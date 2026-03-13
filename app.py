import os
import re
import uuid
import logging
import requests
import bcrypt
from collections import defaultdict
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient, DESCENDING
from bson import ObjectId

from dotenv import load_dotenv
load_dotenv()  

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

# ── App ──
app = Flask(__name__)
app.config['SECRET_KEY']              = os.environ.get('SECRET_KEY', 'dev_key_only_change_in_azure')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE']   = False  # Set True in Azure production

# ── Security ──
talisman = Talisman(app, content_security_policy=None, force_https=False)
csrf     = CSRFProtect(app)

# ── Rate Limiting ──
# Applied only where it matters:
#   /api/translate   → 40/min  (hits Azure paid API)
#   /login           → 20/hr   (brute-force protection)
#   /register        → 10/hr   (prevent mass account creation)
#   /change-password → 10/hr   (prevent automated cycling)
# Journal + Board routes have NO limits — MongoDB only, no external API cost.
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://"
)

# ── MongoDB ──
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    logging.error("MONGO_URI not set — database will not connect!")

_mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
_db           = _mongo_client["db_webpage"]
accounts      = _db["account"]
journal_col   = _db["journal"]
board_tasks_col   = _db["board_tasks"]
board_archive_col = _db["board_archive"]

# Indexes (idempotent — safe to run on every startup)
accounts.create_index("username", unique=True)
journal_col.create_index([("user_id", 1), ("date", DESCENDING)])
board_tasks_col.create_index([("user_id", 1), ("created_at", DESCENDING)])
board_archive_col.create_index([("user_id", 1), ("week_start", DESCENDING)])

# ── Azure Translator ──
AZURE_KEY      = os.environ.get("AZURE_TRANSLATOR_KEY")
AZURE_LOCATION = os.environ.get("AZURE_TRANSLATOR_LOCATION")
AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"
LANGUAGES      = ['en', 'fi', 'vi', 'zh-Hans']

if not AZURE_KEY:
    logging.error("AZURE_TRANSLATOR_KEY not set — translation will fail!")
if not AZURE_LOCATION:
    logging.error("AZURE_TRANSLATOR_LOCATION not set — translation will fail!")

_AZURE_HEADERS_BASE = {
    "Ocp-Apim-Subscription-Key":    AZURE_KEY or "",
    "Ocp-Apim-Subscription-Region": AZURE_LOCATION or "",
    "Content-Type":                  "application/json",
}

# ── Journal Feelings ──
FEELINGS = [
    {"emoji": "🤩", "word": "Excited",    "score": 7},
    {"emoji": "😊", "word": "Happy",      "score": 6},
    {"emoji": "😌", "word": "Calm",       "score": 5},
    {"emoji": "😐", "word": "Neutral",    "score": 4},
    {"emoji": "😴", "word": "Tired",      "score": 3},
    {"emoji": "😔", "word": "Sad",        "score": 2},
    {"emoji": "😰", "word": "Anxious",    "score": 2},
    {"emoji": "😤", "word": "Frustrated", "score": 1},
]
_FEELING_SCORES = {f["word"]: f["score"] for f in FEELINGS}

# ── Flask-Login ──
login_manager = LoginManager(app)
login_manager.login_view = 'login'


class User(UserMixin):
    def __init__(self, doc):
        self.id       = str(doc["_id"])
        self.username = doc["username"]

    @staticmethod
    def find_by_username(username):
        return accounts.find_one({"username": username})

    @staticmethod
    def find_by_id(user_id):
        try:
            return accounts.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None


@login_manager.user_loader
def load_user(user_id):
    doc = User.find_by_id(user_id)
    return User(doc) if doc else None


# ── Validators ──
_USERNAME_RE   = re.compile(r'^[a-zA-Z0-9_]+$')
_SPECIAL_CHARS = re.compile(r'[!@#$%^&*(),.?":{}|<>_\-\[\]\/\\]')

def validate_username(username):
    errors = []
    if len(username) < 3:
        errors.append("at least 3 characters")
    if len(username) > 30:
        errors.append("no more than 30 characters")
    if not _USERNAME_RE.match(username):
        errors.append("only letters, numbers, and underscores")
    return errors

def validate_password(password):
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r'[A-Z]', password):
        errors.append("one uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("one lowercase letter")
    if not re.search(r'\d', password):
        errors.append("one number")
    if not _SPECIAL_CHARS.search(password):
        errors.append("one special character (!@#$%^&* etc.)")
    return errors


# ── Translation helper ──
def translate(text, to_lang, from_lang=None):
    params = {"api-version": "3.0", "to": to_lang}
    if from_lang:
        params["from"] = from_lang
    if to_lang == "zh-Hans":
        params["toScript"] = "Latn"

    headers  = {**_AZURE_HEADERS_BASE, "X-ClientTraceId": str(uuid.uuid4())}
    response = requests.post(
        AZURE_ENDPOINT, params=params, headers=headers,
        json=[{"text": text}], timeout=10
    )
    response.raise_for_status()
    result = response.json()[0]["translations"][0]

    if to_lang == "zh-Hans" and "transliteration" in result:
        return f"{result['text']}\n{result['transliteration']['text']}"
    return result["text"]


# ── Error Handlers ──
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests — please wait a moment."}), 429

@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404

@app.errorhandler(500)
def server_error(e):
    logging.error(f"500 error: {e}")
    return jsonify({"error": "Internal server error."}), 500


# ──────────────────────────────────────────────
# AUTH ROUTES
# ──────────────────────────────────────────────

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit("10 per hour")
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        confirm  = request.form.get('confirm_password', '').strip()

        errs = validate_username(username)
        if errs:
            flash('Username: ' + ', '.join(errs), 'error')
            return render_template('register.html', username=username)

        errs = validate_password(password)
        if errs:
            flash('Password must have: ' + ', '.join(errs), 'error')
            return render_template('register.html', username=username)

        if password != confirm:
            flash('Passwords do not match.', 'error')
            return render_template('register.html', username=username)

        if User.find_by_username(username):
            flash('Username already taken.', 'error')
            return render_template('register.html')

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        accounts.insert_one({"username": username, "password": hashed})
        logging.info(f"New account: {username}")
        flash('Account created! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("20 per hour")
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        user_doc = User.find_by_username(username)

        if user_doc and bcrypt.checkpw(password.encode(), user_doc['password']):
            login_user(User(user_doc))
            logging.info(f"Login: {username}")
            return redirect(url_for('home'))

        flash('Invalid username or password.', 'error')

    return render_template('login.html')


@app.route('/logout')
def logout():
    if current_user.is_authenticated:
        logging.info(f"Logout: {current_user.username}")
    logout_user()
    return redirect(url_for('login'))


@app.route('/change-password', methods=['GET', 'POST'])
@login_required
@limiter.limit("10 per hour")
def change_password():
    if request.method == 'POST':
        current_pw = request.form.get('current_password', '').strip()
        new_pw     = request.form.get('new_password', '').strip()
        confirm_pw = request.form.get('confirm_password', '').strip()

        user_doc = User.find_by_id(current_user.id)
        if not user_doc or not bcrypt.checkpw(current_pw.encode(), user_doc['password']):
            flash('Current password is incorrect.', 'error')
            return render_template('change_password.html')

        errs = validate_password(new_pw)
        if errs:
            flash('New password must have: ' + ', '.join(errs), 'error')
            return render_template('change_password.html')

        if new_pw != confirm_pw:
            flash('New passwords do not match.', 'error')
            return render_template('change_password.html')

        if new_pw == current_pw:
            flash('New password must be different from current.', 'error')
            return render_template('change_password.html')

        hashed = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt())
        accounts.update_one(
            {"_id": ObjectId(current_user.id)},
            {"$set": {"password": hashed}}
        )
        logging.info(f"Password changed: {current_user.username}")
        flash('Password updated! 🔑', 'success')
        return redirect(url_for('home'))

    return render_template('change_password.html')


# ──────────────────────────────────────────────
# MAIN ROUTES
# ──────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/translate', methods=['POST'])
@limiter.limit("40 per minute")
def api_translate():
    try:
        body        = request.get_json(silent=True) or {}
        source_text = body.get("text", "").strip()
        source_lang = body.get("source_lang", "").strip()

        if not source_text or not source_lang:
            return jsonify({"error": "Missing text or source language."}), 400

        if len(source_text) > 5000:
            return jsonify({"error": "Text too long (max 5000 characters)."}), 400

        results = {}
        for lang in LANGUAGES:
            if lang != source_lang:
                results[lang] = translate(source_text, from_lang=source_lang, to_lang=lang)

        logging.info(f"Translated {len(source_text)} chars from {source_lang}")
        return jsonify(results)

    except requests.HTTPError as e:
        logging.error(f"Azure HTTP error: {e}")
        return jsonify({"error": "Translation service error. Please try again."}), 502
    except Exception as e:
        logging.error(f"Translation failed: {e}")
        return jsonify({"error": "Translation unavailable. Please try again."}), 500


# ──────────────────────────────────────────────
# JOURNAL ROUTES
# ──────────────────────────────────────────────

@app.route('/journal')
@login_required
def journal():
    tab     = request.args.get('tab', 'write')
    entries = list(journal_col.find(
        {"user_id": current_user.id},
        sort=[("date", DESCENDING)]
    ))
    for e in entries:
        if isinstance(e.get('date'), datetime):
            e['date_str'] = e['date'].strftime('%B %d, %Y')
        e['_id'] = str(e['_id'])

    return render_template('journal.html',
        tab=tab,
        entries=entries,
        feelings=FEELINGS,
        today=datetime.today().strftime('%Y-%m-%d')
    )


@app.route('/journal/new', methods=['POST'])
@login_required
def journal_new():
    date_str   = request.form.get('date', '').strip()
    feeling    = request.form.get('feeling', '').strip()
    challenged = request.form.get('challenged', '').strip()
    reflect    = request.form.get('reflect', '').strip()

    if not date_str or not feeling or not reflect:
        flash('Please fill in all required fields.', 'error')
        return redirect(url_for('journal', tab='write'))

    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        flash('Invalid date.', 'error')
        return redirect(url_for('journal', tab='write'))

    feeling_word = feeling.split(' ', 1)[-1].strip()
    score        = _FEELING_SCORES.get(feeling_word, 4)

    journal_col.insert_one({
        "user_id":    current_user.id,
        "date":       date_obj,
        "feeling":    feeling,
        "score":      score,
        "challenged": challenged,
        "reflect":    reflect,
        "created_at": datetime.now()
    })
    logging.info(f"Journal entry saved: {current_user.username}")
    flash('Entry saved! 🌿', 'success')
    return redirect(url_for('journal', tab='entries'))


@app.route('/journal/delete/<entry_id>', methods=['POST'])
@login_required
def journal_delete(entry_id):
    try:
        result = journal_col.delete_one({
            "_id":     ObjectId(entry_id),
            "user_id": current_user.id
        })
        if result.deleted_count:
            flash('Entry deleted.', 'success')
    except Exception as e:
        logging.error(f"Delete error: {e}")
        flash('Could not delete entry.', 'error')
    return redirect(url_for('journal', tab='entries'))


@app.route('/journal/chart-data')
@login_required
def journal_chart_data():
    entries = journal_col.find(
        {"user_id": current_user.id},
        {"date": 1, "score": 1, "feeling": 1, "reflect": 1}
    )
    data = []
    for e in entries:
        if isinstance(e.get('date'), datetime):
            data.append({
                "date":    e['date'].strftime('%Y-%m-%d'),
                "score":   e.get('score', 4),
                "feeling": e.get('feeling', ''),
                "reflect": e.get('reflect', ''),
            })
    return jsonify(data)


# ──────────────────────────────────────────────
# BOARD ROUTES
# ──────────────────────────────────────────────

def _get_week_start(dt=None):
    """Return the Monday 00:00:00 of the week containing dt (or now)."""
    d = (dt or datetime.now()).date()
    return datetime.combine(d - timedelta(days=d.weekday()), datetime.min.time())


def _maybe_archive(user_id):
    """
    On Mondays: move last week's Done tasks into the archive collection.
    Idempotent — safe to call on every board load.
    """
    now        = datetime.now()
    week_start = _get_week_start(now)

    if now.weekday() != 0:   # 0 = Monday
        return

    done_tasks = list(board_tasks_col.find({
        "user_id":    user_id,
        "column":     "done",
        "created_at": {"$lt": week_start}
    }))

    if not done_tasks:
        return

    by_week = defaultdict(list)
    for t in done_tasks:
        ws = _get_week_start(t["created_at"])
        by_week[ws].append(t)

    for ws, week_tasks in by_week.items():
        sun   = ws + timedelta(days=6)
        fmt   = lambda d: d.strftime('%b %d').replace(' 0', ' ')
        label = f"{fmt(ws)} – {fmt(sun)}"

        board_archive_col.update_one(
            {"user_id": user_id, "week_start": ws},
            {
                "$set":  {"week_label": label},
                "$push": {"tasks": {"$each": [
                    {"title": t["title"], "archived_at": now}
                    for t in week_tasks
                ]}}
            },
            upsert=True
        )

    ids = [t["_id"] for t in done_tasks]
    board_tasks_col.delete_many({"_id": {"$in": ids}})
    logging.info(f"Archived {len(done_tasks)} done tasks for {user_id}")


@app.route('/board')
@login_required
def board():
    return render_template('board.html')


@app.route('/board/data')
@login_required
def board_data():
    _maybe_archive(current_user.id)

    tasks = list(board_tasks_col.find(
        {"user_id": current_user.id},
        sort=[("created_at", 1)]
    ))
    for t in tasks:
        t['_id']        = str(t['_id'])
        t['created_at'] = t['created_at'].isoformat() if isinstance(t.get('created_at'), datetime) else ''
        # Ensure new optional fields are always present with defaults
        t.setdefault('priority', 0)
        t.setdefault('due_date', None)
        t.setdefault('due_time', None)

    archives = list(board_archive_col.find(
        {"user_id": current_user.id},
        {"week_label": 1, "tasks": 1},
        sort=[("week_start", 1)]
    ))
    for a in archives:
        a['_id'] = str(a['_id'])

    return jsonify(tasks=tasks, archives=archives)


@app.route('/board/task', methods=['POST'])
@login_required
def board_task_create():
    body   = request.get_json(silent=True) or {}
    title  = body.get('title', '').strip()[:120]
    column = body.get('column', 'todo')

    if not title:
        return jsonify(error="Title required"), 400
    if column not in ('todo', 'inprogress', 'done'):
        return jsonify(error="Invalid column"), 400

    priority = body.get('priority', 0)
    due_date = body.get('due_date') or None   # 'YYYY-MM-DD' string or None
    due_time = body.get('due_time') or None   # 'HH:MM' string or None

    if priority not in (0, 1, 2, 3):
        priority = 0

    now = datetime.now()
    doc = {
        "user_id":    current_user.id,
        "title":      title,
        "column":     column,
        "priority":   priority,
        "due_date":   due_date,
        "due_time":   due_time,
        "created_at": now,
        "updated_at": now,
    }
    result        = board_tasks_col.insert_one(doc)
    doc['_id']        = str(result.inserted_id)
    doc['created_at'] = now.isoformat()
    doc['updated_at'] = now.isoformat()
    logging.info(f"Board task created: '{title}' [{column}] by {current_user.username}")
    return jsonify(doc), 201


@app.route('/board/task/<task_id>', methods=['PATCH'])
@login_required
def board_task_update(task_id):
    body    = request.get_json(silent=True) or {}
    updates = {}

    if 'title' in body:
        title = body['title'].strip()[:120]
        if title:
            updates['title'] = title

    if 'column' in body:
        col = body['column']
        if col in ('todo', 'inprogress', 'done'):
            updates['column'] = col

    if 'priority' in body:
        p = body['priority']
        if p in (0, 1, 2, 3):
            updates['priority'] = p

    if 'due_date' in body:
        updates['due_date'] = body['due_date'] or None

    if 'due_time' in body:
        updates['due_time'] = body['due_time'] or None

    if not updates:
        return jsonify(error="Nothing to update"), 400

    updates['updated_at'] = datetime.now()
    result = board_tasks_col.update_one(
        {"_id": ObjectId(task_id), "user_id": current_user.id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        return jsonify(error="Task not found"), 404

    return jsonify(ok=True)


@app.route('/board/task/<task_id>', methods=['DELETE'])
@login_required
def board_task_delete(task_id):
    try:
        result = board_tasks_col.delete_one(
            {"_id": ObjectId(task_id), "user_id": current_user.id}
        )
        if result.deleted_count == 0:
            return jsonify(error="Task not found"), 404
        logging.info(f"Board task deleted: {task_id} by {current_user.username}")
        return jsonify(ok=True)
    except Exception as e:
        logging.error(f"Board delete error: {e}")
        return jsonify(error="Could not delete task"), 500




@app.route('/board/task/<task_id>/archive', methods=['POST'])
@login_required
def board_task_manual_archive(task_id):
    """Manually archive a single active task into the current week's archive entry."""
    try:
        task = board_tasks_col.find_one(
            {"_id": ObjectId(task_id), "user_id": current_user.id}
        )
        if not task:
            return jsonify(error="Task not found"), 404

        now        = datetime.now()
        ws         = _get_week_start(now)
        sun        = ws + timedelta(days=6)
        fmt        = lambda d: d.strftime('%b %d').replace(' 0', ' ')
        label      = f"{fmt(ws)} – {fmt(sun)}"

        board_archive_col.update_one(
            {"user_id": current_user.id, "week_start": ws},
            {
                "$set":  {"week_label": label},
                "$push": {"tasks": {"title": task["title"], "archived_at": now}}
            },
            upsert=True
        )
        board_tasks_col.delete_one({"_id": ObjectId(task_id)})
        logging.info(f"Manual archive: '{task['title']}' by {current_user.username}")
        return jsonify(ok=True)
    except Exception as e:
        logging.error(f"Manual archive error: {e}")
        return jsonify(error="Could not archive task"), 500


@app.route('/board/archive/delete', methods=['POST'])
@login_required
def board_archive_delete():
    """Bulk-delete archived weeks: scope = 'week' | 'month' | 'all'."""
    body  = request.get_json(silent=True) or {}
    scope = body.get('scope', 'all')

    now = datetime.now()
    if scope == 'all':
        cutoff = None
    elif scope == 'month':
        cutoff = _get_week_start(now - timedelta(days=30))
    elif scope == 'week':
        cutoff = _get_week_start(now - timedelta(days=7))
    else:
        return jsonify(error="Invalid scope"), 400

    query = {"user_id": current_user.id}
    if cutoff:
        query["week_start"] = {"$lt": cutoff}

    result = board_archive_col.delete_many(query)
    logging.info(f"Bulk archive delete ({scope}): {result.deleted_count} weeks for {current_user.username}")
    return jsonify(ok=True, deleted=result.deleted_count)

# ──────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────

@app.route('/healthz')
@talisman(force_https=False)
def health_check():
    try:
        _mongo_client.admin.command('ping')
        if not AZURE_KEY or not AZURE_LOCATION:
            raise RuntimeError("Azure credentials not configured")
        return jsonify(status="healthy", database="connected", translator="configured"), 200
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return jsonify(status="unhealthy", reason=str(e)), 500


# ──────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────

if __name__ == '__main__':
    port       = int(os.environ.get("PORT", 8000))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logging.info(f"Starting In In on port {port} (debug={debug_mode})")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
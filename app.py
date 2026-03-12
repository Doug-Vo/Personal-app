import os
import re
import uuid
import logging
import requests
import bcrypt
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient, DESCENDING
from bson import ObjectId

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
#   /api/translate  → 40/min  (hits Azure paid API)
#   /login          → 20/hr   (brute-force protection)
#   /register       → 10/hr   (prevent mass account creation)
#   /change-password→ 10/hr   (prevent automated cycling)
# Journal routes have NO limits — they only write to MongoDB (no external API cost).
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # No global default — explicit per-route only
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

# Indexes (idempotent — safe to run on every startup)
accounts.create_index("username", unique=True)
journal_col.create_index([("user_id", 1), ("date", DESCENDING)])

# ── Azure Translator ──
AZURE_KEY      = os.environ.get("AZURE_TRANSLATOR_KEY")
AZURE_LOCATION = os.environ.get("AZURE_TRANSLATOR_LOCATION")
AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"
LANGUAGES      = ['en', 'fi', 'vi', 'zh-Hans']

if not AZURE_KEY:
    logging.error("AZURE_TRANSLATOR_KEY not set — translation will fail!")
if not AZURE_LOCATION:
    logging.error("AZURE_TRANSLATOR_LOCATION not set — translation will fail!")

# Pre-built static headers (UUID injected per-request)
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
# Pre-built lookup so we don't scan the list on every journal submission
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
# JOURNAL ROUTES  (no rate limits — MongoDB only, no external API cost)
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
        "created_at": datetime.utcnow()
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
            "user_id": current_user.id  # users can only delete their own entries
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
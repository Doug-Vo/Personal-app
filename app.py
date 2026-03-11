import os
import logging
import requests
import uuid
import re
import bcrypt
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from pymongo import MongoClient
from bson import ObjectId

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_only_change_in_azure')

# Security Config
talisman = Talisman(app, content_security_policy=None, force_https=False)
app.config['SESSION_COOKIE_SECURE'] = False  # Set True in Azure production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# CSRF Protection
csrf = CSRFProtect(app)

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# ── MongoDB ──
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    logging.error("MONGO_URI not found in environment variables!")

client = MongoClient(MONGO_URI)
db_webpage = client["db_webpage"]
accounts = db_webpage["account"]

# Ensure unique index on username
accounts.create_index("username", unique=True)

# ── Azure Translator ──
AZURE_KEY = os.environ.get("AZURE_TRANSLATOR_KEY")
AZURE_LOCATION = os.environ.get("AZURE_TRANSLATOR_LOCATION")
AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com/"

if not AZURE_KEY:
    logging.error("AZURE_TRANSLATOR_KEY not found in environment variables!")
if not AZURE_LOCATION:
    logging.error("AZURE_TRANSLATOR_LOCATION not found in environment variables!")

LANGUAGES = ['en', 'fi', 'vi', 'zh-Hans']

# ── Flask-Login ──
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


class User(UserMixin):
    def __init__(self, user_doc):
        self.id = str(user_doc["_id"])
        self.username = user_doc["username"]

    @staticmethod
    def find_by_username(username):
        return accounts.find_one({"username": username})

    @staticmethod
    def find_by_id(user_id):
        return accounts.find_one({"_id": ObjectId(user_id)})


@login_manager.user_loader
def load_user(user_id):
    user_doc = User.find_by_id(user_id)
    if user_doc:
        return User(user_doc)
    return None


# ── Password Validation ──
def validate_password(password):
    """
    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    errors = []
    if len(password) < 8:
        errors.append("At least 8 characters")
    if not re.search(r'[A-Z]', password):
        errors.append("At least one uppercase letter")
    if not re.search(r'[a-z]', password):
        errors.append("At least one lowercase letter")
    if not re.search(r'\d', password):
        errors.append("At least one number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-\[\]\/\\]', password):
        errors.append("At least one special character (!@#$%^&* etc.)")
    return errors


def validate_username(username):
    errors = []
    if len(username) < 3:
        errors.append("At least 3 characters")
    if len(username) > 30:
        errors.append("No more than 30 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        errors.append("Only letters, numbers, and underscores")
    return errors


# ── Translation ──
def translate(text, to_lang, from_lang=None):
    try:
        url = f"{AZURE_ENDPOINT}translate"
        params = {"api-version": "3.0", "to": to_lang}
        if from_lang:
            params["from"] = from_lang
        if to_lang == "zh-Hans":
            params["toScript"] = "Latn"

        headers = {
            "Ocp-Apim-Subscription-Key": AZURE_KEY,
            "Ocp-Apim-Subscription-Region": AZURE_LOCATION,
            "Content-Type": "application/json",
            "X-ClientTraceId": str(uuid.uuid4())
        }
        response = requests.post(url, params=params, headers=headers, json=[{"text": text}])
        response.raise_for_status()
        result = response.json()[0]["translations"][0]

        if to_lang == "zh-Hans" and "transliteration" in result:
            return f"{result['text']}\n{result['transliteration']['text']}"

        return result["text"]

    except Exception as e:
        logging.error(f"Translation error ({from_lang} -> {to_lang}): {e}")
        raise


# ── Error Handlers ──
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "You are translating too fast! Please wait a moment before trying again."}), 429


# ── Auth Routes ──
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        confirm  = request.form.get('confirm_password', '').strip()

        # Validate username
        username_errors = validate_username(username)
        if username_errors:
            flash({'type': 'error', 'message': 'Username issues: ' + ', '.join(username_errors)})
            return render_template('register.html', username=username)

        # Validate password
        password_errors = validate_password(password)
        if password_errors:
            flash({'type': 'error', 'message': 'Password must have: ' + ', '.join(password_errors)})
            return render_template('register.html', username=username)

        # Confirm passwords match
        if password != confirm:
            flash({'type': 'error', 'message': 'Passwords do not match.'})
            return render_template('register.html', username=username)

        # Check username not taken
        if User.find_by_username(username):
            flash({'type': 'error', 'message': 'Username already taken.'})
            return render_template('register.html')

        # Hash password and save
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        accounts.insert_one({
            "username": username,
            "password": hashed
        })
        logging.info(f"New account registered: {username}")
        flash({'type': 'success', 'message': 'Account created! Please log in.'})
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        user_doc = User.find_by_username(username)

        if user_doc and bcrypt.checkpw(password.encode('utf-8'), user_doc['password']):
            user = User(user_doc)
            login_user(user)
            logging.info(f"User logged in: {username}")
            return redirect(url_for('home'))
        else:
            flash({'type': 'error', 'message': 'Invalid username or password.'})

    return render_template('login.html')


@app.route('/logout')
def logout():
    logging.info(f"User logged out: {current_user.username if current_user.is_authenticated else 'unknown'}")
    logout_user()
    return redirect(url_for('login'))


# ── Main Routes ──
@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/translate', methods=['POST'])
@limiter.limit("40 per minute")
def api_translate():
    try:
        query = request.get_json()
        original_text = query.get("text")
        source_lang = query.get("source_lang")

        if not original_text or not source_lang:
            return jsonify({"error": "Missing Data!"}), 400

        results = {}
        for lang in LANGUAGES:
            if lang != source_lang:
                translated = translate(original_text, from_lang=source_lang, to_lang=lang)
                results[lang] = translated
                logging.info(f"Translated '{original_text}' ({source_lang}) -> '{translated}' ({lang})")

        return jsonify(results)

    except Exception as e:
        logging.error(f"Translation request failed: {e}")
        return jsonify({"error": "Translation service unavailable. Please try again."}), 500


@app.route('/healthz', methods=['GET'])
@talisman(force_https=False)
def health_check():
    try:
        client.admin.command('ping')
        if not AZURE_KEY or not AZURE_LOCATION:
            raise Exception("Azure Translator credentials not configured")
        return jsonify(status="healthy", database="connected", translator="configured"), 200
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return jsonify(status="unhealthy", reason=str(e)), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logging.info(f"Starting app on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
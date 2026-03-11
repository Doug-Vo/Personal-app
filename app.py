import os
import requests, uuid
import time
from flask import Flask, render_template, request, jsonify
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


app = Flask(__name__)

key = os.environ.get("AZURE_TRANSLATOR_KEY")
location = os.environ.get("AZURE_TRANSLATOR_LOCATION")
endpoint = "https://api.cognitive.microsofttranslator.com/"

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-this')

# Security Config
# Force HTTPS and set security headers later in Azure

Talisman(app, content_security_policy=None, force_https = False)

# Enable CSRF Protection
csrf = CSRFProtect(app)

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Custom Error Handler for Rate Limiting
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "You are translating too fast! Please wait a moment before trying again."
    }), 429


def translate(text, to_lang, from_lang=None):
    url = f"{endpoint}translate"
    params = {
        "api-version": "3.0",
        "to": to_lang,
    }
    if from_lang:
        params["from"] = from_lang
    
    # Request transliteration when translating to Mandarin
    if to_lang == "zh-Hans":
        params["toScript"] = "Latn"  # Latin alphabet (Pinyin)

    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": location,
        "Content-Type": "application/json",
        "X-ClientTraceId": str(uuid.uuid4())
    }
    body = [{"text": text}]
    response = requests.post(url, params=params, headers=headers, json=body)
    result = response.json()[0]["translations"][0]

    # Return both characters and pinyin if translating to Mandarin
    if to_lang == "zh-Hans" and "transliteration" in result:
        chinese = result["text"]
        pinyin = result["transliteration"]["text"]
        return f"{chinese}\n{pinyin}"  # e.g. "你好\nnǐ hǎo"
    
    return result["text"]

@app.route('/', methods=['GET'])
def home():    
    return render_template('index.html')

@app.route('/api/translate', methods=['POST'])
@limiter.limit("40 per minute") # UPDATED: Increased to 40
def api_translate():
    query = request.get_json()
    
    original_text = query.get("text")
    source_lang = query.get("source_lang")

    if not original_text or not source_lang:
        return jsonify({"error": "Missing Data!"}), 400

    results = {}
    languages = ['en', 'fi', 'vi', 'zh-Hans']

    for lang in languages:
        if lang != source_lang:
            translated = translate(original_text, from_lang= source_lang,to_lang= lang)
            results[lang] = translated
            logging.info(f"Translated '{original_text}' ({source_lang}) -> '{translated}' ({lang})\n")

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
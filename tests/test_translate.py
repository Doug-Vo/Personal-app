"""Translation API tests: POST /api/translate (Azure is mocked)."""
import json
import pytest
from unittest.mock import patch, MagicMock


def _mock_azure(text, transliteration=None):
    """Build the fake Azure Translator JSON response."""
    translation = {"text": text}
    if transliteration:
        translation["transliteration"] = {"text": transliteration}
    return MagicMock(
        status_code=200,
        json=lambda: [{"translations": [translation]}],
        raise_for_status=lambda: None,
    )


def _translate(client, text, source_lang):
    return client.post("/api/translate",
                       data=json.dumps({"text": text, "source_lang": source_lang}),
                       content_type="application/json")


# ── Auth guard ────────────────────────────────────────────────────────────────

def test_translate_unauthenticated_redirects(client):
    resp = _translate(client, "hello", "en")
    assert resp.status_code == 302
    assert "login" in resp.headers["Location"]


# ── Happy path ────────────────────────────────────────────────────────────────

def test_translate_returns_all_target_languages(auth_client):
    with patch("app.requests.post", return_value=_mock_azure("bonjour")) as mock_post:
        resp = _translate(auth_client, "hello", "en")
    assert resp.status_code == 200
    data = resp.get_json()
    # en is the source; fi, vi, zh-Hans should be present
    assert "fi" in data
    assert "vi" in data
    assert "zh-Hans" in data
    assert "en" not in data  # source language excluded


def test_translate_zh_hans_returns_two_line_format(auth_client):
    # Azure returns characters + Pinyin for zh-Hans when toScript=Latn is requested
    with patch("app.requests.post", return_value=_mock_azure("你好", transliteration="Nǐ hǎo")):
        resp = _translate(auth_client, "hello", "en")
    assert resp.status_code == 200
    zh = resp.get_json()["zh-Hans"]
    assert "\n" in zh
    lines = zh.split("\n")
    assert lines[0] == "你好"
    assert lines[1] == "Nǐ hǎo"


# ── Input validation ──────────────────────────────────────────────────────────

def test_translate_missing_text_returns_400(auth_client):
    resp = auth_client.post("/api/translate",
                            data=json.dumps({"source_lang": "en"}),
                            content_type="application/json")
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_translate_missing_source_lang_returns_400(auth_client):
    resp = auth_client.post("/api/translate",
                            data=json.dumps({"text": "hello"}),
                            content_type="application/json")
    assert resp.status_code == 400


def test_translate_unsupported_language_returns_400(auth_client):
    resp = _translate(auth_client, "hello", "de")
    assert resp.status_code == 400
    assert "Unsupported" in resp.get_json()["error"]


def test_translate_text_too_long_returns_400(auth_client):
    resp = _translate(auth_client, "x" * 5001, "en")
    assert resp.status_code == 400
    assert "too long" in resp.get_json()["error"]


# ── Azure error handling ──────────────────────────────────────────────────────

def test_translate_azure_http_error_returns_502(auth_client):
    import requests as req
    error_resp = MagicMock()
    error_resp.raise_for_status.side_effect = req.HTTPError("503")
    with patch("app.requests.post", return_value=error_resp):
        resp = _translate(auth_client, "hello", "en")
    assert resp.status_code == 502

"""YKI route tests: question fetch, prefs, notes, and cross-user isolation."""
import json
import app as _app_module
from tests.conftest import get_user_id


def _post_json(client, url, body):
    return client.post(url, data=json.dumps(body), content_type="application/json")


# ── Auth guards ───────────────────────────────────────────────────────────────

def test_yki_question_unauthenticated_redirects(client):
    resp = _post_json(client, "/api/yki/question", {"category": "Kertominen"})
    assert resp.status_code == 302
    assert "login" in resp.headers["Location"]


def test_yki_prefs_get_unauthenticated_redirects(client):
    resp = client.get("/api/yki/prefs")
    assert resp.status_code == 302


def test_yki_notes_get_unauthenticated_redirects(client):
    resp = client.get("/api/yki/notes?question=test")
    assert resp.status_code == 302


# ── POST /api/yki/question ────────────────────────────────────────────────────

def test_yki_question_invalid_category_returns_400(auth_client):
    resp = _post_json(auth_client, "/api/yki/question", {"category": "Invalid"})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_yki_question_no_matching_docs_returns_404(auth_client):
    # yki_col is empty (clean_db wiped it)
    resp = _post_json(auth_client, "/api/yki/question", {"category": "Kertominen"})
    assert resp.status_code == 404
    assert resp.get_json()["error"] == "No questions found"


def test_yki_question_returns_question_fields(auth_client):
    _app_module.yki_col.insert_one({
        "Category":                                      "Kertominen",
        "Topic":                                         "Arkielämä",
        "Main question":                                 "Kerro arjestasi.",
        "Translation of the main question in English":   "Tell about your daily life.",
        "Hint":                                          "Mitä teet aamulla?",
        "Translation of the hint":                       "What do you do in the morning?",
    })
    resp = _post_json(auth_client, "/api/yki/question", {
        "category": "Kertominen",
        "topic":    "Arkielämä",
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["question"] == "Kerro arjestasi."
    assert data["translation"] == "Tell about your daily life."
    assert data["hint"] == "Mitä teet aamulla?"
    assert data["hint_translation"] == "What do you do in the morning?"
    assert data["topic"] == "Arkielämä"
    assert data["category"] == "Kertominen"


def test_yki_question_random_topic_returns_any_question(auth_client):
    _app_module.yki_col.insert_many([
        {"Category": "Mielipide", "Topic": "Terveys ja hyvinvointi",
         "Main question": "Q1", "Translation of the main question in English": "T1",
         "Hint": "", "Translation of the hint": ""},
        {"Category": "Mielipide", "Topic": "Vapaa-aika",
         "Main question": "Q2", "Translation of the main question in English": "T2",
         "Hint": "", "Translation of the hint": ""},
    ])
    # No topic supplied → random pick from all Mielipide questions
    resp = _post_json(auth_client, "/api/yki/question", {"category": "Mielipide"})
    assert resp.status_code == 200
    assert resp.get_json()["question"] in ("Q1", "Q2")


# ── GET/POST /api/yki/prefs ───────────────────────────────────────────────────

def test_yki_prefs_get_returns_defaults(auth_client):
    resp = auth_client.get("/api/yki/prefs")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["volume"] == 0.5
    assert data["muted"] is False


def test_yki_prefs_set_and_get_roundtrip(auth_client):
    _post_json(auth_client, "/api/yki/prefs", {"volume": 0.8, "muted": True})
    resp = auth_client.get("/api/yki/prefs")
    data = resp.get_json()
    assert data["volume"] == 0.8
    assert data["muted"] is True


def test_yki_prefs_volume_out_of_range_ignored(auth_client):
    _post_json(auth_client, "/api/yki/prefs", {"volume": 1.5})  # invalid
    resp = auth_client.get("/api/yki/prefs")
    # Volume should not have been updated from the default
    assert resp.get_json()["volume"] == 0.5


# ── GET/POST /api/yki/notes ───────────────────────────────────────────────────

def test_yki_notes_save_and_retrieve(auth_client):
    question = "Kerro arjestasi."
    _post_json(auth_client, "/api/yki/notes", {
        "question": question,
        "notes":    "My practice notes here.",
    })
    resp = auth_client.get(f"/api/yki/notes?question={question}")
    assert resp.status_code == 200
    assert resp.get_json()["notes"] == "My practice notes here."


def test_yki_notes_missing_question_returns_400(auth_client):
    resp = _post_json(auth_client, "/api/yki/notes", {"notes": "Some notes"})
    assert resp.status_code == 400


def test_yki_notes_get_empty_question_returns_empty(auth_client):
    resp = auth_client.get("/api/yki/notes?question=nonexistent")
    assert resp.status_code == 200
    assert resp.get_json()["notes"] == ""


def test_yki_notes_cross_user_isolation(auth_client, other_client):
    question = "Shared question text."
    # user_a saves notes
    _post_json(auth_client, "/api/yki/notes", {"question": question, "notes": "user_a notes"})
    # user_b saves different notes for the same question
    _post_json(other_client, "/api/yki/notes", {"question": question, "notes": "user_b notes"})

    # Each user sees only their own notes
    resp_a = auth_client.get(f"/api/yki/notes?question={question}")
    resp_b = other_client.get(f"/api/yki/notes?question={question}")
    assert resp_a.get_json()["notes"] == "user_a notes"
    assert resp_b.get_json()["notes"] == "user_b notes"


def test_yki_notes_truncated_at_2000_chars(auth_client):
    question = "Long notes question."
    _post_json(auth_client, "/api/yki/notes", {
        "question": question,
        "notes":    "x" * 3000,
    })
    uid = get_user_id("user_a")
    doc = _app_module.yki_notes_col.find_one({"user_id": uid, "question": question})
    assert len(doc["notes"]) == 2000

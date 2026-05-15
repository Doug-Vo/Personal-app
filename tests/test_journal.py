"""Journal route tests: /journal/new, /journal/delete, /journal/chart-data."""
from datetime import datetime
import app as _app_module
from tests.conftest import get_user_id


# ── POST /journal/new ─────────────────────────────────────────────────────────

def test_journal_new_valid_entry_saved(auth_client):
    resp = auth_client.post("/journal/new", data={
        "date":       "2024-06-01",
        "feeling":    "😊 Happy",
        "challenged": "Something hard",
        "reflect":    "I learned a lot today.",
    }, follow_redirects=False)
    assert resp.status_code == 302
    assert "entries" in resp.headers["Location"]
    # Entry exists in DB
    uid = get_user_id("user_a")
    assert _app_module.journal_col.count_documents({"user_id": uid}) == 1


def test_journal_new_missing_feeling_redirects_to_write(auth_client):
    resp = auth_client.post("/journal/new", data={
        "date":    "2024-06-01",
        "reflect": "Some reflection",
        # feeling is missing
    }, follow_redirects=False)
    assert resp.status_code == 302
    assert "write" in resp.headers["Location"]


def test_journal_new_missing_reflect_redirects_to_write(auth_client):
    resp = auth_client.post("/journal/new", data={
        "date":    "2024-06-01",
        "feeling": "😊 Happy",
        # reflect is missing
    }, follow_redirects=False)
    assert resp.status_code == 302
    assert "write" in resp.headers["Location"]


def test_journal_new_invalid_date_format(auth_client):
    resp = auth_client.post("/journal/new", data={
        "date":    "not-a-date",
        "feeling": "😊 Happy",
        "reflect": "Some reflection",
    }, follow_redirects=False)
    assert resp.status_code == 302
    assert "write" in resp.headers["Location"]


def test_journal_new_reflect_truncated_at_2000_chars(auth_client):
    long_text = "x" * 2500
    auth_client.post("/journal/new", data={
        "date":    "2024-06-01",
        "feeling": "😊 Happy",
        "reflect": long_text,
    })
    uid = get_user_id("user_a")
    entry = _app_module.journal_col.find_one({"user_id": uid})
    assert len(entry["reflect"]) == 2000


# ── POST /journal/delete/<id> ─────────────────────────────────────────────────

def test_journal_delete_own_entry(auth_client):
    uid = get_user_id("user_a")
    result = _app_module.journal_col.insert_one({
        "user_id": uid,
        "date":    datetime(2024, 6, 1),
        "feeling": "😊 Happy",
        "score":   6,
        "reflect": "test",
    })
    entry_id = str(result.inserted_id)

    resp = auth_client.post(f"/journal/delete/{entry_id}", follow_redirects=False)
    assert resp.status_code == 302
    assert _app_module.journal_col.find_one({"_id": result.inserted_id}) is None


def test_journal_delete_other_users_entry_does_not_delete(auth_client, other_client):
    # other_client creates an entry
    uid_b = get_user_id("user_b")
    result = _app_module.journal_col.insert_one({
        "user_id": uid_b,
        "date":    datetime(2024, 6, 1),
        "feeling": "😌 Calm",
        "score":   5,
        "reflect": "user_b entry",
    })
    entry_id = str(result.inserted_id)

    # user_a tries to delete it — should silently do nothing
    resp = auth_client.post(f"/journal/delete/{entry_id}", follow_redirects=False)
    assert resp.status_code == 302
    # Entry must still exist
    assert _app_module.journal_col.find_one({"_id": result.inserted_id}) is not None


def test_journal_delete_malformed_id_does_not_crash(auth_client):
    resp = auth_client.post("/journal/delete/not-an-objectid", follow_redirects=False)
    # Route catches exception and redirects — should never 500
    assert resp.status_code == 302


# ── GET /journal/chart-data ───────────────────────────────────────────────────

def test_journal_chart_data_returns_only_own_entries(auth_client, other_client):
    uid_a = get_user_id("user_a")
    uid_b = get_user_id("user_b")

    _app_module.journal_col.insert_many([
        {"user_id": uid_a, "date": datetime(2024, 6, 1), "feeling": "😊 Happy",  "score": 6, "reflect": "a1"},
        {"user_id": uid_a, "date": datetime(2024, 6, 2), "feeling": "😌 Calm",   "score": 5, "reflect": "a2"},
        {"user_id": uid_b, "date": datetime(2024, 6, 1), "feeling": "😐 Neutral", "score": 4, "reflect": "b1"},
    ])

    resp = auth_client.get("/journal/chart-data")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2
    for entry in data:
        assert "score" in entry
        assert "date" in entry


def test_journal_chart_data_empty_for_new_user(auth_client):
    resp = auth_client.get("/journal/chart-data")
    assert resp.status_code == 200
    assert resp.get_json() == []

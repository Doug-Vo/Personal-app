"""
Shared pytest fixtures for the Ỉn Ỉn Flask test suite.

MongoClient is patched with mongomock at module load time — before app.py is
imported — because app.py calls MongoClient() at the top level (not inside a
factory function).  The patch must be started here, outside any fixture, so it
is active when Python executes the `from pymongo import MongoClient` line in
app.py.
"""
import os
import pytest
import mongomock
from unittest.mock import patch

# Set a dummy MONGO_URI so app.py doesn't log an error on import.
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test_db")

# Patch pymongo.MongoClient → mongomock.MongoClient before importing app.
_patcher = patch("pymongo.MongoClient", mongomock.MongoClient)
_patcher.start()

import app as _app_module  # noqa: E402 — must come after the patch


@pytest.fixture(scope="session")
def app():
    _app_module.app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SECRET_KEY": "test-secret-key",
        "RATELIMIT_ENABLED": False,       # disable Flask-Limiter in tests
        "SESSION_COOKIE_SECURE": False,
    })
    yield _app_module.app


@pytest.fixture(autouse=True)
def clean_db():
    """Wipe every collection and reset rate-limit counters before each test."""
    _app_module.accounts.delete_many({})
    _app_module.journal_col.delete_many({})
    _app_module.board_tasks_col.delete_many({})
    _app_module.board_archive_col.delete_many({})
    _app_module.yki_col.delete_many({})
    _app_module.yki_notes_col.delete_many({})
    # Flask-Limiter keeps in-memory counters across requests; reset them so
    # successive tests don't accumulate toward the per-route limits.
    _app_module.limiter.reset()
    yield


@pytest.fixture
def client(app):
    # No 'with' context manager — avoids preserved-context conflicts when two
    # clients are open simultaneously in the same test (auth_client + other_client).
    return app.test_client()


def _register_login(client, username="user_a", password="TestPass1!"):
    """Register then log in; returns the same client (session is now active)."""
    client.post("/register", data={
        "username": username,
        "password": password,
        "confirm_password": password,
    })
    client.post("/login", data={"username": username, "password": password})
    return client


def get_user_id(username):
    """Return the string _id for a registered username (query mongomock directly)."""
    doc = _app_module.accounts.find_one({"username": username})
    return str(doc["_id"]) if doc else None


@pytest.fixture
def auth_client(app):
    """Logged-in test client for 'user_a'."""
    c = app.test_client()
    _register_login(c, "user_a")
    return c


@pytest.fixture
def other_client(app):
    """Logged-in test client for 'user_b' — used in cross-user isolation tests."""
    c = app.test_client()
    _register_login(c, "user_b")
    return c

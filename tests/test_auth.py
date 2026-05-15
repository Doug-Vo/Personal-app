"""Auth route tests: /register, /login, /logout, /change-password."""
import pytest


# ── Registration ──────────────────────────────────────────────────────────────

def test_register_new_user_redirects_to_login(client):
    resp = client.post("/register", data={
        "username": "newuser",
        "password": "TestPass1!",
        "confirm_password": "TestPass1!",
    }, follow_redirects=False)
    assert resp.status_code == 302
    assert "/login" in resp.headers["Location"]


def test_register_duplicate_username_returns_200_with_error(client):
    data = {"username": "dupeuser", "password": "TestPass1!", "confirm_password": "TestPass1!"}
    client.post("/register", data=data)
    resp = client.post("/register", data=data)
    assert resp.status_code == 200
    assert b"already taken" in resp.data


def test_register_password_missing_uppercase(client):
    resp = client.post("/register", data={
        "username": "badpw",
        "password": "testpass1!",  # no uppercase
        "confirm_password": "testpass1!",
    })
    assert resp.status_code == 200
    assert b"uppercase" in resp.data


def test_register_password_too_short(client):
    resp = client.post("/register", data={
        "username": "shortpw",
        "password": "T1!abcd",  # 7 chars
        "confirm_password": "T1!abcd",
    })
    assert resp.status_code == 200
    assert b"8 characters" in resp.data


def test_register_passwords_mismatch(client):
    resp = client.post("/register", data={
        "username": "mismatch",
        "password": "TestPass1!",
        "confirm_password": "TestPass2!",
    })
    assert resp.status_code == 200
    assert b"do not match" in resp.data


def test_register_short_username(client):
    resp = client.post("/register", data={
        "username": "ab",  # < 3 chars
        "password": "TestPass1!",
        "confirm_password": "TestPass1!",
    })
    assert resp.status_code == 200
    assert b"3 characters" in resp.data


# ── Login ─────────────────────────────────────────────────────────────────────

def test_login_valid_credentials_redirects(client):
    client.post("/register", data={
        "username": "loginuser",
        "password": "TestPass1!",
        "confirm_password": "TestPass1!",
    })
    resp = client.post("/login", data={
        "username": "loginuser",
        "password": "TestPass1!",
    }, follow_redirects=False)
    assert resp.status_code == 302


def test_login_wrong_password_returns_200_with_error(client):
    client.post("/register", data={
        "username": "loginuser",
        "password": "TestPass1!",
        "confirm_password": "TestPass1!",
    })
    resp = client.post("/login", data={
        "username": "loginuser",
        "password": "WrongPass9@",
    })
    assert resp.status_code == 200
    assert b"Invalid" in resp.data


def test_login_nonexistent_user_returns_200_with_error(client):
    resp = client.post("/login", data={
        "username": "ghost",
        "password": "TestPass1!",
    })
    assert resp.status_code == 200
    assert b"Invalid" in resp.data


# ── Auth-gated routes redirect to /login ─────────────────────────────────────

@pytest.mark.parametrize("url", [
    "/journal",
    "/board",
    "/summary",
    "/yki",
    "/translator",
    "/change-password",
])
def test_protected_routes_redirect_when_unauthenticated(client, url):
    resp = client.get(url, follow_redirects=False)
    assert resp.status_code == 302
    assert "login" in resp.headers["Location"]


# ── Logout ────────────────────────────────────────────────────────────────────

def test_logout_clears_session(auth_client):
    resp = auth_client.post("/logout", follow_redirects=False)
    assert resp.status_code == 302
    # After logout, a protected route should redirect to login
    resp2 = auth_client.get("/journal", follow_redirects=False)
    assert resp2.status_code == 302
    assert "login" in resp2.headers["Location"]


# ── Change password ───────────────────────────────────────────────────────────

def test_change_password_success(auth_client):
    resp = auth_client.post("/change-password", data={
        "current_password": "TestPass1!",
        "new_password":     "NewPass2@",
        "confirm_password": "NewPass2@",
    }, follow_redirects=False)
    assert resp.status_code == 302


def test_change_password_wrong_current(auth_client):
    resp = auth_client.post("/change-password", data={
        "current_password": "WrongOld9!",
        "new_password":     "NewPass2@",
        "confirm_password": "NewPass2@",
    })
    assert resp.status_code == 200
    assert b"incorrect" in resp.data


def test_change_password_same_as_current(auth_client):
    resp = auth_client.post("/change-password", data={
        "current_password": "TestPass1!",
        "new_password":     "TestPass1!",
        "confirm_password": "TestPass1!",
    })
    assert resp.status_code == 200
    assert b"different" in resp.data

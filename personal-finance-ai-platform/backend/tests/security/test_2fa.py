"""
Test suite for Two-Factor Authentication (2FA) security flow.

Covers:
  1. Login returns 2fa_required status with 2fa_pending scoped token
  2. Correct 2FA code grants full access token
  3. Wrong 2FA code is rejected (400)
  4. 2fa_pending token cannot access protected routes (401)
  5. Full access token can access protected routes
  6. Expired 2fa_pending token is rejected (401)
  7. Access-scoped token cannot call verify-2fa (401)
"""

import os
# Force SQLite BEFORE any app modules are imported so the production
# MySQL engine is never created during test collection.
os.environ["DATABASE_URL"] = "sqlite:///./test_2fa.db"

import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import User
from app.auth import get_password_hash, create_access_token

# ---------------------------------------------------------------------------
# In-memory SQLite test database
# StaticPool ensures every connection shares the SAME in-memory DB so that
# tables created in fixtures are visible to the app's request handlers.
# ---------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function")
def test_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(test_db):
    """Seed a user with a known password."""
    db = TestingSessionLocal()
    user = User(
        email="2fa_user@example.com",
        hashed_password=get_password_hash("SecurePass123"),
        full_name="2FA Test User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def pending_token(test_user):
    """A short-lived token with '2fa_pending' scope (mimics login response)."""
    return create_access_token(
        data={"sub": test_user.email, "scopes": ["2fa_pending"]},
        expires_delta=timedelta(minutes=5),
    )


@pytest.fixture
def access_token(test_user):
    """A full access token (mimics post-2FA verification)."""
    return create_access_token(
        data={"sub": test_user.email, "scopes": ["access"]},
        expires_delta=timedelta(minutes=30),
    )


# ---------------------------------------------------------------------------
# 1. Login returns 2fa_required status
# ---------------------------------------------------------------------------
class TestLoginReturns2FARequired:
    def test_login_issues_pending_token(self, test_user):
        """After valid credentials, login should return status='2fa_required'."""
        response = client.post(
            "/api/auth/login",
            data={"username": "2fa_user@example.com", "password": "SecurePass123"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "2fa_required"
        assert body["token_type"] == "bearer"
        assert "access_token" in body

    def test_login_wrong_password_rejected(self, test_user):
        """Invalid credentials should be rejected before the 2FA step."""
        response = client.post(
            "/api/auth/login",
            data={"username": "2fa_user@example.com", "password": "WrongPassword"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# 2. Correct 2FA code → full access token
# ---------------------------------------------------------------------------
class TestVerify2FASuccess:
    def test_correct_code_returns_access_token(self, pending_token):
        """Submitting the correct code with a pending token returns status='success'."""
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "123456"},
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        assert body["token_type"] == "bearer"
        assert "access_token" in body


# ---------------------------------------------------------------------------
# 3. Wrong 2FA code → 400 error
# ---------------------------------------------------------------------------
class TestVerify2FAWrongCode:
    def test_wrong_code_rejected(self, pending_token):
        """An incorrect 2FA code should return 400."""
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "000000"},
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"]

    def test_empty_code_rejected(self, pending_token):
        """An empty code string should be rejected."""
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": ""},
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 400

    def test_short_code_rejected(self, pending_token):
        """A code shorter than 6 digits should be rejected."""
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "123"},
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# 4. 2fa_pending token cannot access protected routes
# ---------------------------------------------------------------------------
class TestPendingTokenBlocksProtectedRoutes:
    def test_pending_token_rejected_on_me(self, pending_token):
        """A token with only '2fa_pending' scope must be rejected on /me."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 401
        assert "2FA" in response.json()["detail"]

    def test_pending_token_rejected_on_transactions(self, pending_token):
        """A token with only '2fa_pending' scope must be rejected on /transactions."""
        response = client.get(
            "/api/transactions/",
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 401

    def test_pending_token_rejected_on_categories(self, pending_token):
        """A token with only '2fa_pending' scope must be rejected on /categories."""
        response = client.get(
            "/api/categories/",
            headers={"Authorization": f"Bearer {pending_token}"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# 5. Full access token can access protected routes
# ---------------------------------------------------------------------------
class TestAccessTokenAllowsProtectedRoutes:
    def test_access_token_on_me(self, access_token):
        """A fully authenticated token should access /me."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["email"] == "2fa_user@example.com"

    def test_access_token_on_categories(self, access_token):
        """A fully authenticated token should access /categories."""
        response = client.get(
            "/api/categories/",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# 6. Expired 2fa_pending token → 401
# ---------------------------------------------------------------------------
class TestExpiredPendingToken:
    def test_expired_token_rejected(self, test_user):
        """A token that has already expired should be rejected."""
        expired_token = create_access_token(
            data={"sub": test_user.email, "scopes": ["2fa_pending"]},
            expires_delta=timedelta(seconds=-1),  # Already expired
        )
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "123456"},
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# 7. Access-scoped token cannot call verify-2fa
# ---------------------------------------------------------------------------
class TestAccessTokenCannotVerify2FA:
    def test_access_token_rejected_on_verify(self, access_token):
        """
        A token with 'access' scope (already fully authenticated) should NOT
        be able to call /verify-2fa — only '2fa_pending' tokens are valid there.
        """
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "123456"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 401
        assert "scope" in response.json()["detail"].lower() or "2FA" in response.json()["detail"]


# ---------------------------------------------------------------------------
# 8. No token at all → 401
# ---------------------------------------------------------------------------
class TestNoTokenRejected:
    def test_no_token_on_verify_2fa(self):
        """Calling /verify-2fa without any token should return 401."""
        response = client.post(
            "/api/auth/verify-2fa",
            json={"code": "123456"},
        )
        assert response.status_code == 401

    def test_no_token_on_protected_route(self):
        """Calling /me without any token should return 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

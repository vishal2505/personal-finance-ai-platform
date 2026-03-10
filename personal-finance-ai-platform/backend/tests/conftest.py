"""
Pytest configuration for the backend test suite.

This module must remain import-free of any ``app.*`` modules because it runs
before pytest imports the test files.  Setting DATABASE_URL here ensures that
``app.database`` picks up the SQLite URI when the test modules first import it,
so no live MySQL connection is attempted during the test run.
"""

import os

# Override the database URL BEFORE any app module is imported.
# app.database builds the engine at module-level from this env var.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient  # noqa: E402 – after env var is set
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import User, Category
from app.auth import get_password_hash, create_access_token

# ---------------------------------------------------------------------------
# Single shared in-memory database used by ALL test files.
# StaticPool ensures every connection reuses the same underlying SQLite DB,
# so tables created in one session are visible to subsequent sessions.
# ---------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Apply the override ONCE so that ALL test files share the same engine.
app.dependency_overrides[get_db] = override_get_db

# A single TestClient that can be imported by any test module.
client = TestClient(app)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def test_db():
    """Create all tables before each test, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(test_db):
    db = TestingSessionLocal()
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword"),
        full_name="Test User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def auth_token(test_user):
    return create_access_token(data={"sub": test_user.email, "scopes": ["access"]})


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def system_category(test_db):
    db = TestingSessionLocal()
    category = Category(
        name="System Groceries",
        type="expense",
        color="#10B981",
        icon="🛒",
        is_system=True,
        user_id=None,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    db.close()
    return category


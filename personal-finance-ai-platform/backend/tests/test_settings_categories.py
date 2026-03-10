"""
Tests for the Settings-router Categories endpoints.

These endpoints are mounted at /api/settings/categories and provide a
simplified category CRUD interface used by the Settings UI.  They differ
from the primary /api/categories router in that they:
  - use a simpler CategoryCreate schema (name / color / icon only, no type /
    parent_id / advanced fields)
  - return a lightweight dict representation for GET (no full CategoryResponse)
  - hard-delete via DELETE instead of soft-archiving

Endpoint matrix
---------------
POST   /api/settings/categories          create_category
GET    /api/settings/categories          get_categories
PUT    /api/settings/categories/{id}     update_category
DELETE /api/settings/categories/{id}     delete_category
"""

import pytest
from app.main import app
from tests.conftest import TestingSessionLocal, client
from app.models import User, Category
from app.auth import get_password_hash, create_access_token


# ---------------------------------------------------------------------------
# Extra fixtures needed only for settings-categories tests
# ---------------------------------------------------------------------------

@pytest.fixture
def other_user(test_db):
    """A second user to verify ownership isolation."""
    db = TestingSessionLocal()
    user = User(
        email="other_settings_user@example.com",
        hashed_password=get_password_hash("password"),
        full_name="Other User",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def other_auth_headers(other_user):
    token = create_access_token(
        data={"sub": other_user.email, "scopes": ["access"]}
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /api/settings/categories
# ---------------------------------------------------------------------------

class TestSettingsCreateCategory:
    def test_create_category_success(self, test_user, auth_headers):
        response = client.post(
            "/api/settings/categories",
            json={"name": "Groceries", "color": "#10B981", "icon": "🛒"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Groceries"
        assert data["color"] == "#10B981"
        assert data["icon"] == "🛒"
        assert data["user_id"] == test_user.id

    def test_create_category_duplicate_name_returns_400(self, auth_headers):
        client.post(
            "/api/settings/categories",
            json={"name": "Dining", "color": "#F59E0B", "icon": "🍽️"},
            headers=auth_headers,
        )
        response = client.post(
            "/api/settings/categories",
            json={"name": "Dining", "color": "#F59E0B", "icon": "🍽️"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_category_unauthenticated_returns_401(self):
        response = client.post(
            "/api/settings/categories",
            json={"name": "Test", "color": "#000000", "icon": "💰"},
        )
        assert response.status_code == 401

    def test_create_category_same_name_different_users_allowed(
        self, auth_headers, other_auth_headers
    ):
        r1 = client.post(
            "/api/settings/categories",
            json={"name": "Travel", "color": "#3B82F6", "icon": "✈️"},
            headers=auth_headers,
        )
        r2 = client.post(
            "/api/settings/categories",
            json={"name": "Travel", "color": "#3B82F6", "icon": "✈️"},
            headers=other_auth_headers,
        )
        assert r1.status_code == 200
        assert r2.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/settings/categories
# ---------------------------------------------------------------------------

class TestSettingsListCategories:
    def test_list_returns_only_own_active_visible_categories(
        self, auth_headers, other_auth_headers
    ):
        client.post(
            "/api/settings/categories",
            json={"name": "My Cat", "color": "#000000", "icon": "📦"},
            headers=auth_headers,
        )
        client.post(
            "/api/settings/categories",
            json={"name": "Other Cat", "color": "#000000", "icon": "📦"},
            headers=other_auth_headers,
        )

        response = client.get("/api/settings/categories", headers=auth_headers)
        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert "My Cat" in names
        assert "Other Cat" not in names

    def test_list_excludes_inactive_categories(self, auth_headers, test_user, test_db):
        db = TestingSessionLocal()
        cat = Category(
            user_id=test_user.id,
            name="Inactive Cat",
            color="#000000",
            icon="🚫",
            is_active=False,
        )
        db.add(cat)
        db.commit()
        db.close()

        response = client.get("/api/settings/categories", headers=auth_headers)
        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert "Inactive Cat" not in names

    def test_list_excludes_hidden_categories(self, auth_headers, test_user, test_db):
        db = TestingSessionLocal()
        cat = Category(
            user_id=test_user.id,
            name="Hidden Cat",
            color="#000000",
            icon="👻",
            is_hidden=True,
        )
        db.add(cat)
        db.commit()
        db.close()

        response = client.get("/api/settings/categories", headers=auth_headers)
        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert "Hidden Cat" not in names

    def test_list_response_has_expected_fields(self, auth_headers):
        client.post(
            "/api/settings/categories",
            json={"name": "Fields Test", "color": "#FF0000", "icon": "🔴"},
            headers=auth_headers,
        )
        response = client.get("/api/settings/categories", headers=auth_headers)
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) >= 1
        cat = categories[0]
        assert "id" in cat
        assert "name" in cat
        assert "color" in cat
        assert "icon" in cat

    def test_list_unauthenticated_returns_401(self):
        response = client.get("/api/settings/categories")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/settings/categories/{id}
# ---------------------------------------------------------------------------

class TestSettingsUpdateCategory:
    def _create(self, auth_headers, name="Update Me"):
        r = client.post(
            "/api/settings/categories",
            json={"name": name, "color": "#000000", "icon": "📝"},
            headers=auth_headers,
        )
        return r.json()

    def test_update_success(self, auth_headers):
        cat = self._create(auth_headers)
        response = client.put(
            f"/api/settings/categories/{cat['id']}",
            json={"name": "Updated Name", "color": "#FF0000", "icon": "✅"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["color"] == "#FF0000"
        assert data["icon"] == "✅"

    def test_update_not_found_returns_404(self, auth_headers):
        response = client.put(
            "/api/settings/categories/99999",
            json={"name": "Ghost", "color": "#000000", "icon": "👻"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_other_users_category_returns_404(
        self, auth_headers, other_auth_headers
    ):
        cat = client.post(
            "/api/settings/categories",
            json={"name": "Owner Cat", "color": "#000000", "icon": "🔒"},
            headers=other_auth_headers,
        ).json()

        response = client.put(
            f"/api/settings/categories/{cat['id']}",
            json={"name": "Hijack", "color": "#000000", "icon": "💀"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_unauthenticated_returns_401(self, auth_headers):
        cat = self._create(auth_headers)
        response = client.put(
            f"/api/settings/categories/{cat['id']}",
            json={"name": "No Auth", "color": "#000000", "icon": "🚫"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/settings/categories/{id}
# ---------------------------------------------------------------------------

class TestSettingsDeleteCategory:
    def _create(self, auth_headers, name="Delete Me"):
        r = client.post(
            "/api/settings/categories",
            json={"name": name, "color": "#000000", "icon": "🗑️"},
            headers=auth_headers,
        )
        return r.json()

    def test_delete_success(self, auth_headers):
        cat = self._create(auth_headers)
        response = client.delete(
            f"/api/settings/categories/{cat['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify the category is gone from list
        categories = client.get(
            "/api/settings/categories", headers=auth_headers
        ).json()
        assert all(c["id"] != cat["id"] for c in categories)

    def test_delete_not_found_returns_404(self, auth_headers):
        response = client.delete(
            "/api/settings/categories/99999",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_other_users_category_returns_404(
        self, auth_headers, other_auth_headers
    ):
        cat = client.post(
            "/api/settings/categories",
            json={"name": "Protected Cat", "color": "#000000", "icon": "🛡️"},
            headers=other_auth_headers,
        ).json()

        response = client.delete(
            f"/api/settings/categories/{cat['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_unauthenticated_returns_401(self, auth_headers):
        cat = self._create(auth_headers)
        response = client.delete(f"/api/settings/categories/{cat['id']}")
        assert response.status_code == 401

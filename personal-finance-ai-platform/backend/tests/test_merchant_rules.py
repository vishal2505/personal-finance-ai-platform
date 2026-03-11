"""
Tests for the Settings-router Merchant Rules endpoints.

Endpoints are mounted at /api/settings/merchant-rules:

POST   /api/settings/merchant-rules              create rule
GET    /api/settings/merchant-rules              list rules
PUT    /api/settings/merchant-rules/{id}         update rule
DELETE /api/settings/merchant-rules/{id}         delete rule
PUT    /api/settings/merchant-rules/{id}/toggle  toggle is_active

Coverage
--------
- Happy path CRUD for each endpoint
- Validation / edge cases (invalid category, missing rule, wrong owner)
- User isolation (one user cannot access another user's rules)
- Toggle correctly flips is_active
- Unauthenticated requests rejected with 401
"""

import pytest
from app.main import app
from tests.conftest import TestingSessionLocal, client
from app.models import User, Category, MerchantRule
from app.auth import get_password_hash, create_access_token


# ---------------------------------------------------------------------------
# Extra fixtures needed only for merchant-rules tests
# ---------------------------------------------------------------------------

@pytest.fixture
def other_user(test_db):
    """A second, distinct user for isolation tests."""
    db = TestingSessionLocal()
    user = User(
        email="other_merchant_user@example.com",
        hashed_password=get_password_hash("password"),
        full_name="Other Merchant User",
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


@pytest.fixture
def category(test_user, test_db):
    """A pre-created category belonging to test_user."""
    db = TestingSessionLocal()
    cat = Category(
        user_id=test_user.id,
        name="Groceries",
        color="#10B981",
        icon="🛒",
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    db.close()
    return cat


@pytest.fixture
def other_category(other_user, test_db):
    """A category belonging to other_user."""
    db = TestingSessionLocal()
    cat = Category(
        user_id=other_user.id,
        name="Other Groceries",
        color="#10B981",
        icon="🛒",
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    db.close()
    return cat


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _create_rule(auth_headers, category_id, pattern="WHOLE FOODS", match_type="partial"):
    return client.post(
        "/api/settings/merchant-rules",
        json={
            "merchant_pattern": pattern,
            "match_type": match_type,
            "category_id": category_id,
        },
        headers=auth_headers,
    )


# ---------------------------------------------------------------------------
# POST /api/settings/merchant-rules
# ---------------------------------------------------------------------------

class TestCreateMerchantRule:
    def test_create_rule_success(self, auth_headers, category):
        response = _create_rule(auth_headers, category.id)
        assert response.status_code == 200
        data = response.json()
        assert data["merchant_pattern"] == "WHOLE FOODS"
        assert data["match_type"] == "partial"
        assert data["category_id"] == category.id
        assert data["category_name"] == "Groceries"
        assert data["is_active"] is True

    def test_create_rule_exact_match_type(self, auth_headers, category):
        response = _create_rule(auth_headers, category.id, match_type="exact")
        assert response.status_code == 200
        assert response.json()["match_type"] == "exact"

    def test_create_rule_category_not_found_returns_404(self, auth_headers):
        response = _create_rule(auth_headers, category_id=999999)
        assert response.status_code == 404
        assert "Category not found" in response.json()["detail"]

    def test_create_rule_cannot_use_other_users_category(
        self, auth_headers, other_category
    ):
        """A user cannot assign a rule to another user's category."""
        response = _create_rule(auth_headers, other_category.id)
        assert response.status_code == 404

    def test_create_rule_unauthenticated_returns_401(self, category):
        response = client.post(
            "/api/settings/merchant-rules",
            json={
                "merchant_pattern": "AMZN",
                "match_type": "partial",
                "category_id": category.id,
            },
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/settings/merchant-rules
# ---------------------------------------------------------------------------

class TestListMerchantRules:
    def test_list_returns_own_rules(self, auth_headers, category):
        _create_rule(auth_headers, category.id, pattern="AMAZON")
        _create_rule(auth_headers, category.id, pattern="WALMART")

        response = client.get("/api/settings/merchant-rules", headers=auth_headers)
        assert response.status_code == 200
        patterns = [r["merchant_pattern"] for r in response.json()]
        assert "AMAZON" in patterns
        assert "WALMART" in patterns

    def test_list_returns_empty_when_no_rules(self, auth_headers):
        response = client.get("/api/settings/merchant-rules", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_does_not_include_other_users_rules(
        self, auth_headers, other_auth_headers, category, other_category
    ):
        _create_rule(auth_headers, category.id, pattern="MY STORE")
        _create_rule(other_auth_headers, other_category.id, pattern="THEIR STORE")

        response = client.get("/api/settings/merchant-rules", headers=auth_headers)
        patterns = [r["merchant_pattern"] for r in response.json()]
        assert "MY STORE" in patterns
        assert "THEIR STORE" not in patterns

    def test_list_response_has_expected_fields(self, auth_headers, category):
        _create_rule(auth_headers, category.id)
        response = client.get("/api/settings/merchant-rules", headers=auth_headers)
        assert response.status_code == 200
        rule = response.json()[0]
        for field in ("id", "merchant_pattern", "match_type", "category_id", "category_name", "is_active"):
            assert field in rule, f"Missing field: {field}"

    def test_list_unauthenticated_returns_401(self):
        response = client.get("/api/settings/merchant-rules")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/settings/merchant-rules/{id}
# ---------------------------------------------------------------------------

class TestUpdateMerchantRule:
    def test_update_rule_success(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id, pattern="OLD PATTERN").json()

        response = client.put(
            f"/api/settings/merchant-rules/{rule['id']}",
            json={
                "merchant_pattern": "NEW PATTERN",
                "match_type": "exact",
                "category_id": category.id,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["merchant_pattern"] == "NEW PATTERN"
        assert data["match_type"] == "exact"

    def test_update_rule_change_category(self, auth_headers, category, test_user, test_db):
        # Create a second category for the same user
        db = TestingSessionLocal()
        cat2 = Category(
            user_id=test_user.id, name="Shopping", color="#3B82F6", icon="🛍️"
        )
        db.add(cat2)
        db.commit()
        db.refresh(cat2)
        db.close()

        rule = _create_rule(auth_headers, category.id).json()

        response = client.put(
            f"/api/settings/merchant-rules/{rule['id']}",
            json={
                "merchant_pattern": "AMAZON",
                "match_type": "partial",
                "category_id": cat2.id,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["category_id"] == cat2.id

    def test_update_rule_not_found_returns_404(self, auth_headers, category):
        response = client.put(
            "/api/settings/merchant-rules/99999",
            json={
                "merchant_pattern": "GHOST",
                "match_type": "partial",
                "category_id": category.id,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_rule_invalid_category_returns_404(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()
        response = client.put(
            f"/api/settings/merchant-rules/{rule['id']}",
            json={
                "merchant_pattern": "STORE",
                "match_type": "partial",
                "category_id": 999999,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_other_users_rule_returns_404(
        self, auth_headers, other_auth_headers, category, other_category
    ):
        other_rule = _create_rule(
            other_auth_headers, other_category.id, pattern="THEIR STORE"
        ).json()

        response = client.put(
            f"/api/settings/merchant-rules/{other_rule['id']}",
            json={
                "merchant_pattern": "HIJACKED",
                "match_type": "partial",
                "category_id": category.id,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_update_unauthenticated_returns_401(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()
        response = client.put(
            f"/api/settings/merchant-rules/{rule['id']}",
            json={
                "merchant_pattern": "NO AUTH",
                "match_type": "partial",
                "category_id": category.id,
            },
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/settings/merchant-rules/{id}
# ---------------------------------------------------------------------------

class TestDeleteMerchantRule:
    def test_delete_rule_success(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()

        response = client.delete(
            f"/api/settings/merchant-rules/{rule['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify it is no longer returned in the list
        rules = client.get(
            "/api/settings/merchant-rules", headers=auth_headers
        ).json()
        assert all(r["id"] != rule["id"] for r in rules)

    def test_delete_rule_not_found_returns_404(self, auth_headers):
        response = client.delete(
            "/api/settings/merchant-rules/99999",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_other_users_rule_returns_404(
        self, auth_headers, other_auth_headers, other_category
    ):
        other_rule = _create_rule(
            other_auth_headers, other_category.id, pattern="PROTECTED"
        ).json()

        response = client.delete(
            f"/api/settings/merchant-rules/{other_rule['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_unauthenticated_returns_401(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()
        response = client.delete(f"/api/settings/merchant-rules/{rule['id']}")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/settings/merchant-rules/{id}/toggle
# ---------------------------------------------------------------------------

class TestToggleMerchantRule:
    def test_toggle_activates_then_deactivates(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()
        rule_id = rule["id"]
        initial_active = rule["is_active"]

        # First toggle
        resp1 = client.put(
            f"/api/settings/merchant-rules/{rule_id}/toggle",
            headers=auth_headers,
        )
        assert resp1.status_code == 200

        # Retrieve updated state from list
        rules = client.get(
            "/api/settings/merchant-rules", headers=auth_headers
        ).json()
        toggled_rule = next(r for r in rules if r["id"] == rule_id)
        assert toggled_rule["is_active"] != initial_active

        # Second toggle – should return to original state
        client.put(
            f"/api/settings/merchant-rules/{rule_id}/toggle",
            headers=auth_headers,
        )
        rules = client.get(
            "/api/settings/merchant-rules", headers=auth_headers
        ).json()
        twice_toggled = next(r for r in rules if r["id"] == rule_id)
        assert twice_toggled["is_active"] == initial_active

    def test_toggle_not_found_returns_404(self, auth_headers):
        response = client.put(
            "/api/settings/merchant-rules/99999/toggle",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_toggle_other_users_rule_returns_404(
        self, auth_headers, other_auth_headers, other_category
    ):
        other_rule = _create_rule(
            other_auth_headers, other_category.id, pattern="FOREIGN"
        ).json()

        response = client.put(
            f"/api/settings/merchant-rules/{other_rule['id']}/toggle",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_toggle_unauthenticated_returns_401(self, auth_headers, category):
        rule = _create_rule(auth_headers, category.id).json()
        response = client.put(f"/api/settings/merchant-rules/{rule['id']}/toggle")
        assert response.status_code == 401

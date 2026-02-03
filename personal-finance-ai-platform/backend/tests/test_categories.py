import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import User, Category
from app.auth import get_password_hash, create_access_token

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(test_db):
    db = TestingSessionLocal()
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword"),
        full_name="Test User"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def auth_token(test_user):
    token = create_access_token(data={"sub": test_user.email})
    return token


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
        user_id=None
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    db.close()
    return category


class TestCreateCategory:
    def test_create_category_success(self, test_user, auth_headers):
        response = client.post(
            "/api/categories/",
            json={
                "name": "Coffee Shops",
                "type": "expense",
                "color": "#8B4513",
                "icon": "☕"
            },
            headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Coffee Shops"
        assert data["type"] == "expense"
        assert data["is_system"] == False
        assert data["is_active"] == True
        assert data["user_id"] == test_user.id

    def test_create_category_duplicate_name(self, test_user, auth_headers):
        # Create first category
        client.post(
            "/api/categories/",
            json={"name": "Dining", "type": "expense"},
            headers=auth_headers
        )
        
        # Try to create duplicate
        response = client.post(
            "/api/categories/",
            json={"name": "Dining", "type": "expense"},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_category_invalid_color(self, auth_headers):
        response = client.post(
            "/api/categories/",
            json={
                "name": "Test",
                "color": "invalid"
            },
            headers=auth_headers
        )
        assert response.status_code == 422

    def test_create_category_invalid_type(self, auth_headers):
        response = client.post(
            "/api/categories/",
            json={
                "name": "Test",
                "type": "invalid_type"
            },
            headers=auth_headers
        )
        assert response.status_code == 422

    def test_create_category_with_parent(self, test_user, auth_headers):
        # Create parent category
        parent_response = client.post(
            "/api/categories/",
            json={"name": "Food", "type": "expense"},
            headers=auth_headers
        )
        parent_id = parent_response.json()["id"]
        
        # Create child category
        response = client.post(
            "/api/categories/",
            json={
                "name": "Fast Food",
                "type": "expense",
                "parent_id": parent_id
            },
            headers=auth_headers
        )
        assert response.status_code == 201
        assert response.json()["parent_id"] == parent_id

    def test_create_category_invalid_parent(self, auth_headers):
        response = client.post(
            "/api/categories/",
            json={
                "name": "Test",
                "parent_id": 99999
            },
            headers=auth_headers
        )
        assert response.status_code == 404
        assert "Parent category not found" in response.json()["detail"]


class TestListCategories:
    def test_list_categories_includes_system_and_user(self, test_user, auth_headers, system_category):
        # Create user category
        client.post(
            "/api/categories/",
            json={"name": "My Category", "type": "expense"},
            headers=auth_headers
        )
        
        response = client.get("/api/categories/", headers=auth_headers)
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) == 2
        
        category_names = [cat["name"] for cat in categories]
        assert "System Groceries" in category_names
        assert "My Category" in category_names

    def test_list_categories_filter_by_type(self, auth_headers):
        client.post("/api/categories/", json={"name": "Expense Cat", "type": "expense"}, headers=auth_headers)
        client.post("/api/categories/", json={"name": "Income Cat", "type": "income"}, headers=auth_headers)
        
        response = client.get("/api/categories/?type=expense", headers=auth_headers)
        assert response.status_code == 200
        categories = response.json()
        assert all(cat["type"] == "expense" for cat in categories)

    def test_list_categories_exclude_inactive(self, test_user, auth_headers):
        # Create and delete a category
        create_response = client.post(
            "/api/categories/",
            json={"name": "To Delete", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        client.delete(f"/api/categories/{category_id}", headers=auth_headers)
        
        # List without inactive
        response = client.get("/api/categories/", headers=auth_headers)
        assert response.status_code == 200
        categories = response.json()
        assert all(cat["name"] != "To Delete" for cat in categories)
        
        # List with inactive
        response = client.get("/api/categories/?include_inactive=true", headers=auth_headers)
        assert response.status_code == 200
        categories = response.json()
        assert any(cat["name"] == "To Delete" for cat in categories)

    def test_list_categories_exclude_hidden(self, test_user, auth_headers):
        # Create category
        create_response = client.post(
            "/api/categories/",
            json={"name": "Hidden Cat", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        # Hide it
        client.patch(
            f"/api/categories/{category_id}",
            json={"is_hidden": True},
            headers=auth_headers
        )
        
        # List without hidden
        response = client.get("/api/categories/", headers=auth_headers)
        categories = response.json()
        assert all(cat["name"] != "Hidden Cat" for cat in categories)


class TestGetCategory:
    def test_get_category_success(self, auth_headers):
        create_response = client.post(
            "/api/categories/",
            json={"name": "Test Category", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        response = client.get(f"/api/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "Test Category"

    def test_get_system_category(self, system_category, auth_headers):
        response = client.get(f"/api/categories/{system_category.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_system"] == True

    def test_get_category_not_found(self, auth_headers):
        response = client.get("/api/categories/99999", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateCategory:
    def test_update_category_success(self, auth_headers):
        create_response = client.post(
            "/api/categories/",
            json={"name": "Original Name", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/categories/{category_id}",
            json={"name": "Updated Name", "color": "#FF0000"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["color"] == "#FF0000"

    def test_update_system_category_forbidden(self, system_category, auth_headers):
        response = client.patch(
            f"/api/categories/{system_category.id}",
            json={"name": "Modified System"},
            headers=auth_headers
        )
        assert response.status_code == 403
        assert "System categories cannot be modified" in response.json()["detail"]

    def test_update_category_duplicate_name(self, auth_headers):
        client.post("/api/categories/", json={"name": "Category A", "type": "expense"}, headers=auth_headers)
        create_response = client.post("/api/categories/", json={"name": "Category B", "type": "expense"}, headers=auth_headers)
        category_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/categories/{category_id}",
            json={"name": "Category A"},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_update_category_circular_parent(self, auth_headers):
        create_response = client.post(
            "/api/categories/",
            json={"name": "Self Parent", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/categories/{category_id}",
            json={"parent_id": category_id},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "cannot be its own parent" in response.json()["detail"]


class TestDeleteCategory:
    def test_delete_category_success(self, auth_headers):
        create_response = client.post(
            "/api/categories/",
            json={"name": "To Delete", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        response = client.delete(f"/api/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200
        assert "archived" in response.json()["message"]
        
        # Verify it's soft deleted
        get_response = client.get(f"/api/categories/{category_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_delete_system_category_forbidden(self, system_category, auth_headers):
        response = client.delete(f"/api/categories/{system_category.id}", headers=auth_headers)
        assert response.status_code == 403
        assert "System categories cannot be deleted" in response.json()["detail"]


class TestBulkReorder:
    def test_reorder_categories_success(self, auth_headers):
        # Create multiple categories
        cat1 = client.post("/api/categories/", json={"name": "Cat 1", "type": "expense"}, headers=auth_headers).json()
        cat2 = client.post("/api/categories/", json={"name": "Cat 2", "type": "expense"}, headers=auth_headers).json()
        cat3 = client.post("/api/categories/", json={"name": "Cat 3", "type": "expense"}, headers=auth_headers).json()
        
        response = client.patch(
            "/api/categories/reorder",
            json={
                "categories": [
                    {"id": cat1["id"], "sort_order": 2},
                    {"id": cat2["id"], "sort_order": 0},
                    {"id": cat3["id"], "sort_order": 1}
                ]
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["updated_count"] == 3
        
        # Verify order
        list_response = client.get("/api/categories/", headers=auth_headers)
        categories = list_response.json()
        names = [cat["name"] for cat in categories]
        assert names.index("Cat 2") < names.index("Cat 3") < names.index("Cat 1")


class TestCategoryStats:
    def test_category_stats_no_transactions(self, auth_headers):
        create_response = client.post(
            "/api/categories/",
            json={"name": "Empty Category", "type": "expense"},
            headers=auth_headers
        )
        category_id = create_response.json()["id"]
        
        response = client.get(f"/api/categories/{category_id}/stats", headers=auth_headers)
        assert response.status_code == 200
        stats = response.json()
        assert stats["transaction_count"] == 0
        assert stats["total_amount"] == 0.0
        assert stats["expense_count"] == 0
        assert stats["income_count"] == 0

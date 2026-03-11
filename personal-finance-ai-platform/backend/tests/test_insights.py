import pytest
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import Base, get_db
from app.models import User, Category, Transaction
from app.auth import get_password_hash, create_access_token
from app.routers.insights import generate_ai_insight, generate_openai_insights

# ---------------------------------------------------------------------------
# Test database setup (mirrors test_categories.py)
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


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(test_db):
    db = TestingSessionLocal()
    user = User(
        email="insight_test@example.com",
        hashed_password=get_password_hash("testpassword"),
        full_name="Insight Test User",
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
def seed_transactions(test_user, test_db):
    """Create a category and two months of transactions for integration tests."""
    db = TestingSessionLocal()
    category = Category(
        name="Groceries",
        type="expense",
        user_id=test_user.id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    now = datetime.now()
    # Last month – higher spending
    for i in range(3):
        db.add(
            Transaction(
                user_id=test_user.id,
                category_id=category.id,
                date=now - timedelta(days=10 + i),
                amount=200.0,
                merchant=f"Store {i}",
            )
        )
    # Two months ago – lower spending
    for i in range(2):
        db.add(
            Transaction(
                user_id=test_user.id,
                category_id=category.id,
                date=now - timedelta(days=40 + i),
                amount=100.0,
                merchant=f"OldStore {i}",
            )
        )
    db.commit()
    db.close()
    return category


# ===================================================================
# Unit Tests – generate_ai_insight (pure function, no DB needed)
# ===================================================================
class TestGenerateAiInsight:
    def test_spending_trend_increase(self):
        data = {
            "monthly_trends": [
                {"month": "2025-01", "total": 100.0, "count": 5},
                {"month": "2025-02", "total": 150.0, "count": 6},
            ]
        }
        insights = generate_ai_insight(data)
        trend = [i for i in insights if i.type == "trend"]
        assert len(trend) == 1
        assert "Increased" in trend[0].title
        assert trend[0].data["change_percent"] == pytest.approx(50.0)

    def test_spending_trend_decrease(self):
        data = {
            "monthly_trends": [
                {"month": "2025-01", "total": 200.0, "count": 5},
                {"month": "2025-02", "total": 100.0, "count": 3},
            ]
        }
        insights = generate_ai_insight(data)
        trend = [i for i in insights if i.type == "trend"]
        assert len(trend) == 1
        assert "Decreased" in trend[0].title
        assert trend[0].data["change_percent"] == pytest.approx(-50.0)

    def test_no_trend_small_change(self):
        data = {
            "monthly_trends": [
                {"month": "2025-01", "total": 100.0, "count": 5},
                {"month": "2025-02", "total": 105.0, "count": 5},
            ]
        }
        insights = generate_ai_insight(data)
        trend = [i for i in insights if i.type == "trend"]
        assert len(trend) == 0

    def test_single_month_no_trend(self):
        data = {
            "monthly_trends": [{"month": "2025-01", "total": 100.0, "count": 5}]
        }
        insights = generate_ai_insight(data)
        trend = [i for i in insights if i.type == "trend"]
        assert len(trend) == 0

    def test_top_category_insight(self):
        data = {"top_category": {"name": "Dining", "amount": 350.50}}
        insights = generate_ai_insight(data)
        cat = [i for i in insights if i.type == "category"]
        assert len(cat) == 1
        assert "Dining" in cat[0].title
        assert "$350.50" in cat[0].description

    def test_unusual_transactions(self):
        data = {
            "unusual_transactions": [
                {"id": 1, "amount": 999.0, "merchant": "Unknown"},
                {"id": 2, "amount": 500.0, "merchant": "Suspicious"},
            ]
        }
        insights = generate_ai_insight(data)
        anomaly = [i for i in insights if i.type == "anomaly"]
        assert len(anomaly) == 1
        assert "2 Unusual" in anomaly[0].title

    def test_budget_warnings(self):
        data = {
            "budget_warnings": [
                {
                    "budget_name": "Food",
                    "budget_amount": 500,
                    "spent": 450,
                    "percent_used": 90.0,
                    "message": "You've used 90% of your Food budget ($450.00 / $500.00).",
                }
            ]
        }
        insights = generate_ai_insight(data)
        budget = [i for i in insights if i.type == "budget"]
        assert len(budget) == 1
        assert "Food" in budget[0].title

    def test_multiple_budget_warnings(self):
        data = {
            "budget_warnings": [
                {
                    "budget_name": "Food",
                    "budget_amount": 500,
                    "spent": 450,
                    "percent_used": 90.0,
                    "message": "90% of Food budget used.",
                },
                {
                    "budget_name": "Transport",
                    "budget_amount": 200,
                    "spent": 190,
                    "percent_used": 95.0,
                    "message": "95% of Transport budget used.",
                },
            ]
        }
        insights = generate_ai_insight(data)
        budget = [i for i in insights if i.type == "budget"]
        assert len(budget) == 2

    def test_empty_data(self):
        insights = generate_ai_insight({})
        assert insights == []

    def test_prev_month_zero_total(self):
        """When previous month total is 0, change should be 0 (avoid division by zero)."""
        data = {
            "monthly_trends": [
                {"month": "2025-01", "total": 0.0, "count": 0},
                {"month": "2025-02", "total": 100.0, "count": 3},
            ]
        }
        insights = generate_ai_insight(data)
        trend = [i for i in insights if i.type == "trend"]
        # change is 0 because prev_month total is 0 → abs(0) <= 10 → no insight
        assert len(trend) == 0


# ===================================================================
# Unit Tests – generate_openai_insights (mock OpenAI)
# ===================================================================
class TestGenerateOpenaiInsights:
    @patch.dict("os.environ", {}, clear=True)
    def test_missing_api_key(self):
        result = generate_openai_insights({"monthly_trends": []})
        assert result == []

    @patch.dict("os.environ", {"OPENAI_API_KEY": "dummy"})
    def test_placeholder_api_key_dummy(self):
        result = generate_openai_insights({"monthly_trends": []})
        assert result == []

    @patch.dict("os.environ", {"OPENAI_API_KEY": "sk-xxx"})
    def test_placeholder_api_key_sk_xxx(self):
        result = generate_openai_insights({"monthly_trends": []})
        assert result == []

    @patch.dict("os.environ", {"OPENAI_API_KEY": "sk-real-key-123"})
    @patch("openai.OpenAI")
    def test_successful_response(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        content=json.dumps(
                            [
                                {
                                    "type": "tip",
                                    "title": "Cut subscriptions",
                                    "description": "You can save $50/month.",
                                    "data": {},
                                }
                            ]
                        )
                    )
                )
            ]
        )

        result = generate_openai_insights(
            {
                "monthly_trends": [{"month": "2025-01", "total": 500.0}],
                "top_category": {"name": "Food", "amount": 200.0},
            }
        )
        assert len(result) == 1
        assert result[0].title == "Cut subscriptions"
        assert result[0].source == "ai"

    @patch.dict("os.environ", {"OPENAI_API_KEY": "sk-real-key-123"})
    @patch("openai.OpenAI")
    def test_markdown_code_block_response(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        wrapped = '```json\n[{"type":"trend","title":"Spending up","description":"Your spending rose 20%.","data":{}}]\n```'
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=wrapped))]
        )

        result = generate_openai_insights({"monthly_trends": []})
        assert len(result) == 1
        assert result[0].title == "Spending up"

    @patch.dict("os.environ", {"OPENAI_API_KEY": "sk-real-key-123"})
    @patch("openai.OpenAI")
    def test_api_error(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("API down")

        result = generate_openai_insights({"monthly_trends": []})
        assert result == []

    @patch.dict("os.environ", {"OPENAI_API_KEY": "sk-real-key-123"})
    @patch("openai.OpenAI")
    def test_invalid_json_response(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="not json at all"))]
        )

        result = generate_openai_insights({"monthly_trends": []})
        assert result == []

    @patch.dict(
        "os.environ",
        {"OPENAI_API_KEY": json.dumps({"OPENAI_API_KEY": "sk-real-from-json"})},
    )
    @patch("openai.OpenAI")
    def test_json_wrapped_api_key(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        content=json.dumps(
                            [
                                {
                                    "type": "tip",
                                    "title": "Tip",
                                    "description": "Save money.",
                                    "data": {},
                                }
                            ]
                        )
                    )
                )
            ]
        )

        result = generate_openai_insights({"monthly_trends": []})
        assert len(result) == 1
        # Verify the extracted key was used
        mock_openai_cls.assert_called_once_with(api_key="sk-real-from-json")


# ===================================================================
# Integration Tests – API Endpoints
# ===================================================================
class TestInsightsEndpoints:
    def test_get_insights_unauthenticated(self, test_db):
        response = client.get("/api/insights/")
        assert response.status_code == 401

    def test_get_insights_no_transactions(self, test_user, auth_headers):
        response = client.get("/api/insights/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_insights_with_transactions(self, seed_transactions, auth_headers):
        response = client.get("/api/insights/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Should have at least a category insight for "Groceries"
        types = [item["type"] for item in data]
        assert "category" in types

    @patch.dict("os.environ", {}, clear=True)
    def test_get_insights_ai_endpoint_no_key(self, test_user, auth_headers):
        response = client.get("/api/insights/ai", headers=auth_headers)
        assert response.status_code == 200
        # Without a valid API key, returns empty
        assert response.json() == []

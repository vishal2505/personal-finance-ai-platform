import pytest
import io
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import User, ImportJob, Transaction, ImportJobStatus, TransactionStatus, TransactionType
from app.auth import get_password_hash, create_access_token

# Import internal functions from imports.py to test
from app.routers.imports import (
    _parse_amount,
    _parse_amount_with_suffix,
    _parse_date,
    _preprocess_merchant
)

# --- Database & App Setup for Integration Tests ---

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
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

# --- Fixtures ---

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
    return create_access_token(data={"sub": test_user.email, "scopes": ["access"]})

@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture
def sample_import_job(test_user, test_db):
    db = TestingSessionLocal()
    job = ImportJob(
        user_id=test_user.id,
        filename="test_statement.csv",
        file_type="csv",
        status=ImportJobStatus.COMPLETED,
        total_transactions=2,
        processed_transactions=2,
        total_amount=150.0
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    t1 = Transaction(
        user_id=test_user.id,
        import_job_id=job.id,
        date=datetime.now(),
        amount=50.0,
        merchant="Test Merchant 1",
        transaction_type=TransactionType.DEBIT,
        status=TransactionStatus.PENDING
    )
    t2 = Transaction(
        user_id=test_user.id,
        import_job_id=job.id,
        date=datetime.now(),
        amount=100.0,
        merchant="Test Merchant 2",
        transaction_type=TransactionType.DEBIT,
        status=TransactionStatus.PENDING
    )
    db.add_all([t1, t2])
    db.commit()
    db.refresh(job)
    yield job
    db.close()

# --- Internal Function Tests ---
# These verify the data parsing logic contained strictly within imports.py

class TestParseAmount:
    def test_parse_amount_basic(self):
        assert _parse_amount("50.00", handle_suffix=False) == 50.0
        assert _parse_amount("1,200.50", handle_suffix=False) == 1200.5
        assert _parse_amount("$50.00", handle_suffix=False) == 50.0

    def test_parse_amount_negative(self):
        assert _parse_amount("-50.00", handle_suffix=False) == 50.0
        assert _parse_amount("-$50.00", handle_suffix=False) == 50.0

    def test_parse_amount_invalid(self):
        assert _parse_amount("", handle_suffix=False) == 0.0
        assert _parse_amount(None, handle_suffix=False) == 0.0
        assert _parse_amount("abc", handle_suffix=False) == 0.0

    def test_parse_amount_with_suffix(self):
        assert _parse_amount("50.00 Cr", handle_suffix=True) == 50.0
        assert _parse_amount("500.00 Dr", handle_suffix=True) == 500.0

class TestParseAmountWithSuffixHelper:
    def test_basic_values(self):
        assert _parse_amount_with_suffix("50.00") == 50.0
        assert _parse_amount_with_suffix("$1,200.50") == 1200.5

    def test_bank_suffixes(self):
        assert _parse_amount_with_suffix("50.00 Cr") == 50.0
        assert _parse_amount_with_suffix("500.00 Dr") == 500.0

    def test_negative_values(self):
        assert _parse_amount_with_suffix("-500") == 500.0

class TestParseDate:
    def test_valid_formats(self):
        assert _parse_date("2023-10-25") == datetime(2023, 10, 25)
        assert _parse_date("25/10/2023") == datetime(2023, 10, 25)
        assert _parse_date("10/25/2023") == datetime(2023, 10, 25)
        assert _parse_date("25 Oct 2023") == datetime(2023, 10, 25)
        assert _parse_date("25-Oct") == datetime(1900, 10, 25)

    def test_invalid_dates(self):
        assert _parse_date("") is None
        assert _parse_date(None) is None
        assert _parse_date("not a date") is None

class TestPreprocessMerchant:
    def test_merchant_cleaning(self):
        assert _preprocess_merchant("STARBUCKS SINGAPORE") == "starbucks singapore"
        assert _preprocess_merchant("  Grab  Ride  ") == "grab ride"
        assert _preprocess_merchant("MCDONALD'S") == "mcdonalds"
        assert _preprocess_merchant("AMAZON.COM") == "amazoncom"

    def test_empty_merchant(self):
        assert _preprocess_merchant(None) == ""
        assert _preprocess_merchant("") == ""

# --- API Endpoint Tests ---
# These verify the routes defined exclusively within imports.py

class TestImportEndpoints:
    def test_get_import_jobs(self, auth_headers, sample_import_job):
        response = client.get("/api/imports/", headers=auth_headers)
        assert response.status_code == 200
        jobs = response.json()
        assert len(jobs) == 1
        assert jobs[0]["filename"] == "test_statement.csv"
        assert jobs[0]["total_amount"] == 150.0

    def test_get_import_job(self, auth_headers, sample_import_job):
        response = client.get(f"/api/imports/{sample_import_job.id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["filename"] == "test_statement.csv"

    def test_get_import_job_transactions(self, auth_headers, sample_import_job):
        response = client.get(f"/api/imports/{sample_import_job.id}/transactions", headers=auth_headers)
        assert response.status_code == 200
        transactions = response.json()
        assert len(transactions) == 2
        assert transactions[0]["merchant"] in ["Test Merchant 1", "Test Merchant 2"]

    def test_confirm_import_job(self, auth_headers, sample_import_job):
        response = client.post(f"/api/imports/{sample_import_job.id}/confirm", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify transactions flip from 'pending' to 'processed'
        tx_response = client.get(f"/api/imports/{sample_import_job.id}/transactions", headers=auth_headers)
        transactions = tx_response.json()
        assert all(t["status"] == "processed" for t in transactions)

    def test_delete_import_job(self, auth_headers, sample_import_job):
        response = client.delete(f"/api/imports/{sample_import_job.id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify job is successfully deleted
        get_response = client.get(f"/api/imports/{sample_import_job.id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_upload_csv_statement(self, test_db, auth_headers):
        # Create a dummy CSV file simulating statements
        csv_content = "Date,Description,Amount\n2023-10-01,Test Coffee,5.50\n2023-10-02,Grocery,45.00"
        
        response = client.post(
            "/api/imports/upload",
            headers=auth_headers,
            files={"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
            data={"bank_name": "Test Bank"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "import_job" in data
        assert "transactions" in data
        assert data["import_job"]["filename"] == "test.csv"
        assert len(data["transactions"]) == 2
        assert data["transactions"][0]["merchant"] in ["Test Coffee", "Grocery"]

import pytest
import io
from datetime import datetime

from app.models import ImportJob, ImportJobStatus

# Import internal functions from imports.py to test
from app.routers.imports import (
    _parse_amount,
    _parse_date,
)
from tests.conftest import client, TestingSessionLocal

# --- Internal Function Tests ---
# These verify the data parsing logic contained strictly within imports.py

class TestParseAmount:
    def test_parse_amount_basic(self):
        assert _parse_amount("50.00") == 50.0
        assert _parse_amount("1,200.50") == 1200.5
        assert _parse_amount("$50.00") == 50.0

    def test_parse_amount_negative(self):
        assert _parse_amount("-50.00") == 50.0
        assert _parse_amount("-$50.00") == 50.0

    def test_parse_amount_invalid(self):
        assert _parse_amount("") == 0.0
        assert _parse_amount(None) == 0.0
        assert _parse_amount("abc") == 0.0

    def test_parse_amount_with_suffix(self):
        # _parse_amount strips non-numeric chars via regex, so suffixes are handled
        assert _parse_amount("50.00 Cr") == 50.0
        assert _parse_amount("500.00 Dr") == 500.0

    def test_parse_amount_parentheses(self):
        # Parenthesised amounts are treated as negative then abs'd
        assert _parse_amount("(500.00)") == 500.0

class TestParseDate:
    def test_valid_formats(self):
        assert _parse_date("2023-10-25") == datetime(2023, 10, 25)
        assert _parse_date("25/10/2023") == datetime(2023, 10, 25)
        assert _parse_date("25 Oct 2023") == datetime(2023, 10, 25)
        # "%d %b" format (space-separated, no year)
        assert _parse_date("25 Oct") == datetime(1900, 10, 25)

    def test_invalid_dates(self):
        assert _parse_date("") is None
        assert _parse_date(None) is None
        assert _parse_date("not a date") is None

# --- API Endpoint Tests ---
# These verify the routes defined exclusively within imports.py

class TestImportEndpoints:
    def test_get_import_jobs_empty(self, auth_headers):
        response = client.get("/api/imports/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

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

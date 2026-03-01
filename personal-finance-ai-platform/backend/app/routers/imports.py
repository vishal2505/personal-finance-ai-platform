from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Transaction, User, ImportJob,
    ImportJobStatus, TransactionSource, TransactionStatus
)
from app.schemas import TransactionResponse, ImportJobResponse, UploadResponse
from app.auth import get_current_user
import pdfplumber
import io
from datetime import datetime
import re

router = APIRouter()


# =========================
# DATE PARSER
# =========================
def _parse_date(date_str: str):
    if not date_str:
        return None

    cleaned = str(date_str).replace("\n", " ").strip()

    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y",
        "%d %b %Y", "%d.%m.%Y", "%d.%m.%y",
        "%d %b", "%d/%m"
    ]

    for f in formats:
        try:
            return datetime.strptime(cleaned, f)
        except:
            continue

    return None


# =========================
# AMOUNT PARSER
# =========================
def _parse_amount(val: str) -> float:
    if not val:
        return 0.0

    val = str(val).strip()

    # Citi negative brackets
    if "(" in val and ")" in val:
        val = "-" + val.replace("(", "").replace(")", "")

    val = re.sub(r"[^\d\.-]", "", val)

    try:
        return abs(float(val))
    except:
        return 0.0


# =========================
# VALIDATION
# =========================
def _is_valid_transaction(date, merchant, amount):
    if not date or not merchant:
        return False

    merchant_lower = merchant.lower().strip()

    invalid_keywords = [
        "opening balance", "closing balance",
        "new credits", "new debits",
        "minimum payment", "credit limit",
        "statement", "summary", "balance",
        "total", "available credit",
        "payment received", "auto payment",
        "amount due"
    ]

    if any(k in merchant_lower for k in invalid_keywords):
        return False

    # Remove large system payments
    if amount > 5000 and len(merchant_lower) < 10:
        return False

    if len(merchant_lower) < 3:
        return False

    if re.fullmatch(r"\d+", merchant_lower):
        return False

    if amount <= 0:
        return False

    return True


# =========================
# TEXT PARSER (AMEX / CITI)
# =========================
def _parse_text(text: str):
    transactions = []

    date_pattern = r'(\d{1,2}[/\s.-](?:\d{1,2}|[A-Za-z]{3,9})[/\s.-]\d{2,4})'
    amount_pattern = r'(\(?-?[\d,]+\.\d{2}\)?)'
    pattern = date_pattern + r"\s+(.+?)\s+" + amount_pattern

    for m in re.finditer(pattern, text):
        date_str, merchant, amt = m.groups()

        if "FOREIGN AMOUNT" in merchant.upper():
            continue

        date = _parse_date(date_str)
        amount = _parse_amount(amt)

        merchant = merchant.strip()

        if _is_valid_transaction(date, merchant, amount):
            transactions.append({
                "date": date,
                "amount": amount,
                "merchant": merchant,
                "description": None
            })

    # AMEX column fallback
    if not transactions:
        amounts = re.findall(r"\d{1,3}(?:,\d{3})*\.\d{2}", text)
        txns = re.findall(r"(\d{2}\.\d{2}\.\d{2})\s+([A-Z0-9\*\'\-\s]+)", text)

        for i in range(min(len(amounts), len(txns))):
            d, m = txns[i]
            date = _parse_date(d)
            amount = _parse_amount(amounts[i])

            if _is_valid_transaction(date, m, amount):
                transactions.append({
                    "date": date,
                    "amount": amount,
                    "merchant": m.strip(),
                    "description": None
                })

    return transactions


# =========================
# PDF PARSER (ALL PAGES FIXED)
# =========================
def parse_pdf(content: bytes):
    all_transactions = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:

        for i, page in enumerate(pdf.pages):

            page_transactions = []

            # ---- TABLE FIRST ----
            tables = page.extract_tables()

            if tables:
                for table in tables:
                    for row in table[1:]:
                        if not row:
                            continue

                        row = [str(x).strip() if x else "" for x in row]

                        date = _parse_date(row[0])

                        merchant = " ".join(
                            [x for x in row[1:-2] if x]
                        ).strip()

                        amount = (
                            _parse_amount(row[-2])
                            or _parse_amount(row[-3])
                        )

                        if _is_valid_transaction(date, merchant, amount):
                            page_transactions.append({
                                "date": date,
                                "amount": amount,
                                "merchant": merchant,
                                "description": None
                            })

            # ---- FALLBACK PER PAGE ----
            if not page_transactions:
                text = page.extract_text()
                if text:
                    page_transactions.extend(_parse_text(text))

            print(f"Page {i+1}: {len(page_transactions)} transactions found")

            all_transactions.extend(page_transactions)

    if not all_transactions:
        raise ValueError("No valid transactions found")

    return all_transactions


# =========================
# UPLOAD API
# =========================
@router.post("/upload", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    account_id: Optional[int] = None,
    bank_name: Optional[str] = None,
    card_last_four: Optional[str] = None,
    statement_period: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF supported")

    import_job = ImportJob(
        user_id=current_user.id,
        account_id=account_id,
        filename=file.filename,
        file_type="pdf",
        status=ImportJobStatus.PROCESSING,
        statement_period=statement_period
    )

    db.add(import_job)
    db.commit()
    db.refresh(import_job)

    created_transactions = []

    try:
        content = await file.read()
        parsed = parse_pdf(content)

        import_job.total_transactions = len(parsed)

        for t in parsed:

            # Duplicate detection
            existing = db.query(Transaction).filter(
                Transaction.user_id == current_user.id,
                Transaction.date == t["date"],
                Transaction.amount == t["amount"],
                Transaction.merchant == t["merchant"]
            ).first()

            if existing:
                continue

            txn = Transaction(
                user_id=current_user.id,
                account_id=account_id,
                import_job_id=import_job.id,
                date=t["date"],
                amount=t["amount"],
                merchant=t["merchant"],
                description=t.get("description"),
                bank_name=bank_name,
                card_last_four=card_last_four,
                source=TransactionSource.IMPORTED_PDF,
                status=TransactionStatus.PENDING
            )

            db.add(txn)
            created_transactions.append(txn)

        import_job.status = ImportJobStatus.COMPLETED
        import_job.completed_at = datetime.now()

        db.commit()

        for t in created_transactions:
            db.refresh(t)

    except Exception as e:
        import_job.status = ImportJobStatus.FAILED
        import_job.error_message = str(e)
        db.commit()
        raise HTTPException(400, f"Import failed: {str(e)}")

    return {
        "import_job": import_job,
        "transactions": created_transactions
    }


# =========================
# IMPORT HISTORY
# =========================
@router.get("/", response_model=List[ImportJobResponse])
def get_import_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return (
        db.query(ImportJob)
        .filter(ImportJob.user_id == current_user.id)
        .order_by(ImportJob.created_at.desc())
        .all()
    )


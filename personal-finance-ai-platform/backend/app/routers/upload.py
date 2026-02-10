from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Transaction, User, Category, MerchantRule, TransactionSource, TransactionStatus
from app.schemas import TransactionResponse
from app.auth import get_current_user
import pdfplumber
import csv
import io
from datetime import datetime
import re

router = APIRouter()

def _value_present(val) -> bool:
    """Return True if value is not None and not empty (replaces pd.notna for strings)."""
    if val is None:
        return False
    return str(val).strip() != ""

def parse_csv(file_content: bytes) -> List[dict]:
    """Parse CSV file and extract transactions (uses stdlib csv, no pandas)."""
    try:
        text = file_content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            raise ValueError("No data rows in CSV")
        columns = list(rows[0].keys())
        transactions = []

        date_cols = ["date", "transaction_date", "Date", "Transaction Date"]
        amount_cols = ["amount", "Amount", "transaction_amount"]
        merchant_cols = ["merchant", "Merchant", "description", "Description", "vendor"]
        desc_cols = ["description", "Description", "details", "Details"]

        date_col = next((c for c in date_cols if c in columns), None)
        amount_col = next((c for c in amount_cols if c in columns), None)
        merchant_col = next((c for c in merchant_cols if c in columns), None)
        desc_col = next((c for c in desc_cols if c in columns), None)

        if not date_col or not amount_col or not merchant_col:
            raise ValueError("Required columns not found in CSV")

        for row in rows:
            try:
                date_str = str(row.get(date_col, ""))
                amount = float(row.get(amount_col, 0))
                merchant = str(row.get(merchant_col, ""))
                description = str(row[desc_col]).strip() if desc_col and _value_present(row.get(desc_col)) else None

                date = None
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        date = datetime.strptime(date_str.strip(), fmt)
                        break
                    except ValueError:
                        continue

                if date:
                    transactions.append({
                        "date": date,
                        "amount": abs(amount),
                        "merchant": merchant,
                        "description": description,
                    })
            except (ValueError, TypeError, KeyError):
                continue

        return transactions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")

def parse_pdf(file_content: bytes) -> List[dict]:
    """Parse PDF file and extract transactions"""
    transactions = []
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                
                # Try to extract table data
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        # Look for transaction rows
                        for row in table[1:]:  # Skip header
                            if len(row) >= 3:
                                try:
                                    # Try to extract date, amount, merchant
                                    date_str = str(row[0]) if row[0] else ""
                                    amount_str = str(row[-1]) if row[-1] else ""
                                    merchant = str(row[1]) if len(row) > 1 else ""
                                    
                                    # Extract amount (remove currency symbols)
                                    amount_match = re.search(r'[\d,]+\.?\d*', amount_str.replace(',', ''))
                                    if amount_match:
                                        amount = float(amount_match.group().replace(',', ''))
                                        
                                        # Try to parse date
                                        date = None
                                        for fmt in ['%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d', '%d %b %Y']:
                                            try:
                                                date = datetime.strptime(date_str.strip(), fmt)
                                                break
                                            except:
                                                continue
                                        
                                        if date and merchant:
                                            transactions.append({
                                                'date': date,
                                                'amount': abs(amount),
                                                'merchant': merchant.strip(),
                                                'description': None
                                            })
                                except:
                                    continue
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing PDF: {str(e)}")
    
    return transactions

def auto_categorize_transaction(merchant: str, db: Session, user_id: int) -> int:
    """Auto-categorize transaction using merchant rules"""
    # Check merchant rules first
    rules = db.query(MerchantRule).filter(
        MerchantRule.user_id == user_id,
        MerchantRule.is_active == True
    ).all()
    
    for rule in rules:
        if rule.merchant_pattern.lower() in merchant.lower():
            return rule.category_id
    
    # Default categories based on keywords
    merchant_lower = merchant.lower()
    
    # Food & Dining
    if any(kw in merchant_lower for kw in ['restaurant', 'cafe', 'food', 'dining', 'starbucks', 'mcdonald']):
        category = db.query(Category).filter(
            Category.user_id == user_id,
            Category.name.ilike('%food%')
        ).first()
        if category:
            return category.id
    
    # Transportation
    if any(kw in merchant_lower for kw in ['grab', 'uber', 'taxi', 'transport', 'mrt', 'bus']):
        category = db.query(Category).filter(
            Category.user_id == user_id,
            Category.name.ilike('%transport%')
        ).first()
        if category:
            return category.id
    
    # Shopping
    if any(kw in merchant_lower for kw in ['shop', 'store', 'retail', 'amazon', 'lazada']):
        category = db.query(Category).filter(
            Category.user_id == user_id,
            Category.name.ilike('%shopping%')
        ).first()
        if category:
            return category.id
    
    return None

@router.post("/csv", response_model=List[TransactionResponse])
async def upload_csv(
    file: UploadFile = File(...),
    bank_name: str = None,
    card_last_four: str = None,
    statement_period: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    transactions_data = parse_csv(content)
    
    created_transactions = []
    for t_data in transactions_data:
        category_id = auto_categorize_transaction(t_data['merchant'], db, current_user.id)
        
        transaction = Transaction(
            user_id=current_user.id,
            date=t_data['date'],
            amount=t_data['amount'],
            merchant=t_data['merchant'],
            description=t_data.get('description'),
            bank_name=bank_name,
            card_last_four=card_last_four,
            statement_period=statement_period,
            category_id=category_id,
            source=TransactionSource.IMPORTED_CSV,
            status=TransactionStatus.PROCESSED
        )
        db.add(transaction)
        created_transactions.append(transaction)
    
    db.commit()
    
    result = []
    for t in created_transactions:
        db.refresh(t)
        result.append(TransactionResponse(
            id=t.id,
            date=t.date,
            amount=t.amount,
            merchant=t.merchant,
            description=t.description,
            transaction_type=t.transaction_type,
            status=t.status,
            bank_name=t.bank_name,
            card_last_four=t.card_last_four,
            category_id=t.category_id,
            category_name=t.category.name if t.category else None,
            account_id=t.account_id,
            account_name=t.account.name if t.account else None,
            import_job_id=t.import_job_id,
            source=t.source,
            is_anomaly=t.is_anomaly,
            anomaly_score=t.anomaly_score
        ))
    
    return result

@router.post("/pdf", response_model=List[TransactionResponse])
async def upload_pdf(
    file: UploadFile = File(...),
    bank_name: str = None,
    card_last_four: str = None,
    statement_period: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    content = await file.read()
    transactions_data = parse_pdf(content)
    
    if not transactions_data:
        raise HTTPException(status_code=400, detail="No transactions found in PDF")
    
    created_transactions = []
    for t_data in transactions_data:
        category_id = auto_categorize_transaction(t_data['merchant'], db, current_user.id)
        
        transaction = Transaction(
            user_id=current_user.id,
            date=t_data['date'],
            amount=t_data['amount'],
            merchant=t_data['merchant'],
            description=t_data.get('description'),
            bank_name=bank_name,
            card_last_four=card_last_four,
            statement_period=statement_period,
            category_id=category_id,
            source=TransactionSource.IMPORTED_PDF,
            status=TransactionStatus.PROCESSED
        )
        db.add(transaction)
        created_transactions.append(transaction)
    
    db.commit()
    
    result = []
    for t in created_transactions:
        db.refresh(t)
        result.append(TransactionResponse(
            id=t.id,
            date=t.date,
            amount=t.amount,
            merchant=t.merchant,
            description=t.description,
            transaction_type=t.transaction_type,
            status=t.status,
            bank_name=t.bank_name,
            card_last_four=t.card_last_four,
            category_id=t.category_id,
            category_name=t.category.name if t.category else None,
            account_id=t.account_id,
            account_name=t.account.name if t.account else None,
            import_job_id=t.import_job_id,
            source=t.source,
            is_anomaly=t.is_anomaly,
            anomaly_score=t.anomaly_score
        ))
    
    return result

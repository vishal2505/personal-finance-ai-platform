from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Transaction, User, Category, MerchantRule, Account, ImportJob, ImportJobStatus, TransactionSource, TransactionStatus
from app.schemas import TransactionResponse, ImportJobResponse
from app.auth import get_current_user
import pdfplumber
import pandas as pd
import io
from datetime import datetime
import re

router = APIRouter()

def parse_csv(file_content: bytes) -> List[dict]:
    """Parse CSV file and extract transactions"""
    try:
        df = pd.read_csv(io.BytesIO(file_content))
        transactions = []
        
        # Common CSV column mappings
        date_cols = ['date', 'transaction_date', 'Date', 'Transaction Date']
        amount_cols = ['amount', 'Amount', 'transaction_amount']
        merchant_cols = ['merchant', 'Merchant', 'description', 'Description', 'vendor']
        desc_cols = ['description', 'Description', 'details', 'Details']
        
        date_col = next((col for col in date_cols if col in df.columns), None)
        amount_col = next((col for col in amount_cols if col in df.columns), None)
        merchant_col = next((col for col in merchant_cols if col in df.columns), None)
        desc_col = next((col for col in desc_cols if col in df.columns), None)
        
        if not date_col or not amount_col or not merchant_col:
            raise ValueError("Required columns not found in CSV")
        
        for _, row in df.iterrows():
            try:
                date_str = str(row[date_col])
                amount = float(row[amount_col])
                merchant = str(row[merchant_col])
                description = str(row[desc_col]) if desc_col and pd.notna(row.get(desc_col)) else None
                
                # Try to parse date
                date = None
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S']:
                    try:
                        date = datetime.strptime(date_str, fmt)
                        break
                    except:
                        continue
                
                if date:
                    transactions.append({
                        'date': date,
                        'amount': abs(amount),
                        'merchant': merchant,
                        'description': description
                    })
            except Exception as e:
                continue
        
        return transactions
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

@router.post("/upload", response_model=ImportJobResponse)
async def upload_statement(
    file: UploadFile = File(...),
    account_id: Optional[int] = None,
    statement_period: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a bank statement (CSV/PDF) and create an import job"""
    
    is_csv = file.filename.endswith('.csv')
    is_pdf = file.filename.endswith('.pdf')
    
    if not is_csv and not is_pdf:
        raise HTTPException(status_code=400, detail="File must be a CSV or PDF")
    
    # Create ImportJob
    import_job = ImportJob(
        user_id=current_user.id,
        account_id=account_id,
        filename=file.filename,
        file_type='csv' if is_csv else 'pdf',
        status=ImportJobStatus.PROCESSING,
        statement_period=statement_period
    )
    db.add(import_job)
    db.commit()
    db.refresh(import_job)
    
    try:
        content = await file.read()
        if is_csv:
            transactions_data = parse_csv(content)
            source = TransactionSource.IMPORTED_CSV
        else:
            transactions_data = parse_pdf(content)
            source = TransactionSource.IMPORTED_PDF
            
        import_job.total_transactions = len(transactions_data)
        
        # Create transactions in PENDING status
        for t_data in transactions_data:
            category_id = auto_categorize_transaction(t_data['merchant'], db, current_user.id)
            
            transaction = Transaction(
                user_id=current_user.id,
                account_id=account_id,
                import_job_id=import_job.id,
                date=t_data['date'],
                amount=t_data['amount'],
                merchant=t_data['merchant'],
                description=t_data.get('description'),
                category_id=category_id,
                source=source,
                status=TransactionStatus.PENDING
            )
            db.add(transaction)
            import_job.processed_transactions += 1
            
        import_job.status = ImportJobStatus.COMPLETED
        import_job.completed_at = datetime.now()
        db.commit()
        
    except Exception as e:
        import_job.status = ImportJobStatus.FAILED
        import_job.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
        
    db.refresh(import_job)
    return import_job

@router.get("/", response_model=List[ImportJobResponse])
def get_import_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all import jobs for the current user"""
    return db.query(ImportJob).filter(ImportJob.user_id == current_user.id).order_by(ImportJob.created_at.desc()).all()

@router.get("/{job_id}", response_model=ImportJobResponse)
def get_import_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details for a specific import job"""
    job = db.query(ImportJob).filter(
        and_(ImportJob.id == job_id, ImportJob.user_id == current_user.id)
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    return job

@router.get("/{job_id}/transactions", response_model=List[TransactionResponse])
def get_import_job_transactions(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions associated with an import job"""
    job = db.query(ImportJob).filter(
        and_(ImportJob.id == job_id, ImportJob.user_id == current_user.id)
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    transactions = db.query(Transaction).filter(Transaction.import_job_id == job_id).all()
    
    # Map to schema correctly (handling relationships)
    result = []
    for t in transactions:
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

@router.post("/{job_id}/confirm")
def confirm_import_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm and process all transactions in an import job"""
    job = db.query(ImportJob).filter(
        and_(ImportJob.id == job_id, ImportJob.user_id == current_user.id)
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    # Update all pending transactions in this job to PROCESSED
    db.query(Transaction).filter(
        and_(Transaction.import_job_id == job_id, Transaction.status == TransactionStatus.PENDING)
    ).update({"status": TransactionStatus.PROCESSED})
    
    db.commit()
    return {"message": f"Successfully confirmed transactions for import job {job_id}"}

@router.delete("/{job_id}")
def delete_import_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an import job and its pending transactions"""
    job = db.query(ImportJob).filter(
        and_(ImportJob.id == job_id, ImportJob.user_id == current_user.id)
    ).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
        
    # Delete transactions that are still PENDING
    db.query(Transaction).filter(
        and_(Transaction.import_job_id == job_id, Transaction.status == TransactionStatus.PENDING)
    ).delete()
    
    db.delete(job)
    db.commit()
    return {"message": "Import job and pending transactions deleted"}

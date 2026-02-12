from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Transaction, User, Category, MerchantRule, Account, ImportJob, ImportJobStatus, TransactionSource, TransactionStatus
from app.schemas import TransactionResponse, ImportJobResponse
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

def _sanitize_currency(amount_str: str) -> float:
    """Sanitize currency string by removing non-numeric characters (except dot and minus).
    
    Converts strings like "$1,200.50", "1.200,50", "-$500" to valid floats.
    
    Args:
        amount_str: Raw amount string from CSV
        
    Returns:
        Parsed float value
        
    Raises:
        ValueError: If string cannot be converted to float
    """
    if not amount_str:
        return 0.0
    
    # Remove all non-numeric characters except dot and minus
    sanitized = re.sub(r'[^\d.-]', '', str(amount_str).strip())
    
    if not sanitized or sanitized == '-':
        return 0.0
    
    return float(sanitized)


def _detect_header_row(lines: List[str], max_lines: int = 20) -> tuple[int, dict]:
    """Detect the actual header row by finding one that contains both 'date' and 'amount'.
    
    Skips account balance headers and other metadata often found in downloaded statements.
    
    Args:
        lines: List of CSV lines
        max_lines: Maximum number of lines to check before giving up
        
    Returns:
        Tuple of (header_row_index, column_dict) where column_dict maps column names
        
    Raises:
        ValueError: If no valid header row is found
    """
    for idx, line in enumerate(lines[:max_lines]):
        # Parse this line as potential header
        reader = csv.DictReader(io.StringIO(line))
        if reader.fieldnames:
            headers_lower = [h.lower() for h in reader.fieldnames]
            # Check if this line contains both date and amount keywords
            has_date = any('date' in h for h in headers_lower)
            has_amount = any('amount' in h for h in headers_lower)
            
            if has_date and has_amount:
                return idx, dict(zip(reader.fieldnames, reader.fieldnames))
    
    raise ValueError("Could not find valid CSV header with 'date' and 'amount' columns")


def parse_csv(file_content: bytes) -> List[dict]:
    """Parse CSV file and extract transactions with robust header detection and encoding.
    
    Features:
    - Smart encoding detection (UTF-8 with fallback to Latin-1)
    - Header detection logic: scans first 20 lines for actual headers
    - Handles account statements with metadata headers
    - Currency sanitization: removes symbols, commas, normalizes format
    - Empty row handling: skips rows with all empty values
    - Multiple date/amount/merchant column name variations
    
    Args:
        file_content: Raw file bytes
        
    Returns:
        List of parsed transaction dictionaries
        
    Raises:
        HTTPException: If parsing fails
    """
    try:
        # SMART ENCODING: Try UTF-8 first, fall back to Latin-1
        try:
            text = file_content.decode("utf-8")
        except UnicodeDecodeError:
            text = file_content.decode("latin-1")
        
        lines = text.strip().split('\n')
        if not lines:
            raise ValueError("CSV file is empty")
        
        # HEADER DETECTION: Find actual header row (skip account balance, etc.)
        header_idx, _ = _detect_header_row(lines)
        
        # Re-parse CSV starting from detected header
        csv_text = '\n'.join(lines[header_idx:])
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
        
        if not rows:
            raise ValueError("No data rows found in CSV after header")
        
        columns = list(rows[0].keys())
        transactions = []
        
        # Column name variations to search for
        date_cols = ["date", "transaction_date", "Date", "Transaction Date", "Date Time", "datetime"]
        amount_cols = ["amount", "Amount", "transaction_amount", "Transaction Amount", "value", "Value"]
        merchant_cols = ["merchant", "Merchant", "description", "Description", "vendor", "Vendor", "details", "Details"]
        desc_cols = ["description", "Description", "details", "Details", "narration", "Narration", "memo", "Memo"]
        
        # Find matching columns (case-insensitive)
        date_col = next((c for c in columns for dc in date_cols if dc.lower() == c.lower()), None)
        amount_col = next((c for c in columns for ac in amount_cols if ac.lower() == c.lower()), None)
        merchant_col = next((c for c in columns for mc in merchant_cols if mc.lower() == c.lower()), None)
        desc_col = next((c for c in columns for dc in desc_cols if dc.lower() == c.lower()), None)
        
        if not date_col or not amount_col or not merchant_col:
            raise ValueError(f"Required columns not found. Found: {columns}")
        
        for row in rows:
            # EMPTY ROW HANDLING: Skip rows where all values are empty/None
            if not any(row.values()):
                continue
            
            try:
                date_str = str(row.get(date_col, "")).strip()
                merchant = str(row.get(merchant_col, "")).strip()
                
                # Skip rows with empty required fields
                if not date_str or not merchant:
                    continue
                
                # CURRENCY SANITIZATION: Remove currency symbols and format issues
                amount_str = str(row.get(amount_col, "0")).strip()
                amount = _sanitize_currency(amount_str)
                
                # Parse description if available
                description = None
                if desc_col and _value_present(row.get(desc_col)):
                    description = str(row[desc_col]).strip()
                
                # Try multiple date formats
                date = None
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S", 
                            "%d-%m-%Y", "%m-%d-%Y", "%d %b %Y", "%Y/%m/%d", "%d.%m.%Y"]:
                    try:
                        date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                
                if date and merchant and amount > 0:
                    transactions.append({
                        "date": date,
                        "amount": abs(amount),
                        "merchant": merchant,
                        "description": description,
                    })
            except (ValueError, TypeError, KeyError) as e:
                # Log and continue with next row
                continue
        
        if not transactions:
            raise ValueError("No valid transactions found in CSV")
        
        return transactions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")

def _find_header_indices(header_row: List[str]) -> dict:
    """Dynamically discover column indices from header row.
    
    Scans header row for keywords like "Date", "Amount", "Description", "Particulars".
    Works with different PDF statement layouts without hardcoding column positions.
    
    Args:
        header_row: First row of PDF table (assumed to be headers)
        
    Returns:
        Dictionary mapping field names to column indices
        E.g., {'date': 0, 'amount': 2, 'merchant': 1}
        
    Raises:
        ValueError: If required columns (date, amount) not found
    """
    indices = {}
    
    date_keywords = ['date', 'transaction date', 'posting date', 'posted', 'trans date']
    amount_keywords = ['amount', 'debit', 'credit', 'value', 'transaction amount', 'amt']
    merchant_keywords = ['description', 'particulars', 'merchant', 'details', 'narration', 'remarks']
    
    header_lower = [str(h).lower().replace('\n', ' ').strip() for h in header_row if h]
    
    # Find date column
    for idx, header in enumerate(header_lower):
        if any(kw in header for kw in date_keywords):
            indices['date'] = idx
            break
    
    # Find amount column
    for idx, header in enumerate(header_lower):
        if any(kw in header for kw in amount_keywords):
            indices['amount'] = idx
            break
    
    # Find merchant/description column (optional)
    for idx, header in enumerate(header_lower):
        if any(kw in header for kw in merchant_keywords):
            indices['merchant'] = idx
            break
    
    # If no merchant column found, use column after date or second column
    if 'merchant' not in indices:
        indices['merchant'] = indices.get('date', 0) + 1 if indices.get('date', 0) + 1 < len(header_lower) else 1
    
    # Validate required columns
    if 'date' not in indices or 'amount' not in indices:
        raise ValueError(f"Could not find required columns (date/amount) in PDF header. Found: {header_lower}")
    
    return indices


def _parse_amount_with_suffix(amount_str: str) -> float:
    """Parse amount string that may have Dr/Cr suffix or currency symbols.
    
    Handles formats like:
    - "50.00"
    - "$1,200.50"
    - "50.00 Cr"
    - "500.00 Dr"
    - "€1.200,50"
    - "-500"
    
    Args:
        amount_str: Raw amount string from PDF
        
    Returns:
        Parsed float value
        
    Raises:
        ValueError: If amount cannot be parsed
    """
    if not amount_str or not str(amount_str).strip():
        return 0.0
    
    cleaned = str(amount_str).strip()
    
    # Remove newlines (PDF tables often have them)
    cleaned = cleaned.replace('\n', ' ').strip()
    
    # Check for Dr/Cr suffixes and track if negative
    is_negative = False
    cleaned_lower = cleaned.lower()
    
    if 'dr' in cleaned_lower:
        # Debit - typically negative
        is_negative = True
        cleaned = re.sub(r'\s*dr\s*', '', cleaned, flags=re.IGNORECASE)
    elif 'cr' in cleaned_lower:
        # Credit - typically positive
        cleaned = re.sub(r'\s*cr\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Check for negative sign
    if cleaned.lstrip().startswith('-'):
        is_negative = True
    
    # Remove all non-numeric characters except dot and minus
    sanitized = re.sub(r'[^\d.-]', '', cleaned.strip())
    
    if not sanitized or sanitized == '-':
        return 0.0
    
    try:
        amount = float(sanitized)
        # Apply negative flag if detected
        if is_negative:
            amount = abs(amount)
        return amount
    except ValueError:
        return 0.0


def parse_pdf(file_content: bytes) -> List[dict]:
    """Parse PDF file and extract transactions with dynamic header detection.
    
    Features:
    - Dynamic header discovery: Scans first few rows for column names
    - Works with different PDF layouts without hardcoding positions
    - Handles "dirty" PDF text: removes newlines from cells
    - Advanced amount parsing: Handles Dr/Cr suffixes, currency symbols
    - Skips total rows: Ignores summary rows at end of statements
    - Multiple date format support
    
    Args:
        file_content: Raw PDF file bytes
        
    Returns:
        List of parsed transaction dictionaries
        
    Raises:
        HTTPException: If parsing fails
    """
    transactions = []
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text:
                    continue
                
                # Try to extract table data
                tables = page.extract_tables()
                if not tables:
                    continue
                
                for table_num, table in enumerate(tables):
                    if not table or len(table) < 2:
                        continue
                    
                    try:
                        # DYNAMIC HEADER DISCOVERY: Find column indices from header
                        header_indices = _find_header_indices(table[0])
                        date_col = header_indices['date']
                        amount_col = header_indices['amount']
                        merchant_col = header_indices['merchant']
                        
                    except (ValueError, IndexError) as e:
                        # Skip this table if we can't find headers
                        continue
                    
                    # Process data rows (skip header at index 0)
                    for row_num, row in enumerate(table[1:], 1):
                        if not row or len(row) <= max(date_col, amount_col, merchant_col):
                            continue
                        
                        try:
                            # Get raw cell values and clean newlines
                            date_str = str(row[date_col]).replace('\n', ' ').strip() if row[date_col] else ""
                            merchant = str(row[merchant_col]).replace('\n', ' ').strip() if row[merchant_col] else ""
                            amount_str = str(row[amount_col]).replace('\n', ' ').strip() if row[amount_col] else ""
                            
                            # IGNORE TOTAL ROWS: Skip rows that start with "Total"
                            if any(keyword in str(row[0]).lower() for keyword in ['total', 'subtotal', 'balance']):
                                continue
                            
                            # Skip empty required fields
                            if not date_str or not merchant or not amount_str:
                                continue
                            
                            # ADVANCED AMOUNT CLEANING: Handle Dr/Cr suffixes
                            amount = _parse_amount_with_suffix(amount_str)
                            if amount == 0.0:
                                continue
                            
                            # Try to parse date with multiple formats
                            date = None
                            for fmt in ['%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d', '%d %b %Y', 
                                       '%d-%m-%Y', '%m-%d-%Y', '%Y/%m/%d', '%d.%m.%Y',
                                       '%d %b', '%d-%b', '%d/%m']:
                                try:
                                    date = datetime.strptime(date_str, fmt)
                                    break
                                except ValueError:
                                    continue
                            
                            # Only add if we successfully parsed date and have merchant
                            if date and merchant:
                                transactions.append({
                                    'date': date,
                                    'amount': abs(amount),
                                    'merchant': merchant,
                                    'description': None
                                })
                        
                        except (ValueError, TypeError, AttributeError, IndexError):
                            # Skip malformed rows and continue
                            continue
        
        if not transactions:
            raise ValueError("No valid transactions found in PDF")
        
        return transactions
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing PDF: {str(e)}")

def _preprocess_merchant(merchant: str) -> str:
    """Preprocess merchant name for better matching.
    
    - Strips whitespace
    - Converts to lowercase
    - Removes special characters
    - Normalizes spaces
    
    Args:
        merchant: Raw merchant name
        
    Returns:
        Cleaned merchant name
    """
    if not merchant or not isinstance(merchant, str):
        return ""
    
    # Strip and convert to lowercase
    cleaned = merchant.strip().lower()
    
    # Normalize spaces (remove extra whitespace)
    cleaned = ' '.join(cleaned.split())
    
    # Remove special characters, keep only alphanumeric and spaces
    cleaned = re.sub(r'[^a-z0-9\s]', '', cleaned)
    
    return cleaned


def auto_categorize_transaction(merchant: str, db: Session, user_id: int) -> Optional[int]:
    """Auto-categorize transaction using merchant rules with preprocessing and optimization.
    
    Strategy:
    1. Preprocesses merchant input (strips, lowercases, removes special chars)
    2. Checks user-defined merchant rules first
    3. Uses keyword dictionary map for pattern matching
    4. Optimizes by fetching all categories in one query instead of multiple queries
    
    Args:
        merchant: Raw merchant name from transaction
        db: Database session
        user_id: User ID for filtering categories and rules
        
    Returns:
        Category ID if matched, None otherwise
    """
    
    # 1. PREPROCESSING: Clean the input
    merchant_cleaned = _preprocess_merchant(merchant)
    
    if not merchant_cleaned:
        return None
    
    # 2. Check merchant rules first (user-defined patterns have priority)
    rules = db.query(MerchantRule).filter(
        MerchantRule.user_id == user_id,
        MerchantRule.is_active == True
    ).all()
    
    for rule in rules:
        if rule.merchant_pattern.lower() in merchant_cleaned:
            return rule.category_id
    
    # 3. OPTIMIZATION: Fetch all categories once instead of multiple queries
    categories = db.query(Category).filter(
        Category.user_id == user_id
    ).all()
    
    # Create a lookup map for efficient category matching by name
    category_lookup = {cat.name.lower(): cat.id for cat in categories}
    
    # DICTIONARY MAP: Keyword-to-category mapping for pattern matching
    category_keywords = {
        'food': ['restaurant', 'cafe', 'food', 'dining', 'starbucks', 'mcdonald', 'pizza', 'burger', 'sushi', 'bakery', 'donut', 'fast food', 'bistro', 'diner', 'grill', 'bbq', 'ramen', 'noodle', 'chicken', 'seafood', 'dessert', 'ice cream', 'coffee', 'tea', 'juice', 'smoothie', 'kopitiam', 'hawker', 'chicken rice', 'laksa', 'satay', 'dim sum', 'yum cha', 'toast box', 'jollibbee', 'chir chir', 'mcspicy'],
        'transportation': ['grab', 'uber', 'taxi', 'transport', 'mrt', 'bus', 'parking', 'gas', 'fuel', 'carpark', 'petrol', 'lyft', 'train', 'flight', 'airline', 'tolls', 'metro', 'transit', 'uber eats', 'smrt', 'lrt', 'ets', 'gojek'],
        'shopping': ['shop', 'store', 'retail', 'amazon', 'lazada', 'mall', 'supermarket', 'mart', 'clothing', 'department', 'shopee', 'aliexpress', 'ebay', 'target', 'walmart', 'costco', 'cold storage', 'ntuc', 'giant', 'carrefour', 'courts', 'best denki', 'challenger'],
        'entertainment': ['movie', 'cinema', 'theatre', 'game', 'spotify', 'netflix', 'streaming', 'arcade', 'karaoke', 'disney', 'hulu', 'youtube', 'twitch', 'steam', 'playstation', 'xbox', 'concert', 'tickets', 'gv', 'shaw', 'cathay', 'golden village', 'bugis plus'],
        'utilities': ['electric', 'water', 'internet', 'phone', 'utility', 'bills', 'subscription', 'isp', 'telecom', 'energy', 'power', 'broadband', 'wifi', 'singtel', 'starhub', 'm1', 'sp group'],
        'healthcare': ['hospital', 'clinic', 'pharmacy', 'doctor', 'medical', 'health', 'dentist', 'therapist', 'optician', 'veterinary', 'wellness', 'gym', 'fitness', 'raffles', 'parkway', 'gleneagles', 'mount elizabeth', 'guardian', 'watsons'],
        'accommodation': ['hotel', 'airbnb', 'resort', 'hostel', 'motel', 'booking', 'accommodation', 'lodging', 'rent', 'apartment', 'village hotel', 'furama', 'swissotel'],
        'fitness': ['gym', 'yoga', 'fitness', 'sport', 'trainer', 'exercise', 'workout', 'swimming', 'tennis', 'cycling', 'f45', 'orangetheory', 'virgin active', 'year round'],
        'education': ['school', 'university', 'college', 'course', 'learning', 'tuition', 'education', 'class', 'training', 'udemy', 'nus', 'ntu', 'smu', 'iss'],
        'insurance': ['insurance', 'premium', 'axa', 'allianz', 'claim', 'ntuc income', 'great eastern', 'aviva', 'oic'],
        'financial': ['bank', 'atm', 'transfer', 'wire', 'loan', 'mortgage', 'investment', 'brokerage', 'crypto', 'forex', 'dbs', 'ocbc', 'uob', 'maybank', 'cimb', 'ib', 'saxo'],
        'personal_care': ['salon', 'barber', 'spa', 'massage', 'cosmetics', 'beauty', 'haircut', 'nails', 'grooming', 'hair lab', 'la klinik', 'esthetic'],
        'gifts_donations': ['gift', 'flowers', 'charity', 'donation', 'donate', 'flower chimp'],
        'office_supplies': ['office', 'stationery', 'supply', 'supplies', 'paper', 'pen', 'ink', 'popular', 'g1000'],
        'home_maintenance': ['hardware', 'home depot', 'lowes', 'plumber', 'electrician', 'maintenance', 'repair', 'renovation', 'home improvement', 'bestmart', 'kaison'],
        'pets': ['pet', 'veterinary', 'vet', 'dog', 'cat', 'petmart', 'pet store', 'only pet', 'pet lovers'],
        'childcare': ['daycare', 'babysitter', 'nanny', 'childcare'],
    }
    
    # Match merchant against keyword map
    for category_keyword, keywords in category_keywords.items():
        if any(kw in merchant_cleaned for kw in keywords):
            # Search for matching category in lookup
            for cat_name, cat_id in category_lookup.items():
                if category_keyword in cat_name:
                    return cat_id
    
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

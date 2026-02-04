# Core Backend for Manual and Imported Spending Records

A backend system enabling users to **manually add transactions** and **import transactions from statements** (CSV/PDF), with features for tracking, categorization, and account/card association.

---

## Current State Analysis

### Existing Components
- **Transaction Model** ([models.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/models.py)): Complete with fields for date, amount, merchant, category, bank/card info, anomaly tracking
- **Upload Router** ([upload.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/upload.py)): CSV/PDF parsing with auto-categorization
- **Transactions Router** ([transactions.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/transactions.py)): GET, PUT, DELETE operations

### Missing Features
| Feature | Status | Priority |
|---------|--------|----------|
| Manual transaction creation (POST) | ❌ Missing | High |
| Account/Card management | ❌ Missing | High |
| Import job tracking | ❌ Missing | Medium |
| Data source tracking (manual vs imported) | ❌ Missing | Medium |

---

## Proposed Changes

### Data Model Layer

#### [MODIFY] [models.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/models.py)

1. **Add `TransactionSource` enum** to distinguish manual vs imported transactions:
```python
class TransactionSource(str, enum.Enum):
    MANUAL = "manual"
    IMPORTED_CSV = "imported_csv"
    IMPORTED_PDF = "imported_pdf"
```

2. **Add `source` field to Transaction model**:
```python
source = Column(SQLEnum(TransactionSource), default=TransactionSource.MANUAL)
```

3. **Add `Account` model** for tracking bank accounts/cards:
```python
class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "DBS Credit Card"
    bank_name = Column(String, nullable=False)
    card_last_four = Column(String)
    account_type = Column(String, default="credit_card")  # credit_card, debit_card, bank_account
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
```

4. **Add `ImportJob` model** for tracking statement imports:
```python
class ImportJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ImportJob(Base):
    __tablename__ = "import_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # csv, pdf
    status = Column(SQLEnum(ImportJobStatus), default=ImportJobStatus.PENDING)
    statement_period = Column(String)
    
    total_transactions = Column(Integer, default=0)
    processed_transactions = Column(Integer, default=0)
    error_message = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    user = relationship("User", back_populates="import_jobs")
    account = relationship("Account")
```

5. **Update Transaction model** with account and import job references:
```python
account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
import_job_id = Column(Integer, ForeignKey("import_jobs.id"), nullable=True)
```

6. **Update User model** with new relationships:
```python
accounts = relationship("Account", back_populates="user")
import_jobs = relationship("ImportJob", back_populates="user")
```

---

#### [MODIFY] [schemas.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/schemas.py)

1. **Add Account schemas**:
```python
class AccountCreate(BaseModel):
    name: str
    bank_name: str
    card_last_four: Optional[str] = None
    account_type: str = "credit_card"

class AccountResponse(BaseModel):
    id: int
    name: str
    bank_name: str
    card_last_four: Optional[str]
    account_type: str
    is_active: bool
    
    class Config:
        from_attributes = True
```

2. **Add ImportJob schemas**:
```python
class ImportJobResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    status: str
    statement_period: Optional[str]
    total_transactions: int
    processed_transactions: int
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True
```

3. **Update TransactionCreate** to include account_id:
```python
class TransactionCreate(BaseModel):
    date: datetime
    amount: float
    merchant: str
    description: Optional[str] = None
    transaction_type: TransactionType = TransactionType.DEBIT
    category_id: Optional[int] = None
    account_id: Optional[int] = None
```

4. **Update TransactionResponse** with new fields:
```python
class TransactionResponse(BaseModel):
    # ... existing fields ...
    source: str
    account_id: Optional[int]
    account_name: Optional[str] = None
    import_job_id: Optional[int]
```

---

### API Layer

#### [MODIFY] [transactions.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/transactions.py)

1. **Add POST endpoint for manual transaction creation**:
```python
@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate category and account ownership
    # Create transaction with source=MANUAL
    # Return created transaction
```

---

#### [NEW] [accounts.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/accounts.py)

CRUD endpoints for account management:
- `GET /accounts` - List user's accounts
- `POST /accounts` - Create new account
- `GET /accounts/{id}` - Get specific account
- `PUT /accounts/{id}` - Update account
- `DELETE /accounts/{id}` - Soft-delete account

---

#### [NEW] [imports.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/imports.py)

Import job management endpoints:
- `POST /imports/upload` - Upload statement (refactored from upload.py)
- `GET /imports` - List import jobs
- `GET /imports/{id}` - Get import job details with transactions
- `POST /imports/{id}/confirm` - Confirm imported transactions
- `DELETE /imports/{id}` - Cancel/delete import job

---

#### [MODIFY] [upload.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/routers/upload.py)

Refactor to:
1. Create ImportJob record before parsing
2. Track transactions with `source` and `import_job_id`
3. Link transactions to accounts when provided

---

#### [MODIFY] [main.py](file:///c:/A-IS631%20MSS/Projects/personal-finance-ai-platform/personal-finance-ai-platform/backend/app/main.py)

Register new routers:
```python
from app.routers import accounts, imports

app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
```

---

## API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions` | POST | Create manual transaction |
| `/api/transactions` | GET | List transactions (with source filter) |
| `/api/accounts` | GET | List accounts |
| `/api/accounts` | POST | Create account |
| `/api/accounts/{id}` | GET/PUT/DELETE | Account CRUD |
| `/api/imports/upload` | POST | Upload statement |
| `/api/imports` | GET | List import jobs |
| `/api/imports/{id}` | GET | Get import details |
| `/api/imports/{id}/confirm` | POST | Confirm import |

---

## Verification Plan

### Automated Tests

> [!IMPORTANT]
> No existing tests were found in the backend. I recommend creating a test suite.

**New test file**: `backend/tests/test_spending_records.py`

Run tests with:
```bash
cd c:\A-IS631 MSS\Projects\personal-finance-ai-platform\personal-finance-ai-platform\backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

Test coverage:
1. Manual transaction creation (POST `/api/transactions`)
2. Account CRUD operations
3. Import job creation and status tracking
4. Transaction source filtering

---

### Manual Verification

**Prerequisites**: Start the backend server:
```bash
cd c:\A-IS631 MSS\Projects\personal-finance-ai-platform\personal-finance-ai-platform\backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Test via Swagger UI** at `http://localhost:8000/docs`:

1. **Register/Login** to get JWT token
2. **Create Account**: POST `/api/accounts` with `{"name": "Test Card", "bank_name": "DBS", "card_last_four": "1234"}`
3. **Create Manual Transaction**: POST `/api/transactions` with transaction data
4. **List Transactions**: GET `/api/transactions` - verify `source: "manual"` appears
5. **Upload CSV**: POST `/api/imports/upload` - verify import job created
6. **Confirm Import**: POST `/api/imports/{id}/confirm` - verify transactions added

---

## Questions for Review

> [!NOTE]
> Please confirm before proceeding:

1. **Account requirement**: Should transactions require an account, or is it optional for manual entries?
2. **Import confirmation flow**: Should imported transactions be in "pending" status until user confirms, or auto-confirm?
3. **Test scope**: Should I create comprehensive pytest tests, or focus on Swagger manual testing for now?

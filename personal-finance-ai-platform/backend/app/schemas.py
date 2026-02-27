from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models import TransactionType, TransactionStatus, BudgetPeriod

# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    status: Optional[str] = "success"  # "success" or "2fa_required"

class TokenData(BaseModel):
    email: Optional[str] = None
    scopes: List[str] = []

class TwoFactorVerify(BaseModel):
    code: str

# Transaction schemas
class TransactionCreate(BaseModel):
    date: datetime
    amount: float
    merchant: str
    description: Optional[str] = None
    transaction_type: TransactionType = TransactionType.DEBIT
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    bank_name: Optional[str] = None
    card_last_four: Optional[str] = None
    statement_period: Optional[str] = None

class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TransactionStatus] = None

class TransactionResponse(BaseModel):
    id: int
    date: datetime
    amount: float
    merchant: str
    description: Optional[str]
    transaction_type: TransactionType
    status: TransactionStatus
    bank_name: Optional[str]
    card_last_four: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str] = None
    account_id: Optional[int] = None
    account_name: Optional[str] = None
    import_job_id: Optional[int] = None
    source: str
    is_anomaly: bool
    anomaly_score: float
    
    class Config:
        from_attributes = True

class TransactionBulkUpdate(BaseModel):
    transaction_ids: List[int]
    category_id: Optional[int] = None
    status: Optional[TransactionStatus] = None

# Category schemas
## Copilot recommendation => Validation: Add constraints to sort_order (e.g., conint(ge=0)) to prevent negative ordering values
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(default="#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(default="💰", min_length=1, max_length=10)
    type: Optional[str] = Field(default="expense", pattern="^(expense|income|transfer)$")
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, min_length=1, max_length=10)
    parent_id: Optional[int] = None
    is_hidden: Optional[bool] = None
    sort_order: Optional[int] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    color: str = "#3B82F6"
    icon: str = "💰"
    type: str = "expense"
    parent_id: Optional[int] = None
    sort_order: int = 0
    is_system: bool = False
    is_active: bool = True
    is_hidden: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_id: Optional[int] = None

    class Config:
        from_attributes = True

class CategoryReorderItem(BaseModel):
    id: int
    sort_order: int

class CategoryReorder(BaseModel):
    categories: List[CategoryReorderItem]

class CategoryStats(BaseModel):
    category_id: int
    category_name: str
    transaction_count: int
    total_amount: float
    expense_count: int
    income_count: int

# Merchant Rule schemas
class MerchantRuleCreate(BaseModel):
    merchant_pattern: str
    match_type: str = "partial"
    category_id: int

class MerchantRuleResponse(BaseModel):
    id: int
    merchant_pattern: str
    match_type: str
    category_id: int
    category_name: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True

# Budget schemas
## Copilot recommendation => Date validation: Add a validator to ensure end_date >= start_date
class BudgetCreate(BaseModel):
    name: str
    amount: float
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    category_id: Optional[int] = None
    start_date: datetime
    end_date: Optional[datetime] = None

class BudgetResponse(BaseModel):
    id: int
    name: str
    amount: float
    period: BudgetPeriod
    category_id: Optional[int]
    category_name: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime]
    is_active: bool
    spent: Optional[float] = None
    
    class Config:
        from_attributes = True

# Insights schemas
## Copilot recommendation => InsightResponse: source is "rule" or "ai" — better as an enum for strictness
class InsightResponse(BaseModel):
    type: str
    title: str
    description: str
    data: Optional[dict] = None
    source: str = "rule"  # "rule" or "ai"

# Anomaly schemas
class AnomalyResponse(BaseModel):
    transaction_id: int
    transaction: TransactionResponse
    reason: str
    severity: str

# Account schemas
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
    created_at: datetime
    
    class Config:
        from_attributes = True

# Import Job schemas
## Copilot recommendation => Status field: Should be an enum (pending, processing, completed, failed) instead of free-form string
## Copilot recommendation => Error message: Consider defaulting to "" instead of None for consistency in API responses
class ImportJobResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    status: str
    statement_period: Optional[str]
    total_transactions: int
    processed_transactions: int
    total_amount: float
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    import_job: ImportJobResponse
    transactions: List[TransactionResponse]

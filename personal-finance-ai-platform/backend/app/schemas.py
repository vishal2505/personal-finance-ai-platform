from pydantic import BaseModel, EmailStr
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

class TokenData(BaseModel):
    email: Optional[str] = None

# Transaction schemas
class TransactionCreate(BaseModel):
    date: datetime
    amount: float
    merchant: str
    description: Optional[str] = None
    transaction_type: TransactionType = TransactionType.DEBIT
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
    is_anomaly: bool
    anomaly_score: float
    
    class Config:
        from_attributes = True

class TransactionBulkUpdate(BaseModel):
    transaction_ids: List[int]
    category_id: Optional[int] = None
    status: Optional[TransactionStatus] = None

# Category schemas
class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = "💰"

class CategoryResponse(BaseModel):
    id: int
    name: str
    color: str
    icon: str
    
    class Config:
        from_attributes = True

# Merchant Rule schemas
class MerchantRuleCreate(BaseModel):
    merchant_pattern: str
    category_id: int

class MerchantRuleResponse(BaseModel):
    id: int
    merchant_pattern: str
    category_id: int
    category_name: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True

# Budget schemas
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
class InsightResponse(BaseModel):
    type: str
    title: str
    description: str
    data: Optional[dict] = None

# Anomaly schemas
class AnomalyResponse(BaseModel):
    transaction_id: int
    transaction: TransactionResponse
    reason: str
    severity: str

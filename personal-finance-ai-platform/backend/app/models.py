from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TransactionType(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class TransactionSource(str, enum.Enum):
    MANUAL = "manual"
    IMPORTED_CSV = "imported_csv"
    IMPORTED_PDF = "imported_pdf"

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    REVIEWED = "reviewed"

class ImportJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class BudgetPeriod(str, enum.Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"
    WEEKLY = "weekly"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    categories = relationship("Category", back_populates="user")
    merchant_rules = relationship("MerchantRule", back_populates="user")
    accounts = relationship("Account", back_populates="user")
    import_jobs = relationship("ImportJob", back_populates="user")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    color = Column(String, default="#3B82F6")
    icon = Column(String, default="💰")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")

class MerchantRule(Base):
    __tablename__ = "merchant_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    merchant_pattern = Column(String, nullable=False)  # Pattern to match merchant names
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="merchant_rules")
    category = relationship("Category")

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

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Transaction details
    date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Float, nullable=False)
    merchant = Column(String, nullable=False)
    description = Column(Text)
    transaction_type = Column(SQLEnum(TransactionType), default=TransactionType.DEBIT)
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING)
    
    # Bank/Card info
    bank_name = Column(String)
    card_last_four = Column(String)
    statement_period = Column(String)
    
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    import_job_id = Column(Integer, ForeignKey("import_jobs.id"), nullable=True)
    source = Column(SQLEnum(TransactionSource), default=TransactionSource.MANUAL)
    
    # Metadata
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    import_job = relationship("ImportJob")

class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # None = overall budget
    
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    period = Column(SQLEnum(BudgetPeriod), default=BudgetPeriod.MONTHLY)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="budgets")
    category = relationship("Category")

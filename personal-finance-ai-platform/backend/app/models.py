from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TransactionType(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    REVIEWED = "reviewed"

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

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)

    # Core identity
    name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Classification
    type = Column(
        SQLEnum("expense", "income", "transfer", name="category_type"),
        nullable=False,
        default="expense"
    )

    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # UI / UX
    color = Column(String(7), default="#3B82F6")
    icon = Column(String(10), default="💰")
    sort_order = Column(Integer, default=0)

    # Lifecycle & safety
    is_system = Column(Boolean, default=False)   # Built-in category
    is_active = Column(Boolean, default=True)    # Soft delete
    is_hidden = Column(Boolean, default=False)   # Hide from picker

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    parent = relationship("Category", remote_side=[id])

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
    
    # Metadata
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")

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

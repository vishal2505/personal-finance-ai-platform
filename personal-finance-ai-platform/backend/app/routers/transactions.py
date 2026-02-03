from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.database import get_db
from app.models import Transaction, Category, User
from app.schemas import TransactionResponse, TransactionUpdate, TransactionBulkUpdate
from app.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_id: Optional[int] = None,
    bank_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if bank_name:
        query = query.filter(Transaction.bank_name == bank_name)
    
    transactions = query.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()
    
    result = []
    for t in transactions:
        trans_dict = {
            "id": t.id,
            "date": t.date,
            "amount": t.amount,
            "merchant": t.merchant,
            "description": t.description,
            "transaction_type": t.transaction_type,
            "status": t.status,
            "bank_name": t.bank_name,
            "card_last_four": t.card_last_four,
            "category_id": t.category_id,
            "category_name": t.category.name if t.category else None,
            "is_anomaly": t.is_anomaly,
            "anomaly_score": t.anomaly_score
        }
        result.append(TransactionResponse(**trans_dict))
    
    return result

@router.get("/stats")
def get_transaction_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    total_count = query.count()
    total_amount = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id
    ).scalar() or 0.0
    
    # By category
    category_stats = db.query(
        Category.name,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).join(Transaction).filter(
        Transaction.user_id == current_user.id
    ).group_by(Category.name).all()
    
    return {
        "total_count": total_count,
        "total_amount": float(total_amount),
        "by_category": [{"category": c[0], "total": float(c[1]), "count": c[2]} for c in category_stats]
    }

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    transaction_update: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(
        and_(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction_update.category_id is not None:
        # Verify category belongs to user or is a system category
        category = db.query(Category).filter(
            and_(
                Category.id == transaction_update.category_id,
                Category.is_active == True,
                or_(
                    Category.user_id == current_user.id,
                    Category.is_system == True
                )
            )
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        transaction.category_id = transaction_update.category_id
    
    if transaction_update.merchant is not None:
        transaction.merchant = transaction_update.merchant
    if transaction_update.description is not None:
        transaction.description = transaction_update.description
    if transaction_update.status is not None:
        transaction.status = transaction_update.status
    
    db.commit()
    db.refresh(transaction)
    
    return TransactionResponse(
        id=transaction.id,
        date=transaction.date,
        amount=transaction.amount,
        merchant=transaction.merchant,
        description=transaction.description,
        transaction_type=transaction.transaction_type,
        status=transaction.status,
        bank_name=transaction.bank_name,
        card_last_four=transaction.card_last_four,
        category_id=transaction.category_id,
        category_name=transaction.category.name if transaction.category else None,
        is_anomaly=transaction.is_anomaly,
        anomaly_score=transaction.anomaly_score
    )

@router.post("/bulk-update")
def bulk_update_transactions(
    bulk_update: TransactionBulkUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions = db.query(Transaction).filter(
        and_(
            Transaction.id.in_(bulk_update.transaction_ids),
            Transaction.user_id == current_user.id
        )
    ).all()
    
    if len(transactions) != len(bulk_update.transaction_ids):
        raise HTTPException(status_code=404, detail="Some transactions not found")
    
    for transaction in transactions:
        if bulk_update.category_id is not None:
            category = db.query(Category).filter(
                and_(
                    Category.id == bulk_update.category_id,
                    Category.is_active == True,
                    or_(
                        Category.user_id == current_user.id,
                        Category.is_system == True
                    )
                )
            ).first()
            if category:
                transaction.category_id = bulk_update.category_id
        if bulk_update.status is not None:
            transaction.status = bulk_update.status
    
    db.commit()
    return {"updated": len(transactions)}

@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(
        and_(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted"}

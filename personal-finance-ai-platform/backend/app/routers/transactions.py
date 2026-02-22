from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from app.database import get_db
from app.models import Transaction, Category, User, TransactionSource, TransactionStatus, TransactionType, Account
from app.schemas import TransactionResponse, TransactionUpdate, TransactionBulkUpdate, TransactionCreate
from app.auth import get_current_user

router = APIRouter()


def _get_transactions_list(db: Session, user_id: int, start_date: Optional[datetime], end_date: Optional[datetime], category_id: Optional[int], bank_name: Optional[str], skip: int, limit: int) -> List[TransactionResponse]:
    """Fetch transactions. Uses raw SQL so it works when table is missing source/account_id columns."""
    conditions = ["t.user_id = :user_id"]
    params = {"user_id": user_id}
    if start_date:
        conditions.append("t.date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("t.date <= :end_date")
        params["end_date"] = end_date
    if category_id:
        conditions.append("t.category_id = :category_id")
        params["category_id"] = category_id
    if bank_name:
        conditions.append("t.bank_name = :bank_name")
        params["bank_name"] = bank_name
    where = " AND ".join(conditions)
    # Use literal integers for LIMIT/OFFSET (MySQL/PyMySQL can reject bound params here)
    skip = max(0, int(skip))
    limit = max(1, min(int(limit), 2000))
    rows = db.execute(
        text(f"""
            SELECT t.id, t.date, t.amount, t.merchant, t.description, t.transaction_type, t.status,
                   t.bank_name, t.card_last_four, t.category_id, c.name AS category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE {where}
            ORDER BY t.date DESC
            LIMIT {limit} OFFSET {skip}
        """),
        params,
    ).fetchall()
    result = []
    for row in rows:
        tt = (row[5] or "debit").lower() if isinstance(row[5], str) else "debit"
        st = (row[6] or "processed").lower() if isinstance(row[6], str) else "processed"
        result.append(TransactionResponse(
            id=row[0],
            date=row[1],
            amount=float(row[2]),
            merchant=row[3] or "",
            description=row[4],
            transaction_type=TransactionType(tt) if tt in ("debit", "credit") else TransactionType.DEBIT,
            status=TransactionStatus(st) if st in ("pending", "processed", "reviewed") else TransactionStatus.PROCESSED,
            bank_name=row[7],
            card_last_four=row[8],
            category_id=row[9],
            category_name=row[10],
            account_id=None,
            account_name=None,
            import_job_id=None,
            source="manual",
            is_anomaly=False,
            anomaly_score=0.0,
        ))
    return result


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
    return _get_transactions_list(db, current_user.id, start_date, end_date, category_id, bank_name, skip, limit)

@router.get("/stats")
def get_transaction_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Use raw SQL so it works when transactions table is missing source/account_id."""
    conditions = ["t.user_id = :user_id"]
    params = {"user_id": current_user.id}
    if start_date:
        conditions.append("t.date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("t.date <= :end_date")
        params["end_date"] = end_date
    where = " AND ".join(conditions)
    count_row = db.execute(
        text(f"SELECT COUNT(*) FROM transactions t WHERE {where}"),
        params,
    ).fetchone()
    total_count = count_row[0] if count_row else 0
    sum_row = db.execute(
        text(f"SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE {where}"),
        params,
    ).fetchone()
    total_amount = float(sum_row[0]) if sum_row else 0.0
    category_rows = db.execute(
        text(f"""
            SELECT c.name, SUM(t.amount), COUNT(t.id)
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE {where}
            GROUP BY c.name
        """),
        params,
    ).fetchall()
    by_category = [{"category": r[0] or "Uncategorized", "total": float(r[1] or 0), "count": r[2] or 0} for r in category_rows]
    return {
        "total_count": total_count,
        "total_amount": total_amount,
        "by_category": by_category,
    }

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a manual transaction"""
    # Verify category ownership if provided
    if transaction_in.category_id:
        category = db.query(Category).filter(
            and_(Category.id == transaction_in.category_id, Category.user_id == current_user.id)
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
            
    # Verify account ownership if provided
    if transaction_in.account_id:
        account = db.query(Account).filter(
            and_(Account.id == transaction_in.account_id, Account.user_id == current_user.id)
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

    transaction = Transaction(
        **transaction_in.dict(),
        user_id=current_user.id,
        source=TransactionSource.MANUAL,
        status=TransactionStatus.PROCESSED  # Manual entries are processed immediately
    )
    db.add(transaction)
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
        account_id=transaction.account_id,
        account_name=transaction.account.name if transaction.account else None,
        import_job_id=transaction.import_job_id,
        source=transaction.source,
        is_anomaly=transaction.is_anomaly,
        anomaly_score=transaction.anomaly_score
    )

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
        account_id=transaction.account_id,
        account_name=transaction.account.name if transaction.account else None,
        import_job_id=transaction.import_job_id,
        source=transaction.source,
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

@router.post("/bulk-delete")
def bulk_delete_transactions(
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

    if not transactions:
        raise HTTPException(status_code=404, detail="No transactions found")

    count = len(transactions)
    for transaction in transactions:
        db.delete(transaction)
    db.commit()
    return {"deleted": count}

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

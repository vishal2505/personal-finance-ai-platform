from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Transaction, User
from app.schemas import AnomalyResponse, TransactionResponse
from app.auth import get_current_user
import statistics

try:
    from sklearn.ensemble import IsolationForest  # type: ignore
except Exception:
    IsolationForest = None  # type: ignore[assignment]

try:
    import numpy as np  # type: ignore
except Exception:
    np = None  # type: ignore[assignment]

router = APIRouter()

def detect_anomalies(transactions: List[Transaction]) -> List[Transaction]:
    """Detect anomalous transactions.

    Prefers an ML approach (Isolation Forest) when scikit-learn + numpy are available.
    Falls back to a simple z-score heuristic if they're not installed (or broken).
    """
    if len(transactions) < 10:
        return []

    if IsolationForest is None or np is None:
        amounts = [float(t.amount) for t in transactions]
        mean = statistics.fmean(amounts)
        stdev = statistics.pstdev(amounts) or 0.0

        anomalous_transactions: List[Transaction] = []
        for t in transactions:
            if stdev == 0.0:
                z = 0.0
            else:
                z = abs((float(t.amount) - mean) / stdev)

            is_anomaly = z >= 2.5
            t.is_anomaly = bool(is_anomaly)
            t.anomaly_score = float(min(1.0, z / 5.0))

            if is_anomaly:
                anomalous_transactions.append(t)

        return anomalous_transactions
    
    # Prepare features: amount, day_of_month, day_of_week
    features = []
    for t in transactions:
        features.append([
            float(t.amount),
            float(t.date.day),
            float(t.date.weekday())
        ])
    
    X = np.array(features)
    
    # Use Isolation Forest
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    predictions = iso_forest.fit_predict(X)
    anomaly_scores = iso_forest.score_samples(X)
    
    # Mark anomalies
    anomalous_transactions = []
    for i, t in enumerate(transactions):
        is_anomaly = predictions[i] == -1
        score = float(anomaly_scores[i])
        
        if is_anomaly:
            t.is_anomaly = True
            t.anomaly_score = abs(score)
            anomalous_transactions.append(t)
        else:
            t.is_anomaly = False
            t.anomaly_score = abs(score)
    
    return anomalous_transactions

@router.get("/", response_model=List[AnomalyResponse])
def get_anomalies(
    months: int = Query(default=3, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months * 30)
    
    # Get transactions
    transactions = db.query(Transaction).filter(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.date >= start_date,
            Transaction.date <= end_date
        )
    ).order_by(Transaction.date.desc()).all()
    
    # Detect anomalies
    anomalous = detect_anomalies(transactions)
    
    # Save anomaly flags
    db.commit()
    
    # Format response
    result = []
    for t in anomalous:
        # Determine reason
        reason = "Unusual amount"
        if t.amount > 1000:
            reason = "High-value transaction"
        elif t.amount < 1:
            reason = "Very small transaction"
        
        severity = "medium"
        if t.anomaly_score > 0.5:
            severity = "high"
        elif t.anomaly_score < 0.2:
            severity = "low"
        
        result.append(AnomalyResponse(
            transaction_id=t.id,
            transaction=TransactionResponse(
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
                is_anomaly=t.is_anomaly,
                anomaly_score=t.anomaly_score
            ),
            reason=reason,
            severity=severity
        ))
    
    return result

@router.post("/recalculate")
def recalculate_anomalies(
    months: int = Query(default=3, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Recalculate anomaly scores for all transactions"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months * 30)
    
    transactions = db.query(Transaction).filter(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.date >= start_date,
            Transaction.date <= end_date
        )
    ).all()
    
    detect_anomalies(transactions)
    db.commit()
    
    return {"message": f"Anomaly detection completed for {len(transactions)} transactions"}

from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.models import Transaction, Category, User
from app.schemas import InsightResponse
from app.auth import get_current_user
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

def generate_ai_insight(transactions_data: dict) -> List[InsightResponse]:
    """Generate AI-powered insights from transaction data"""
    insights = []
    
    # Spending trend analysis
    if transactions_data.get("monthly_trends"):
        trends = transactions_data["monthly_trends"]
        if len(trends) >= 2:
            last_month = trends[-1]
            prev_month = trends[-2]
            change = ((last_month["total"] - prev_month["total"]) / prev_month["total"]) * 100 if prev_month["total"] > 0 else 0
            
            if abs(change) > 10:
                insights.append(InsightResponse(
                    type="trend",
                    title=f"Spending {'Increased' if change > 0 else 'Decreased'} by {abs(change):.1f}%",
                    description=f"Your spending in {last_month['month']} was {abs(change):.1f}% {'higher' if change > 0 else 'lower'} than the previous month.",
                    data={"change_percent": change, "current": last_month["total"], "previous": prev_month["total"]}
                ))
    
    # Top spending category
    if transactions_data.get("top_category"):
        top = transactions_data["top_category"]
        insights.append(InsightResponse(
            type="category",
            title=f"Top Spending: {top['name']}",
            description=f"You spent ${top['amount']:.2f} on {top['name']} this period.",
            data=top
        ))
    
    # Unusual spending detection
    if transactions_data.get("unusual_transactions"):
        unusual = transactions_data["unusual_transactions"]
        if unusual:
            insights.append(InsightResponse(
                type="anomaly",
                title=f"{len(unusual)} Unusual Transactions Detected",
                description="We've detected some transactions that are significantly different from your usual spending patterns.",
                data={"count": len(unusual)}
            ))
    
    # Budget alerts
    if transactions_data.get("budget_warnings"):
        warnings = transactions_data["budget_warnings"]
        if warnings:
            for warning in warnings:
                insights.append(InsightResponse(
                    type="budget",
                    title=f"Budget Alert: {warning['budget_name']}",
                    description=warning["message"],
                    data=warning
                ))
    
    return insights

@router.get("/", response_model=List[InsightResponse])
def get_insights(
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
    ).all()
    
    # Calculate monthly trends
    monthly_trends = {}
    for t in transactions:
        month_key = t.date.strftime("%Y-%m")
        if month_key not in monthly_trends:
            monthly_trends[month_key] = {"month": month_key, "total": 0.0, "count": 0}
        monthly_trends[month_key]["total"] += t.amount
        monthly_trends[month_key]["count"] += 1
    
    monthly_trends_list = sorted(monthly_trends.values(), key=lambda x: x["month"])
    
    # Top category
    category_totals = {}
    for t in transactions:
        if t.category:
            cat_name = t.category.name
            if cat_name not in category_totals:
                category_totals[cat_name] = 0.0
            category_totals[cat_name] += t.amount
    
    top_category = None
    if category_totals:
        top_cat_name = max(category_totals, key=category_totals.get)
        top_category = {"name": top_cat_name, "amount": category_totals[top_cat_name]}
    
    # Unusual transactions
    unusual_transactions = [t for t in transactions if t.is_anomaly]
    
    # Prepare data for AI insights
    transactions_data = {
        "monthly_trends": monthly_trends_list,
        "top_category": top_category,
        "unusual_transactions": unusual_transactions,
        "budget_warnings": []  # Would be populated from budget checks
    }
    
    insights = generate_ai_insight(transactions_data)
    
    return insights

from typing import List
from datetime import datetime, timedelta
import json
import os
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, text
from app.database import get_db
from app.models import Transaction, Category, User
from app.schemas import InsightResponse
from app.auth import get_current_user
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()


def generate_openai_insights(transactions_data: dict) -> List[InsightResponse]:
    """
    Call OpenAI to generate short, actionable insights from transaction summary.
    Returns empty list if OPENAI_API_KEY is missing or the API call fails.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not api_key.strip():
        return []

    monthly = transactions_data.get("monthly_trends") or []
    top_cat = transactions_data.get("top_category")
    summary_lines = []
    if monthly:
        summary_lines.append("Monthly totals: " + ", ".join(f"{m['month']}: ${m['total']:.2f}" for m in monthly))
    if top_cat:
        summary_lines.append(f"Top category: {top_cat['name']} (${top_cat['amount']:.2f})")
    if not summary_lines:
        summary_lines.append("No transaction summary available.")

    prompt = f"""You are a personal finance assistant. Based on this user's transaction summary, suggest 1-3 very short insights (savings tip, trend observation, or warning). Be concise.

Transaction summary:
{chr(10).join(summary_lines)}

Respond with a JSON array only. Each item: {{"type": "trend"|"category"|"tip"|"anomaly", "title": "Short title", "description": "One sentence.", "data": {{}}}}
Example: [{{"type":"tip","title":"Save on subscriptions","description":"You have multiple subscriptions; consider reviewing them.","data":{{}}}}]"""

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        content = (response.choices[0].message.content or "").strip()
        # Handle markdown code block if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        parsed = json.loads(content)
        if not isinstance(parsed, list):
            return []
        insights = []
        for item in parsed:
            if isinstance(item, dict) and item.get("title") and item.get("description"):
                insights.append(InsightResponse(
                    type=str(item.get("type", "tip"))[:50],
                    title=str(item["title"])[:200],
                    description=str(item["description"])[:500],
                    data=item.get("data") if isinstance(item.get("data"), dict) else None,
                ))
        return insights
    except Exception:
        return []

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

def _build_transactions_data(db: Session, user_id: int, months: int) -> tuple[list, dict]:
    """Fetch transactions and build monthly trends + top category + summary dict. Uses raw SQL so it works even when the transactions table has fewer columns (e.g. no source, account_id)."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months * 30)
    # Select only columns that exist in minimal schema (user_id, date, amount, category_id)
    rows = db.execute(
        text("""
            SELECT t.date, t.amount, c.name AS category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = :user_id AND t.date >= :start_date AND t.date <= :end_date
        """),
        {"user_id": user_id, "start_date": start_date, "end_date": end_date},
    ).fetchall()

    monthly_trends = {}
    category_totals = {}
    for row in rows:
        date_val, amount, cat_name = row[0], float(row[1]), row[2]
        month_key = date_val.strftime("%Y-%m") if hasattr(date_val, "strftime") else str(date_val)[:7]
        if month_key not in monthly_trends:
            monthly_trends[month_key] = {"month": month_key, "total": 0.0, "count": 0}
        monthly_trends[month_key]["total"] += amount
        monthly_trends[month_key]["count"] += 1
        if cat_name:
            category_totals[cat_name] = category_totals.get(cat_name, 0.0) + amount

    monthly_trends_list = sorted(monthly_trends.values(), key=lambda x: x["month"])
    top_category = None
    if category_totals:
        top_cat_name = max(category_totals, key=category_totals.get)
        top_category = {"name": top_cat_name, "amount": category_totals[top_cat_name]}

    transactions_data = {
        "monthly_trends": monthly_trends_list,
        "top_category": top_category,
        "unusual_transactions": [],
        "budget_warnings": []
    }
    return list(rows), transactions_data


@router.get("/", response_model=List[InsightResponse])
def get_insights(
    months: int = Query(default=3, ge=1, le=12),
    use_ai: bool = Query(default=False, description="Include OpenAI-generated insights (requires OPENAI_API_KEY)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rule-based insights. Set use_ai=true to also include OpenAI-generated insights."""
    _, transactions_data = _build_transactions_data(db, current_user.id, months)
    insights = generate_ai_insight(transactions_data)
    if use_ai:
        insights.extend(generate_openai_insights(transactions_data))
    return insights


@router.get("/ai", response_model=List[InsightResponse])
def get_insights_ai(
    months: int = Query(default=3, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test endpoint: insights generated only by OpenAI from transaction summary. Requires OPENAI_API_KEY in .env."""
    _, transactions_data = _build_transactions_data(db, current_user.id, months)
    return generate_openai_insights(transactions_data)

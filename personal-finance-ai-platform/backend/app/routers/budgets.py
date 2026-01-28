from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.database import get_db
from app.models import Budget, Transaction, User, Category
from app.schemas import BudgetCreate, BudgetResponse
from app.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=BudgetResponse)
def create_budget(
    budget: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if budget.category_id:
        category = db.query(Category).filter(
            and_(Category.id == budget.category_id, Category.user_id == current_user.id)
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    
    db_budget = Budget(
        user_id=current_user.id,
        name=budget.name,
        amount=budget.amount,
        period=budget.period,
        category_id=budget.category_id,
        start_date=budget.start_date,
        end_date=budget.end_date
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    
    return BudgetResponse(
        id=db_budget.id,
        name=db_budget.name,
        amount=db_budget.amount,
        period=db_budget.period,
        category_id=db_budget.category_id,
        category_name=db_budget.category.name if db_budget.category else None,
        start_date=db_budget.start_date,
        end_date=db_budget.end_date,
        is_active=db_budget.is_active,
        spent=0.0
    )

@router.get("/", response_model=List[BudgetResponse])
def get_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    budgets = db.query(Budget).filter(
        and_(Budget.user_id == current_user.id, Budget.is_active == True)
    ).all()
    
    result = []
    for budget in budgets:
        # Calculate spent amount
        query = db.query(func.sum(Transaction.amount)).filter(
            and_(
                Transaction.user_id == current_user.id,
                Transaction.date >= budget.start_date
            )
        )
        
        if budget.end_date:
            query = query.filter(Transaction.date <= budget.end_date)
        
        if budget.category_id:
            query = query.filter(Transaction.category_id == budget.category_id)
        
        spent = query.scalar() or 0.0
        
        result.append(BudgetResponse(
            id=budget.id,
            name=budget.name,
            amount=budget.amount,
            period=budget.period,
            category_id=budget.category_id,
            category_name=budget.category.name if budget.category else None,
            start_date=budget.start_date,
            end_date=budget.end_date,
            is_active=budget.is_active,
            spent=float(spent)
        ))
    
    return result

@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(
        and_(Budget.id == budget_id, Budget.user_id == current_user.id)
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Calculate spent
    query = db.query(func.sum(Transaction.amount)).filter(
        and_(
            Transaction.user_id == current_user.id,
            Transaction.date >= budget.start_date
        )
    )
    
    if budget.end_date:
        query = query.filter(Transaction.date <= budget.end_date)
    if budget.category_id:
        query = query.filter(Transaction.category_id == budget.category_id)
    
    spent = query.scalar() or 0.0
    
    return BudgetResponse(
        id=budget.id,
        name=budget.name,
        amount=budget.amount,
        period=budget.period,
        category_id=budget.category_id,
        category_name=budget.category.name if budget.category else None,
        start_date=budget.start_date,
        end_date=budget.end_date,
        is_active=budget.is_active,
        spent=float(spent)
    )

@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    budget_update: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(
        and_(Budget.id == budget_id, Budget.user_id == current_user.id)
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    budget.name = budget_update.name
    budget.amount = budget_update.amount
    budget.period = budget_update.period
    budget.category_id = budget_update.category_id
    budget.start_date = budget_update.start_date
    budget.end_date = budget_update.end_date
    
    db.commit()
    db.refresh(budget)
    
    return BudgetResponse(
        id=budget.id,
        name=budget.name,
        amount=budget.amount,
        period=budget.period,
        category_id=budget.category_id,
        category_name=budget.category.name if budget.category else None,
        start_date=budget.start_date,
        end_date=budget.end_date,
        is_active=budget.is_active,
        spent=0.0
    )

@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(
        and_(Budget.id == budget_id, Budget.user_id == current_user.id)
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    budget.is_active = False
    db.commit()
    return {"message": "Budget deleted"}

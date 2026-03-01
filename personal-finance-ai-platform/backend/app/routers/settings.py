from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Category, MerchantRule, User
from app.schemas import CategoryCreate, CategoryResponse, MerchantRuleCreate, MerchantRuleResponse
from app.auth import get_current_user

router = APIRouter()


# =========================
# Category endpoints
# =========================
@router.post("/categories", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Category).filter(
        and_(Category.user_id == current_user.id, Category.name == category.name)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")

    db_category = Category(
        user_id=current_user.id,
        name=category.name,
        color=category.color,
        icon=category.icon
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)

    return db_category


# ⭐ FIXED: simple category response for UI
@router.get("/categories")
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    categories = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.is_active == True,
        Category.is_hidden == False
    ).order_by(Category.sort_order, Category.name).all()

    # return simplified structure for frontend dropdown
    return [
        {
            "id": c.id,
            "name": c.name,
            "color": c.color,
            "icon": c.icon
        }
        for c in categories
    ]


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_update: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        and_(Category.id == category_id, Category.user_id == current_user.id)
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.name = category_update.name
    category.color = category_update.color
    category.icon = category_update.icon

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        and_(Category.id == category_id, Category.user_id == current_user.id)
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
    return {"message": "Category deleted"}


# =========================
# Merchant Rule endpoints
# =========================
@router.post("/merchant-rules", response_model=MerchantRuleResponse)
def create_merchant_rule(
    rule: MerchantRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).filter(
        and_(Category.id == rule.category_id, Category.user_id == current_user.id)
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db_rule = MerchantRule(
        user_id=current_user.id,
        merchant_pattern=rule.merchant_pattern,
        match_type=rule.match_type,
        category_id=rule.category_id
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    return MerchantRuleResponse(
        id=db_rule.id,
        merchant_pattern=db_rule.merchant_pattern,
        match_type=db_rule.match_type,
        category_id=db_rule.category_id,
        category_name=category.name,
        is_active=db_rule.is_active
    )


@router.get("/merchant-rules", response_model=List[MerchantRuleResponse])
def get_merchant_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rules = db.query(MerchantRule).filter(
        MerchantRule.user_id == current_user.id
    ).all()

    result = []
    for rule in rules:
        result.append(MerchantRuleResponse(
            id=rule.id,
            merchant_pattern=rule.merchant_pattern,
            match_type=rule.match_type,
            category_id=rule.category_id,
            category_name=rule.category.name if rule.category else None,
            is_active=rule.is_active
        ))

    return result


@router.put("/merchant-rules/{rule_id}", response_model=MerchantRuleResponse)
def update_merchant_rule(
    rule_id: int,
    rule_update: MerchantRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(MerchantRule).filter(
        and_(MerchantRule.id == rule_id, MerchantRule.user_id == current_user.id)
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Merchant rule not found")

    category = db.query(Category).filter(
        and_(Category.id == rule_update.category_id, Category.user_id == current_user.id)
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    rule.merchant_pattern = rule_update.merchant_pattern
    rule.match_type = rule_update.match_type
    rule.category_id = rule_update.category_id

    db.commit()
    db.refresh(rule)

    return MerchantRuleResponse(
        id=rule.id,
        merchant_pattern=rule.merchant_pattern,
        match_type=rule.match_type,
        category_id=rule.category_id,
        category_name=category.name,
        is_active=rule.is_active
    )


@router.delete("/merchant-rules/{rule_id}")
def delete_merchant_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(MerchantRule).filter(
        and_(MerchantRule.id == rule_id, MerchantRule.user_id == current_user.id)
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Merchant rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "Merchant rule deleted"}


@router.put("/merchant-rules/{rule_id}/toggle")
def toggle_merchant_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(MerchantRule).filter(
        and_(MerchantRule.id == rule_id, MerchantRule.user_id == current_user.id)
    ).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Merchant rule not found")

    rule.is_active = not rule.is_active
    db.commit()

    return {"message": f"Merchant rule {'activated' if rule.is_active else 'deactivated'}"}


# =========================
# Automation
# =========================
@router.post("/run-automation")
def run_automation_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run automation rules safely without circular import"""
    from app.models import Transaction

    # lightweight categorisation logic
    def auto_categorize_transaction(merchant: str):
        if not merchant:
            return None

        merchant_lower = merchant.lower()

        rules = db.query(MerchantRule).filter(
            MerchantRule.user_id == current_user.id,
            MerchantRule.is_active == True
        ).all()

        for rule in rules:
            if rule.match_type == "exact":
                if rule.merchant_pattern.lower() == merchant_lower:
                    return rule.category_id
            else:
                if rule.merchant_pattern.lower() in merchant_lower:
                    return rule.category_id

        return None

    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    ).all()

    count = 0
    for transaction in transactions:
        new_category_id = auto_categorize_transaction(transaction.merchant)

        if new_category_id is not None and transaction.category_id != new_category_id:
            transaction.category_id = new_category_id
            count += 1

    db.commit()

    return {"message": f"Automation rules applied. {count} transactions updated."}

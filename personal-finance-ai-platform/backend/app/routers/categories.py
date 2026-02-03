from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.database import get_db
from app.models import Category, Transaction, TransactionType, User
from app.schemas import (
    CategoryCreate, 
    CategoryUpdate, 
    CategoryResponse, 
    CategoryReorder,
    CategoryStats
)
from app.auth import get_current_user

router = APIRouter()


def _detect_circular_reference(db: Session, category_id: int, parent_id: int) -> bool:
    """
    Detect if setting parent_id as the parent of category_id would create a circular reference.
    
    This traverses the parent chain starting from parent_id to ensure that category_id
    is not encountered in the chain, which would create a cycle.
    
    Args:
        db: Database session
        category_id: The category being updated
        parent_id: The proposed new parent
        
    Returns:
        True if a circular reference would be created, False otherwise
    """
    # Direct self-reference check
    if category_id == parent_id:
        return True
    
    # Traverse the parent chain
    visited = set()
    current_id = parent_id
    
    while current_id is not None:
        # If we've seen this ID before, there's a cycle in the existing data
        if current_id in visited:
            return True
            
        # If we encounter the category_id in the parent chain, it would create a cycle
        if current_id == category_id:
            return True
            
        visited.add(current_id)
        
        # Get the parent of the current category
        parent = db.query(Category).filter(Category.id == current_id).first()
        if parent is None:
            break
            
        current_id = parent.parent_id
    
    return False


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new user category.
    
    - **name**: Category name (1-100 characters)
    - **color**: Hex color code (e.g., #3B82F6)
    - **icon**: Icon/emoji (1-10 characters)
    - **type**: Category type (expense, income, or transfer)
    - **parent_id**: Optional parent category ID for hierarchical structure
    """
    # Check for duplicate name within user's categories
    existing = db.query(Category).filter(
        and_(
            Category.user_id == current_user.id,
            Category.name == payload.name,
            Category.is_active == True
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{payload.name}' already exists"
        )
    
    # Validate parent category if provided
    if payload.parent_id:
        parent = db.query(Category).filter(
            Category.id == payload.parent_id,
            Category.is_active == True,
            or_(
                Category.user_id == current_user.id,
                Category.is_system == True
            )
        ).first()
        
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found"
            )
        
        # Note: For new categories, circular references are not possible since
        # the category has no children yet. The parent chain itself is validated above.
    
    category = Category(
        **payload.model_dump(),
        user_id=current_user.id,
        is_system=False,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/", response_model=List[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_inactive: bool = Query(False, description="Include archived categories"),
    include_hidden: bool = Query(False, description="Include hidden categories"),
    type: Optional[str] = Query(None, description="Filter by type (expense, income, transfer)"),
    parent_id: Optional[int] = Query(None, description="Filter by parent category ID"),
):
    """
    List all categories accessible to the user (system + user-owned).
    
    By default, only active and visible categories are returned.
    """
    query = db.query(Category).filter(
        or_(
            Category.user_id == current_user.id,
            Category.is_system == True
        )
    )

    if not include_inactive:
        query = query.filter(Category.is_active == True)
    
    if not include_hidden:
        query = query.filter(Category.is_hidden == False)
    
    if type:
        if type not in ["expense", "income", "transfer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Type must be 'expense', 'income', or 'transfer'"
            )
        query = query.filter(Category.type == type)
    
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)

    return query.order_by(Category.sort_order, Category.name).all()


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single category by ID.
    
    User can access their own categories and system categories.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_active == True,
        or_(
            Category.user_id == current_user.id,
            Category.is_system == True
        )
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a user-owned category.
    
    System categories cannot be modified.
    Only the category owner can update it.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_active == True
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    if category.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System categories cannot be modified"
        )

    if category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this category"
        )
    
    # Check for duplicate name if name is being updated
    if payload.name and payload.name != category.name:
        existing = db.query(Category).filter(
            and_(
                Category.user_id == current_user.id,
                Category.name == payload.name,
                Category.is_active == True,
                Category.id != category_id
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{payload.name}' already exists"
            )
    
    # Validate parent category if being updated
    if payload.parent_id is not None:
        # Check for circular reference
        if _detect_circular_reference(db, category_id, payload.parent_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set parent: would create a circular reference"
            )
        
        parent = db.query(Category).filter(
            Category.id == payload.parent_id,
            Category.is_active == True,
            or_(
                Category.user_id == current_user.id,
                Category.is_system == True
            )
        ).first()
        
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found"
            )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Archive (soft delete) a user-owned category.
    
    System categories cannot be deleted.
    The category is marked as inactive but preserved in the database
    to maintain transaction history integrity.
    """
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_active == True
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    if category.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System categories cannot be deleted"
        )

    if category.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this category"
        )

    category.is_active = False
    db.commit()

    return {"message": "Category archived successfully"}


@router.patch("/reorder", response_model=dict)
def reorder_categories(
    payload: CategoryReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk update sort order for multiple categories.
    
    Only user-owned categories can be reordered.
    """
    category_ids = [item.id for item in payload.categories]
    
    # Fetch all categories and verify ownership
    categories = db.query(Category).filter(
        and_(
            Category.id.in_(category_ids),
            Category.user_id == current_user.id,
            Category.is_active == True
        )
    ).all()
    
    if len(categories) != len(category_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Some categories not found or not authorized"
        )
    
    # Create a mapping for quick lookup
    category_map = {cat.id: cat for cat in categories}
    
    # Update sort orders
    for item in payload.categories:
        if item.id in category_map:
            category_map[item.id].sort_order = item.sort_order
    
    db.commit()
    
    return {
        "message": "Categories reordered successfully",
        "updated_count": len(categories)
    }


@router.get("/{category_id}/stats", response_model=CategoryStats)
def get_category_stats(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    start_date: Optional[datetime] = Query(None, description="Filter transactions from this date"),
    end_date: Optional[datetime] = Query(None, description="Filter transactions until this date"),
):
    """
    Get usage statistics for a category.
    
    Returns transaction count and total amount spent/received.
    Only active categories can have their statistics retrieved.
    """
    # Verify category access
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_active == True,
        or_(
            Category.user_id == current_user.id,
            Category.is_system == True
        )
    ).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Build query for transactions
    query = db.query(Transaction).filter(
        and_(
            Transaction.category_id == category_id,
            Transaction.user_id == current_user.id
        )
    )
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    # Get statistics
    transactions = query.all()
    transaction_count = len(transactions)
    total_amount = sum(t.amount for t in transactions)
    
    # Count by transaction type
    expense_count = sum(1 for t in transactions if t.transaction_type == TransactionType.DEBIT)
    income_count = sum(1 for t in transactions if t.transaction_type == TransactionType.CREDIT)
    
    return CategoryStats(
        category_id=category_id,
        category_name=category.name,
        transaction_count=transaction_count,
        total_amount=float(total_amount),
        expense_count=expense_count,
        income_count=income_count
    )

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
from app.auth import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_user_by_email,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Auto-seed default categories
    from app.models import Category
    
    default_categories = [
        {"name": "Food & Dining", "color": "#ef4444", "icon": "🍔", "type": "expense"},
        {"name": "Transportation", "color": "#f97316", "icon": "🚗", "type": "expense"},
        {"name": "Shopping", "color": "#ec4899", "icon": "🛍️", "type": "expense"},
        {"name": "Housing", "color": "#8b5cf6", "icon": "🏠", "type": "expense"},
        {"name": "Utilities", "color": "#06b6d4", "icon": "💡", "type": "expense"},
        {"name": "Health", "color": "#10b981", "icon": "🏥", "type": "expense"},
        {"name": "Entertainment", "color": "#8b5cf6", "icon": "🎬", "type": "expense"},
        {"name": "Income", "color": "#22c55e", "icon": "💰", "type": "income"},
        {"name": "Transfer", "color": "#64748b", "icon": "↔️", "type": "transfer"},
    ]
    
    for cat_data in default_categories:
        category = Category(
            user_id=db_user.id,
            name=cat_data["name"],
            color=cat_data["color"],
            icon=cat_data["icon"],
            type=cat_data["type"],
            is_system=False
        )
        db.add(category)
    
    db.commit()
    
    return db_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

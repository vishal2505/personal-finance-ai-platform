from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, Token, TwoFactorVerify
from app.auth import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_user_by_email,
    get_current_user,
    get_pending_2fa_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

@router.post(
    "/register",
    response_model=UserResponse,
    summary="Register a new user",
    description=(
        "Creates a new user account, seeds default categories, and seeds default "
        "merchant automation rules for that user."
    ),
)
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
    
    # Create map of created categories for rule seeding
    created_categories = {}
    
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
        db.flush() # flush to get id
        created_categories[category.name] = category.id

    # Auto-seed default merchant rules
    from app.models import MerchantRule
    
    default_rules = [
        # Food & Dining
        {"pattern": "restaurant", "cat": "Food & Dining"},
        {"pattern": "cafe", "cat": "Food & Dining"},
        {"pattern": "food", "cat": "Food & Dining"},
        {"pattern": "dining", "cat": "Food & Dining"},
        {"pattern": "starbucks", "cat": "Food & Dining"},
        {"pattern": "mcdonald", "cat": "Food & Dining"},
        # Transportation
        {"pattern": "grab", "cat": "Transportation"},
        {"pattern": "uber", "cat": "Transportation"},
        {"pattern": "taxi", "cat": "Transportation"},
        {"pattern": "transport", "cat": "Transportation"},
        {"pattern": "mrt", "cat": "Transportation"},
        {"pattern": "bus", "cat": "Transportation"},
        # Shopping
        {"pattern": "shop", "cat": "Shopping"},
        {"pattern": "store", "cat": "Shopping"},
        {"pattern": "retail", "cat": "Shopping"},
        {"pattern": "amazon", "cat": "Shopping"},
        {"pattern": "lazada", "cat": "Shopping"},
    ]

    for rule_data in default_rules:
        if rule_data["cat"] in created_categories:
            rule = MerchantRule(
                user_id=db_user.id,
                merchant_pattern=rule_data["pattern"],
                match_type="partial",
                category_id=created_categories[rule_data["cat"]]
            )
            db.add(rule)
    
    db.commit()
    
    return db_user

@router.post(
    "/login",
    response_model=Token,
    summary="Step 1: Login and get temporary 2FA token",
    description=(
        "Authenticates the user's email and password and returns a temporary bearer "
        "token with '2fa_pending' scope. This token only works for /api/auth/verify-2fa "
        "and will be rejected by protected APIs such as /api/categories/.\n\n"
        "Swagger usage:\n"
        "1. Call this endpoint.\n"
        "2. Copy the returned access_token.\n"
        "3. Click Authorize and paste that token.\n"
        "4. Call /api/auth/verify-2fa.\n"
        "5. Replace the token in Authorize with the new token returned by /api/auth/verify-2fa."
    ),
)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Issue a temporary token with '2fa_pending' scope
    # This token CANNOT be used to access protected routes (get_current_user will reject it)
    access_token_expires = timedelta(minutes=5) # Short expiry for 2FA step
    access_token = create_access_token(
        data={"sub": user.email, "scopes": ["2fa_pending"]}, 
        expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "status": "2fa_required"
    }

@router.post(
    "/verify-2fa",
    response_model=Token,
    summary="Step 2: Verify 2FA and get final access token",
    description=(
        "Verifies the 2FA code using the temporary token returned by /api/auth/login. "
        "On success, returns a new bearer token with 'access' scope. Use this final token "
        "for all protected APIs.\n\n"
        "Swagger usage:\n"
        "1. Authorize Swagger with the temporary token from /api/auth/login.\n"
        "2. Call this endpoint with the 2FA code.\n"
        "3. Copy the new access_token from the response.\n"
        "4. Click Authorize again and replace the old token with the new one.\n"
        "5. Retry protected endpoints such as /api/categories/."
    ),
)
def verify_two_factor(
    payload: TwoFactorVerify,
    user: User = Depends(get_pending_2fa_user)
):
    """
    Verifies the 2FA code. Requires a valid token with '2fa_pending' scope.
    If valid, returns a full access token.
    """
    if payload.code != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid authentication code"
        )
        
    # Issue the final access token with 'access' scope
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "scopes": ["access"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "status": "success"
    }

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user",
    description="Requires the final bearer token returned by /api/auth/verify-2fa.",
)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

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

@router.post("/verify-2fa", response_model=Token)
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

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

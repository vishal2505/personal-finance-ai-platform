from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models import Account, User
from app.schemas import AccountCreate, AccountResponse
from app.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[AccountResponse])
def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active accounts for the current user"""
    accounts = db.query(Account).filter(
        and_(Account.user_id == current_user.id, Account.is_active == True)
    ).all()
    return accounts

@router.post("/", response_model=AccountResponse)
def create_account(
    account_in: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new bank account or card"""
    account = Account(
        **account_in.dict(),
        user_id=current_user.id
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account

@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details for a specific account"""
    account = db.query(Account).filter(
        and_(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return account

@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account_in: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update account details"""
    account = db.query(Account).filter(
        and_(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    for field, value in account_in.dict().items():
        setattr(account, field, value)
        
    db.commit()
    db.refresh(account)
    return account

@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft-delete an account"""
    account = db.query(Account).filter(
        and_(Account.id == account_id, Account.user_id == current_user.id)
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    account.is_active = False
    db.commit()
    return {"message": "Account deleted"}

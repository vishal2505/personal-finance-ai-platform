from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, transactions, budgets, insights, anomalies, imports, settings, accounts, upload, categories

# Create database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(title="Personal Finance AI Platform", version="1.0.0")

# --- Seed test user if not present ---
from app.auth import get_password_hash, get_user_by_email
from app.models import User
from sqlalchemy.orm import Session
from app.database import SessionLocal

def seed_test_user():
    db: Session = SessionLocal()
    try:
        test_email = "test@example.com"
        test_password = "test123"
        user = get_user_by_email(db, test_email)
        if not user:
            db_user = User(
                email=test_email,
                hashed_password=get_password_hash(test_password),
                full_name="Test User"
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            print("Seeded test user: test@example.com / test123")
    finally:
        db.close()

seed_test_user()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["anomalies"])
app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])

@app.get("/")
def root():
    return {"message": "Personal Finance AI Platform API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

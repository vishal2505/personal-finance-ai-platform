from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, transactions, budgets, insights, anomalies, imports, settings, accounts, categories
import os
import logging

logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)


def ensure_schema_up_to_date():
    """Add missing columns to existing tables so the ORM model matches the DB.

    ``create_all`` only creates *new* tables – it never ALTERs existing ones.
    This function inspects every table that SQLAlchemy knows about and adds
    any columns that are present in the model but absent from the database.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # --- categories ----------------------------------------------------------
    if "categories" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("categories")}

        alters: list[str] = []
        if "type" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN `type` "
                "ENUM('expense','income','transfer') NOT NULL DEFAULT 'expense'"
            )
        if "parent_id" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN parent_id INTEGER NULL"
            )
        if "sort_order" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0"
            )
        if "is_system" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN is_system BOOLEAN DEFAULT FALSE"
            )
        if "is_active" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT TRUE"
            )
        if "is_hidden" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE"
            )
        if "updated_at" not in cols:
            alters.append(
                "ALTER TABLE categories ADD COLUMN updated_at DATETIME NULL"
            )

        if alters:
            with engine.begin() as conn:
                for stmt in alters:
                    logger.info("Auto-migration: %s", stmt)
                    conn.execute(text(stmt))

    # --- merchant_rules ------------------------------------------------------
    if "merchant_rules" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("merchant_rules")}

        if "match_type" not in cols:
            with engine.begin() as conn:
                stmt = (
                    "ALTER TABLE merchant_rules ADD COLUMN match_type "
                    "VARCHAR(20) DEFAULT 'partial'"
                )
                logger.info("Auto-migration: %s", stmt)
                conn.execute(text(stmt))


try:
    ensure_schema_up_to_date()
except Exception:
    logger.exception("Auto-migration failed – the app will start anyway")


app = FastAPI(title="Personal Finance AI Platform", version="1.0.0")

# --- Seed test user if not present ---
from app.auth import get_password_hash, get_user_by_email
from app.models import User
from sqlalchemy.orm import Session
from app.database import SessionLocal, get_db

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
cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    cors_origins = ["http://localhost:3000", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])

@app.get("/")
def root():
    return {"message": "Personal Finance AI Platform API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

# Copilot Recommendation: Add DB connectivity check (e.g., run a lightweight query) so you know if the backend is healthy and the DB is reachable.

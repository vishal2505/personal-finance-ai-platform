from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://user:password@localhost:3306/personal_finance?charset=utf8mb4",
)

def _ensure_db_driver(database_url: str) -> None:
    if database_url.startswith("mysql+pymysql://"):
        try:
            import pymysql  # noqa: F401
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Missing MySQL driver: PyMySQL is not installed.\n"
                "Install it in your backend virtualenv:\n"
                "  pip install pymysql\n"
                "Or switch DATABASE_URL to use mysql+mysqlconnector:// and install mysql-connector-python."
            ) from exc

    if database_url.startswith("mysql+mysqlconnector://"):
        try:
            import mysql.connector  # noqa: F401
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Missing MySQL driver: mysql-connector-python is not installed.\n"
                "Install it in your backend virtualenv:\n"
                "  pip install mysql-connector-python\n"
                "Or switch DATABASE_URL to use mysql+pymysql:// and install pymysql."
            ) from exc


_ensure_db_driver(DATABASE_URL)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

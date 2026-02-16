import sys
import os

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Attempting to add match_type column to merchant_rules table...")
        try:
            # Try to add the column. If it exists, this will fail.
            conn.execute(text("ALTER TABLE merchant_rules ADD COLUMN match_type VARCHAR(20) DEFAULT 'partial'"))
            conn.commit()
            print("Successfully added match_type column.")
        except Exception as e:
            if "Duplicate column name" in str(e) or "1060" in str(e):
                print("match_type column already exists.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    migrate()

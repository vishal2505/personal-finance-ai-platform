"""
Patch older MySQL schemas to match fields expected by backend models.

Run:
  python backend/scripts/fix_schema.py
"""
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text


def _load_backend_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    load_dotenv(backend_dir / ".env")


def main() -> int:
    _load_backend_env()
    from app.database import engine

    with engine.connect() as conn:
        tx_cols = {r[0] for r in conn.execute(text("SHOW COLUMNS FROM transactions")).fetchall()}
        cat_cols = {r[0] for r in conn.execute(text("SHOW COLUMNS FROM categories")).fetchall()}

        stmts: list[str] = []

        # transactions table compatibility
        if "account_id" not in tx_cols:
            stmts.append("ALTER TABLE transactions ADD COLUMN account_id INT NULL")
        if "import_job_id" not in tx_cols:
            stmts.append("ALTER TABLE transactions ADD COLUMN import_job_id INT NULL")
        if "source" not in tx_cols:
            stmts.append(
                "ALTER TABLE transactions ADD COLUMN source ENUM('manual','imported_csv','imported_pdf') DEFAULT 'manual'"
            )

        # categories table compatibility
        if "type" not in cat_cols:
            stmts.append(
                "ALTER TABLE categories ADD COLUMN type ENUM('expense','income','transfer') NOT NULL DEFAULT 'expense'"
            )
        if "parent_id" not in cat_cols:
            stmts.append("ALTER TABLE categories ADD COLUMN parent_id INT NULL")
        if "sort_order" not in cat_cols:
            stmts.append("ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0")
        if "is_system" not in cat_cols:
            stmts.append("ALTER TABLE categories ADD COLUMN is_system BOOLEAN DEFAULT FALSE")
        if "is_active" not in cat_cols:
            stmts.append("ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
        if "is_hidden" not in cat_cols:
            stmts.append("ALTER TABLE categories ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE")
        if "updated_at" not in cat_cols:
            stmts.append(
                "ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            )

        for stmt in stmts:
            conn.execute(text(stmt))

        conn.commit()

        print(f"Applied {len(stmts)} schema updates.")
        print("transactions:", [r[0] for r in conn.execute(text("SHOW COLUMNS FROM transactions")).fetchall()])
        print("categories:", [r[0] for r in conn.execute(text("SHOW COLUMNS FROM categories")).fetchall()])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

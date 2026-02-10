"""
Seed transaction history for a user. Uses backend .env for DB connection.
Run from repo root: python backend/scripts/seed_transactions.py --user test@example.com
Or with JSON: python backend/scripts/seed_transactions.py --user test@example.com --file backend/scripts/data/seed_transactions.json
"""
import argparse
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv


def _load_backend_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    load_dotenv(backend_dir / ".env")


# Sample data for quick seeding without a JSON file
SAMPLE_TRANSACTIONS = [
    {"merchant": "Starbucks", "amount": 6.50, "description": "Latte"},
    {"merchant": "Grab", "amount": 12.80, "description": "Ride to office"},
    {"merchant": "Amazon", "amount": 49.99, "description": "Household items"},
    {"merchant": "NTUC FairPrice", "amount": 85.20, "description": "Groceries"},
    {"merchant": "Restaurant XYZ", "amount": 42.00, "description": "Dinner"},
    {"merchant": "Spotify", "amount": 9.99, "description": "Premium subscription"},
    {"merchant": "Shell Station", "amount": 65.00, "description": "Fuel"},
    {"merchant": "Shopee", "amount": 28.50, "description": "Online shopping"},
    {"merchant": "McDonald's", "amount": 11.20, "description": "Lunch"},
    {"merchant": "Cinema", "amount": 18.00, "description": "Movie ticket"},
    {"merchant": "Gym", "amount": 55.00, "description": "Monthly membership"},
    {"merchant": "Grab", "amount": 8.50, "description": "Food delivery"},
    {"merchant": "DBS Bank", "amount": 1200.00, "description": "Salary credit", "transaction_type": "credit"},
    {"merchant": "Electric Co", "amount": 95.00, "description": "Utilities"},
    {"merchant": "Netflix", "amount": 15.99, "description": "Subscription"},
    {"merchant": "Coffee Bean", "amount": 7.20, "description": "Americano"},
    {"merchant": "Lazada", "amount": 33.00, "description": "Electronics"},
    {"merchant": "Hawker Centre", "amount": 5.50, "description": "Breakfast"},
    {"merchant": "Grab", "amount": 22.00, "description": "Ride"},
    {"merchant": "Guardian", "amount": 24.80, "description": "Pharmacy"},
]


def load_transactions_from_json(path: Path) -> list[dict]:
    """Load transaction list from JSON. Each item: merchant, amount; optional: description, date (YYYY-MM-DD), transaction_type (debit|credit)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("JSON must be a list of transactions")
    out = []
    for i, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Transaction #{i} must be an object")
        merchant = item.get("merchant")
        amount = item.get("amount")
        if not merchant or amount is None:
            raise ValueError(f"Transaction #{i} must have 'merchant' and 'amount'")
        out.append({
            "merchant": str(merchant),
            "amount": float(amount),
            "description": item.get("description"),
            "date": item.get("date"),
            "transaction_type": (item.get("transaction_type") or "debit").lower(),
        })
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Seed transaction history for a user (DB from backend/.env)."
    )
    parser.add_argument(
        "--user",
        default="test@example.com",
        help="Email of the user to attach transactions to (default: test@example.com).",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="Optional JSON file: list of {merchant, amount, description?, date?, transaction_type?}.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=0,
        help="If no --file, number of sample transactions to insert (default: all SAMPLE_TRANSACTIONS).",
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=90,
        help="Spread sample dates over this many days (default: 90).",
    )
    args = parser.parse_args(argv)

    _load_backend_env()

    from app.auth import get_user_by_email
    from app.database import Base, SessionLocal, engine
    from app.models import User

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        user = get_user_by_email(db, args.user)
        if not user:
            print(f"User not found: {args.user}. Run seed_users.py first.")
            return 1

        if args.file:
            if not args.file.exists():
                print(f"File not found: {args.file}")
                return 1
            rows = load_transactions_from_json(args.file)
        else:
            count = args.count or len(SAMPLE_TRANSACTIONS)
            rows = []
            for i, s in enumerate(SAMPLE_TRANSACTIONS * (count // len(SAMPLE_TRANSACTIONS) + 1)):
                if len(rows) >= count:
                    break
                delta = random.randint(0, args.days_back)
                date = (datetime.now() - timedelta(days=delta)).replace(hour=0, minute=0, second=0, microsecond=0)
                rows.append({
                    "merchant": s["merchant"],
                    "amount": s["amount"],
                    "description": s.get("description"),
                    "date": date.isoformat(),
                    "transaction_type": s.get("transaction_type", "debit"),
                })

        from sqlalchemy import text

        created = 0
        for r in rows:
            date_str = r.get("date")
            if date_str:
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except Exception:
                    dt = datetime.now() - timedelta(days=random.randint(0, args.days_back))
            else:
                dt = datetime.now() - timedelta(days=random.randint(0, args.days_back))
            tt = "credit" if (r.get("transaction_type") or "debit") == "credit" else "debit"
            merchant = (r["merchant"][:255]) if r["merchant"] else ""
            desc = r.get("description")
            # Minimal columns so this works with older DB schemas (no account_id, source, etc.)
            db.execute(
                text("""
                    INSERT INTO transactions (user_id, date, amount, merchant, description, transaction_type, status)
                    VALUES (:user_id, :date, :amount, :merchant, :description, :transaction_type, :status)
                """),
                {
                    "user_id": user.id,
                    "date": dt,
                    "amount": abs(r["amount"]),
                    "merchant": merchant,
                    "description": desc,
                    "transaction_type": tt,
                    "status": "processed",
                },
            )
            created += 1

        db.commit()
        print(f"Seeded {created} transactions for {args.user}")
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

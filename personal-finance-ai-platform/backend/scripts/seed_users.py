import argparse
import json
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Sequence

from dotenv import load_dotenv


@dataclass(frozen=True)
class SeedUser:
    email: str
    password: str
    full_name: str | None = None


def _load_backend_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    load_dotenv(backend_dir / ".env")


def _parse_user_spec(spec: str) -> SeedUser:
    # Format: email:password[:full_name]
    parts = spec.split(":", 2)
    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise ValueError("Invalid --user format. Expected: email:password[:full_name]")
    email, password = parts[0], parts[1]
    full_name = parts[2] if len(parts) == 3 and parts[2] else None
    return SeedUser(email=email, password=password, full_name=full_name)


def _load_users_from_json(path: Path) -> list[SeedUser]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("JSON must be a list of users")

    users: list[SeedUser] = []
    for idx, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"User #{idx} must be an object")
        email = item.get("email")
        password = item.get("password")
        full_name = item.get("full_name")
        if not isinstance(email, str) or not email:
            raise ValueError(f"User #{idx} missing 'email'")
        if not isinstance(password, str) or not password:
            raise ValueError(f"User #{idx} missing 'password'")
        if full_name is not None and not isinstance(full_name, str):
            raise ValueError(f"User #{idx} 'full_name' must be a string or null")
        users.append(SeedUser(email=email, password=password, full_name=full_name))

    return users


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Seed dev users into the database configured by backend/.env (MySQL)."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--user",
        action="append",
        help="User in format email:password[:full_name]. Repeat for multiple users.",
    )
    group.add_argument(
        "--file",
        type=Path,
        help="Path to JSON file containing a list of users {email,password,full_name?}.",
    )
    parser.add_argument(
        "--update-password",
        action="store_true",
        help="If the user already exists, update their password (and full_name if provided).",
    )

    args = parser.parse_args(argv)

    _load_backend_env()

    from app.auth import get_password_hash, get_user_by_email
    from app.database import Base, SessionLocal, engine
    from app.models import User

    Base.metadata.create_all(bind=engine)

    if args.file:
        users = _load_users_from_json(args.file)
    else:
        users = [_parse_user_spec(spec) for spec in (args.user or [])]

    created = 0
    updated = 0
    skipped = 0

    db = SessionLocal()
    try:
        for u in users:
            existing = get_user_by_email(db, u.email)
            if existing:
                if args.update_password:
                    existing.hashed_password = get_password_hash(u.password)
                    if u.full_name is not None:
                        existing.full_name = u.full_name
                    updated += 1
                    print(f"updated: {u.email}")
                else:
                    skipped += 1
                    print(f"skipped (exists): {u.email}")
                continue

            db_user = User(
                email=u.email,
                hashed_password=get_password_hash(u.password),
                full_name=u.full_name,
            )
            db.add(db_user)
            created += 1
            print(f"created: {u.email}")

        db.commit()
    finally:
        db.close()

    print(f"done: created={created} updated={updated} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import os

# Set DATABASE_URL to SQLite before any app modules are imported.
# This prevents the database module from trying to connect to MySQL
# during test collection.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

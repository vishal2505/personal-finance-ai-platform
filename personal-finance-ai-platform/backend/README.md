# Backend API

FastAPI backend for the Personal Finance AI Platform.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the `backend` directory:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=spendwise_db
DB_USER=pfai_admin
DB_PASSWORD=your-password
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=your-openai-api-key-here
```

4. Set up MySQL database:
4. Set up MySQL database:
```bash
# Example using mysql client
mysql -u root -p -e "CREATE DATABASE spendwise_db;"
```

5. Run the application:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Seed dev users (optional)

You can seed one or more users for testing login:

```bash
python scripts/seed_users.py --user test@example.com:test123:"Test User"
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Docker Compose (local)

From the app root (`personal-finance-ai-platform/`):
```bash
docker compose up --build
```

The backend will be available at `http://localhost:8000`.

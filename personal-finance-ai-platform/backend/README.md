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
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/personal_finance?charset=utf8mb4
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=your-openai-api-key-here
```

4. Set up MySQL database:
```bash
# Open MySQL client
mysql -u root -p

# In the MySQL prompt:
# CREATE DATABASE personal_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# CREATE USER 'user'@'localhost' IDENTIFIED BY 'password';
# GRANT ALL PRIVILEGES ON personal_finance.* TO 'user'@'localhost';
# FLUSH PRIVILEGES;
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

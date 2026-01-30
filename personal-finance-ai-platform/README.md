# Personal Finance AI Platform

This repository contains a collaborative project developed as part of the  
**SMU – Modern Software Solution Development** course.

## Project Overview

The Personal Finance AI Platform allows users to:
- Import monthly credit card statements (PDF/CSV)
- Consolidate expenses across multiple banks and cards
- Automatically categorize transactions
- Detect anomalous or unusual spending
- Generate AI-driven insights, budgets, and goals

## Key Constraint

Due to the lack of public consumer APIs from most Singapore banks, credit card
statements are imported through secure manual upload workflows (PDF/CSV upload).

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Database**: PostgreSQL
- **AI Services**: LLM-based insight generation, Isolation Forest for anomaly detection
- **File Processing**: pdfplumber (PDF), pandas (CSV)

## Features

### Core Features
- ✅ User authentication (Login/Register)
- ✅ Manual statement upload (PDF/CSV)
- ✅ Automatic transaction categorization
- ✅ Merchant rule-based auto-categorization
- ✅ Transaction filtering and search
- ✅ Budget creation and tracking
- ✅ AI-powered insights
- ✅ Anomaly detection using machine learning
- ✅ Category and merchant rule management

### Pages
- ✅ Login/Register
- ✅ Dashboard
- ✅ Upload Statement
- ✅ Import Review (bulk mapping)
- ✅ Transactions list (filter by date/category)
- ✅ Budgets
- ✅ Insights
- ✅ Anomalies
- ✅ Settings (categories + merchant rules)

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 12+

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/personal_finance
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
OPENAI_API_KEY=your-openai-api-key-here
```

5. Set up PostgreSQL database:
```bash
createdb personal_finance
```

6. Run the backend:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
personal-finance-ai-platform/
├── backend/
│   ├── app/
│   │   ├── routers/        # API route handlers
│   │   ├── models.py        # Database models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # Authentication utilities
│   │   ├── database.py      # Database configuration
│   │   └── main.py          # FastAPI application
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── components/      # Reusable components
│   │   ├── contexts/        # React contexts
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── README.md
└── README.md
```

## Usage

1. **Register/Login**: Create an account or sign in
2. **Upload Statement**: Upload PDF or CSV statement files
3. **Review Import**: Review and categorize imported transactions
4. **View Transactions**: Browse and filter your transaction history
5. **Set Budgets**: Create budgets for categories or overall spending
6. **View Insights**: Get AI-powered insights about your spending
7. **Check Anomalies**: Review unusual transactions detected by AI
8. **Manage Settings**: Configure categories and merchant rules

## Team

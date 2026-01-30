# Setup Guide

## Quick Start

### 1. Database Setup

First, ensure PostgreSQL is installed and running. Then create the database:

```bash
# Using psql
psql -U postgres
CREATE DATABASE personal_finance;
\q

# Or using createdb command
createdb personal_finance
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env file with your database credentials:
# DATABASE_URL=postgresql://username:password@localhost:5432/personal_finance
# SECRET_KEY=your-secret-key-here
# OPENAI_API_KEY=your-openai-api-key (optional, for enhanced AI features)

# Run database migrations (tables are auto-created on first run)
# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API Docs: `http://localhost:8000/docs`

### 3. Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: `http://localhost:3000`

## Using the Application

1. **Register**: Create a new account at `/register`
2. **Login**: Sign in at `/login`
3. **Upload Statement**: Go to Upload Statement page and upload a PDF or CSV file
4. **Review Import**: After upload, review and categorize transactions
5. **View Dashboard**: See overview of your finances
6. **Set Budgets**: Create budgets for categories or overall spending
7. **View Insights**: Get AI-powered insights about spending patterns
8. **Check Anomalies**: Review unusual transactions
9. **Manage Settings**: Configure categories and merchant rules for auto-categorization

## File Format Support

### CSV Format
The CSV should contain columns for:
- Date (various formats supported)
- Amount
- Merchant/Description
- Optional: Description/Details

Example CSV columns:
- `date`, `amount`, `merchant`, `description`
- `Date`, `Amount`, `Merchant`, `Description`
- `transaction_date`, `transaction_amount`, `vendor`

### PDF Format
PDF statements are parsed using table extraction. The system looks for:
- Date column
- Amount column (last column often)
- Merchant/Description column

## Troubleshooting

### Backend Issues

**Database Connection Error**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Verify database exists: `psql -l` should show `personal_finance`

**Port Already in Use**
- Change port in uvicorn command: `--port 8001`
- Update frontend proxy in `vite.config.ts`

### Frontend Issues

**Cannot connect to backend**
- Ensure backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Verify proxy configuration in `frontend/vite.config.ts`

**Module not found errors**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then reinstall

### File Upload Issues

**PDF parsing fails**
- Ensure PDF contains extractable text (not scanned images)
- Try converting PDF to CSV if parsing fails
- Check PDF format matches typical bank statement layout

**CSV parsing fails**
- Verify CSV has proper headers
- Check date format matches common formats
- Ensure amount column contains numeric values

## Development

### Backend Development
- API documentation: `http://localhost:8000/docs`
- Code structure: `backend/app/`
- Add new routes in `backend/app/routers/`
- Database models in `backend/app/models.py`

### Frontend Development
- Main app: `frontend/src/App.tsx`
- Pages: `frontend/src/pages/`
- Components: `frontend/src/components/`
- API calls use axios with base URL from vite proxy

## Production Deployment

### Backend
1. Set production environment variables
2. Use production ASGI server (e.g., gunicorn with uvicorn workers)
3. Set up proper CORS origins
4. Use environment-specific database

### Frontend
1. Build: `npm run build`
2. Serve `dist/` directory with a web server (nginx, etc.)
3. Configure API proxy or use absolute API URLs

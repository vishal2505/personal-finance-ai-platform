# Quick Start Guide

## Option A: Run with Docker (easiest)

Run the full stack (database, backend, frontend) with one command. No need to install PostgreSQL or Node locally.

From the repository root, go to the app directory and start:

```bash
cd personal-finance-ai-platform
docker compose up --build
```

Then open:

- **Frontend App**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). Stop with `Ctrl+C`; run `docker compose down` to remove containers.

---

## Option B: Run backend and frontend manually

## ✅ Backend and Frontend Started!

Both servers should now be running:

- **Backend API**: http://localhost:8000
- **Frontend App**: http://localhost:5173 (Vite default; check terminal if different)
- **API Documentation**: http://localhost:8000/docs

## Important: Database Setup Required

Before you can use the application, you need to set up PostgreSQL:

### Option 1: Install PostgreSQL (Recommended)

1. Download and install PostgreSQL from: https://www.postgresql.org/download/windows/
2. During installation, remember the password you set for the `postgres` user
3. Create the database:
   ```powershell
   # Open PowerShell and run:
   psql -U postgres
   # Then in psql:
   CREATE DATABASE personal_finance;
   \q
   ```

4. Update the `.env` file in the `backend` folder:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/personal_finance
   ```

### Option 2: Use Docker (Alternative)

If you have Docker installed:
```bash
docker run --name postgres-finance -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=personal_finance -p 5432:5432 -d postgres
```

## Next Steps

1. **Open your browser** and go to: http://localhost:5173
2. **Register** a new account
3. **Start using** the application!

## Troubleshooting

### Backend not starting?
- Check if port 8000 is already in use
- Verify PostgreSQL is running
- Check the `.env` file has correct database URL
- Look at the terminal output for error messages

### Frontend not starting?
- Check if port 5173 is already in use (Vite default)
- Make sure `node_modules` is installed (run `npm install` in frontend folder)
- Check the terminal output for error messages

### Database connection errors?
- Ensure PostgreSQL is running
- Verify the database `personal_finance` exists
- Check the DATABASE_URL in `.env` file matches your PostgreSQL setup

## Manual Start Commands

If you need to restart the servers manually, run these from the `personal-finance-ai-platform` directory:

### Backend (in one terminal):
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (in another terminal):
```powershell
cd frontend
npm run dev
```

## Features Available

Once both servers are running and database is set up:

- ✅ User Registration & Login
- ✅ Upload PDF/CSV Statements
- ✅ Review & Categorize Transactions
- ✅ View Transaction History
- ✅ Create & Track Budgets
- ✅ AI-Powered Insights
- ✅ Anomaly Detection
- ✅ Category & Merchant Rule Management

Enjoy using the Personal Finance AI Platform! 🎉

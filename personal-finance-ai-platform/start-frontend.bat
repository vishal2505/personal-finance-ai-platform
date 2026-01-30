@echo off

REM Start Frontend Server
cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Start development server
echo Starting frontend server...
call npm run dev

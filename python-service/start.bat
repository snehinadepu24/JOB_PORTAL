@echo off
REM Start script for Resume Intelligence Engine (Windows)

echo ==========================================
echo Resume Intelligence Engine - Starting
echo ==========================================

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo Please edit .env file with your configuration
)

REM Start the service
echo Starting Flask service...
python app.py

pause

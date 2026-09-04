@echo off
title AI Shop Agent - Desktop Launcher
echo ===================================================
echo   AI Shop Agent - Sales & Customer Service Suite
echo   Desktop Application for Windows
echo ===================================================
echo.

:: Check for Python installation
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not found in PATH!
    echo Please install Python 3.10 or higher from https://python.org
    echo and ensure "Add Python to PATH" is checked during installation.
    pause
    exit /b
)

:: Install / verify dependencies
echo [1/3] Checking and installing required Python packages...
pip install -r requirements.txt

:: Check Gemini API Key
if "%GEMINI_API_KEY%"=="" (
    echo [2/3] GEMINI_API_KEY environment variable is not set.
    echo (The application will run with intelligent local rule-based fallback,
    echo or you can set it now in Windows: setx GEMINI_API_KEY "your_api_key_here")
) else (
    echo [2/3] GEMINI_API_KEY detected!
)

:: Launch the Desktop Application
echo [3/3] Launching Windows Desktop Application...
echo.
python main_app.py
pause

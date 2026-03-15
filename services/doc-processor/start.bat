@echo off
echo [AGL] Starting Doc Processor Service on port 8100...
echo [AGL] First run will download models (PaddleOCR ~100MB, Whisper base ~150MB)
echo.
cd /d "%~dp0"
python main.py
pause

@echo off
setlocal
title Kinetix — Windows One-Click Installer Builder

echo ==================================================
echo   Building Kinetix One-Click Windows Installer
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js 20+ from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

echo [1/4] Installing application dependencies...
call npm install
if errorlevel 1 goto :error

echo [2/4] Installing Windows desktop packager...
call npm install --no-save electron electron-builder
if errorlevel 1 goto :error

echo [3/4] Building web interface...
call npm run build
if errorlevel 1 goto :error

echo [4/4] Packaging one-click Windows installer (.exe)...
call npx electron-builder --win --config electron-builder.yml --publish never
if errorlevel 1 goto :error

echo.
echo Done! Your one-click installer is ready in the "release" folder.
start "" "%~dp0release"
pause
exit /b 0

:error
echo.
echo Build failed. Please review the message above.
pause
exit /b 1

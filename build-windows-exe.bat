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

echo [1/5] Installing application dependencies...
call npm install --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 goto :error

echo [2/5] Installing Windows desktop packager...
call npm install --no-save --legacy-peer-deps --no-audit --no-fund electron electron-builder
if errorlevel 1 goto :error

echo [3/5] Building web interface...
call npm run build
if errorlevel 1 goto :error

echo [4/5] Building desktop server bundle...
call npm run build:desktop-server
if errorlevel 1 goto :error

echo [5/5] Packaging one-click Windows installer (.exe)...
call npx electron-builder --win --config electron-builder.yml -c.publish=null --publish never
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

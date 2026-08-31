@echo off
setlocal
cd /d "%~dp0"
title Mahjong Live

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Mahjong Live needs Node.js 20 or newer.
  echo Opening the Node.js download page...
  start "" "https://nodejs.org/en/download"
  echo.
  echo Install Node.js, then double-click START_GAME.bat again.
  pause
  exit /b 1
)

node scripts\start.mjs
if errorlevel 1 (
  echo.
  echo Mahjong Live did not start correctly.
  pause
)

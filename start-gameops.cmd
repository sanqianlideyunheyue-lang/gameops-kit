@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  echo Could not open the GameOps Kit folder.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) < 18 ? 1 : 0)"
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  pause
  exit /b 1
)

node server.js --open
if errorlevel 1 (
  echo GameOps Kit could not start. See the message above.
  pause
  exit /b 1
)

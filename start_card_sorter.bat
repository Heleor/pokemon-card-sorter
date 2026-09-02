@echo off
cd /d %~dp0
echo Refreshing price data (skips if less than 24h old)...
node refresh.mjs
start "card-sorter-server" /min node server.mjs
timeout /t 1 /nobreak >nul
start "" http://localhost:8799

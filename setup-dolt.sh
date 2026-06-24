#!/bin/bash
# One-time Dolt database setup
set -e

mkdir -p ~/dolt-databases/dolt-crm
cd ~/dolt-databases/dolt-crm

if [ -d ".dolt" ]; then
  echo "Dolt database already initialized at ~/dolt-databases/dolt-crm"
else
  dolt init
  dolt config --local --add user.email "james@dolthub.com"
  dolt config --local --add user.name "James Wright"
  echo "Dolt database initialized at ~/dolt-databases/dolt-crm"
fi

echo ""
echo "Next step — start the Dolt SQL server:"
echo "  cd ~/dolt-databases/dolt-crm && dolt sql-server --port 3307"
echo ""
echo "Then in another terminal, start the CRM:"
echo "  cd ~/dolt-crm && npm run dev"

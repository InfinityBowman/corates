#!/bin/bash
# Reset production D1 database and redeploy workers
# Usage: ./scripts/reset-db-prod.sh

set -e

echo "=========================================="
echo "  Resetting Production D1 Database"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.."

echo ""
echo "Step 1: Dropping existing tables..."
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS mediaFiles;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS project_members;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS projects;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS verification;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS account;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS session;"
npx wrangler d1 execute corates-db-prod --remote --yes --command "DROP TABLE IF EXISTS user;"

echo ""
echo "Step 2: Running migration..."
npx wrangler d1 execute corates-db-prod --remote --yes --file=migrations/0001_init.sql

echo ""
echo "Step 3: Deploying workers..."
npx wrangler deploy --env production

echo ""
echo "=========================================="
echo "  Database reset and workers deployed!"
echo "=========================================="

#!/usr/bin/env bash
set -e

# FINFVC — build local de produção (provider supabase)
# Roda a partir da raiz do repo. App fica em finance-app/, saída em finance-app/dist/.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/finance-app"

echo "==> Build FINFVC (VITE_DATA_PROVIDER=supabase)"
cd "$APP_DIR"

VITE_DATA_PROVIDER=supabase npm run build

echo "==> Build OK: $APP_DIR/dist"

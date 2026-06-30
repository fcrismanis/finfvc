#!/usr/bin/env bash
set -e

# FINFVC — deploy de produção: rsync + troca atômica.
# Servidor: root@187.127.4.69   Dir prod: /var/www/fin
# Uso: scripts/deploy-prod.sh [--build]   (--build roda build antes do envio)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/finance-app"
DIST_DIR="$APP_DIR/dist"

SERVER="root@187.127.4.69"
PROD_DIR="/var/www/fin"
NEW_DIR="/var/www/fin-new"
OLD_DIR="/var/www/fin-old"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/var/www/fin-pre-deploy-$STAMP"

# Build opcional antes do deploy.
if [ "${1:-}" = "--build" ]; then
  "$REPO_ROOT/scripts/build.sh"
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "ERRO: $DIST_DIR não existe. Rode scripts/build.sh primeiro (ou passe --build)." >&2
  exit 1
fi

echo "==> Backup remoto: $BACKUP_DIR"
ssh "$SERVER" "if [ -d '$PROD_DIR' ]; then cp -a '$PROD_DIR' '$BACKUP_DIR'; fi"

echo "==> Limpando staging remoto $NEW_DIR"
ssh "$SERVER" "rm -rf '$NEW_DIR' && mkdir -p '$NEW_DIR'"

echo "==> Enviando dist/ para $NEW_DIR"
rsync -az --delete "$DIST_DIR/" "$SERVER:$NEW_DIR/"

echo "==> Swap atômico"
ssh "$SERVER" "set -e; \
  rm -rf '$OLD_DIR'; \
  if [ -d '$PROD_DIR' ]; then mv '$PROD_DIR' '$OLD_DIR'; fi; \
  mv '$NEW_DIR' '$PROD_DIR'; \
  chown -R www-data:www-data '$PROD_DIR'; \
  systemctl reload nginx"

echo "==> Deploy OK. Backup: $BACKUP_DIR | Versão anterior: $OLD_DIR"

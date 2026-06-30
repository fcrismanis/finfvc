#!/usr/bin/env bash
set -e

# FINFVC — rollback: restaura backup mais recente fin-pre-deploy-*.
# Versão atual quebrada vira /var/www/fin-broken. Recarrega nginx.

SERVER="root@187.127.4.69"
PROD_DIR="/var/www/fin"
BROKEN_DIR="/var/www/fin-broken"

echo "==> Procurando backup mais recente em /var/www/fin-pre-deploy-*"

ssh "$SERVER" bash -s <<EOF
set -e
LATEST=\$(ls -1d /var/www/fin-pre-deploy-* 2>/dev/null | sort | tail -n1 || true)
if [ -z "\$LATEST" ]; then
  echo "ERRO: nenhum backup fin-pre-deploy-* encontrado." >&2
  exit 1
fi
echo "==> Restaurando: \$LATEST"
rm -rf '$BROKEN_DIR'
if [ -d '$PROD_DIR' ]; then mv '$PROD_DIR' '$BROKEN_DIR'; fi
cp -a "\$LATEST" '$PROD_DIR'
chown -R www-data:www-data '$PROD_DIR'
systemctl reload nginx
echo "==> Rollback OK. Restaurado de: \$LATEST | Quebrado salvo em: $BROKEN_DIR"
EOF

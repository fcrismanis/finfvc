#!/usr/bin/env bash
# Deploy do MCP "Economista FIN" na VPS Ubuntu. Idempotente: pode rodar de novo.
# Uso (no terminal da Hostinger):
#   curl -fsSL https://raw.githubusercontent.com/fcrismanis/finfvc/feat/pluggy-mcp-tools/finance-app/mcp/deploy/setup-vps.sh | bash
set -euo pipefail

DOMAIN="${MCP_DOMAIN:-mcp.crismanis.com.br}"
BRANCH="${MCP_BRANCH:-feat/pluggy-mcp-tools}"
DIR="${MCP_DIR:-$HOME/finfvc}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
TTY=/dev/tty   # permite perguntar mesmo com o script vindo por pipe

ask()   { local v; read -r -p "$1: " v <"$TTY"; printf '%s' "$v"; }
asks()  { local v; read -r -s -p "$1: " v <"$TTY"; echo >&2; printf '%s' "$v"; }

echo "==> Docker"
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | $SUDO sh; }
docker compose version >/dev/null

echo "==> Código ($BRANCH)"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else git clone -q -b "$BRANCH" https://github.com/fcrismanis/finfvc "$DIR"; fi
cd "$DIR/finance-app/mcp"

if [ ! -f .env ]; then
  echo "==> Configuração (os segredos não aparecem na tela)"
  PCID=$(ask  "PLUGGY_CLIENT_ID")
  PCSEC=$(asks "PLUGGY_CLIENT_SECRET")
  ITEMS=$(ask  "PLUGGY_ITEM_IDS (csv, pode ficar vazio por enquanto)")
  SBURL=$(ask  "SUPABASE_URL")
  SBKEY=$(asks "SUPABASE_SERVICE_ROLE_KEY")
  FAM=$(ask    "FAMILY_ID")
  TOKEN=$(openssl rand -hex 32)
  umask 077
  { echo "PLUGGY_CLIENT_ID=$PCID"; echo "PLUGGY_CLIENT_SECRET=$PCSEC"; echo "PLUGGY_ITEM_IDS=$ITEMS"
    echo "SUPABASE_URL=$SBURL"; echo "SUPABASE_SERVICE_ROLE_KEY=$SBKEY"; echo "FAMILY_ID=$FAM"
    echo "MCP_AUTH_TOKEN=$TOKEN"; } > .env
else
  echo "==> .env já existe: mantendo"
fi

echo "==> Subindo o container"
$SUDO docker compose up -d --build
for i in $(seq 1 20); do curl -fsS localhost:3010/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS localhost:3010/health && echo

echo "==> Nginx + HTTPS ($DOMAIN)"
command -v nginx   >/dev/null || $SUDO apt-get install -y -q nginx
command -v certbot >/dev/null || $SUDO apt-get install -y -q certbot python3-certbot-nginx
$SUDO sed "s/mcp.crismanis.com.br/$DOMAIN/g" deploy/nginx-mcp.conf > /tmp/mcp-site.conf
$SUDO cp /tmp/mcp-site.conf "/etc/nginx/sites-available/$DOMAIN"
$SUDO ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
$SUDO nginx -t && $SUDO systemctl reload nginx

MYIP=$(curl -fsS https://api.ipify.org || true)
DNSIP=$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || true)
if [ -z "$DNSIP" ]; then
  echo "!! $DOMAIN ainda não resolve. Crie no Cloudflare um registro A 'mcp' -> $MYIP (DNS only) e rode este script de novo."
  exit 0
fi
$SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

TOKEN=$(grep '^MCP_AUTH_TOKEN=' .env | cut -d= -f2)
echo
echo "PRONTO. Conector no Claude (URL):"
echo "https://$DOMAIN/mcp/$TOKEN"

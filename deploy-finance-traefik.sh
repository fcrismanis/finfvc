#!/usr/bin/env bash
set -euo pipefail

# ==============================
# FINANCE · Deploy Hostinger VPS + Traefik
# ==============================

DOMAIN="fin.fjcrivo.com"
SSH_HOST="srv886658.hstgr.cloud"
SSH_USER="root"
SSH_PORT="22"

APP_DIR="finance-app"
DIST_DIR="$APP_DIR/dist"
REMOTE_APP_ROOT="/var/www/fin"
REMOTE_NGINX_DIR="/var/www/fin-nginx"
SERVICE_NAME="finance_finance"
IMAGE="nginx:alpine"

echo "== FINANCE · Deploy Traefik =="
echo "Domínio: $DOMAIN"
echo "Servidor: $SSH_USER@$SSH_HOST:$SSH_PORT"
echo

echo "1) Conferindo pasta local..."
if [ ! -d "$APP_DIR" ]; then
  echo "ERRO: pasta '$APP_DIR' não encontrada."
  echo "Rode este script na raiz do projeto FINFVC."
  exit 1
fi

echo "OK: $APP_DIR encontrado."
echo

echo "2) Build local com provider LOCAL..."
cd "$APP_DIR"
VITE_DATA_PROVIDER=local npm run build
cd ..
echo

echo "3) Validando dist..."
test -f "$DIST_DIR/index.html"
test -d "$DIST_DIR/assets"

echo "OK: dist válido."
echo

echo "4) Criando pacote temporário..."
rm -f finance-dist.tar.gz
tar -czf finance-dist.tar.gz -C "$DIST_DIR" .
ls -lh finance-dist.tar.gz
echo

echo "5) Enviando pacote para o servidor..."
scp -P "$SSH_PORT" finance-dist.tar.gz "$SSH_USER@$SSH_HOST:/tmp/finance-dist.tar.gz"
echo

echo "6) Executando deploy remoto..."
ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" <<'REMOTE_EOF'
set -euo pipefail

DOMAIN="fin.fjcrivo.com"
REMOTE_APP_ROOT="/var/www/fin"
REMOTE_NGINX_DIR="/var/www/fin-nginx"
SERVICE_NAME="finance_finance"
IMAGE="nginx:alpine"

echo "== Remoto · FINANCE deploy =="
echo

echo "1) Preparando pasta do app..."
rm -rf "$REMOTE_APP_ROOT"
mkdir -p "$REMOTE_APP_ROOT"
tar -xzf /tmp/finance-dist.tar.gz -C "$REMOTE_APP_ROOT"

echo "Conteúdo do app:"
ls -la "$REMOTE_APP_ROOT"
test -f "$REMOTE_APP_ROOT/index.html"
test -d "$REMOTE_APP_ROOT/assets"
echo

echo "2) Criando Nginx interno do container..."
mkdir -p "$REMOTE_NGINX_DIR"

cat > "$REMOTE_NGINX_DIR/default.conf" <<'NGINX'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

echo "OK: Nginx interno criado."
echo

echo "3) Ajustando permissões..."
chown -R www-data:www-data "$REMOTE_APP_ROOT"
chmod -R 755 "$REMOTE_APP_ROOT"
echo

echo "4) Descobrindo serviço Traefik..."
TRAEFIK_SERVICE="$(docker service ls --format '{{.Name}}' | grep -E '^traefik_' | head -1 || true)"

if [ -z "$TRAEFIK_SERVICE" ]; then
  echo "ERRO: serviço Traefik não encontrado."
  docker service ls
  exit 1
fi

echo "Traefik service: $TRAEFIK_SERVICE"
echo

echo "5) Descobrindo network do Traefik..."
TRAEFIK_TARGET="$(docker service inspect "$TRAEFIK_SERVICE" --format '{{range .Spec.TaskTemplate.Networks}}{{println .Target}}{{end}}' | head -1)"

if [ -z "$TRAEFIK_TARGET" ]; then
  echo "ERRO: não consegui descobrir a network do Traefik."
  docker service inspect "$TRAEFIK_SERVICE" --format '{{json .Spec.TaskTemplate.Networks}}'
  exit 1
fi

TRAEFIK_NETWORK="$(docker network inspect "$TRAEFIK_TARGET" -f '{{.Name}}' 2>/dev/null || echo "$TRAEFIK_TARGET")"

echo "Traefik network: $TRAEFIK_NETWORK"
echo

echo "6) Descobrindo certresolver pelo UberTarget, se existir..."
UBER_SERVICE="$(docker service ls --format '{{.Name}}' | grep -E '^ubertarget_' | head -1 || true)"
RESOLVER="letsencryptresolver"

if [ -n "$UBER_SERVICE" ]; then
  DETECTED_RESOLVER="$(docker service inspect "$UBER_SERVICE" -f '{{range $k,$v := .Spec.Labels}}{{printf "%s=%s\n" $k $v}}{{end}}' | awk -F= '/tls.certresolver/ {print $2; exit}' || true)"
  if [ -n "${DETECTED_RESOLVER:-}" ]; then
    RESOLVER="$DETECTED_RESOLVER"
  fi
fi

echo "Certresolver: $RESOLVER"
echo

echo "7) Verificando constraints do Traefik..."
TRAEFIK_ARGS="$(docker service inspect "$TRAEFIK_SERVICE" --format '{{json .Spec.TaskTemplate.ContainerSpec.Args}}' || true)"
echo "$TRAEFIK_ARGS" | grep -i "constraint" >/dev/null 2>&1 && {
  echo "ATENÇÃO: Traefik parece usar constraints. Se der 404, precisamos copiar a label de constraint do serviço que funciona."
} || true
echo

echo "8) Removendo serviço antigo do Finance, se existir..."
docker service rm "$SERVICE_NAME" 2>/dev/null || true
sleep 5
echo

echo "9) Criando regra Host do Traefik..."
HOST_RULE="Host(\`${DOMAIN}\`)"

echo "HOST_RULE=$HOST_RULE"
echo

echo "10) Criando serviço Finance..."
docker service create \
  --name "$SERVICE_NAME" \
  --network "$TRAEFIK_NETWORK" \
  --replicas 1 \
  --mount type=bind,src="$REMOTE_APP_ROOT",dst=/usr/share/nginx/html,readonly \
  --mount type=bind,src="$REMOTE_NGINX_DIR/default.conf",dst=/etc/nginx/conf.d/default.conf,readonly \
  --label "traefik.enable=true" \
  --label "traefik.docker.network=$TRAEFIK_NETWORK" \
  --label "traefik.swarm.network=$TRAEFIK_NETWORK" \
  --label "traefik.http.services.finance-finance.loadbalancer.server.port=80" \
  --label "traefik.http.routers.finance-finance.service=finance-finance" \
  --label "traefik.http.routers.finance-finance.rule=$HOST_RULE" \
  --label "traefik.http.routers.finance-finance.entrypoints=websecure" \
  --label "traefik.http.routers.finance-finance.tls=true" \
  --label "traefik.http.routers.finance-finance.tls.certresolver=$RESOLVER" \
  --label "traefik.http.routers.finance-finance-http.rule=$HOST_RULE" \
  --label "traefik.http.routers.finance-finance-http.entrypoints=web" \
  --label "traefik.http.routers.finance-finance-http.middlewares=finance-finance-https" \
  --label "traefik.http.middlewares.finance-finance-https.redirectscheme.scheme=https" \
  "$IMAGE"

echo

echo "11) Aguardando serviço estabilizar..."
sleep 12

echo "Service status:"
docker service ls | grep -E 'finance|traefik|ubertarget' || true
echo

echo "Tasks:"
docker service ps "$SERVICE_NAME" --no-trunc || true
echo

echo "12) Testando container diretamente..."
CONTAINER_ID="$(docker ps --filter "name=${SERVICE_NAME}" --format '{{.ID}}' | head -1 || true)"

if [ -n "$CONTAINER_ID" ]; then
  docker exec "$CONTAINER_ID" sh -c 'ls -la /usr/share/nginx/html && wget -qO- http://127.0.0.1 | head -5' || true
else
  echo "ATENÇÃO: não achei container do Finance."
fi

echo

echo "13) Testando via Traefik local HTTPS..."
curl -k -I --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN" || true
echo

echo "14) Testando via Traefik local rota interna..."
curl -k -I --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/orcamento" || true
echo

echo "15) Labels finais Finance:"
docker service inspect "$SERVICE_NAME" \
  --format '{{range $k,$v := .Spec.Labels}}{{printf "%s=%s\n" $k $v}}{{end}}' | sort || true

echo
echo "16) Logs Traefik recentes:"
docker service logs "$TRAEFIK_SERVICE" --tail 80 || true

echo
echo "== Deploy remoto finalizado =="
REMOTE_EOF

echo
echo "7) Testando domínio público..."
curl -k -I "https://$DOMAIN" || true
echo
curl -k -I "https://$DOMAIN/orcamento" || true
echo

echo "== Finalizado =="
echo "Abra no navegador:"
echo "https://$DOMAIN"
echo "https://$DOMAIN/orcamento"

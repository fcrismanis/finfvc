#!/usr/bin/env bash
# Instala o robô do Artha na VPS: pergunta o login, testa uma vez e agenda todo dia 06:30.
#   curl -fsSL https://raw.githubusercontent.com/fcrismanis/finfvc/feat/pluggy-mcp-tools/finance-app/artha-robot/setup.sh | bash
set -euo pipefail
BRANCH="${MCP_BRANCH:-feat/pluggy-mcp-tools}"
DIR="${MCP_DIR:-$HOME/finfvc}"
DATA="${ARTHA_DATA:-/opt/finfvc-data/artha}"
TTY=/dev/tty

if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else git clone -q -b "$BRANCH" https://github.com/fcrismanis/finfvc "$DIR"; fi
cd "$DIR/finance-app/artha-robot"

if [ ! -f .env ]; then
  read -r -p "ARTHA_EMAIL: " EMAIL <"$TTY"
  read -r -s -p "ARTHA_PASSWORD: " PASS <"$TTY"; echo
  umask 077
  printf 'ARTHA_EMAIL=%s\nARTHA_PASSWORD=%s\nARTHA_MONTHS_BACK=1\n' "$EMAIL" "$PASS" > .env
fi

mkdir -p "$DATA"
docker build -q -t finfvc-artha .
RUN="docker run --rm --env-file $PWD/.env -v $DATA:/data finfvc-artha"
echo "==> Teste"
$RUN
echo "==> Agendamento diário 06:30"
( crontab -l 2>/dev/null | grep -v finfvc-artha ; echo "30 6 * * * $RUN >> $DATA/cron.log 2>&1 # finfvc-artha" ) | crontab -
echo "PRONTO. Planilhas em $DATA"; ls -la "$DATA"

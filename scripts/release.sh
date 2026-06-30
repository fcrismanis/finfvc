#!/usr/bin/env bash
set -e

# FINFVC — release completa: commit + push + build + deploy.
# Para em qualquer falha (set -e). Roda a partir da raiz do repo.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> git status"
git status

echo
read -r -p "Mensagem de commit: " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
  echo "ERRO: mensagem vazia. Abortando." >&2
  exit 1
fi

echo "==> git add + commit + push origin main"
git add -A
git commit -m "$COMMIT_MSG"
git push origin main

echo "==> Build"
"$REPO_ROOT/scripts/build.sh"

echo "==> Deploy"
"$REPO_ROOT/scripts/deploy-prod.sh"

echo "==> Release OK"

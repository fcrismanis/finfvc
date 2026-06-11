#!/usr/bin/env bash
set -euo pipefail

APP_DIR="finance-app"
ZIP_NAME="finance-hostinger-dist.zip"
DIST_DIR="$APP_DIR/dist"

echo "== FINANCE · Build para Hostinger =="
echo

echo "1) Verificando diretório do app..."
if [ ! -d "$APP_DIR" ]; then
  echo "ERRO: pasta '$APP_DIR' não encontrada."
  echo "Rode este script na raiz do projeto FINFVC."
  exit 1
fi

echo "OK: pasta '$APP_DIR' encontrada."
echo

echo "2) Verificando .env.local..."
if [ -f "$APP_DIR/.env.local" ]; then
  echo "Arquivo .env.local encontrado."
  if grep -q "VITE_DATA_PROVIDER=supabase" "$APP_DIR/.env.local"; then
    echo "ATENÇÃO: VITE_DATA_PROVIDER=supabase encontrado."
    echo "Para este deploy inicial na Hostinger, recomendo usar:"
    echo "VITE_DATA_PROVIDER=local"
    echo
    read -r -p "Deseja continuar mesmo assim? (s/N): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[sS]$ ]]; then
      echo "Cancelado."
      exit 1
    fi
  else
    echo "OK: provider não está como supabase."
  fi
else
  echo "Aviso: $APP_DIR/.env.local não encontrado."
  echo "O build usará os defaults do app. Para segurança, o esperado é provider local."
fi
echo

echo "3) Garantindo que não há arquivos financeiros no build..."
find "$APP_DIR" \
  \( -name "*.xlsx" -o -name "*.xls" -o -name "*.csv" -o -name "*.ofx" -o -name "*.qif" \) \
  -not -path "$APP_DIR/node_modules/*" \
  -not -path "$APP_DIR/dist/*" \
  -print > /tmp/finance_sensitive_files.txt

if [ -s /tmp/finance_sensitive_files.txt ]; then
  echo "ATENÇÃO: encontrei arquivos financeiros dentro do app:"
  cat /tmp/finance_sensitive_files.txt
  echo
  echo "Eles não devem ir para o deploy."
  read -r -p "Deseja continuar mesmo assim? (s/N): " CONTINUE_FILES
  if [[ ! "$CONTINUE_FILES" =~ ^[sS]$ ]]; then
    echo "Cancelado."
    exit 1
  fi
else
  echo "OK: nenhum XLSX/CSV/OFX/QIF encontrado dentro do app."
fi
echo

echo "4) Instalando dependências, se necessário..."
cd "$APP_DIR"

if [ ! -d "node_modules" ]; then
  npm install
else
  echo "OK: node_modules já existe."
fi
echo

echo "5) Rodando build..."
npm run build
echo

cd ..

echo "6) Verificando dist..."
if [ ! -d "$DIST_DIR" ]; then
  echo "ERRO: pasta '$DIST_DIR' não foi gerada."
  exit 1
fi

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "ERRO: '$DIST_DIR/index.html' não encontrado."
  exit 1
fi

if [ ! -d "$DIST_DIR/assets" ]; then
  echo "ERRO: '$DIST_DIR/assets' não encontrado."
  exit 1
fi

echo "OK: dist gerado corretamente."
echo

echo "7) Verificando .htaccess..."
if [ ! -f "$DIST_DIR/.htaccess" ]; then
  echo "ATENÇÃO: .htaccess não encontrado em dist."
  echo "Criando .htaccess para SPA React/Vite..."

  cat > "$DIST_DIR/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
HTACCESS

  echo "OK: .htaccess criado."
else
  echo "OK: .htaccess presente."
fi
echo

echo "8) Removendo ZIP antigo, se existir..."
rm -f "$ZIP_NAME"
echo

echo "9) Criando ZIP com conteúdo interno da dist..."
(
  cd "$DIST_DIR"
  zip -r "../../$ZIP_NAME" . -x "*.map"
)
echo

echo "10) Validando ZIP..."
if [ ! -f "$ZIP_NAME" ]; then
  echo "ERRO: ZIP não foi criado."
  exit 1
fi

ZIP_SIZE=$(du -h "$ZIP_NAME" | awk '{print $1}')

echo
echo "== Build pronto =="
echo "Arquivo: $(pwd)/$ZIP_NAME"
echo "Tamanho: $ZIP_SIZE"
echo
echo "Conteúdo do ZIP:"
unzip -l "$ZIP_NAME" | head -40
echo

echo "== Próximo passo na Hostinger =="
echo "1. hPanel → File Manager"
echo "2. Abrir: public_html/fin/"
echo "3. Enviar: $ZIP_NAME"
echo "4. Extrair dentro de public_html/fin/"
echo "5. Confirmar:"
echo "   public_html/fin/index.html"
echo "   public_html/fin/.htaccess"
echo "   public_html/fin/assets/"
echo
echo "Testes:"
echo "https://fin.fjcrivo.com"
echo "https://fin.fjcrivo.com/orcamento"
echo
echo "Se /orcamento + F5 funcionar, o .htaccess está correto."

# Hostinger Deploy — FINANCE

## Destino

- **URL:** https://fin.fjcrivo.com
- **Tipo:** Subdomínio de `fjcrivo.com`
- **Pasta pública:** subpasta dedicada no hPanel

---

## 1. Criar subdomínio no hPanel

1. hPanel → **Domínios** → **Subdomínios**
2. Criar `fin.fjcrivo.com`
3. Definir Document Root como: `public_html/fin` (ou conforme hPanel sugerir)
4. Aguardar propagação (geralmente < 5 min na Hostinger)

---

## 2. Build local

```bash
cd finance-app

# Copiar .env.local com as variáveis corretas
cp .env.local .env.local  # já existe — verificar VITE_DATA_PROVIDER

# Build de produção
npm run build
# Gera: finance-app/dist/
```

O conteúdo de `dist/` é o que vai para o servidor.

---

## 3. Deploy — Git (recomendado se disponível)

Hostinger suporta Git deploy via hPanel para planos Business/Cloud:

1. hPanel → **Avançado** → **Git**
2. Repository URL: `https://github.com/fcrismanis/finfvc.git`
3. Branch: `main`
4. Deploy path: pasta pública do subdomínio
5. **Atenção:** o hPanel faz deploy do repositório inteiro — é necessário configurar um script de build pós-deploy ou usar CI/CD

> Se Git deploy não estiver disponível no plano atual, usar upload manual (Opção B).

---

## 4. Deploy — Upload manual (File Manager ou FTP)

```bash
# Após npm run build:
# Conteúdo de finance-app/dist/ vai para a pasta pública do subdomínio

# Exemplo via rsync (SSH):
rsync -avz --delete \
  finance-app/dist/ \
  usuario@servidor.hostinger.com:~/public_html/fin/
```

Via File Manager:
1. hPanel → File Manager → `public_html/fin/`
2. Upload de todo o conteúdo de `finance-app/dist/`
3. Garantir que `index.html` está na raiz da pasta pública

---

## 5. Configuração SPA — .htaccess

O arquivo `finance-app/public/.htaccess` já está no projeto e será incluído no build automaticamente.

Conteúdo:
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

Isso garante que rotas como `/orcamento`, `/lancamentos` funcionem sem 404 após F5.

---

## 6. Cache — limpeza após deploy

Após upload, limpar cache do Hostinger se disponível:
- hPanel → **Cache** → **Purge All**

---

## 7. Variáveis de ambiente em produção

O app usa variáveis `VITE_*` que são compiladas em tempo de build.

Para produção com Supabase ativo:
1. Criar `finance-app/.env.production` **localmente** (não commitado)
2. Conteúdo:
   ```env
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://ycskqocrvjdwozqnsots.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
3. Rodar `npm run build` — as vars são embutidas no bundle
4. Upload do `dist/` resultante

> ⚠️ O bundle de produção conterá a anon key visível no JS. Isso é normal e seguro — é a chave pública. Nunca embutir a secret key.

---

## Checklist de deploy

- [ ] Subdomínio `fin.fjcrivo.com` criado no hPanel
- [ ] `.htaccess` presente na pasta pública (copiado do dist/)
- [ ] `index.html` na raiz da pasta pública
- [ ] HTTPS ativo (hPanel → SSL → Auto SSL)
- [ ] Rota `/` abre o dashboard sem erro
- [ ] Rota `/orcamento` funciona após F5 (testa o .htaccess)
- [ ] Console do browser sem erros críticos

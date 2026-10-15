# Economista FIN — MCP (FINFVC + Pluggy)

Servidor MCP que dá ao Claude acesso ao FINFVC (ledger no Supabase) e à Pluggy (Open Finance, somente leitura).

## Tools

- `fin_*`: ledger, orçamento, categorias, reconciliação (já existiam).
- `pluggy_status`, `pluggy_get_items`, `pluggy_get_accounts`, `pluggy_get_transactions`, `pluggy_get_investments`: leitura direta do banco via Open Finance. **Não gravam** no ledger.

Regra de arquitetura: credenciais Pluggy vivem só no ambiente do servidor. Nunca viram parâmetro de tool nem voltam ao modelo.

## Rodar

| Onde usar | Transporte | Como |
|---|---|---|
| Claude Code / Desktop (local) | stdio | `npm run build` e registrar `node dist/index.js` com as variáveis do `.env` |
| Claude web/mobile (chat, Work) | HTTP remoto | Subir em host com HTTPS (`MCP_TRANSPORT=http`, `MCP_AUTH_TOKEN` obrigatório) e adicionar como conector customizado com a URL `https://<host>/mcp/<MCP_AUTH_TOKEN>` |

O chat e o Work do Claude rodam na nuvem e não alcançam `localhost`: por isso o modo remoto.

## Segurança do modo HTTP

- Sem `MCP_AUTH_TOKEN`: escuta só em `127.0.0.1`.
- Com token: aceita `Authorization: Bearer` ou o token no caminho da URL. O token na URL pode vazar em logs de proxy; rotacione se suspeitar.
- Este endpoint dá acesso a dados financeiros reais. Trate o token como senha.

## Item IDs

A Pluggy não lista items por cliente. Informe `PLUGGY_ITEM_IDS` (csv) ou aponte `PLUGGY_CONNECTIONS_FILE` para `finance-app/server/.data/pluggy-connections.json`.

## Deploy na VPS (Hostinger, Ubuntu)

```bash
git clone -b feat/pluggy-mcp-tools https://github.com/fcrismanis/finfvc && cd finfvc/finance-app/mcp
cp .env.example .env && nano .env        # Pluggy, Supabase, FAMILY_ID, MCP_AUTH_TOKEN
docker compose up -d --build
curl localhost:3010/health
sudo cp deploy/nginx-mcp.conf /etc/nginx/sites-available/mcp.crismanis.com.br
sudo ln -s /etc/nginx/sites-available/mcp.crismanis.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mcp.crismanis.com.br
```

DNS (Cloudflare): registro A `mcp` apontando para o IP da VPS, em "DNS only" até o certbot emitir o certificado.
Conector no Claude: `https://mcp.crismanis.com.br/mcp/<MCP_AUTH_TOKEN>`.

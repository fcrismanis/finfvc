# Advisor Endpoint — `/api/advisor`

Secure backend for the FIN AI Advisor. API keys live only here — never in the browser bundle.

## Architecture

```
Browser (React)
  └─ POST /api/advisor  (no key)
        │
        ▼
  server/index.js  (Node 18+)
    ├─ OPENAI_API_KEY    → OpenAI Responses API
    └─ ANTHROPIC_API_KEY → Anthropic Messages API
```

## Local development

```bash
# Terminal 1 — frontend
cd finance-app
npm run dev        # http://localhost:5173
                   # Vite proxies /api → localhost:8787 automatically

# Terminal 2 — backend
cd finance-app/server
npm install
cp .env.example .env   # fill in your keys
npm run dev            # http://localhost:8787
```

## `.env` variables

| Variable              | Required | Default            | Description                    |
|-----------------------|----------|--------------------|--------------------------------|
| `PORT`                | no       | `8787`             | Backend listen port            |
| `OPENAI_API_KEY`      | for GPT  | —                  | OpenAI secret key              |
| `ANTHROPIC_API_KEY`   | for Claude | —                | Anthropic secret key           |
| `ADVISOR_OPENAI_MODEL`| no       | `gpt-4.1-mini`     | OpenAI model ID                |
| `ADVISOR_CLAUDE_MODEL`| no       | `claude-sonnet-4-5`| Anthropic model ID             |

**Never commit `.env`.** It is in `.gitignore`. Only commit `.env.example`.

## Request payload

```ts
POST /api/advisor
Content-Type: application/json

{
  provider: "mock" | "gpt" | "claude",
  question: string,           // max 2000 chars
  month: string,              // "YYYY-MM"
  context: {
    summary: object,          // monthly summary
    transactions: object[],   // max 50 sent to AI
    budget: object,
    closing?: object
  }
}
```

## Response

```ts
{ provider: string, answer: string }          // success
{ provider: string, answer: "", error: string } // key not configured (503)
{ error: string, details?: string }             // server error (500)
```

## Test with curl

```bash
# Mock (no key needed)
curl -X POST http://localhost:8787/api/advisor \
  -H "Content-Type: application/json" \
  -d '{"provider":"mock","question":"onde foi meu dinheiro?","month":"2026-05","context":{"summary":{},"transactions":[],"budget":{}}}'

# GPT (needs OPENAI_API_KEY in .env)
curl -X POST http://localhost:8787/api/advisor \
  -H "Content-Type: application/json" \
  -d '{"provider":"gpt","question":"como está meu resultado?","month":"2026-05","context":{"summary":{"operationalResult":-500},"transactions":[],"budget":{}}}'

# Claude (needs ANTHROPIC_API_KEY in .env)
curl -X POST http://localhost:8787/api/advisor \
  -H "Content-Type: application/json" \
  -d '{"provider":"claude","question":"como está meu resultado?","month":"2026-05","context":{"summary":{"operationalResult":-500},"transactions":[],"budget":{}}}'
```

## Security rules

1. Keys only in `server/.env`, loaded via `dotenv` — never in `VITE_*` vars
2. Payload size limited to 128 KB
3. Transaction sample capped at 50 rows
4. Question limited to 2 000 chars
5. Financial data is never logged (only error messages)
6. CORS allows only `localhost:5173`, `5174`, `3000` in dev

## Production (Traefik/Nginx on VPS)

Run the server as a separate process (or Docker container) alongside the frontend:

```yaml
# docker-compose snippet
services:
  advisor-api:
    build: ./finance-app/server
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    ports:
      - "8787:8787"
```

In Nginx/Traefik, route `/api/` to the backend container:

```nginx
location /api/ {
    proxy_pass http://advisor-api:8787;
    proxy_set_header Host $host;
}
```

The frontend static build has no knowledge of keys — it only calls relative `/api/advisor`.

## Deduplication / data sent to AI

- `context.transactions` is sliced to 50 entries before being forwarded
- `context.summary` is the pre-computed monthly summary (not raw DB rows)
- The system prompt instructs the model to use only provided data and to flag missing information

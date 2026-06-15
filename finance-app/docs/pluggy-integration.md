# Pluggy Open Finance — Guia de Integração

## Variáveis necessárias (server-side APENAS)

```env
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret   # NUNCA exponha no frontend
```

## Endpoints backend necessários

### POST /api/pluggy/token
Gera um connect_token de curta duração para o widget.
```json
// Request
{ "userId": "opaque_user_id" }

// Response
{ "connectToken": "eyJ..." }
```

### GET /api/pluggy/connections
Lista itens/conexões do usuário.
```json
// Response
[{ "item": {...}, "accounts": [...], "lastSync": "2025-01-01T..." }]
```

### POST /api/pluggy/sync/:itemId
Força re-sincronização de um item.

## Fluxo de autenticação

1. Frontend chama `GET /api/pluggy/token`
2. Backend chama `POST https://api.pluggy.ai/auth` com client_id + client_secret
3. Backend obtém `apiKey` e chama `POST https://api.pluggy.ai/connect_token`
4. Backend retorna o `connectToken` ao frontend
5. Frontend abre PluggyConnect widget com o token
6. Usuário autentica no banco
7. Webhook do Pluggy notifica o backend com `item_id` e status

## Deduplicação

Prioridade:
1. `providerTransactionId` (campo `providerCode` na API Pluggy)
2. Fallback: `${data}|${valor}|${descrição_40chars}|${accountId}`

## Mapeamento Pluggy → Transaction (FIN)

| Campo Pluggy         | Campo Transaction (FIN)  | Notas                           |
|---------------------|--------------------------|----------------------------------|
| `date`              | `transactionDate`        | ISO date                        |
| `date`              | `competenceDate`         | mesmo que transactionDate       |
| `description`       | `originalDescription`    | texto bruto                     |
| `description`       | `description`            | pode ser normalizado            |
| `amount`            | `amount`                 | valor absoluto                  |
| `type === 'DEBIT'`  | `type = 'expense'`       |                                 |
| `type === 'CREDIT'` | `type = 'income'`        |                                 |
| `status`            | `status`                 | POSTED→paid, PENDING→pending    |
| `accountId`         | `accountId`              |                                 |
| `id` (Pluggy)       | `importHash`             | para deduplicação               |
| n/a                 | `origin = 'import_api'`  |                                 |

## Instalação do widget (quando backend estiver pronto)

```bash
npm install @pluggy/connect-widget-nextjs  # ou @pluggy/connect-widget-react
```

```tsx
import { PluggyConnect } from '@pluggy/connect-widget-react'

<PluggyConnect
  connectToken={connectToken}
  onSuccess={({ item }) => handleItemConnected(item.id)}
  onError={(error) => console.error(error)}
/>
```

# Pluggy Open Finance — Guia de Integração (Fase 2)

## Variáveis de ambiente (server-side APENAS)

```env
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_secret   # NUNCA expor no frontend ou commitar
```

---

## Endpoints backend

### POST /api/pluggy/token
Gera connect_token de curta duração para o widget PluggyConnect.

```json
// Request
{ "userId": "opaque_user_id" }

// Response (sucesso)
{ "ok": true, "token": "eyJ..." }

// Response (erro)
{ "ok": false, "error": "mensagem" }
```

### POST /api/pluggy/connections
Registra um item recém-conectado, buscando contas e saldos via API Pluggy.

```json
// Request
{ "itemId": "uuid-do-item" }

// Response (sucesso)
{
  "ok": true,
  "connection": {
    "itemId": "uuid",
    "connectorName": "Banco Inter",
    "connectorImageUrl": "https://...",
    "status": "UPDATED",
    "createdAt": "2025-01-01T00:00:00Z",
    "lastUpdatedAt": "2025-01-01T00:00:00Z",
    "accounts": [
      {
        "id": "acc-uuid",
        "itemId": "uuid",
        "name": "Conta Corrente",
        "type": "BANK",
        "subtype": "CHECKING_ACCOUNT",
        "balance": 1234.56,
        "currencyCode": "BRL",
        "limit": null,
        "availableLimit": null,
        "closeDate": null,
        "dueDate": null
      }
    ]
  }
}
```

### GET /api/pluggy/connections
Lista conexões existentes (implementação futura — por ora usa localStorage).

### POST /api/pluggy/transactions
Busca transações de uma conta ou item no período informado, com paginação automática.

```json
// Request — por accountId
{
  "accountId": "acc-uuid",
  "from": "2025-01-01",
  "to": "2025-01-31"
}

// Request — por itemId (busca todas as contas do item)
{
  "itemId": "item-uuid",
  "from": "2025-01-01",
  "to": "2025-01-31"
}

// Response (sucesso)
{
  "ok": true,
  "transactions": [ /* PluggyRawTransaction[] */ ],
  "count": 47,
  "provider": "pluggy"
}

// Response (erro)
{ "ok": false, "error": "mensagem" }
```

Paginação interna: `pageSize=500`, incrementa `page` até `results.length < pageSize`.

---

## Fluxo de conexão (Fase 1)

1. Frontend chama `POST /api/pluggy/token`
2. Backend autentica via `POST https://api.pluggy.ai/auth` (client_id + client_secret) → obtém `apiKey`
3. Backend chama `POST https://api.pluggy.ai/connect_token` com `apiKey` → obtém `connectToken`
4. Backend retorna `{ ok: true, token: connectToken }` ao frontend
5. Frontend abre widget `react-pluggy-connect` com o token
6. Usuário autentica no banco
7. `onSuccess({ item })` no frontend: chama `POST /api/pluggy/connections` com `item.id`
8. Conexão salva em localStorage via `saveLocalConnection()`

---

## Fluxo de sincronização (Fase 2)

1. Usuário abre PluggyPage → seleciona conta → clica "Sincronizar"
2. Modal abre: usuário escolhe período (mês corrente / 30d / 90d / personalizado)
3. Frontend chama `POST /api/pluggy/transactions` com `{ accountId, from, to }`
4. Transações retornadas passam por `mapPluggyToTransactions()` → deduplicação
5. Modal exibe prévia: novos / duplicados / receitas / despesas
6. Usuário confirma → `appendTransactions(newTxs)` persiste no DataContext
7. `updateConnectionSyncMeta(itemId, accountId, count)` atualiza `lastSyncAt` + `lastSyncCount` em localStorage

---

## Deduplicação

Aplicada em `mapPluggyToTransactions()` (`src/services/pluggy.service.ts`):

| Prioridade | Campo          | Formato do hash                                          |
|-----------|----------------|----------------------------------------------------------|
| 1ª        | `providerCode` | `pluggy_${providerCode}`                                 |
| 2ª        | `id` Pluggy    | `id = pluggy_${ptx.id}` (verificado em `existingIds`)   |
| 3ª (fallback) | —          | `${date}\|${abs(amount)}\|${description_40upper}\|${accountId}` |

Execuções repetidas da sync no mesmo período são seguras — duplicatas são descartadas silenciosamente.

---

## Mapeamento Pluggy → Transaction (FIN)

| Campo Pluggy         | Campo Transaction        | Notas                                        |
|---------------------|--------------------------|----------------------------------------------|
| `id`                | `id`                     | prefixado: `pluggy_${id}`                    |
| `date`              | `transactionDate`        | ISO date (YYYY-MM-DD)                        |
| `date`              | `competenceDate`         | igual a transactionDate                      |
| `description`       | `description`            | texto original                               |
| `description`       | `originalDescription`    | cópia para histórico                         |
| `abs(amount)`       | `amount`                 | sempre positivo                              |
| `type === 'DEBIT'`  | `type = 'expense'`       | classificationType = `operational_expense`   |
| `type === 'CREDIT'` | `type = 'income'`        | classificationType = `operational_income`    |
| `POSTED`            | `status = 'paid'`        |                                              |
| `PENDING`           | `status = 'pending'`     |                                              |
| `providerCode`      | `importHash`             | chave de dedup principal                     |
| —                   | `origin = 'import_api'`  | fixo para Pluggy                             |
| —                   | `source = 'pluggy'`      | para filtros na tela de Revisão              |
| —                   | `needsReview = true`     | aparece na central de Revisão                |
| —                   | `paymentMethod = 'account'` |                                           |

---

## Persistência local (localStorage)

| Chave                    | Conteúdo                                   |
|-------------------------|--------------------------------------------|
| `fin_pluggy_connections` | `PluggyLocalConnection[]` com `accounts[]` |
| `finance_transactions`   | `Transaction[]` (inclui importadas)        |

`PluggyLocalAccount` inclui `lastSyncAt?: string` e `lastSyncCount?: number` atualizados a cada sync.

---

## Pendências para produção

| Item | Status | Notas |
|------|--------|-------|
| Webhook Pluggy → backend | ⬜ pendente | Receber notificações de item atualizado |
| Persistência em Supabase | ⬜ pendente | Substituir localStorage por tabela `pluggy_connections` |
| Auto-sync agendado | ⬜ pendente | Cron job backend para re-sync diário |
| Reconciliação automática | ⬜ pendente | Cruzar transações Pluggy com lançamentos manuais |
| Suporte a múltiplos usuários | ⬜ pendente | Isolar conexões por `userId` |
| Atualização de saldos | ⬜ pendente | Re-buscar saldos na sync sem reabrir widget |
| Classificação automática de faturas | ⬜ pendente | Detectar pagamentos de fatura e marcar como transferência |
| Tela de histórico de sync | ⬜ pendente | Log com data, conta, contagem por execução |

---

## Widget (instalado)

```bash
npm install react-pluggy-connect
```

```tsx
import { PluggyConnect } from 'react-pluggy-connect'

<PluggyConnect
  connectToken={connectToken}
  onSuccess={({ item }) => handleItemConnected(item.id)}
  onError={(error) => console.error(error)}
/>
```

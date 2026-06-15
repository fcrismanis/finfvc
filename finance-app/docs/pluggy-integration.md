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
8. **Todas as contas retornadas são salvas automaticamente** via `saveLocalConnection(conn)`

---

## Fluxo de sincronização (Fase 2 — atual)

1. Usuário abre PluggyPage → clica "Sincronizar" na conta desejada
2. Modal abre em estado `period_select` — usuário escolhe período (mês atual, 30d, 90d, ou personalizado)
   - Período personalizado: padrão `2024-01-01` até hoje
3. Usuário clica "Buscar transações" → modal entra em estado `fetching`
4. Frontend chama `POST /api/pluggy/transactions` com `{ accountId, from, to }`
5. Transações passam por `mapPluggyToTransactions(txs, accountId, existingTxs, connInfo)` — deduplicação + categorização automática
6. Modal exibe prévia: Novas / Duplicadas / Auto-cat. + lista de transações com badges de categoria
7. Opção "← Mudar período" na prévia retorna ao estado `period_select`
8. Usuário confirma → `appendTransactions(newTxs)` persiste no DataContext
9. `updateConnectionSyncMeta(itemId, accountId, count)` atualiza `lastSyncAt` + `lastSyncCount` em localStorage

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

| Campo Pluggy              | Campo Transaction           | Notas                                              |
|--------------------------|-----------------------------|----------------------------------------------------|
| `id`                     | `id`                        | prefixado: `pluggy_${id}`                          |
| `date`                   | `transactionDate`           | ISO date (YYYY-MM-DD)                              |
| `date`                   | `competenceDate`            | igual a transactionDate                            |
| `description`            | `description`               | texto original                                     |
| `description`            | `originalDescription`       | cópia imutável para histórico                      |
| `abs(amount)`            | `amount`                    | sempre positivo                                    |
| `type === 'DEBIT'`       | `type = 'expense'`          | classificationType = `operational_expense`         |
| `type === 'CREDIT'`      | `type = 'income'`           | classificationType = `operational_income`          |
| `POSTED`                 | `status = 'paid'`           |                                                    |
| `PENDING`                | `status = 'pending'`        |                                                    |
| `providerCode`           | `importHash`                | chave de dedup principal                           |
| `category`               | `pluggyCategory`            | label bruto da Pluggy, salvo para referência       |
| —                        | `pluggyAccountName`         | nome da conta (ex: "Conta Corrente")               |
| —                        | `pluggyInstitutionName`     | nome do banco (ex: "Nubank")                       |
| —                        | `pluggyInstitutionLogoUrl`  | URL do logo do banco                               |
| —                        | `origin = 'import_api'`     | fixo para Pluggy                                   |
| —                        | `source = 'pluggy'`         | para filtros na tela de Revisão                    |
| —                        | `needsReview`               | `false` se categorizado; `true` se pendente revisão |
| —                        | `paymentMethod = 'account'` |                                                    |

### Prioridade de categorização automática

1. **Histórico** — descrição exata encontrada em transações revisadas anteriormente (match por `description.toUpperCase()`)
2. **Categoria Pluggy** — `ptx.category` mapeada para `macroCategoryId` via `PLUGGY_CAT_MAP` em `pluggy.service.ts`
3. **Heurísticas locais** — regras regex em `categorize.service.ts` (supermercados, farmácias, etc.)
4. **Sem categoria** — `needsReview = true`, aparece na central de Revisão

### Proteções contra sobrescrita

| Flag                     | Quando definido                              | Efeito                                            |
|--------------------------|----------------------------------------------|---------------------------------------------------|
| `manualCategoryOverride` | Usuário edita macroCategoria ou categoria    | Badge "editado" no ledger                         |
| `manualSubCategoryOverride` | Usuário edita subcategoria               | Parte de `manualEditedAt`                         |
| `manualTextOverride`     | Usuário edita descrição                      | Badge "editado"; `originalDescription` preservada |

Deduplicação por hash garante que reimports nunca sobrescrevam transações existentes.

---

## Persistência local (localStorage)

| Chave                         | Conteúdo                                                      |
|------------------------------|---------------------------------------------------------------|
| `fin_pluggy_connections`      | `PluggyLocalConnection[]` com `accounts[]`                    |
| `finance_transactions`        | `Transaction[]` (inclui importadas Pluggy)                    |
| `fin_transactions_page_size`  | Tamanho de página no ledger (100/250/500/1000, padrão: 500)   |

`PluggyLocalAccount` inclui `lastSyncAt?: string` e `lastSyncCount?: number` atualizados a cada sync.

---

## Funcionalidades implementadas (Fase 2)

| Bloco | Funcionalidade | Arquivo(s) |
|-------|---------------|------------|
| 1 | Categorização automática na importação (heurísticas + histórico) | `pluggy.service.ts`, `categorize.service.ts` |
| 2 | Proteção de edições manuais contra reimport | `transactions.service.ts`, `types/index.ts` |
| 3 | Ledger agrupado por dia com header de data | `Transactions.tsx` |
| 4 | Edição inline de categoria (clique na célula) | `Transactions.tsx` |
| 5 | Funil de Clareza contabiliza transações Pluggy | `pluggy.service.ts` (categorização automática) |
| 6 | Auto-adicionar todas as contas após conexão (sem seleção manual) | `PluggyPage.tsx` |
| 7 | Seleção de período antes de buscar transações | `PluggyPage.tsx` (fase `period_select`) |
| 8 | Logo e nome da instituição na lista de conexões | `PluggyPage.tsx` |
| 9 | Logo e nome da instituição em Contas e Cartões | `AccountsPage.tsx`, `CardsPage.tsx` |
| 10 | IA local de alta confiança + exportação para clipboard | `Review.tsx`, `categorize.service.ts` |
| 11 | Badge com nome da conta / logo da instituição no ledger | `Transactions.tsx`, `pluggy.service.ts` |
| 12 | Paginação configurável (100/250/500/1000) via Configurações | `Settings.tsx`, `Transactions.tsx` |
| 13 | Mapeamento de categorias Pluggy para macro-categorias FIN | `pluggy.service.ts` (`PLUGGY_CAT_MAP`) |
| 14 | Subcategoria exibida em destaque; "sem subcat." quando ausente | `Transactions.tsx` |
| 15 | Edição inline de descrição (duplo clique); `originalDescription` preservada | `Transactions.tsx`, `transactions.service.ts` |
| 16 | Tags por lançamento: chips, filtro, add/remove no modal | `Transactions.tsx`, `types/index.ts` |

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

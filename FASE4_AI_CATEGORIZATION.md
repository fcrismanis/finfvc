# Fase 4 — IA de Categorização + Regras Robustas
> Branch: `feature/fin-functional-upgrades` | Data: 2026-06-15

---

## 1. Prioridade de categorização

Quando uma transação é importada (Pluggy ou XLSX), a seguinte ordem é respeitada:

| Prioridade | Mecanismo | Campo resultante |
|---|---|---|
| 0 | **Guard**: `canAutoCategorize(tx)` retorna false → skip tudo | — |
| 1 | **Regra aprendida** (`suggestFromRules`) | `categorySuggestionSource: 'rule'` |
| 2 | **Pluggy categoryId** (`pluggyCategoryMap`) | `categorySuggestionSource: 'pluggy_id'` |
| 3 | **Pluggy category name** | `categorySuggestionSource: 'pluggy_name'` |
| 4 | **Heurística local** (`categorize.service.ts`) | `categorySuggestionSource: 'text_inference'` |
| 5 | **IA** (via `/api/ai/categorize-transactions`, aplicação manual pelo usuário) | `categorySuggestionSource: 'ai'` |
| 6 | **A classificar** | `macroCategoryId: undefined` |

**Manual override** sempre tem prioridade sobre qualquer automação:
- `manualCategoryOverride: true` — nenhum mecanismo muda a categoria
- `manualSubCategoryOverride: true` — subcategoria protegida
- `manualTextOverride: true` — descrição protegida

---

## 2. Proteção de manual override

Função `canAutoCategorize(tx: Transaction): boolean` em `categoryRules.service.ts`:

```ts
export function canAutoCategorize(tx: Transaction): boolean {
  return !(tx.manualCategoryOverride || tx.manualSubCategoryOverride || tx.manualTextOverride)
}
```

Toda aplicação automática (import, AI, rules) chama esta função antes de escrever.
Ao aplicar via `updateTransaction` com `markManual: true`, o campo `manualCategoryOverride`
é setado — protegendo a transação em importações futuras.

---

## 3. Como uma regra é criada

### Via correção manual
1. Usuário edita categoria de um lançamento no modal (Lançamentos) ou na Revisão.
2. `applyTransactionPatches(items, { markManual: true })` é chamado.
3. Internamente chama `learnRuleFromTransaction(tx, 'manual')`.
4. `learnRuleFromTransaction` deriva padrão + captura receiverName/payerName/pluggyCategory.
5. `upsertRule(...)` insere ou mescla no `fin_category_rules` (localStorage).

### Via IA
1. Usuário clica "Categorizar com IA" na Revisão (painel Pluggy).
2. Modal mostra sugestões — usuário clica "Aplicar" em cada uma (ou "Aplicar alta confiança").
3. `applyAISuggestion(sugg)` atualiza a transação com `categorySuggestionSource: 'ai'`.
4. Se `rulePattern` presente, `learnRuleFromTransaction(..., 'ai')` cria a regra.

### Via tela /regras
Usuário digita padrão + escolhe categoria → `upsertRule({ pattern, macroCategoryId, origin: 'manual' })`.

---

## 4. Como uma regra é aplicada em importação futura

### Pluggy (`pluggy.service.ts`)
```
Priority 2 (antes do Pluggy map):
  ruleSugg = suggestFromRules(baseTx)
  if ruleSugg → apply + categorySuggestionSource='rule' + incrementRuleUseCount
```

### XLSX (`importers/transformer.ts`)
```
After building transaction:
  if !macroCategoryId && canAutoCategorize(tx):
    match = suggestFromRules(tx, loadRules())
    if match → apply + categorySuggestionSource='rule' + incrementRuleUseCount
```

---

## 5. Matching de regras — ordem de prioridade

Em `suggestFromRules(tx)`, regras ativas são comparadas na ordem:

1. **receiverName** — `normalizeText(rule.receiverName)` ⊆ `normalizeText(tx.pluggyReceiverName)`
2. **payerName** — idem para pagador
3. **pattern** na descrição — `txText.includes(rule.pattern)`, longest pattern first
4. **pluggyCategoryId** — exact match `rule.pluggyCategoryId === tx.pluggyCategoryId`
5. **pluggyCategory** — exact match after normalize

---

## 6. Como testar a IA

### Pré-requisito
Backend rodando com pelo menos uma chave configurada:

```bash
# finance-app/server/.env
ANTHROPIC_API_KEY=sk-ant-...   # preferido (usa claude-haiku-4-5)
# OU
OPENAI_API_KEY=sk-proj-...     # fallback (usa gpt-4o-mini)

cd finance-app/server && node index.js
```

### Via UI
1. Abrir `/revisao`
2. Clicar card "Importadas via Pluggy"
3. Clicar "Categorizar com IA" (botão roxo)
4. Aguardar modal com sugestões
5. Aprovar individualmente ou "Aplicar alta confiança"

### Via curl (testa endpoint diretamente)
```bash
curl -s -X POST http://localhost:8787/api/ai/categorize-transactions \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {"id":"t1","description":"NETFLIX","amount":55.9,"type":"expense","pluggyCategory":"Entertainment"}
    ],
    "categories": [
      {"id":"mac_assinaturas","name":"Assinaturas","classificationType":"operational_expense"}
    ],
    "subCategories": [],
    "rules": []
  }' | python3 -m json.tool
```

---

## 7. Campos da regra aprendida (`CategoryRule`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | string | ID único |
| `pattern` | string | Texto normalizado para busca no description |
| `receiverName` | string? | Nome do receptor normalizado |
| `payerName` | string? | Nome do pagador normalizado |
| `pluggyCategoryId` | string? | ID Pluggy para match exato |
| `pluggyCategory` | string? | Nome categoria Pluggy normalizado |
| `macroCategoryId` | string | Categoria macro FIN |
| `subCategoryId` | string? | Subcategoria |
| `classificationType` | string? | Tipo de classificação |
| `tags` | string[]? | Tags automáticas |
| `confidence` | high/medium/low | Confiança da regra |
| `origin` | manual/pluggy/csv/ai | Como foi criada |
| `active` | boolean | Se está sendo aplicada |
| `useCount` | number | Quantas vezes foi aplicada |
| `createdAt` | ISO string | Data de criação |
| `updatedAt` | ISO string | Última atualização |

---

## 8. Segurança

- Backend nunca expõe `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `PLUGGY_CLIENT_SECRET` ao frontend.
- Endpoint `/api/ai/categorize-transactions` recebe apenas campos de categorização (description, amount, type, pluggyCategory) — sem dados pessoais de conta, documentNumber, etc.
- Manual override protege lançamentos sensíveis de qualquer automação.

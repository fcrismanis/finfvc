# Pluggy — Mapa de Categorias (referência)

Documento de referência do mapeamento de categorias da Pluggy para o FIN.
Fonte da verdade no código: [`src/services/pluggyCategoryMap.ts`](../src/services/pluggyCategoryMap.ts).

> Capturamos o payload real via endpoint dev `POST /api/pluggy/debug-transactions`
> (sanitizado, sem tokens). Os códigos confirmados em produção estão marcados como
> **confirmado real** nas tabelas abaixo.

---

## Campos reais da Pluggy

A Pluggy retorna a categoria em **dois campos separados** no nível raiz da transação:

| Campo Pluggy  | Tipo     | Exemplo real        | Uso no FIN                                        |
|---------------|----------|---------------------|---------------------------------------------------|
| `category`    | `string` | `"Education"`       | nome textual (inglês). Salvo em `pluggyCategory`  |
| `categoryId`  | `string` | `"07020000"`        | código numérico em string. Salvo em `pluggyCategoryId` |

> ⚠️ `category` é **string simples**, não objeto `{ id, description }`.
> O código (`categoryId`) é a chave mais confiável — é estável e independente de idioma.

Campos auxiliares também capturados:
- `operationType` → `pluggyOperationType`
- `paymentData.paymentMethod` → `pluggyPaymentMethod`
- `paymentData.receiver.name` → `pluggyReceiverName`
- `paymentData.payer.name` → `pluggyPayerName`

---

## Regra de prioridade de categorização

Aplicada em `mapPluggyToTransactions()` (import) e em `buildReclassPreview()` (reclassificação):

1. **Manual override** — `manualCategoryOverride` / `manualSubCategoryOverride` / (`manualEditedAt` + categoria). **Nunca** é sobrescrito.
2. **Regra aprendida / histórico** — `suggestCategoryWithHistory()` (descrição já revisada antes).
3. **Pluggy `categoryId`** — lookup em `PLUGGY_ID_MAP`. Confiança **alta**.
4. **Pluggy `category` (nome)** — lookup em `PLUGGY_NAME_MAP`. Confiança **média**.
5. **Inferência por texto** — `inferCategoryFromText()` sobre descrição/contraparte/operação. Confiança **baixa**.
6. **A classificar** — `needsReview = true`, aparece na central de Revisão.

A origem aplicada fica registrada em `categorySuggestionSource`:
`pluggy_id` | `pluggy_name` | `text_inference` | `history` | `manual` | `none`.

---

## Como interpretar `categoryConfidence`

| Valor    | Origem                         | `needsReview` | Significado                                            |
|----------|--------------------------------|---------------|--------------------------------------------------------|
| `high`   | `categoryId` (código numérico) | `false`       | Mapa direto e estável — aplicado sem revisão           |
| `medium` | `category` (nome em inglês)    | `true`        | Provável, mas confirme — nome pode ser ambíguo         |
| `low`    | inferência por texto           | `true`        | Palpite por regex na descrição — sempre revisar        |

`subCategoryNameSuggested` traz uma **sugestão de nome** de subcategoria quando não há
um `cat_*` real correspondente — serve de pista para o usuário ao editar.

---

## Transferências e pagamentos como **neutros**

Movimentações que não são receita nem despesa real são marcadas como `classificationType: 'neutral'`,
com `includeInBudget: false` e `includeInOperationalResult: false` — para não inflar orçamento/resultado.

| `categoryId` | Situação                                  | Flags                                        |
|--------------|-------------------------------------------|----------------------------------------------|
| `04000000`   | Transferência mesma pessoa (confirmado)   | neutro · `isInternalTransfer: true`          |
| `05040000`   | Pagamento de cartão                       | neutro                                       |
| `05070000`   | PIX / Transferência (confirmado)          | neutro                                       |
| `05000000`–`05060000` | TED/DOC, boleto, débito, tributo | neutro                                       |
| `06000000`   | Investimento / aporte                     | neutro · sugere `cat_aporte`                 |

A inferência por texto também detecta neutros: `pagamento de cartão`, `transferência entre contas`,
`PIX`, `TED/DOC`, `boleto`, `aporte/aplicação/CDB/tesouro`.

---

## Tabela — `categoryId` conhecidos (`PLUGGY_ID_MAP`)

| categoryId | Macro            | Subcategoria sugerida          | Classificação        |
|------------|------------------|--------------------------------|----------------------|
| `01000000` | mac_alimentacao  | Alimentação geral              | despesa op.          |
| `01010000` | mac_alimentacao  | Supermercado (`cat_alimentacao`) | despesa op.        |
| `01020000` | mac_alimentacao  | Restaurantes (`cat_restaurantes`) | despesa op.       |
| `01030000` | mac_alimentacao  | Padaria / Delivery (`cat_padaria`) | despesa op.      |
| `01050000` | mac_alimentacao  | Açougue (`cat_acougue`)        | despesa op.          |
| `02000000` | mac_divida       | Financiamentos (`cat_dividas`) · **confirmado** | dívida  |
| `02010000` | mac_divida       | Empréstimos (`cat_dividas`)    | dívida               |
| `02020000` | mac_divida       | Parcelamentos (`cat_dividas`)  | dívida               |
| `03010000` | mac_receita_op   | Salário (`cat_salario`)        | receita op.          |
| `03020000` | mac_receita_ev   | Outras receitas (`cat_outras_receitas`) | rec. eventual |
| `04000000` | mac_movfin       | Transf. entre contas próprias · **confirmado** | neutro (interno) |
| `05040000` | mac_movfin       | Pagamento de cartão            | neutro               |
| `05070000` | mac_movfin       | PIX / Transferência · **confirmado** | neutro         |
| `06000000` | mac_movfin       | Investimento / Aporte (`cat_aporte`) | neutro         |
| `07000000` | mac_educacao     | Educação geral                 | despesa op.          |
| `07010000` | mac_educacao     | Escola (`cat_bethel`)          | despesa op.          |
| `07020000` | mac_educacao     | Cursos / Idiomas (`cat_idiomas`) · **confirmado** | despesa op. |
| `08010000` | mac_casa         | Aluguel / Prestação (`cat_prestacao`) | despesa op.   |
| `08020000` | mac_casa         | Contas de consumo (`cat_contas`) | despesa op.        |
| `08040000` | mac_casa         | IPTU / Taxas (`cat_iptu`)      | despesa op.          |
| `09010000` | mac_saude        | Farmácia (`cat_farmacia`)      | despesa op.          |
| `09030000` | mac_saude        | Academia (`cat_academias`)     | despesa op.          |
| `10010000` | mac_transporte   | Combustível (`cat_combustivel`) | despesa op.         |
| `10020000` | mac_transporte   | Estacionamento (`cat_estacionamento`) | despesa op.   |
| `11010000` | mac_assinaturas  | Streaming (`cat_spotify`)      | despesa op.          |
| `11020000` | mac_assinaturas  | Serviços digitais / IA (`cat_ia`) | despesa op.       |
| `12000000` | mac_compras      | Compras geral (`cat_compras`)  | despesa op.          |
| `12010000` | mac_compras      | Compras online (`cat_ml`)      | despesa op.          |

> Lista completa (incl. seguros, lazer, impostos, cuidados, pets) em `PLUGGY_ID_MAP`.

---

## Tabela — `category` nomes conhecidos (`PLUGGY_NAME_MAP`)

Confiança **média**. Cobre inglês (padrão Pluggy) e português (fallback). Exemplos:

| Nome Pluggy            | Macro            | Subcategoria sugerida          |
|------------------------|------------------|--------------------------------|
| `Groceries`            | mac_alimentacao  | Supermercado                   |
| `Eating out` / `Bars and restaurants` | mac_alimentacao | Restaurantes    |
| `Education` / `Courses and training` | mac_educacao | Cursos / Idiomas   |
| `Pharmacy`             | mac_saude        | Farmácia                       |
| `Fuel`                 | mac_transporte   | Combustível                    |
| `Streaming`            | mac_assinaturas  | Streaming                      |
| `Salary`               | mac_receita_op   | Salário                        |
| `Loans and financing`  | mac_divida       | Financiamentos                 |
| `Credit card payment`  | mac_movfin       | Pagamento de cartão (neutro)   |
| `Same person transfer` | mac_movfin       | Transf. entre contas (neutro)  |
| `Transfer - PIX`       | mac_movfin       | PIX / Transferência (neutro)   |

> Lista completa (incl. variações PT-BR) em `PLUGGY_NAME_MAP`.

---

## Botão "Reclassificar importados"

Na tela **Pluggy**, aparece um banner para lançamentos já importados.

1. Clicar em **Reclassificar importados** abre um preview (não aplica nada ainda).
2. O preview mostra: total analisado · classificados via Pluggy · inferidos por texto ·
   ignorados por ajuste manual · sem mapa · distribuição por macro · 5 exemplos antes→depois.
3. Só são reclassificados lançamentos **sem categoria** ou marcados **"a revisar"**.
4. **Ajustes manuais nunca são tocados.**
5. Confirmar aplica os patches via `updateTransaction` (preserva `originalDescription`, dedup etc.).

Útil para lançamentos antigos importados **antes** do mapa atual, inclusive os que não têm
`pluggyCategory`/`pluggyCategoryId` — esses passam pela inferência por texto.

---

## Onde editar

- Adicionar/ajustar código numérico → `PLUGGY_ID_MAP`
- Adicionar/ajustar nome de categoria → `PLUGGY_NAME_MAP`
- Adicionar regra de texto (legado) → `INFERENCE_RULES`

Todas em [`src/services/pluggyCategoryMap.ts`](../src/services/pluggyCategoryMap.ts).
Após editar, rode `npm run build` e teste a reclassificação no preview.

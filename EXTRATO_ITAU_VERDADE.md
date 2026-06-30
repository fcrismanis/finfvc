# Verdade do extrato — Conta Itaú (master)

Fonte autoritativa dos saldos da conta-corrente Itaú. Sempre que houver
divergência entre ambientes/sistema e estes valores, **estes valores prevalecem**.

- Titular: FABIO VOLFE CRISMANIS — CPF 216.641.838-41
- Agência **1145** · Conta **023475-1**
- Extratos: `itau_extrato_072025.pdf` (01/07/2025–31/12/2025) e
  `itau_extrato_012026.pdf` (01/01/2026–30/06/2026), ambos emitidos 30/06/2026.

## Saldo atual

**R$ 40.186,72** — saldo em conta em 30/06/2026.

## Checkpoints de fechamento mensal (SALDO DO DIA)

| Data (fim do mês) | Saldo (R$) |
|---|---:|
| 2025-06-30 (âncora) | 82.925,55 |
| 2025-07-31 | −10.855,64 |
| 2025-08-29 | −968,12 |
| 2025-09-30 | 8.913,89 |
| 2025-10-31 | −9.228,34 |
| 2025-11-28 | −10.288,13 |
| 2025-12-31 | −14.582,20 |
| 2026-01-30 | −18.749,71 |
| 2026-02-26 | −21,64 |
| 2026-03-30 | −18.217,37 |
| 2026-04-30 | −23.148,27 |
| 2026-05-28 | 17.297,26 |
| 2026-06-30 | 40.186,72 |

> Datas com saldo carregado (sem movimento até o fim do mês): ago/25 (29),
> nov/25 (28), fev/26 (26), mai/26 (28).

## Notas de reconciliação

- O ledger FINFVC **não tem opening balance por conta** — saldoFIN é só o
  acumulado das transações ([bankReconciliation.service.ts](finance-app/src/services/bankReconciliation.service.ts)).
  Para saldo absoluto, ancorar em 2025-06-30 = 82.925,55.
- Os dados Pluggy em Supabase **misturam conta-corrente Itaú e cartão** num só
  fluxo ("MeuPluggy", sem `account_id` exposto), então o fluxo mensal do ledger
  **não** bate com o delta do extrato — isso é esperado (gasto de cartão,
  neutros, investimentos), **não** é erro de saldo.
- O saldo que a UI mostra (Patrimônio/Reconciliação) vem do `account.balance`
  do Pluggy. Com a conexão Pluggy viva, esse valor sincroniza do banco e deve
  igualar 40.186,72.

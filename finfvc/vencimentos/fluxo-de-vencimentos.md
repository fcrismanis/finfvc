# Fluxo de Vencimentos
> Última atualização: 2026-07-06

## Objetivo

Definir o ciclo de vida de um vencimento — do cadastro até a confirmação de pagamento — e registrar o roadmap de evolução desse fluxo para conciliação automática com o Pluggy, quando os pagamentos realizados passarem a ser cruzados automaticamente contra os vencimentos esperados.

## Estados possíveis (campo Status)

| Status | Significado |
|---|---|
| **A vencer** | Data de vencimento no futuro, nenhuma ação necessária ainda. |
| **Vence hoje** | Data de vencimento é a data corrente — ação necessária no dia. |
| **Vencido** | Data de vencimento passou sem confirmação de pagamento. |
| **Pago** | Pagamento confirmado dentro do prazo. |
| **Pago com atraso** | Pagamento confirmado após a data de vencimento (registrar multa/juros em Observações, quando houver). |
| **Cancelado** | Compromisso encerrado antes de vencer (ex.: assinatura cancelada, financiamento quitado antecipadamente). |

## Ciclo de vida de um vencimento

1. **Cadastro** — compromisso é registrado no arquivo de categoria correta, seguindo o [modelo único](README.md#modelo-único-de-vencimento), com Status inicial "A vencer".
2. **Aproximação** — na revisão diária (`../playbooks/revisao-diaria-vencimentos.md`), o vencimento aparece nas janelas de hoje/amanhã/semana conforme a Data de vencimento se aproxima.
3. **Vencimento** — na data de vencimento, o Status muda para "Vence hoje"; se não houver confirmação de pagamento até o fim do dia, passa a "Vencido" no dia seguinte.
4. **Confirmação de pagamento** — hoje, feita manualmente (conferência de extrato/comprovante) ou por reconciliação parcial já existente via Pluggy nas contas conectadas; Status muda para "Pago" ou "Pago com atraso".
5. **Fechamento do período** — todo vencimento do período precisa estar em um estado terminal (Pago, Pago com atraso ou Cancelado) antes do fechamento, conforme `checklist-fechamento.md`.
6. **Recorrência** — se o campo Recorrência indicar repetição (mensal, anual), uma nova instância do vencimento é criada para o próximo ciclo, herdando os mesmos campos exceto Data de vencimento e Status (que volta a "A vencer").

## Conciliação hoje (manual)

Atualmente a confirmação de pagamento é manual: conferência de extrato/fatura contra o valor e a data esperados de cada vencimento, feita na revisão diária e no fechamento periódico. Dados já sincronizados via Pluggy (ver `../../docs/arquitetura/pluggy.md`) ajudam a conferência, mas não há hoje matching automático entre uma transação sincronizada e um vencimento esperado.

## Roadmap — integração futura com Pluggy (conciliação automática)

Objetivo final: todo vencimento com Status "A vencer" muda automaticamente para "Pago" (ou "Pago com atraso") assim que uma transação correspondente é sincronizada via Pluggy, sem intervenção manual — exceto para revisão de exceções.

- **Fase 1 — Leitura consolidada.** Reaproveitar a sincronização de transações e faturas já existente via Pluggy (`../../docs/arquitetura/pluggy.md`) como fonte de dados de pagamento, sem ainda cruzar com vencimentos.
- **Fase 2 — Matching automático simples.** Cruzar cada vencimento "A vencer"/"Vence hoje" contra transações sincronizadas por conta de pagamento + valor aproximado (tolerância de centavos por juros/desconto) + janela de data (poucos dias ao redor do vencimento). Matches de alta confiança atualizam o Status automaticamente; os demais ficam como sugestão para confirmação humana.
- **Fase 3 — Tratamento de exceções.** Cobrir casos que a Fase 2 não resolve sozinha: valor variável (contas de consumo), pagamento parcial, pagamento antecipado, e vencimento pago por uma conta diferente da prevista.
- **Fase 4 — Alertas proativos.** Quando um vencimento passa de "Vence hoje" para "Vencido" sem transação correspondente encontrada, gerar alerta automático (in-app ou pelo Arquiteto do Segundo Cérebro) em vez de depender só da revisão diária manual.
- **Fase 5 — Fechamento automático assistido.** `checklist-fechamento.md` passa a ser pré-preenchido automaticamente com os itens já conciliados, restando à revisão humana apenas as exceções sinalizadas na Fase 3.

Este roadmap é consequência direta da Fase 5 (Inteligência) do [roadmap patrimonial](../ROADMAP.md) e depende da integração Pluggy plena descrita lá — nenhuma etapa aqui é implementada antes da estrutura documental deste módulo estar madura e em uso manual consistente.

## Estado atual

[PENDENTE DE PREENCHIMENTO] — fluxo definido; operação hoje é 100% manual. Nenhuma fase do roadmap de conciliação automática foi iniciada.

## Próximas ações

1. Operar o ciclo de vida manualmente por pelo menos um ciclo mensal completo, validando se os estados e campos definidos aqui são suficientes na prática.
2. Registrar em `../decisoes/` quando a Fase 2 do roadmap Pluggy for de fato priorizada para implementação.
3. Ajustar este documento com aprendizados operacionais antes de qualquer automação real.

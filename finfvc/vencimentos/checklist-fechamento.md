# Checklist de Fechamento — Vencimentos
> Última atualização: 2026-07-06

## Objetivo

Checklist específico para garantir que, ao fechar um período (semana ou mês), nenhum vencimento fique em estado indefinido — todo compromisso deve estar em um estado terminal (pago, pago com atraso ou cancelado) antes de considerar o período fechado. Alimenta os passos "Revisar cartões" e "Revisar contas" de `../playbooks/fechamento-mensal.md`.

## Checklist

- [ ] Todos os vencimentos com Data de vencimento dentro do período têm Status "Pago", "Pago com atraso" ou "Cancelado" — nenhum ficou "A vencer" ou "Vencido" sem explicação.
- [ ] Toda fatura de cartão (`cartoes.md`) foi reconciliada: valor previsto vs. valor real cobrado, com diferenças explicadas.
- [ ] Toda conta fixa (`contas-fixas.md`) de valor variável teve o valor real registrado, não apenas a estimativa.
- [ ] Parcelas de financiamento (`financiamentos.md`) do período foram confirmadas como pagas e o contador de parcelas restantes foi atualizado.
- [ ] Assinaturas (`assinaturas.md`) foram revisadas quanto a uso — nenhuma cobrança "fantasma" sem revisão de necessidade.
- [ ] Impostos (`impostos.md`) com vencimento no período foram pagos e, se parcelados, a próxima parcela está corretamente projetada.
- [ ] Prêmios de seguro (`seguros.md`) do período foram pagos e nenhuma apólice está em risco de cancelamento por atraso.
- [ ] Recorrências diversas e investimentos programados (`recorrencias.md`) do período foram executados conforme planejado.
- [ ] Nenhum vencimento "Pago com atraso" ficou sem o custo de multa/juros registrado em Observações.
- [ ] O calendário do próximo período (`calendario-financeiro.md`) já reflete as recorrências que se repetem, com datas e valores atualizados.
- [ ] Total pago no período e total ainda a pagar (se o fechamento for parcial) foram somados e conferem com `../financeiro/fluxo-de-caixa.md`.

## Quando executar

Ao final de cada semana (checklist rápido) e obrigatoriamente ao final de cada mês, como parte de `../playbooks/fechamento-mensal.md`.

## Estado atual

[PENDENTE DE PREENCHIMENTO] — checklist definido; ainda não executado com dados reais.

# Cartões de Crédito
> Última atualização: 2026-07-06

## Objetivo

Controlar o vencimento de cada fatura de cartão de crédito da família, distinguindo claramente **fechamento** (data em que a fatura para de receber novos lançamentos) de **vencimento** (data limite de pagamento), para nunca pagar juros/multa por atraso nem perder o melhor dia de compra.

## O que entra aqui

- Todo cartão de crédito ativo da família (físico ou virtual).
- Parcelamentos feitos diretamente na fatura do cartão (parcelamento de compra em N vezes).
- Assinaturas cobradas no cartão são controladas em `assinaturas.md`, mas a fatura consolidada do cartão continua sendo um vencimento único aqui.

## Como controlar

- Cada cartão gera uma linha mensal no [modelo único de vencimento](README.md#modelo-único-de-vencimento), com **Categoria = "Cartão de crédito"** e **Recorrência = "Mensal"**.
- **Valor** da fatura é sempre uma estimativa até o fechamento — reconciliar contra a fatura real emitida (ver `checklist-fechamento.md` e `../playbooks/fechamento-mensal.md`, passo "Revisar cartões").
- Registrar em **Observações**: data de fechamento, melhor dia de compra (dia seguinte ao fechamento, para maximizar o prazo), e limite total do cartão.
- Parcelas em andamento dentro da fatura (ex.: "3/12") devem aparecer detalhadas em Observações ou como linhas próprias quando relevantes para o valor total variar mês a mês de forma previsível.
- Prioridade é sempre **Essencial/crítico**: atraso de fatura de cartão gera juros rotativos, que estão entre os custos de dívida mais altos do mercado — nenhuma decisão de investimento deve ser tomada enquanto houver risco de cair em rotativo (ver `../PRINCIPIOS.md`, princípio 1).
- Forma de pagamento deve ser sempre o valor integral da fatura; pagamento mínimo/parcelamento do cartão é tratado como alerta de risco, não como plano normal.

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Lista de todos os cartões ativos: banco/emissor, limite, dia de fechamento, dia de vencimento.
- Histórico de valor médio de fatura dos últimos 3-6 meses por cartão.
- Parcelamentos em andamento na fatura (descrição, parcela atual/total, valor por parcela).

## Próximas ações

1. Levantar todos os cartões ativos com fechamento/vencimento/limite.
2. Preencher este arquivo com a lista consolidada.
3. Confirmar que todo cartão está mapeado também em `calendario-financeiro.md` e coberto pela revisão diária.

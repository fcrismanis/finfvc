# Financiamentos e Parcelas
> Última atualização: 2026-07-06

## Objetivo

Controlar o vencimento operacional de cada parcela de financiamento e parcelamento de longo prazo (imóvel, veículo, empréstimos), garantindo que o pagamento mensal esteja sempre previsto no caixa — de forma complementar ao controle de saldo devedor e taxa de juros já feito em `../financeiro/dividas.md`.

## Diferença em relação a `../financeiro/dividas.md`

- `../financeiro/dividas.md` responde "quanto devo, a que custo, com que prioridade de quitação".
- Este arquivo responde "quando vence a próxima parcela, de qual conta sai, e o status de pagamento está em dia".
- Os dois arquivos devem ser mantidos consistentes: toda dívida com parcela mensal ativa em `dividas.md` deve ter uma linha correspondente aqui.

## O que entra aqui

- Financiamento imobiliário.
- Financiamento de veículo.
- Empréstimos pessoais ou consignados com parcela fixa.
- Parcelamentos de compras fora do cartão de crédito (carnê, boleto parcelado).

## Como controlar

- Cada financiamento/parcelamento gera uma linha no [modelo único de vencimento](README.md#modelo-único-de-vencimento), com **Categoria = "Financiamento"** e **Recorrência = "Parcelado (nº parcela/total)"**.
- **Valor** deve refletir a parcela atual (incluindo eventual correção monetária/juros pós-fixados, quando aplicável) — não o saldo devedor total.
- Registrar em **Observações**: número de parcelas restantes, data prevista de quitação total, e se há opção de amortização extraordinária vantajosa.
- Prioridade **Essencial/crítico**: atraso em financiamento gera multa, juros e, em casos extremos (imóvel, veículo alienado), risco de perda do bem.
- Ao final de cada financiamento (última parcela paga), mover a linha para histórico/observação de quitado — não deletar, para preservar histórico junto com `../wiki-patrimonial/grandes-decisoes.md` quando relevante.

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Lista de financiamentos/parcelamentos ativos: valor da parcela, dia de vencimento, parcelas restantes, conta de pagamento.
- Data prevista de quitação de cada um.
- Cruzamento com o saldo devedor e taxa registrados em `../financeiro/dividas.md`.

## Próximas ações

1. Levantar todos os financiamentos e parcelamentos ativos com seus termos operacionais (parcela, vencimento, parcelas restantes).
2. Preencher este arquivo com a lista consolidada, garantindo consistência com `../financeiro/dividas.md`.
3. Posicionar cada vencimento em `calendario-financeiro.md`.

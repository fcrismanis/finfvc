# Seguros
> Última atualização: 2026-07-06

## Objetivo

Controlar o vencimento de prêmios de seguro, distinguindo a **vigência da apólice** (período em que a cobertura está ativa) do **vencimento do prêmio** (data limite de pagamento da parcela), evitando o risco de estar "sem seguro" por atraso de pagamento sem perceber. Complementa a avaliação de adequação de cobertura feita na Fase 3 do `../ROADMAP.md`.

## O que entra aqui

- Seguro de vida.
- Seguro residencial.
- Seguro de veículo (auto).
- Seguro saúde/plano de saúde, quando pago fora de folha/benefício.
- Seguros específicos (viagem, equipamentos), quando recorrentes.

## Como controlar

- Cada apólice gera uma linha no [modelo único de vencimento](README.md#modelo-único-de-vencimento), com **Categoria = "Seguro"**.
- **Recorrência**: "Mensal" quando o prêmio é parcelado mensalmente, "Anual" quando é pago em cota única na renovação.
- Registrar em **Observações**: data de vigência/renovação da apólice (que pode ser diferente da data de vencimento do prêmio), seguradora, e se houve reajuste de prêmio na última renovação.
- Prioridade **Essencial/crítico** para seguro de vida, saúde e do bem financiado (imóvel/veículo com alienação costuma exigir seguro vigente por contrato); **Importante** para os demais.
- Na renovação anual, tratar como ponto de revisão: comparar cobertura e prêmio contra o mercado antes de renovar automaticamente (ver `../PRINCIPIOS.md`, princípio 7 — comparar alternativas).

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Lista de apólices ativas: seguradora, cobertura, prêmio, forma de pagamento, data de vigência/renovação.
- Histórico de reajuste de prêmio nas últimas renovações.
- Avaliação de adequação de cobertura (ver Fase 3 do `../ROADMAP.md`).

## Próximas ações

1. Levantar todas as apólices ativas e seus termos (prêmio, vigência, cobertura).
2. Preencher este arquivo com a lista consolidada.
3. Cruzar datas de renovação com `calendario-financeiro.md` para antecipar decisão de renovar/trocar seguradora.

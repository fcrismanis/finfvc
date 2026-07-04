# Investimentos
> Última atualização: 2026-07-04

## Objetivo

Manter uma visão consolidada da carteira de investimentos da família Crismanis — classe de ativo, propósito, risco — e servir de referência para avaliar novas oportunidades (ver `docs/prompts/analista-investimentos.md`).

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados conhecidos

- Módulo de Patrimônio & Investimentos já implementado no FinFVC (`finance-app/src/pages/PatrimonioInvestimentosPage.tsx`), com listagem de investimentos via Pluggy (`openfinance_list_investments`, `openfinance_list_investment_transactions`).

## Dados pendentes

- Composição atual da carteira por classe de ativo (renda fixa, renda variável, fundos, alternativos).
- Objetivo declarado de cada posição (proteção, renda, crescimento).
- Percentual de concentração em qualquer ativo/emissor único (risco de concentração).
- Última data de rebalanceamento ou revisão da carteira.

## Próximas ações

1. Consolidar a carteira atual a partir dos dados sincronizados via Pluggy/Supabase.
2. Classificar cada posição por objetivo e nível de risco.
3. Identificar concentração excessiva, se houver, e registrar como risco em `riscos.md`.
4. Toda nova posição relevante segue o protocolo de `docs/prompts/analista-investimentos.md` antes de entrar aqui.

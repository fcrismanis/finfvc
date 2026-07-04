# Despesas
> Última atualização: 2026-07-04

## Objetivo

Mapear o padrão de despesas da família Crismanis por categoria, identificando o que é essencial, o que é discricionário, e onde há espaço de otimização.

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados conhecidos

- O FinFVC já possui estrutura robusta de categorização de despesas (macro categorias + subcategorias, ver `finance-app/src/config/categories.ts`), incluindo classificação de essencialidade (`essentiality`).
- Orçamento planejado vs. realizado já implementado (`finance-app/src/pages/Budget.tsx`).
- Regras de categoria aprendidas e categorização por IA já em produção (ver `FASE4_AI_CATEGORIZATION.md`).

## Dados pendentes

- Despesa mensal média consolidada dos últimos 3-6 meses, por macro categoria.
- Percentual de despesa essencial vs. discricionária.
- Categorias com maior variância mês a mês (candidatas a atenção/controle).

## Próximas ações

1. Rodar consolidação de despesas dos últimos meses direto do FinFVC (Relatórios/Dashboard).
2. Preencher este arquivo com o breakdown por categoria e a leitura de essencial vs. discricionário.
3. Cruzar com `metas.md` para identificar onde cortar sem comprometer o essencial.

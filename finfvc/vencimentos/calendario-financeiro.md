# Calendário Financeiro
> Última atualização: 2026-07-06

## Objetivo

Consolidar todos os vencimentos registrados em `contas-fixas.md`, `cartoes.md`, `financiamentos.md`, `assinaturas.md`, `impostos.md`, `seguros.md` e `recorrencias.md` em uma única visão de calendário, para responder rapidamente "o que vence quando" em qualquer horizonte — dia, semana, mês ou ano — e antecipar meses de aperto sazonal.

## Como o calendário é montado

O calendário não duplica dado — ele é uma vista agregada sobre o **modelo único de vencimento** (ver `README.md`) já registrado em cada arquivo de categoria. Ao consultar ou montar o calendário:

1. Reunir todas as linhas de todos os arquivos de categoria deste módulo.
2. Ordenar por **Data de vencimento**.
3. Agrupar pela pergunta feita (dia/semana/mês/ano).
4. Somar **Valor** por agrupamento para saber quanto sai do caixa naquele horizonte.

## Visão por horizonte

- **Hoje / amanhã** — vencimentos com Data de vencimento = hoje ou amanhã e Status ≠ "pago".
- **Esta semana** — vencimentos dos próximos 7 dias corridos.
- **Este mês** — todos os vencimentos com Data de vencimento dentro do mês corrente, separados por já pago vs. ainda a pagar.
- **Este ano / sazonalidade** — vencimentos anuais ou concentrados em meses específicos (ver seção abaixo).

Esta é exatamente a estrutura de perguntas usada na rotina diária — ver `../playbooks/revisao-diaria-vencimentos.md`.

## Sazonalidade — meses de maior concentração conhecida

Alguns vencimentos não são mensais e se concentram em meses específicos, exigindo caixa extra além do padrão mensal. Candidatos típicos a mapear aqui:

- Janeiro/fevereiro: IPVA, IPTU (cota única ou primeira parcela), material escolar e matrícula.
- Março/abril: Imposto de Renda (ano-calendário anterior).
- Dezembro: 13º salário (entrada) compensando gastos de fim de ano (também saída maior).
- Meses de renovação de seguros e assinaturas anuais (variável por apólice/contrato).

## Estado atual

[PENDENTE DE PREENCHIMENTO]

## Dados pendentes

- Consolidação real de todos os vencimentos das categorias já preenchidas.
- Mapa de sazonalidade com valores estimados por mês de concentração.
- Saldo mínimo recomendado em conta nos meses de maior concentração, cruzado com `../financeiro/fluxo-de-caixa.md`.

## Próximas ações

1. Aguardar preenchimento dos arquivos de categoria com dados reais.
2. Montar a primeira versão consolidada deste calendário (mesmo que manual, antes de qualquer automação).
3. Identificar e registrar aqui os meses de maior aperto sazonal específicos da família Crismanis.

# Diagnóstico Financeiro Atual
> Última atualização: 2026-07-04

## Objetivo

Consolidar, em um único lugar, a leitura mais recente do estado financeiro da família Crismanis — ponto de partida para qualquer análise ou decisão no FinFVC.

## Estado atual

[PENDENTE DE PREENCHIMENTO] — consolidar a partir de `patrimonio.md`, `receitas.md`, `despesas.md`, `dividas.md` uma vez que esses arquivos tenham dado real preenchido.

## Dados conhecidos

- Sistema FinFVC em operação, com integração Pluggy e Supabase (ver `docs/arquitetura/`).
- Estrutura de categorização e orçamento já implementada no produto (`finance-app/`).
- Demais dados financeiros específicos da família: [PENDENTE DE PREENCHIMENTO].

## Dados pendentes

- Patrimônio líquido consolidado atual.
- Renda mensal recorrente consolidada.
- Despesa mensal média dos últimos 3-6 meses.
- Dívidas ativas e seus termos (taxa, prazo, saldo devedor).
- Reserva de emergência atual vs. meta.

## Próximas ações

1. Confirmar que todas as contas/cartões relevantes estão conectadas via Pluggy ou lançados manualmente no FinFVC.
2. Rodar consolidação de patrimônio, receitas, despesas e dívidas a partir do dado real do app.
3. Preencher este diagnóstico com os números resultantes.
4. Gerar o primeiro relatório mensal em `docs/relatorios/`.

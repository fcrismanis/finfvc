# Arquitetura — Agentes no FinFVC
> Última atualização: 2026-07-04

## Referência

Os papéis conceituais de Hermes, OpenClaw, IA CFO e Git como fonte de verdade estão definidos em [docs/soul/AGENTES.md](../soul/AGENTES.md). Este arquivo cobre como esses papéis se conectam à arquitetura técnica do FinFVC.

## Pontos de integração técnica (estado atual e planejado)

- **Leitura de dados**: hoje, os agentes leem o estado financeiro através dos arquivos Markdown em `docs/financeiro/` e `docs/decisoes/`. Uma evolução planejada é permitir leitura direta (via MCP ou API) do estado no Supabase, para diagnósticos sempre atualizados sem depender de sincronização manual da documentação.
- **Escrita/atualização**: OpenClaw é o agente responsável por atualizar `docs/` de forma operacional, seguindo `docs/prompts/openclaw-financeiro.md` e `docs/prompts/segundo-cerebro-financeiro.md`.
- **Análise**: a IA CFO opera sobre dados consolidados (hoje, principalmente via análise pontual dentro do FinFVC/Claude Code; potencialmente, no futuro, via endpoint dedicado similar ao `advisor-endpoint.md` já documentado em `finance-app/docs/`).
- **Estratégia**: Hermes consome os outputs da IA CFO e do estado registrado em `docs/` para produzir plano executivo, sem acesso direto necessário ao banco de dados — opera na camada de decisão, não na camada de dado bruto.

## Por que essa separação de camadas importa

Manter os agentes operando sobre camadas diferentes (dado bruto → análise → estratégia → memória documental) evita que uma falha ou viés em um agente contamine silenciosamente os outros. Cada camada pode ser auditada e corrigida independentemente.

## Próximos passos técnicos (não implementados ainda)

- Avaliar exposição de um MCP ou API somente-leitura sobre o Supabase do FinFVC para os agentes do Geisteshelfer consultarem estado real sem passar por Markdown intermediário.
- Definir processo de sincronização entre atualizações feitas via UI do FinFVC e o segundo cérebro documental (hoje é manual/assistido).

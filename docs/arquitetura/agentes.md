# Arquitetura — Agentes no FinFVC
> Última atualização: 2026-07-04

## Referência

Os papéis conceituais de Hermes, OpenClaw, IA CFO, Claude Code e o comitê de investimentos estão definidos em [finfvc/agentes/README.md](../../finfvc/agentes/README.md). Este arquivo cobre como esses papéis se conectam à arquitetura técnica do FinFVC.

## Pontos de integração técnica (estado atual e planejado)

- **Leitura de dados**: hoje, os agentes leem o estado financeiro através dos arquivos Markdown em [finfvc/financeiro/](../../finfvc/financeiro/diagnostico-atual.md) e [finfvc/decisoes/](../../finfvc/decisoes/README.md). Uma evolução planejada é permitir leitura direta (via MCP ou API) do estado no Supabase, para diagnósticos sempre atualizados sem depender de sincronização manual da documentação.
- **Escrita/atualização**: OpenClaw é o agente responsável por atualizar `finfvc/` de forma operacional, seguindo [finfvc/agentes/openclaw.md](../../finfvc/agentes/openclaw.md) e [finfvc/prompts/segundo-cerebro-financeiro.md](../../finfvc/prompts/segundo-cerebro-financeiro.md).
- **Análise**: a IA CFO opera sobre dados consolidados (hoje, principalmente via análise pontual dentro do FinFVC/Claude Code; potencialmente, no futuro, via endpoint dedicado similar ao `advisor-endpoint.md` já documentado em `finance-app/docs/`).
- **Estratégia**: Hermes consome os outputs da IA CFO e do estado registrado em `finfvc/` para produzir plano executivo, sem acesso direto necessário ao banco de dados — opera na camada de decisão, não na camada de dado bruto.
- **Decisão de investimento relevante**: passa pelo modelo de comitê ([finfvc/agentes/comite-de-investimentos-ia.md](../../finfvc/agentes/comite-de-investimentos-ia.md)), com decisão final sempre humana.

## Por que essa separação de camadas importa

Manter os agentes operando sobre camadas diferentes (dado bruto → análise → estratégia → memória documental) evita que uma falha ou viés em um agente contamine silenciosamente os outros. Cada camada pode ser auditada e corrigida independentemente.

## Próximos passos técnicos (não implementados ainda)

- Avaliar exposição de um MCP ou API somente-leitura sobre o Supabase do FinFVC para os agentes do Segundo Cérebro consultarem estado real sem passar por Markdown intermediário.
- Definir processo de sincronização entre atualizações feitas via UI do FinFVC e o Segundo Cérebro documental (hoje é manual/assistido).

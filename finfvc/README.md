# FinFVC — Cérebro Financeiro do Segundo Cérebro
> Última atualização: 2026-07-04

## Propósito

O FinFVC é o cérebro financeiro do Segundo Cérebro de Fábio Volfe Crismanis. É onde vivem os dados, princípios, decisões e estratégias financeiras e patrimoniais da família Crismanis — tratado com o mesmo rigor de um Family Office digital.

O FinFVC atua simultaneamente como:

- **Cérebro financeiro** — memória viva do estado financeiro da família.
- **CFO pessoal com IA** — análise contínua de receitas, despesas, patrimônio e risco.
- **Núcleo de patrimônio familiar** — visão consolidada de tudo que a família possui e deve.
- **Sistema de decisões financeiras** — todo movimento relevante registrado e auditável.
- **Laboratório de investimentos** — nenhuma oportunidade vira decisão real sem antes ser simulada (ver [investimentos/laboratorio-de-investimentos.md](investimentos/laboratorio-de-investimentos.md)).
- **Wiki patrimonial** — a história financeira e patrimonial da família, não só o snapshot atual (ver [wiki-patrimonial/](wiki-patrimonial/README.md)).
- **Base de integração** — com Pluggy, Supabase, Hermes, OpenClaw e Claude.
- **Componente do futuro Family Office digital** da família Crismanis.

## Escopo

Este diretório (`finfvc/`) é uma área raiz do Segundo Cérebro — a camada de conhecimento, decisão e estratégia financeira. A implementação técnica (código do app) vive em `finance-app/` e é referenciada, não duplicada, aqui.

## Estrutura de pastas

```
finfvc/
  README.md                  # este arquivo
  SOUL.md                    # manifesto/alma do FinFVC
  VISAO.md                   # visão de longo prazo
  PRINCIPIOS.md              # princípios financeiros obrigatórios
  ROADMAP.md                 # fases de evolução
  _entrada-dados/            # questionários e checklist para sair de PENDENTE para dado real
  financeiro/                # estado atual: patrimônio, receitas, despesas, dívidas, metas, etc.
  investimentos/             # política de investimentos, laboratório, classes de ativo
  decisoes/                  # histórico auditável de decisões, uma por arquivo
  relatorios/                # snapshots mensais e fechamento anual
  pesquisas/                 # tendências e leitura de mercado/tecnologia
  agentes/                   # papéis de IA CFO, Hermes, OpenClaw, Claude Code, comitê
  prompts/                   # prompts operacionais para cada papel/tarefa
  wiki-patrimonial/          # história patrimonial e familiar
  playbooks/                 # passo a passo de rotinas recorrentes
```

## Como usar

1. **Consultar estado atual** → `financeiro/` (dado real, ou `[PENDENTE DE PREENCHIMENTO]` onde ainda não coletado).
2. **Avaliar uma oportunidade** → seguir `playbooks/analise-de-oportunidade.md` e `investimentos/laboratorio-de-investimentos.md`.
3. **Fechar o mês** → seguir `playbooks/fechamento-mensal.md`.
4. **Tomar e registrar uma decisão** → `decisoes/template-decisao.md`.
5. **Pesquisar tendência ou tema externo** → `pesquisas/` com os prompts de `prompts/pesquisador-tendencias.md`.
6. **Entender quem faz o quê** → `agentes/README.md`.

## Relação com Hermes, OpenClaw, Claude e IA CFO

- **IA CFO** analisa dados financeiros e produz diagnóstico (ver `agentes/cfo-ia.md`).
- **Hermes** conecta esse diagnóstico à estratégia e prioridades mais amplas de Fábio (ver `agentes/hermes.md`).
- **OpenClaw** mantém a memória e consistência histórica deste segundo cérebro (ver `agentes/openclaw.md`).
- **Claude Code** documenta, organiza e executa mudanças estruturais neste repositório (ver `agentes/claude-code.md`).
- Para decisões de investimento relevantes, os quatro papéis (+ Fábio como decisor final) atuam como comitê — ver `agentes/comite-de-investimentos-ia.md`.

## Relação com Pluggy/Supabase

- **Pluggy** alimenta o FinFVC com dados reais de contas e cartões via Open Finance, reduzindo dependência de lançamento manual.
- **Supabase** é o banco de dados que sustenta o app `finance-app/`, permitindo acesso multi-dispositivo/multi-usuário familiar.

Detalhes técnicos dessas integrações continuam documentados em `docs/arquitetura/` e nos arquivos técnicos da raiz do repositório (`ARCHITECTURE.md`, `DATA_MODEL.md`) — este README não duplica esse conteúdo, apenas referencia.

## Visão de longo prazo

O FinFVC existe para durar décadas, acompanhando a família Crismanis por diferentes fases de vida — ver [VISAO.md](VISAO.md) e [ROADMAP.md](ROADMAP.md) para o detalhamento.

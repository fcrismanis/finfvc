# Operação do Segundo Cérebro
> Última atualização: 2026-07-04

## Objetivo

Esta é a página única de "como usar" o Segundo Cérebro no dia a dia. Se você (ou um agente) não souber por onde começar, comece aqui.

## O que é este repositório, em uma frase

O projeto principal é o **Segundo Cérebro** — memória, decisão e execução assistida por IA de Fábio Volfe Crismanis, organizada em áreas raiz por domínio de vida. Hoje a única área raiz implementada é **[finfvc/](finfvc/README.md)** (finanças, patrimônio, investimentos, Family Office digital). Ver [README.md](README.md) e [MAPA_DOS_CEREBROS.md](MAPA_DOS_CEREBROS.md) para a visão completa.

## Uso diário — por tipo de tarefa

| Eu quero... | Vou para... |
|---|---|
| Ver o estado financeiro atual da família | [finfvc/financeiro/diagnostico-atual.md](finfvc/financeiro/diagnostico-atual.md) |
| Fechar o mês | [finfvc/playbooks/fechamento-mensal.md](finfvc/playbooks/fechamento-mensal.md) |
| Avaliar uma oportunidade (investimento, renda, negócio) | [finfvc/playbooks/analise-de-oportunidade.md](finfvc/playbooks/analise-de-oportunidade.md) |
| Simular um investimento antes de decidir | [finfvc/investimentos/laboratorio-de-investimentos.md](finfvc/investimentos/laboratorio-de-investimentos.md) |
| Revisar a carteira de investimentos | [finfvc/playbooks/revisao-de-carteira.md](finfvc/playbooks/revisao-de-carteira.md) |
| Revisar o orçamento familiar | [finfvc/playbooks/revisao-de-orcamento.md](finfvc/playbooks/revisao-de-orcamento.md) |
| Registrar uma decisão financeira relevante | [finfvc/playbooks/registro-de-decisao.md](finfvc/playbooks/registro-de-decisao.md) |
| Abrir ou fechar um ciclo de 90 dias | [finfvc/playbooks/plano-de-acao-90-dias.md](finfvc/playbooks/plano-de-acao-90-dias.md) |
| Pesquisar uma tendência (mercado, IA, carreira) | [finfvc/prompts/pesquisador-tendencias.md](finfvc/prompts/pesquisador-tendencias.md) |
| Sair de `[PENDENTE DE PREENCHIMENTO]` para dado real | [finfvc/_entrada-dados/plano-primeiros-30-dias.md](finfvc/_entrada-dados/plano-primeiros-30-dias.md) |
| Entender quem faz o quê (agente único: Arquiteto do Segundo Cérebro) | [finfvc/agentes/README.md](finfvc/agentes/README.md) |
| Entender como o código do app se conecta a tudo isso | [docs/arquitetura/](docs/arquitetura/finfvc-visao.md) |

## Estrutura de alto nível

```
/ (raiz do Segundo Cérebro)
├── README.md                  # visão geral do projeto e áreas raiz
├── SOUL.md                    # alma/filosofia do Segundo Cérebro como um todo
├── MAPA_DOS_CEREBROS.md       # índice de cada área raiz e seu estágio
├── OPERACAO.md                # este arquivo — como usar no dia a dia
│
├── finfvc/                    # área raiz: finanças, patrimônio, investimentos
│   ├── SOUL.md / VISAO.md / PRINCIPIOS.md / ROADMAP.md
│   ├── financeiro/             # estado atual (patrimônio, receitas, despesas, dívidas...)
│   ├── investimentos/          # política, alocação-alvo, laboratório, classes de ativo
│   ├── decisoes/                # histórico auditável de decisões
│   ├── relatorios/              # snapshots mensais e fechamento anual
│   ├── pesquisas/                # tendências de mercado/tecnologia/carreira
│   ├── agentes/                   # Arquiteto do Segundo Cérebro (agente único) + stubs históricos
│   ├── prompts/                    # prompts operacionais
│   ├── wiki-patrimonial/            # história patrimonial e familiar
│   ├── playbooks/                    # passo a passo de rotinas recorrentes
│   └── _entrada-dados/                 # questionários para preencher dado real
│
├── docs/                       # documentação técnica de arquitetura do produto FinFVC
│   └── arquitetura/             # ponte entre o código (finance-app/) e o Segundo Cérebro
│                                 # (docs/soul, docs/financeiro, docs/prompts, docs/decisoes
│                                  # são referências históricas — o conteúdo vigente está em finfvc/)
│
└── finance-app/                # código do produto FinFVC (React/Vite/TypeScript)
```

## Regra de ouro

1. **`finfvc/` é a fonte de verdade de conhecimento e decisão financeira.** Não editar os stubs em `docs/soul/`, `docs/financeiro/`, `docs/prompts/`, `docs/decisoes/` e `docs/relatorios/` — eles só apontam para `finfvc/`.
2. **`docs/arquitetura/` é a fonte de verdade da ponte código ↔ conhecimento.** Editar ali quando mudar como o produto técnico se conecta ao Segundo Cérebro.
3. **`finance-app/` é o código.** Mudanças de produto relevantes devem, quando fizer sentido, referenciar ou atualizar `finfvc/` — não só o código.
4. **O agente não decide sozinho** uma questão financeira relevante — ver [finfvc/agentes/arquiteto-segundo-cerebro.md](finfvc/agentes/arquiteto-segundo-cerebro.md). Decisão final é sempre humana.
5. **Nunca inventar dado.** Onde não existir informação real, usar `[PENDENTE DE PREENCHIMENTO]`.

## Próximos cérebros (áreas raiz futuras)

Hoje só `finfvc/` está implementado. As demais áreas previstas — `carreira/`, `familia/`, `saude/`, `conhecimento/`, `projetos/`, `legado/` — estão descritas em [MAPA_DOS_CEREBROS.md](MAPA_DOS_CEREBROS.md) e só devem ser criadas quando houver necessidade real de operá-las com a mesma profundidade, seguindo o mesmo padrão estrutural já validado em `finfvc/` (SOUL, VISAO, PRINCIPIOS, ROADMAP, estado atual, decisões, agentes/prompts).

Quando uma nova área raiz for criada, este arquivo (`OPERACAO.md`) deve ganhar uma nova linha na tabela de uso diário e uma entrada na estrutura de alto nível acima.

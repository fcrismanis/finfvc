# Arquitetura — Memória Financeira (Segundo Cérebro)
> Última atualização: 2026-07-04

> **Nota de unificação**: a estrutura de pastas descrita originalmente aqui (`docs/soul/`, `docs/financeiro/`, etc.) foi consolidada na área raiz [finfvc/](../../finfvc/README.md) do Segundo Cérebro. A estrutura vigente é mais rica (inclui `investimentos/`, `pesquisas/`, `agentes/`, `wiki-patrimonial/`, `playbooks/` e `_entrada-dados/`, além de `financeiro/` e `decisoes/`) — ver [finfvc/README.md](../../finfvc/README.md) para o mapa completo.

## Princípio de design (ainda válido)

A estrutura em [finfvc/](../../finfvc/README.md) segue o mesmo princípio de qualquer segundo cérebro bem construído: **separar o que muda pouco (SOUL/PRINCIPIOS/VISAO/ROADMAP) do que muda com frequência (`financeiro/`, `relatorios/`) do que é histórico imutável (`decisoes/`)**.

- `finfvc/SOUL.md`, `PRINCIPIOS.md`, `VISAO.md`, `ROADMAP.md` são revisados raramente — só quando a filosofia ou estratégia de fundo realmente muda.
- `finfvc/financeiro/` é atualizado com frequência — reflete o estado mais recente conhecido.
- `finfvc/relatorios/` nunca é editado retroativamente — cada mês é um novo snapshot.
- `finfvc/decisoes/` é append-only na prática — decisões antigas não são apagadas, só superadas por novas entradas que as referenciam.

## Fluxo de atualização típico

1. Dado novo entra (via Pluggy, lançamento manual, ou análise) → reflete no FinFVC (app).
2. Periodicamente (ou sob demanda), o estado relevante é consolidado em [finfvc/financeiro/](../../finfvc/financeiro/diagnostico-atual.md).
3. Se uma escolha foi feita a partir desse estado, ela vira entrada em [finfvc/decisoes/](../../finfvc/decisoes/README.md).
4. Mensalmente, um snapshot é gerado em [finfvc/relatorios/](../../finfvc/relatorios/README.md).
5. `finfvc/SOUL.md`, `PRINCIPIOS.md` e `VISAO.md` só são tocados quando a estratégia de fundo muda — não em ciclo regular.

## Regras de integridade

- Nunca inventar dado para preencher lacuna — usar `[PENDENTE DE PREENCHIMENTO]`.
- Nunca apagar decisão antiga — superar com registro novo.
- Sempre manter a data de "última atualização" honesta em cada arquivo.
- Consistência antes de completude: é melhor um arquivo curto e correto do que longo e especulativo.
- Para sair de `[PENDENTE DE PREENCHIMENTO]` para dado real, seguir [finfvc/_entrada-dados/plano-primeiros-30-dias.md](../../finfvc/_entrada-dados/plano-primeiros-30-dias.md).

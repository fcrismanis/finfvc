# Arquitetura — Memória Financeira (Segundo Cérebro)
> Última atualização: 2026-07-04

## Estrutura

```
docs/
  soul/          # manifesto, princípios, visão, papéis, roadmap — a camada conceitual
  financeiro/    # estado atual dos números e planos da família — a camada de dado/estado
  prompts/       # prompts operacionais para cada agente/papel
  arquitetura/   # como o sistema técnico se conecta a essa camada conceitual
  relatorios/    # snapshots mensais gerados a partir do estado acima
  decisoes/      # histórico auditável de decisões, uma por arquivo
```

## Princípio de design

Esta estrutura segue o mesmo princípio de qualquer segundo cérebro bem construído: **separar o que muda pouco (soul) do que muda com frequência (financeiro, relatórios) do que é histórico imutável (decisoes)**.

- `soul/` é revisado raramente — só quando a filosofia ou estratégia de fundo realmente muda.
- `financeiro/` é atualizado com frequência — reflete o estado mais recente conhecido.
- `relatorios/` nunca é editado retroativamente — cada mês é um novo snapshot.
- `decisoes/` é append-only na prática — decisões antigas não são apagadas, só superadas por novas entradas que as referenciam.

## Fluxo de atualização típico

1. Dado novo entra (via Pluggy, lançamento manual, ou análise) → reflete no FinFVC (app).
2. Periodicamente (ou sob demanda), o estado relevante é consolidado em `docs/financeiro/`.
3. Se uma escolha foi feita a partir desse estado, ela vira entrada em `docs/decisoes/`.
4. Mensalmente, um snapshot é gerado em `docs/relatorios/`.
5. `docs/soul/` só é tocado quando a estratégia de fundo muda — não em ciclo regular.

## Regras de integridade

- Nunca inventar dado para preencher lacuna — usar `[PENDENTE DE PREENCHIMENTO]`.
- Nunca apagar decisão antiga — superar com registro novo.
- Sempre manter a data de "última atualização" honesta em cada arquivo.
- Consistência antes de completude: é melhor um arquivo curto e correto do que longo e especulativo.

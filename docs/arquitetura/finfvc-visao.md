# FinFVC — Visão de Arquitetura
> Última atualização: 2026-07-04

## Stack atual

- **Frontend**: React + Vite + TypeScript + Tailwind (`finance-app/`)
- **Backend/Banco**: Supabase (Postgres + Auth + Storage)
- **Open Finance**: Pluggy (integração de contas/cartões, ver [pluggy.md](pluggy.md))
- **Deploy**: servidor próprio (Hostinger/VPS), ver `SETUP_HOSTINGER.md` e `deploy-hostinger.sh` na raiz do repositório

Para detalhes técnicos de código (providers, adapters, serviços), a fonte de verdade é `ARCHITECTURE.md` e `DATA_MODEL.md` na raiz do repositório — este documento cobre a visão de arquitetura na camada de produto/segundo cérebro, não duplica o detalhe técnico já existente.

## Camadas do sistema

1. **Ingestão de dados** — Pluggy (automático) e importação manual (XLSX/CSV) como fallback.
2. **Armazenamento** — Supabase como fonte de verdade multi-dispositivo; fallback local (localStorage) para modo demo/offline.
3. **Processamento** — categorização (regras + IA), motor financeiro (orçamento, projeção, reconciliação).
4. **Apresentação** — dashboard, lançamentos, orçamento, relatórios, revisão.
5. **Camada de decisão (Segundo Cérebro)** — [finfvc/](../../finfvc/README.md) (SOUL, PRINCIPIOS, financeiro/, decisoes/, investimentos/ etc.) — a camada conceitual que orienta como o produto deve evoluir, organizada como área raiz do Segundo Cérebro.

## Relação entre código e Segundo Cérebro

O código em `finance-app/` implementa a mecânica (como os dados são capturados, processados e exibidos). A área [finfvc/](../../finfvc/README.md) do Segundo Cérebro define o propósito (por que o sistema existe, quais princípios governam decisões, o que ainda falta construir). Mudanças de produto relevantes devem, idealmente, referenciar ou atualizar o Segundo Cérebro correspondente — não só o código.

## Ver também

- [pluggy.md](pluggy.md) — integração Open Finance
- [supabase.md](supabase.md) — banco e sincronização
- [openfinance.md](openfinance.md) — visão regulatória/funcional do Open Finance no Brasil
- [agentes.md](agentes.md) — como Hermes, OpenClaw e IA CFO se conectam à arquitetura
- [memoria-financeira.md](memoria-financeira.md) — como o segundo cérebro é estruturado e mantido

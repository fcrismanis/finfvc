# Arquitetura — Supabase
> Última atualização: 2026-07-04

## Papel no sistema

Supabase é o backend/banco de dados do FinFVC: Postgres gerenciado, autenticação e camada de sincronização que permite que a família (múltiplos usuários/dispositivos) compartilhe o mesmo estado financeiro de forma consistente.

Documentação técnica de setup e schema já existe em `SETUP_SUPABASE.md`, `SUPABASE_PLAN.md` e `DATA_MODEL.md` na raiz do repositório, e em `supabase/migrations/` — este arquivo cobre o papel do Supabase na visão de segundo cérebro, sem duplicar o detalhe de schema.

## Por que isso importa para o segundo cérebro

- É a fonte de verdade operacional dos dados financeiros (transações, categorias, orçamento, patrimônio) — o que a área [finfvc/financeiro/](../../finfvc/financeiro/diagnostico-atual.md) do Segundo Cérebro resume e contextualiza, mas não substitui.
- Multi-usuário familiar: permite que mais de uma pessoa da família veja e opere sobre o mesmo estado financeiro, com histórico de quem alterou o quê.
- Sustenta features de médio prazo (Fase 2-5 do roadmap): orçamento colaborativo, alertas, automações, futura leitura por agentes (Hermes/OpenClaw) do estado real do sistema.

## Cuidados

- Nunca versionar credenciais/chaves do Supabase em Git (`.env` fica fora do controle de versão — ver regra de segurança padrão do projeto).
- Migrações (`supabase/migrations/`) são a fonte de verdade de schema — qualquer mudança estrutural passa por lá, não por alteração manual no dashboard sem registro.
- Mudança de schema com impacto em dado real da família deve ser tratada com o mesmo cuidado de uma decisão financeira — se afetar como dado é interpretado, considerar registro em [finfvc/decisoes/](../../finfvc/decisoes/README.md).

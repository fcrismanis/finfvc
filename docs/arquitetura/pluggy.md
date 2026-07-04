# Arquitetura — Pluggy (Open Finance)
> Última atualização: 2026-07-04

## Papel no sistema

Pluggy é a integração de Open Finance do FinFVC: conecta contas bancárias e cartões de crédito da família Crismanis para trazer transações, saldos e faturas automaticamente, reduzindo dependência de lançamento manual.

Documentação técnica detalhada de implementação já existe em `finance-app/docs/pluggy-integration.md` e `finance-app/docs/pluggy-category-map.md` — este arquivo cobre o papel do Pluggy na visão de segundo cérebro, sem duplicar o detalhe de código.

## Por que isso importa para o segundo cérebro

- Dado manual é dado atrasado e sujeito a esquecimento. Dado via Open Finance aproxima o "estado registrado" do "estado real" continuamente — pré-requisito para a Fase 5 (Inteligência) do [roadmap](../soul/ROADMAP_PATRIMONIAL.md).
- Reduz o atrito de manter `docs/financeiro/` atualizado — idealmente, boa parte da atualização de receitas/despesas passa a ser semi-automática a partir dos dados sincronizados, com a IA CFO consolidando o que mudou.

## Estado conhecido

Ver `PLUGGY_CLEAN_START_CHECKLIST.md` na raiz do repositório para o estado operacional mais recente da integração (conexões ativas, pendências, histórico de troubleshooting).

## Riscos e cuidados específicos

- Dependência de terceiro: se a API do Pluggy ficar indisponível ou uma conexão expirar (trial, credencial), o sistema precisa degradar de forma graciosa para lançamento manual — nunca travar o usuário sem alternativa.
- Categorização automática vinda do Pluggy é ponto de partida, não verdade final — sempre sujeita a revisão (ver `finance-app/src/services/pluggyCategoryMap.ts` e o motor de regras).
- Dados sensíveis (credenciais bancárias) nunca devem ser expostos no frontend ou versionados — seguir o que já está descrito em `SETUP_SUPABASE.md` / variáveis de ambiente do backend.

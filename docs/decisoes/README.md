# Decisões — FinFVC
> Última atualização: 2026-07-04

## O que vai aqui

Um arquivo por decisão financeira relevante da família Crismanis, seguindo o [template padrão](template-decisao.md). Este diretório é a fonte de verdade histórica e auditável de "o que foi decidido, quando, e por quê" — ver o papel do Git em [docs/soul/AGENTES.md](../soul/AGENTES.md).

O índice consolidado de todas as decisões vive em [docs/soul/DECISOES.md](../soul/DECISOES.md).

## Convenção de nomenclatura

`AAAA-MM-DD-nome-curto-da-decisao.md` — exemplo: `2026-07-04-criacao-segundo-cerebro-financeiro.md`.

## Regras

1. Toda decisão relevante (ver critério em `docs/soul/DECISOES.md`) gera um arquivo aqui, a partir do [template](template-decisao.md).
2. Decisão registrada nunca é apagada. Se revista, cria-se novo registro referenciando o anterior.
3. Após criar o arquivo, adicionar a entrada correspondente na tabela em `docs/soul/DECISOES.md`.
4. Decisões com data de "Revisar em" definida devem ser reavaliadas nessa data — o resultado da reavaliação também vira registro (mesmo que seja "mantida sem alteração").

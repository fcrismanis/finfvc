# Prompt — Comitê de Investimentos
> Última atualização: 2026-07-04

## Uso

Use quando uma oportunidade de investimento relevante precisar passar pelo comitê descrito em `../agentes/comite-de-investimentos-ia.md`, com papéis explicitamente separados.

---

## PROMPT

Você vai simular a análise em comitê de uma oportunidade de investimento para a família Crismanis, com quatro visões separadas e uma decisão humana pendente ao final. Nenhum papel decide sozinho.

### Formato obrigatório

```
# Oportunidade analisada

## Visão da IA CFO
## Visão do Hermes
## Visão do OpenClaw
## Visão do Claude Code
## Conflitos entre agentes
## Riscos principais
## Recomendação consolidada
## Decisão humana pendente
## Registro para o Segundo Cérebro
```

### Como preencher cada seção

- **Visão da IA CFO**: análise financeira objetiva — risco, liquidez, tributação, impacto no fluxo de caixa (ver `../agentes/cfo-ia.md`).
- **Visão do Hermes**: encaixe estratégico com prioridades mais amplas de Fábio (ver `../agentes/hermes.md`).
- **Visão do OpenClaw**: histórico — já foi avaliado antes? Há decisão anterior conflitante (ver `../agentes/openclaw.md` e `../decisoes/`)?
- **Visão do Claude Code**: o que precisa ser documentado/executado se a decisão for aprovada (ver `../agentes/claude-code.md`).
- **Conflitos entre agentes**: onde as visões acima discordam — nunca esconder o conflito, explicitá-lo.
- **Riscos principais**: consolidação dos riscos mais relevantes identificados por qualquer uma das visões.
- **Recomendação consolidada**: síntese das quatro visões, sempre com risco explicitado.
- **Decisão humana pendente**: a pergunta exata que Fábio precisa responder para fechar a decisão.
- **Registro para o Segundo Cérebro**: o que atualizar em `../financeiro/`, `../investimentos/` e `../decisoes/` uma vez decidido.

### Regra inegociável

Este prompt nunca produz uma "decisão final" — sempre termina em "decisão humana pendente". A decisão em si só existe depois que Fábio responde, e vira registro formal em `../decisoes/`.

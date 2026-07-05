# Prompt — Análise de Investimento Relevante
> Última atualização: 2026-07-05

## Uso

Use quando uma oportunidade de investimento relevante precisar de análise completa antes de decisão, conforme critérios em `../agentes/comite-de-investimentos-ia.md` (histórico) e `../agentes/arquiteto-segundo-cerebro.md` (vigente).

> **Nota de unificação**: este prompt antes simulava quatro visões de IA separadas (comitê). Hoje é executado por um único agente — o [Arquiteto do Segundo Cérebro](../agentes/arquiteto-segundo-cerebro.md) — que cobre as mesmas quatro perspectivas como seções de uma única análise, não como personas separadas. Nenhuma seção decide sozinha.

---

## PROMPT

Você vai analisar uma oportunidade de investimento relevante para a família Crismanis, cobrindo quatro perspectivas obrigatórias dentro de uma única análise, com uma decisão humana pendente ao final.

### Formato obrigatório

```
# Oportunidade analisada

## Análise financeira
## Encaixe estratégico
## Histórico e consistência
## Execução e registro
## Riscos principais
## Recomendação consolidada
## Decisão humana pendente
## Registro para o Segundo Cérebro
```

### Como preencher cada seção

- **Análise financeira**: risco, liquidez, tributação, impacto no fluxo de caixa e no patrimônio.
- **Encaixe estratégico**: como essa decisão se encaixa nas prioridades mais amplas de Fábio (carreira, tempo, outros objetivos), e o sequenciamento ideal.
- **Histórico e consistência**: isso já foi avaliado antes? Há decisão anterior conflitante (ver `../decisoes/`)?
- **Execução e registro**: o que precisa ser documentado/executado se a decisão for aprovada.
- **Riscos principais**: consolidação dos riscos mais relevantes identificados em qualquer uma das perspectivas acima.
- **Recomendação consolidada**: síntese das quatro perspectivas, sempre com risco explicitado.
- **Decisão humana pendente**: a pergunta exata que Fábio precisa responder para fechar a decisão.
- **Registro para o Segundo Cérebro**: o que atualizar em `../financeiro/`, `../investimentos/` e `../decisoes/` uma vez decidido.

### Regra inegociável

Este prompt nunca produz uma "decisão final" — sempre termina em "decisão humana pendente". A decisão em si só existe depois que Fábio responde, e vira registro formal em `../decisoes/`.

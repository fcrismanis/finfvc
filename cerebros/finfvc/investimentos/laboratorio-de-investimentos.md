# Laboratório de Investimentos
> Última atualização: 2026-07-04

## Conceito

O laboratório é onde toda oportunidade de investimento é **simulada antes de virar decisão real**. Nenhuma alocação de capital acontece sem antes passar por esse exercício — mesmo quando a oportunidade "parece óbvia" ou vem de fonte confiável.

O laboratório existe para separar entusiasmo de análise. Uma oportunidade que não sobrevive a este modelo de análise, de forma honesta, não deveria virar aporte real.

## Modelo de análise (obrigatório para cada oportunidade)

```
# Oportunidade: [nome]

## Valor
## Prazo
## Risco
## Liquidez
## Tributação
## Cenário otimista
## Cenário base
## Cenário pessimista
## Impacto no patrimônio
## Decisão recomendada
## Data de revisão
```

### Como preencher

- **Valor**: quanto capital está em consideração para esta oportunidade.
- **Prazo**: horizonte de tempo esperado do investimento.
- **Risco**: principais fatores de risco específicos (de mercado, crédito, liquidez, regulatório, operacional).
- **Liquidez**: quão rápido e a que custo o capital pode ser resgatado.
- **Tributação**: regime tributário aplicável, de forma geral — não substitui aconselhamento de contador para caso específico complexo.
- **Cenário otimista**: faixa de resultado em cenário favorável, nunca número único garantido.
- **Cenário base**: faixa de resultado esperado no cenário mais provável.
- **Cenário pessimista**: faixa de resultado em cenário desfavorável, incluindo perda de principal quando aplicável.
- **Impacto no patrimônio**: como essa oportunidade altera a alocação atual (ver `alocacao-alvo.md`) — concentra risco? diversifica?
- **Decisão recomendada**: aceitar, aceitar com ajuste, ou recusar — com justificativa ligada às seções acima.
- **Data de revisão**: quando essa simulação deve ser reavaliada (mudança de cenário, prazo definido, evento-gatilho).

## Fluxo do laboratório até a decisão real

1. Oportunidade identificada → registrada em `../financeiro/oportunidades.md`.
2. Simulação completa neste modelo (laboratório).
3. Se envolver valor relevante, passa pelo [comitê de investimentos IA](../agentes/comite-de-investimentos-ia.md).
4. Decisão final humana (Fábio) — nunca automática.
5. Se aprovada, vira registro em `../decisoes/` seguindo `../decisoes/template-decisao.md`.

## Regra inegociável

Nenhuma simulação que aponte sinais de hype, promessa de retorno garantido, ou estrutura de pirâmide (ver `../PRINCIPIOS.md`, princípio 4) avança para decisão real — a recomendação nesses casos é sempre recusa, independentemente do cenário otimista projetado.

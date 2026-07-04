# Comitê de Investimentos IA
> Última atualização: 2026-07-04

## Conceito

Toda decisão de investimento relevante para a família Crismanis passa por um comitê com quatro visões de IA — cada uma contribuindo com sua perspectiva específica — e uma decisão final sempre humana. Nenhum agente decide sozinho.

## Composição do comitê

### IA CFO — análise financeira

Contribui com o diagnóstico financeiro objetivo: risco, liquidez, tributação, impacto no fluxo de caixa e no patrimônio (ver `cfo-ia.md`).

### Hermes — estratégia e visão macro

Contribui com a leitura estratégica: como essa decisão se encaixa nas prioridades mais amplas de Fábio (carreira, tempo, outros objetivos), e o sequenciamento ideal (ver `hermes.md`).

### OpenClaw — memória e consistência histórica

Contribui com o histórico: isso já foi avaliado antes? Há uma decisão anterior registrada que conflita? O que já sabemos sobre esse tipo de oportunidade (ver `openclaw.md`)?

### Claude Code — documentação e execução

Garante que a análise do comitê seja registrada de forma clara e completa, e que a execução técnica decorrente (atualização de arquivos, próximos passos) aconteça corretamente (ver `claude-code.md`).

### Fábio — decisão final

Recebe as quatro visões consolidadas, avalia à luz de `../PRINCIPIOS.md`, e toma a decisão final. **Nenhuma IA decide por conta própria** — o papel do comitê é eliminar pontos cegos e organizar a análise, não substituir o julgamento humano.

## Fluxo

1. Oportunidade simulada no [laboratório de investimentos](../investimentos/laboratorio-de-investimentos.md).
2. Cada papel do comitê contribui sua visão, seguindo o formato de `../prompts/comite-investimentos.md`.
3. Conflitos entre visões são explicitados, não escondidos.
4. Recomendação consolidada é apresentada a Fábio.
5. Decisão final humana é registrada em `../decisoes/`.

## Quando o comitê é obrigatório

- Qualquer aporte que exceda o percentual definido como "relevante" na `../investimentos/politica-de-investimentos.md` (placeholder a definir).
- Qualquer decisão que altere a alocação-alvo (`../investimentos/alocacao-alvo.md`).
- Qualquer oportunidade com sinais mistos de risco (nem claramente segura, nem claramente red flag).

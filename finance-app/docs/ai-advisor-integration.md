# AI Advisor — Guia de Integração

## Arquitetura de segurança

NUNCA coloque chaves de API (OpenAI/Anthropic) no frontend. Fluxo:

```
Frontend → POST /api/advisor { prompt, context } → Backend (chave segura) → Claude/GPT → resposta → Frontend
```

## Variáveis de ambiente (server-side APENAS)

```env
# Para Claude
ANTHROPIC_API_KEY=<sua-chave>

# Para GPT
OPENAI_API_KEY=<sua-chave>

# Qual usar (claude | gpt)
AI_PROVIDER=claude
```

## Endpoint: POST /api/advisor

### Request
```json
{
  "prompt": "Quais categorias estão acima do orçamento?",
  "context": {
    "month": "2025-05",
    "operationalIncome": 15000,
    "totalExpenses": 11000,
    "operationalResult": 4000,
    "savingsRate": 0.267,
    "topCategories": [
      { "name": "Alimentação", "amount": 3200 },
      { "name": "Casa", "amount": 2100 }
    ],
    "pendingAmount": 800
  },
  "provider": "claude"
}
```

### Response
```json
{ "answer": "Em maio/2025, as categorias acima do orçamento são..." }
```

## System prompt sugerido (backend)

```
Você é um consultor financeiro pessoal objetivo e empático, especializado em finanças familiares brasileiras.
Contexto do mês ${month}:
- Receita operacional: R$ ${income}
- Despesas totais: R$ ${expenses}
- Resultado: R$ ${result}
- Margem familiar: ${margin}%
- Maiores categorias: ${categories}

Responda em português, de forma concisa (máx 250 palavras), com dados concretos do contexto acima.
```

## Como plugar Claude (Anthropic SDK)

```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const msg = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: systemPrompt,
  messages: [{ role: 'user', content: prompt }],
})
```

## Como plugar GPT (OpenAI SDK)

```ts
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ],
})
```

## Evitar envio indevido de dados

- Nunca envie nome, CPF, endereço ou outros dados pessoais no contexto
- O contexto deve conter apenas dados agregados (totais, categorias, percentuais)
- Não inclua descrições individuais de lançamentos que possam identificar o usuário
- Limite o contexto a no máximo 10 categorias e os últimos 3 meses de médias

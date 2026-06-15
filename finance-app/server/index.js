import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT ?? 8787

// ── Payload limits ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '128kb' }))

// ── CORS: allow frontend dev server only ─────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
}))

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um consultor financeiro familiar.
Responda sempre em português do Brasil.
Use somente os dados recebidos no contexto — nunca invente transações ou valores.
Separe claramente: fatos observados, hipóteses e recomendações práticas.
Avise quando faltar dado para uma análise mais precisa.
Não faça recomendações de investimento de alto risco.
Não trate suas respostas como aconselhamento financeiro profissional formal.`

const MAX_TRANSACTIONS = 50

// ── Build user content block ──────────────────────────────────────────────────
function buildContent(question, month, ctx) {
  const txSample = Array.isArray(ctx.transactions)
    ? ctx.transactions.slice(0, MAX_TRANSACTIONS)
    : []
  const parts = [
    `Mês de referência: ${month}`,
    '',
    'Resumo financeiro:',
    JSON.stringify(ctx.summary ?? ctx, null, 2),
    '',
    'Orçamento:',
    JSON.stringify(ctx.budget ?? {}, null, 2),
  ]
  if (ctx.closing) {
    parts.push('', 'Fechamento:', JSON.stringify(ctx.closing, null, 2))
  }
  parts.push(
    '',
    `Amostra de transações (${txSample.length}):`,
    JSON.stringify(txSample, null, 2),
    '',
    `Pergunta do usuário: ${question}`,
  )
  return parts.join('\n')
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleMock(question, month) {
  return {
    provider: 'mock',
    answer: `[Mock] Pergunta: "${question}" — mês ${month}. Configure OPENAI_API_KEY ou ANTHROPIC_API_KEY no .env para respostas reais.`,
  }
}

async function handleGPT(question, month, ctx) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { provider: 'gpt', answer: '', error: 'OPENAI_API_KEY não configurada no backend.' }
  }

  const model = process.env.ADVISOR_OPENAI_MODEL ?? 'gpt-4.1-mini'
  const input = buildContent(question, month, ctx)

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, instructions: SYSTEM_PROMPT, input }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  // Responses API: output[].content[].text
  const answer = data.output
    ?.filter(b => b.type === 'message')
    ?.flatMap(b => b.content ?? [])
    ?.filter(c => c.type === 'output_text')
    ?.map(c => c.text)
    ?.join('') ?? ''

  return { provider: 'gpt', answer }
}

async function handleClaude(question, month, ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { provider: 'claude', answer: '', error: 'ANTHROPIC_API_KEY não configurada no backend.' }
  }

  const model = process.env.ADVISOR_CLAUDE_MODEL ?? 'claude-sonnet-4-5'
  const content = buildContent(question, month, ctx)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const answer = data.content
    ?.filter(c => c.type === 'text')
    ?.map(c => c.text)
    ?.join('') ?? ''

  return { provider: 'claude', answer }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = ['mock', 'gpt', 'claude']

app.post('/api/advisor', async (req, res) => {
  const { provider, question, month, context } = req.body ?? {}

  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `provider inválido: ${String(provider)}. Use: ${VALID_PROVIDERS.join(', ')}` })
  }
  if (!question || typeof question !== 'string' || question.length > 2000) {
    return res.status(400).json({ error: 'question obrigatória (string, máx 2000 chars)' })
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month obrigatório no formato YYYY-MM' })
  }
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return res.status(400).json({ error: 'context obrigatório (object)' })
  }

  try {
    let result
    if (provider === 'mock') result = handleMock(question, month)
    else if (provider === 'gpt') result = await handleGPT(question, month, context)
    else result = await handleClaude(question, month, context)

    if (result.error) return res.status(503).json(result)
    return res.json(result)
  } catch (err) {
    // Log only the error message, never the financial payload
    console.error('[advisor] handler error:', err.message)
    return res.status(500).json({ error: 'Erro interno ao consultar IA.', details: err.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`[advisor] http://localhost:${PORT}`)
  console.log(`[advisor] GPT:    ${process.env.OPENAI_API_KEY ? '✓ configurado' : '✗ OPENAI_API_KEY ausente'}`)
  console.log(`[advisor] Claude: ${process.env.ANTHROPIC_API_KEY ? '✓ configurado' : '✗ ANTHROPIC_API_KEY ausente'}`)
})

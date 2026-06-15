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

// ── Global uncaught handler — never crash the process ─────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[advisor] unhandledRejection:', reason instanceof Error ? reason.message : reason)
})

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um consultor financeiro familiar.
Responda sempre em português do Brasil.
Use somente os dados recebidos no contexto — nunca invente transações ou valores.
Separe claramente: fatos observados, hipóteses e recomendações práticas.
Avise quando faltar dado para uma análise mais precisa.
Não faça recomendações de investimento de alto risco.
Não trate suas respostas como aconselhamento financeiro profissional formal.`

const MAX_TRANSACTIONS = 50

// ── Provider availability ─────────────────────────────────────────────────────
function getProviderStatus() {
  return {
    mock: true,
    gpt: !!(process.env.OPENAI_API_KEY),
    claude: !!(process.env.ANTHROPIC_API_KEY),
  }
}

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
    // 429 = quota/billing issue — controlled error, not a crash
    if (res.status === 429) {
      return {
        provider: 'gpt',
        answer: '',
        error: 'Cota da OpenAI excedida ou saldo insuficiente. Adicione créditos em platform.openai.com/settings/billing.',
        warnings: ['HTTP 429 — quota exceeded'],
      }
    }
    // 401 = bad key
    if (res.status === 401) {
      return { provider: 'gpt', answer: '', error: 'OPENAI_API_KEY inválida ou expirada.' }
    }
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
    return { provider: 'claude', answer: '', error: 'ANTHROPIC_API_KEY não configurada no backend. Obtenha em console.anthropic.com.' }
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
    if (res.status === 429) {
      return { provider: 'claude', answer: '', error: 'Cota da Anthropic excedida. Verifique o plano em console.anthropic.com.' }
    }
    if (res.status === 401) {
      return { provider: 'claude', answer: '', error: 'ANTHROPIC_API_KEY inválida ou expirada.' }
    }
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const answer = data.content
    ?.filter(c => c.type === 'text')
    ?.map(c => c.text)
    ?.join('') ?? ''

  return { provider: 'claude', answer }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ── Pluggy: shared auth helper ────────────────────────────────────────────────
async function pluggyGetApiKey() {
  const clientId     = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  const apiBase      = process.env.PLUGGY_API_BASE_URL ?? 'https://api.pluggy.ai'
  if (!clientId || !clientSecret) throw Object.assign(new Error('Pluggy não configurado no servidor'), { status: 503 })
  const res = await fetch(`${apiBase}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[pluggy] auth failed:', res.status, text.slice(0, 120))
    throw Object.assign(new Error(`Autenticação Pluggy falhou (${res.status})`), { status: 502 })
  }
  const { apiKey } = await res.json()
  return { apiKey, apiBase }
}

// ── Pluggy: status (lets frontend know if Pluggy is configured) ───────────────
app.get('/api/pluggy/status', (_req, res) => {
  const configured = !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
  res.json({ configured, provider: 'pluggy' })
})

// ── Pluggy: secure connect_token endpoint ─────────────────────────────────────
app.post('/api/pluggy/token', async (_req, res) => {
  try {
    const { apiKey, apiBase } = await pluggyGetApiKey()

    const tokenRes = await fetch(`${apiBase}/connect_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({}),
    })
    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '')
      console.error('[pluggy] connect_token failed:', tokenRes.status, text.slice(0, 120))
      return res.status(502).json({ ok: false, error: `Connect token Pluggy falhou (${tokenRes.status})` })
    }
    const tokenData = await tokenRes.json()
    return res.json({ ok: true, token: tokenData.accessToken, expiresAt: tokenData.expiresAt ?? null, provider: 'pluggy' })
  } catch (err) {
    console.error('[pluggy] token error:', err.message)
    return res.status(err.status ?? 500).json({ ok: false, error: err.message })
  }
})

// ── Pluggy: register connection — fetch item + accounts from Pluggy ────────────
app.post('/api/pluggy/connections', async (req, res) => {
  const { itemId } = req.body ?? {}
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ ok: false, error: 'itemId obrigatório' })
  }
  try {
    const { apiKey, apiBase } = await pluggyGetApiKey()

    // Fetch item details
    const itemRes = await fetch(`${apiBase}/items/${encodeURIComponent(itemId)}`, {
      headers: { 'X-API-KEY': apiKey },
    })
    if (!itemRes.ok) {
      const text = await itemRes.text().catch(() => '')
      console.error('[pluggy] item fetch failed:', itemRes.status, text.slice(0, 120))
      return res.status(502).json({ ok: false, error: `Item Pluggy não encontrado (${itemRes.status})` })
    }
    const item = await itemRes.json()

    // Fetch accounts for this item
    const accsRes = await fetch(`${apiBase}/accounts?itemId=${encodeURIComponent(itemId)}`, {
      headers: { 'X-API-KEY': apiKey },
    })
    const accsData = accsRes.ok ? await accsRes.json() : { results: [] }
    const accounts = Array.isArray(accsData.results) ? accsData.results
      : Array.isArray(accsData) ? accsData
      : []

    const connection = {
      itemId:            item.id,
      connectorName:     item.connector?.name ?? 'Banco',
      connectorImageUrl: item.connector?.imageUrl ?? null,
      status:            item.status ?? 'UPDATED',
      createdAt:         item.createdAt ?? new Date().toISOString(),
      lastUpdatedAt:     item.lastUpdatedAt ?? null,
      accounts: accounts.map(acc => ({
        id:             acc.id,
        itemId:         acc.itemId ?? item.id,
        name:           acc.name,
        type:           acc.type,           // 'BANK' | 'CREDIT'
        subtype:        acc.subtype ?? null,
        balance:        acc.balance ?? 0,
        currencyCode:   acc.currencyCode ?? 'BRL',
        limit:          acc.creditData?.creditLimit ?? null,
        availableLimit: acc.creditData?.availableCreditLimit ?? null,
        closeDate:      acc.creditData?.balanceCloseDate ?? null,
        dueDate:        acc.creditData?.balanceDueDate ?? null,
      })),
    }

    return res.json({ ok: true, connection })
  } catch (err) {
    console.error('[pluggy] connections error:', err.message)
    return res.status(err.status ?? 500).json({ ok: false, error: err.message })
  }
})

// ── Pluggy: list connections (stored client-side; backend acknowledges) ────────
app.get('/api/pluggy/connections', (_req, res) => {
  res.json({ ok: true, storageType: 'local', message: 'Conexões persistidas no frontend (localStorage).' })
})

// ── Pluggy: fetch transactions for an account or item with period ─────────────
// POST /api/pluggy/transactions
// Body: { accountId, from, to } OR { itemId, from, to }
// Response: { ok, transactions, count, provider }
app.post('/api/pluggy/transactions', async (req, res) => {
  const { accountId, itemId, from, to } = req.body ?? {}

  if (!accountId && !itemId) {
    return res.status(400).json({ ok: false, error: 'accountId ou itemId obrigatório' })
  }
  if (!from || !to) {
    return res.status(400).json({ ok: false, error: 'from e to obrigatórios (YYYY-MM-DD)' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'from e to devem estar no formato YYYY-MM-DD' })
  }

  try {
    const { apiKey, apiBase } = await pluggyGetApiKey()

    // Resolve account IDs
    let accountIds = []
    if (accountId) {
      accountIds = [accountId]
    } else {
      const accsRes = await fetch(`${apiBase}/accounts?itemId=${encodeURIComponent(itemId)}`, {
        headers: { 'X-API-KEY': apiKey },
      })
      if (!accsRes.ok) {
        return res.status(502).json({ ok: false, error: `Falha ao buscar contas do item (${accsRes.status})` })
      }
      const accsData = await accsRes.json()
      const accs = Array.isArray(accsData.results) ? accsData.results
        : Array.isArray(accsData) ? accsData : []
      accountIds = accs.map(a => a.id)
    }

    const allTransactions = []
    for (const accId of accountIds) {
      let page = 1
      const pageSize = 500
      while (true) {
        const url = new URL(`${apiBase}/transactions`)
        url.searchParams.set('accountId', accId)
        url.searchParams.set('from', from)
        url.searchParams.set('to', to)
        url.searchParams.set('pageSize', String(pageSize))
        url.searchParams.set('page', String(page))

        const txRes = await fetch(url.toString(), { headers: { 'X-API-KEY': apiKey } })
        if (!txRes.ok) {
          console.error('[pluggy] tx fetch failed:', txRes.status, 'accId:', accId)
          break
        }
        const txData = await txRes.json()
        const results = Array.isArray(txData.results) ? txData.results : []
        for (const tx of results) {
          // Pluggy may return category as string or object { id, description }
          const rawCat = tx.category
          let categoryStr = null
          let categoryId = null
          if (rawCat != null) {
            if (typeof rawCat === 'string') {
              categoryStr = rawCat
            } else if (typeof rawCat === 'object') {
              categoryStr = rawCat.description ?? rawCat.name ?? null
              categoryId  = rawCat.id != null ? String(rawCat.id) : null
            }
          }
          // Debug: log first transaction per sync so we can verify field structure
          if (allTransactions.length === 0) {
            console.log('[pluggy] first tx sample:', JSON.stringify({
              id: tx.id, description: tx.description, type: tx.type,
              category: rawCat, providerCode: tx.providerCode,
            }))
          }
          allTransactions.push({
            id:           tx.id,
            accountId:    accId,
            date:         tx.date,
            description:  tx.description ?? tx.descriptionRaw ?? '',
            amount:       tx.amount ?? 0,
            type:         tx.type,        // 'DEBIT' | 'CREDIT'
            status:       tx.status,      // 'POSTED' | 'PENDING'
            providerCode: tx.providerCode ?? null,
            category:     categoryStr,
            categoryId:   categoryId,
          })
        }
        if (results.length < pageSize) break
        page++
      }
    }

    return res.json({ ok: true, transactions: allTransactions, count: allTransactions.length, provider: 'pluggy' })
  } catch (err) {
    console.error('[pluggy] transactions error:', err.message)
    return res.status(err.status ?? 500).json({ ok: false, error: err.message })
  }
})

const VALID_PROVIDERS = ['mock', 'gpt', 'claude']

// Provider availability — lets the UI disable unconfigured providers
app.get('/api/advisor', (_req, res) => {
  res.json(getProviderStatus())
})

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

    // Controlled errors (missing key, quota) → 503
    if (result.error) return res.status(503).json(result)
    return res.json(result)
  } catch (err) {
    console.error('[advisor] error:', err.message)
    return res.status(500).json({ error: 'Erro interno ao consultar IA.', details: err.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString(), providers: getProviderStatus() }))

app.listen(PORT, () => {
  const s = getProviderStatus()
  console.log(`[advisor] http://localhost:${PORT}`)
  console.log(`[advisor] GPT:    ${s.gpt ? '✓ configurado' : '✗ OPENAI_API_KEY ausente'}`)
  console.log(`[advisor] Claude: ${s.claude ? '✓ configurado' : '✗ ANTHROPIC_API_KEY ausente'}`)
})

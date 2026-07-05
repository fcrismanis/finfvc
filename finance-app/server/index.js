import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = process.env.PORT ?? 8787
const HOST = process.env.HOST ?? '0.0.0.0'

app.use(express.json({ limit: '128kb' }))

// ── CORS: allow frontend dev server only ─────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost',
    'http://localhost:80',
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
    openrouter: !!(process.env.OPENROUTER_API_KEY),
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

  const model = process.env.ADVISOR_CLAUDE_MODEL ?? 'claude-sonnet-4-6'
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

async function handleOpenRouter(question, month, ctx) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { provider: 'openrouter', answer: '', error: 'OPENROUTER_API_KEY não configurada no backend.' }
  }

  const model = process.env.ADVISOR_OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4-5'
  const content = buildContent(question, month, ctx)

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'FIN Consultor Financeiro',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 429) {
      return { provider: 'openrouter', answer: '', error: 'Cota OpenRouter excedida. Verifique créditos em openrouter.ai.' }
    }
    if (res.status === 401) {
      return { provider: 'openrouter', answer: '', error: 'OPENROUTER_API_KEY inválida.' }
    }
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const answer = data.choices?.[0]?.message?.content ?? ''
  return { provider: 'openrouter', answer }
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
        id:               acc.id,
        itemId:           acc.itemId ?? item.id,
        name:             acc.name,
        type:             acc.type,           // 'BANK' | 'CREDIT'
        subtype:          acc.subtype ?? null,
        balance:          acc.balance ?? null,
        availableBalance: acc.bankData?.availableBalance ?? null,
        currencyCode:     acc.currencyCode ?? 'BRL',
        limit:            acc.creditData?.creditLimit ?? null,
        availableLimit:   acc.creditData?.availableCreditLimit ?? null,
        closeDate:        acc.creditData?.balanceCloseDate ?? null,
        dueDate:          acc.creditData?.balanceDueDate ?? null,
        lastUpdatedAt:    acc.lastUpdatedAt ?? acc.updatedAt ?? null,
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
          // category comes as plain string from Pluggy (e.g. "Education")
          // categoryId comes as string code (e.g. "07020000")
          const categoryStr = typeof tx.category === 'string' ? tx.category
            : (tx.category?.description ?? tx.category?.name ?? null)
          const categoryId  = tx.categoryId != null ? String(tx.categoryId)
            : (typeof tx.category === 'object' && tx.category?.id != null ? String(tx.category.id) : null)

          if ((process.env.NODE_ENV !== 'production' || process.env.DEBUG_PLUGGY === 'true') && allTransactions.length === 0) {
            console.log('[pluggy] tx field candidates', {
              keys: Object.keys(tx),
              categoryCandidates: {
                category: tx.category,
                categoryId: tx.categoryId,
                paymentData: tx.paymentData,
                operationType: tx.operationType,
              },
            })
          }
          allTransactions.push({
            id:              tx.id,
            accountId:       accId,
            date:            tx.date,
            transactionDate: tx.transactionDate ?? null,
            paymentDate:     tx.paymentDate ?? null,
            competenceDate:  tx.competenceDate ?? null,
            operationDate:   tx.operationDate ?? null,
            createdAt:       tx.createdAt ?? null,
            updatedAt:       tx.updatedAt ?? null,
            description:     tx.description ?? tx.descriptionRaw ?? '',
            descriptionRaw:  tx.descriptionRaw ?? null,
            amount:          tx.amount ?? 0,
            type:            tx.type,
            status:          tx.status,
            providerCode:    tx.providerCode ?? null,
            category:        categoryStr,
            categoryId:      categoryId,
            operationType:   tx.operationType ?? null,
            paymentData:     tx.paymentData ?? null,
            creditCardMetadata: tx.creditCardMetadata ?? null,
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

// ── Pluggy: investments (assets) ─────────────────────────────────────────────
app.post('/api/pluggy/investments', async (req, res) => {
  const { itemId } = req.body ?? {}
  if (!itemId) return res.status(400).json({ ok: false, error: 'itemId obrigatório' })
  try {
    const { apiKey, apiBase } = await pluggyGetApiKey()
    let page = 1
    const pageSize = 500
    const allInvestments = []
    while (true) {
      const url = new URL(`${apiBase}/investments`)
      url.searchParams.set('itemId', itemId)
      url.searchParams.set('pageSize', String(pageSize))
      url.searchParams.set('page', String(page))
      const r = await fetch(url.toString(), { headers: { 'X-API-KEY': apiKey } })
      if (!r.ok) {
        const text = await r.text()
        console.error('[pluggy] investments failed:', r.status, text.slice(0, 120))
        return res.status(502).json({ ok: false, error: `Pluggy investments falhou (${r.status})` })
      }
      const data = await r.json()
      const results = Array.isArray(data.results) ? data.results : []
      for (const inv of results) {
        allInvestments.push({
          id:               inv.id,
          itemId,
          name:             inv.name ?? inv.code ?? 'Investimento',
          code:             inv.code ?? null,
          type:             inv.type ?? null,
          subtype:          inv.subtype ?? null,
          currencyCode:     inv.currencyCode ?? 'BRL',
          balance:          inv.balance ?? inv.value ?? 0,
          quantity:         inv.quantity ?? null,
          lastMonthRate:    inv.lastMonthRate ?? null,
          lastTwelveMonthsRate: inv.lastTwelveMonthsRate ?? null,
          annualRate:       inv.annualRate ?? null,
          date:             inv.date ?? null,
          dueDate:          inv.dueDate ?? null,
          issuer:           inv.issuer ?? null,
          institutionName:  inv.institutionName ?? null,
          status:           inv.status ?? null,
          amount:           inv.amount ?? inv.initialAmount ?? null,
          amountProfit:     inv.amountProfit ?? null,
          amountOriginalCurrency: inv.amountOriginalCurrency ?? null,
          taxes:            inv.taxes ?? null,
          taxes2:           inv.taxes2 ?? null,
          fixedAnnualRate:  inv.fixedAnnualRate ?? null,
          isinCode:         inv.isinCode ?? null,
        })
      }
      if (results.length < pageSize) break
      page++
    }
    return res.json({ ok: true, investments: allInvestments })
  } catch (err) {
    console.error('[pluggy] investments error:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

// ── AI: transaction categorization ───────────────────────────────────────────
const MAX_CATEGORIZE_BATCH = 80

function buildCategorizationPrompt(transactions, categories, subCategories, rules) {
  const catList = categories.map(c => `${c.id} — ${c.name} (${c.classificationType})`).join('\n')
  const subList = subCategories.slice(0, 60).map(s => `${s.id} — ${s.name} (mac: ${s.macroCategoryId})`).join('\n')
  const ruleList = rules.slice(0, 30).map(r =>
    `pattern="${r.pattern}" → macro=${r.macroCategoryId}${r.subCategoryId ? ` sub=${r.subCategoryId}` : ''}`
  ).join('\n')

  const txLines = transactions.map(t => JSON.stringify({
    id: t.id,
    description: t.description,
    originalDescription: t.originalDescription,
    amount: t.amount,
    type: t.type,
    pluggyCategory: t.pluggyCategory,
    pluggyCategoryId: t.pluggyCategoryId,
    receiverName: t.pluggyReceiverName,
    payerName: t.pluggyPayerName,
    paymentMethod: t.paymentMethod,
  })).join('\n')

  return `Você é um classificador de transações financeiras familiares brasileiras.

CATEGORIAS DISPONÍVEIS (use apenas estes IDs):
${catList}

SUBCATEGORIAS DISPONÍVEIS (use apenas estes IDs):
${subList || '(nenhuma)'}

REGRAS JÁ APRENDIDAS (não repita, apenas considere o contexto):
${ruleList || '(nenhuma)'}

TRANSAÇÕES A CLASSIFICAR:
${txLines}

Responda APENAS com JSON válido, sem markdown, no formato:
{
  "suggestions": [
    {
      "id": "<id da transação>",
      "macroCategoryId": "<id>",
      "subCategoryId": "<id ou null>",
      "classificationType": "<tipo>",
      "tags": [],
      "confidence": "high|medium|low",
      "reason": "<motivo curto em pt-BR>",
      "rulePattern": "<texto para regra aprendida>"
    }
  ]
}

Regras obrigatórias:
- confidence "high" apenas quando certeza absoluta pelo nome do estabelecimento ou descrição clara.
- confidence "low" para ambíguos; não invente categoria.
- classificationType deve corresponder à macro escolhida.
- Para PIX/transferências entre contas: macroCategoryId="mac_movfin", classificationType="neutral".
- rulePattern: padrão normalizado (maiúsculas, sem acentos) para aprendizagem futura.
- Não inclua transações que não consegue classificar com segurança (omita-as).`
}

async function categorizeClaude(transactions, categories, subCategories, rules) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const model = process.env.CATEGORIZE_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'
  const content = buildCategorizationPrompt(transactions, categories, subCategories, rules)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') ?? ''
  return JSON.parse(text)
}

async function categorizeGPT(transactions, categories, subCategories, rules) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.CATEGORIZE_OPENAI_MODEL ?? 'gpt-4o-mini'
  const content = buildCategorizationPrompt(transactions, categories, subCategories, rules)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? '{}'
  return JSON.parse(text)
}

function extractFirstJsonBlock(text) {
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function validateSuggestions(suggestions, categories, subCategories) {
  const catIds = new Set(categories.map(c => c.id))
  const subIds = new Set(subCategories.map(s => s.id))
  const validConf = new Set(['high', 'medium', 'low'])
  return suggestions.filter(s => {
    if (!s || typeof s !== 'object') return false
    if (!catIds.has(s.macroCategoryId)) return false
    if (s.subCategoryId != null && s.subCategoryId !== '' && !subIds.has(s.subCategoryId)) return false
    if (!validConf.has(s.confidence)) return false
    return true
  })
}

async function categorizeOllama(transactions, categories, subCategories, rules) {
  const ollamaUrl   = process.env.OLLAMA_URL   ?? 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b'

  const userContent = buildCategorizationPrompt(transactions, categories, subCategories, rules)

  let res
  try {
    res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'Você categoriza transações financeiras pessoais e responde apenas JSON válido.',
          },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err) {
    throw Object.assign(
      new Error(`Ollama não respondeu em ${ollamaUrl}. Verifique se está rodando: ollama serve`),
      { ollamaUnavailable: true },
    )
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Ollama ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json()
  const rawText = data?.message?.content ?? data?.choices?.[0]?.message?.content ?? ''
  if (!rawText) throw new Error('Ollama retornou resposta vazia.')

  const parsed = extractFirstJsonBlock(rawText)
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('Ollama: resposta não é JSON válido no contrato esperado.')
  }

  parsed.suggestions = validateSuggestions(parsed.suggestions, categories, subCategories)
  return parsed
}

async function categorizeOpenRouter(transactions, categories, subCategories, rules) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model = process.env.CATEGORIZE_OPENROUTER_MODEL ?? 'anthropic/claude-haiku-4-5'
  const content = buildCategorizationPrompt(transactions, categories, subCategories, rules)

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'FIN Categorizador',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? '{}'
  return JSON.parse(text)
}

app.post('/api/ai/categorize-transactions', async (req, res) => {
  const hasClaude      = !!(process.env.ANTHROPIC_API_KEY)
  const hasGPT         = !!(process.env.OPENAI_API_KEY)
  const hasOpenRouter  = !!(process.env.OPENROUTER_API_KEY)

  const { transactions, categories, subCategories, rules } = req.body ?? {}

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ ok: false, error: 'transactions[] obrigatório e não vazio' })
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ ok: false, error: 'categories[] obrigatório' })
  }

  const batch = transactions.slice(0, MAX_CATEGORIZE_BATCH)
  const cats  = Array.isArray(categories)    ? categories    : []
  const subs  = Array.isArray(subCategories) ? subCategories : []
  const rls   = Array.isArray(rules)         ? rules         : []

  try {
    let result = null
    let provider = ''

    if (hasClaude) {
      result = await categorizeClaude(batch, cats, subs, rls)
      provider = 'claude'
    } else if (hasGPT) {
      result = await categorizeGPT(batch, cats, subs, rls)
      provider = 'gpt'
    } else if (hasOpenRouter) {
      result = await categorizeOpenRouter(batch, cats, subs, rls)
      provider = 'openrouter'
    } else {
      result = await categorizeOllama(batch, cats, subs, rls)
      provider = 'ollama'
    }

    if (!result || !Array.isArray(result.suggestions)) {
      return res.status(502).json({ ok: false, error: 'Resposta da IA não é válida.' })
    }

    return res.json({ ok: true, provider, suggestions: result.suggestions, processed: batch.length })
  } catch (err) {
    console.error('[ai/categorize] error:', err.message)
    if (err.ollamaUnavailable) {
      return res.status(503).json({
        ok: false,
        error: 'Nenhuma IA configurada. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY ou rode Ollama local (ollama serve).',
      })
    }
    return res.status(500).json({ ok: false, error: 'Erro ao chamar IA: ' + err.message })
  }
})

const VALID_PROVIDERS = ['mock', 'gpt', 'claude', 'openrouter']

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
    else if (provider === 'claude') result = await handleClaude(question, month, context)
    else result = await handleOpenRouter(question, month, context)

    // Controlled errors (missing key, quota) → 503
    if (result.error) return res.status(503).json(result)
    return res.json(result)
  } catch (err) {
    console.error('[advisor] error:', err.message)
    return res.status(500).json({ error: 'Erro interno ao consultar IA.', details: err.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString(), providers: getProviderStatus() }))

// ── Engine Financeira — persistência server-side (paths definidos após __dirname) ─

let ENGINE_FILE, AUDIT_FILE
// Serão inicializados em initEngineFiles() chamado após __dirname estar disponível

function readEngineConfig() {
  try { return JSON.parse(readFileSync(ENGINE_FILE, 'utf8')) } catch { return { version: 1, scopes: {} } }
}
function writeEngineConfig(data) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(ENGINE_FILE, JSON.stringify(data, null, 2))
}
function readAudit() {
  try { return JSON.parse(readFileSync(AUDIT_FILE, 'utf8')) } catch { return [] }
}
function appendAudit(entry) {
  mkdirSync(DATA_DIR, { recursive: true })
  const log = readAudit()
  log.unshift({ ...entry, id: Date.now().toString(36), changed_at: new Date().toISOString() })
  writeFileSync(AUDIT_FILE, JSON.stringify(log.slice(0, 500), null, 2))
}

// GET /api/engine/config — retorna toda config da engine
app.get('/api/engine/config', (_req, res) => res.json(readEngineConfig()))

// PUT /api/engine/config — salva toda config
app.put('/api/engine/config', (req, res) => {
  const data = req.body
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'body inválido' })
  writeEngineConfig({ ...data, updatedAt: new Date().toISOString() })
  res.json({ ok: true })
})

// PATCH /api/engine/config/:scope/:scopeId — atualiza uma regra específica + audit
app.patch('/api/engine/config/:scope/:scopeId', (req, res) => {
  const { scope, scopeId } = req.params
  const { config, note, flag, oldValue, newValue, scopeName } = req.body ?? {}
  const data = readEngineConfig()
  if (!data.scopes) data.scopes = {}
  if (!data.scopes[scope]) data.scopes[scope] = {}
  data.scopes[scope][scopeId] = { ...data.scopes[scope][scopeId], ...config, updatedAt: new Date().toISOString() }
  writeEngineConfig(data)
  appendAudit({ scope, scope_id: scopeId, scope_name: scopeName, flag, old_value: oldValue, new_value: newValue, note, origin: 'ui' })
  res.json({ ok: true })
})

// GET /api/engine/audit — últimas 200 entradas
app.get('/api/engine/audit', (_req, res) => res.json(readAudit().slice(0, 200)))

// ── Agente financeiro com tool use ────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FAMILY_ID    = process.env.FAMILY_ID

async function sbQuery(table, filters = {}, select = '*', limit = 2000) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase não configurado no servidor')
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&family_id=eq.${FAMILY_ID}&limit=${limit}&order=competence_date.desc`
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) url += `&${k}=${encodeURIComponent(v)}`
  }
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`)
  return res.json()
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fin_get_transactions',
      description: 'Lista lançamentos financeiros com filtros. Retorna totais de receita/despesa, contagens de revisão e sem categoria.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Mês YYYY-MM' },
          type: { type: 'string', enum: ['income', 'expense', 'any'] },
          needs_review: { type: 'boolean' },
          macro_category_id: { type: 'string' },
          text: { type: 'string', description: 'Busca na descrição' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_get_spending_insights',
      description: 'Detecta variações de gastos vs meses anteriores. Identifica categorias em alta, queda e oportunidades.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Mês YYYY-MM' },
          compare_months: { type: 'number', description: 'Meses de histórico (padrão 3)' },
        },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_get_budget_analysis',
      description: 'Analisa orçamento vs realizado por categoria com médias históricas.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Mês YYYY-MM' },
          compare_months: { type: 'number' },
        },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_get_reconciliation_status',
      description: 'Verifica pendências: movimentos internos não neutralizados, revisões, despesas pendentes.',
      parameters: {
        type: 'object',
        properties: { month: { type: 'string' } },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_suggest_category_changes',
      description: 'Cria um plano de reclassificação de lançamentos. Somente sugestão — não altera dados. Retorna plan_id para usar em fin_apply_category_changes.',
      parameters: {
        type: 'object',
        properties: {
          target_macro_category_id: { type: 'string', description: 'ID da macro-categoria destino (ex: mac_alimentacao)' },
          period: { type: 'string', description: 'Filtrar por mês (YYYY-MM)' },
          period_from: { type: 'string' },
          period_to: { type: 'string' },
          text_contains: { type: 'string', description: 'Filtrar por texto na descrição' },
          current_macro_category_id: { type: 'string', description: 'Filtrar por categoria atual' },
          reason: { type: 'string', description: 'Motivo da reclassificação' },
          skip_manual_overrides: { type: 'boolean' },
        },
        required: ['target_macro_category_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_apply_category_changes',
      description: 'ESCRITA — aplica um plano de reclassificação criado por fin_suggest_category_changes. Requer confirmed=true explícito para executar de fato.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'ID do plano retornado por fin_suggest_category_changes' },
          confirmed: { type: 'boolean', description: 'true para executar de verdade; false apenas simula sem alterar' },
        },
        required: ['plan_id', 'confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_update_transaction',
      description: 'ESCRITA — atualiza campos de um lançamento existente: categoria, descrição, notas, status, inclusão no resultado/orçamento, etc.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID do lançamento' },
          macro_category_id: { type: 'string' },
          category_id: { type: 'string' },
          sub_category_id: { type: 'string' },
          classification_type: { type: 'string' },
          description: { type: 'string' },
          notes: { type: 'string' },
          status: { type: 'string', enum: ['paid', 'pending', 'cancelled'] },
          include_in_operational_result: { type: 'boolean' },
          include_in_budget: { type: 'boolean' },
          needs_review: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_create_transaction',
      description: 'ESCRITA — cria um lançamento manual.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: 'number', description: 'Valor positivo' },
          type: { type: 'string', enum: ['income', 'expense'] },
          competence_date: { type: 'string', description: 'YYYY-MM-DD' },
          macro_category_id: { type: 'string' },
          classification_type: { type: 'string' },
          status: { type: 'string', enum: ['paid', 'pending'] },
          notes: { type: 'string' },
          account_id: { type: 'string' },
          payment_method: { type: 'string' },
        },
        required: ['description', 'amount', 'type', 'competence_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_delete_transaction',
      description: 'ESCRITA IRREVERSÍVEL — exclui um lançamento permanentemente. Requer confirm=true. Só use quando o usuário pedir explicitamente para excluir.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          confirm: { type: 'boolean', description: 'true para excluir de verdade' },
        },
        required: ['id', 'confirm'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_mark_neutral',
      description: 'ESCRITA — neutraliza lançamentos (transferências internas, pagamento de fatura, etc.), excluindo-os do resultado operacional.',
      parameters: {
        type: 'object',
        properties: {
          transaction_ids: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['transaction_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_get_budgets',
      description: 'Lista orçamentos de um mês.',
      parameters: {
        type: 'object',
        properties: { month: { type: 'string' } },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_set_budget',
      description: 'ESCRITA — define ou atualiza o orçamento de uma categoria para um mês.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string' },
          macro_category_id: { type: 'string' },
          amount: { type: 'number', description: 'Valor planejado em reais' },
        },
        required: ['month', 'macro_category_id', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_copy_budget',
      description: 'ESCRITA — copia o orçamento de um mês para outro.',
      parameters: {
        type: 'object',
        properties: {
          from_month: { type: 'string' },
          to_month: { type: 'string' },
        },
        required: ['from_month', 'to_month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_get_categories',
      description: 'Lista todas as macro-categorias e subcategorias disponíveis.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fin_create_subcategory',
      description: 'ESCRITA — cria uma nova subcategoria.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          macro_category_id: { type: 'string' },
          essentiality: { type: 'string', enum: ['essential', 'non_essential', 'inherit'] },
        },
        required: ['name', 'macro_category_id'],
      },
    },
  },
]

async function executeTool(name, args) {
  const res = await fetch('http://localhost:3010/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
  })
  if (!res.ok) throw new Error(`MCP ${name}: ${res.status}`)
  const text = await res.text()
  // Streamable HTTP may return SSE lines or plain JSON
  const jsonLine = text.split('\n').find(l => l.startsWith('data:'))
  const parsed = jsonLine ? JSON.parse(jsonLine.slice(5).trim()) : JSON.parse(text)
  return parsed.result?.content?.[0]?.text ?? JSON.stringify(parsed.result)
}

const AGENT_SYSTEM = `Você é o Economista FIN — assistente financeiro pessoal integrado ao FINFVC, operando como parte do Arquiteto do Segundo Cérebro.
Você tem acesso direto aos dados financeiros reais via tools, tanto de leitura quanto de escrita.
Responda em português do Brasil. Use os tools para buscar dados reais antes de responder.
Seja direto: fatos → análise → recomendação.

## Autonomia para executar ajustes

Quando o usuário pedir explicitamente para ajustar algo (reclassificar lançamento, corrigir categoria, marcar como neutro, atualizar orçamento, criar lançamento manual etc.), execute o ajuste usando as tools de escrita — não se limite a sugerir. Não peça confirmação extra por texto quando o pedido do usuário já é a confirmação.

Regras obrigatórias:
- Nunca invente valores, IDs ou dados que não vieram de uma tool.
- Para reclassificação em massa, use fin_suggest_category_changes primeiro para ver o plano, depois fin_apply_category_changes com confirmed=true para executar.
- fin_delete_transaction é irreversível — só use quando o usuário pedir explicitamente para excluir/apagar, nunca como parte de uma reclassificação.
- Depois de executar qualquer escrita, confirme ao usuário exatamente o que mudou (quantos registros, de qual valor/categoria para qual).
- Se o pedido for ambíguo sobre qual lançamento/categoria/mês, pergunte antes de agir — não adivinhe.`

app.post('/api/agent', async (req, res) => {
  const { question, month } = req.body ?? {}
  if (!question) return res.status(400).json({ error: 'question obrigatória' })
  if (!month) return res.status(400).json({ error: 'month obrigatório (YYYY-MM)' })
  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Nenhuma API key configurada' })
  }

  const messages = [
    { role: 'system', content: AGENT_SYSTEM },
    { role: 'user', content: `Mês de referência: ${month}\n\nPergunta: ${question}` },
  ]

  try {
    // Agentic loop: max 5 iterations
    for (let i = 0; i < 5; i++) {
      const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
      const baseUrl = process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1'
      const model = process.env.OPENAI_API_KEY
        ? (process.env.ADVISOR_OPENAI_MODEL || 'gpt-4o-mini')
        : (process.env.ADVISOR_OPENROUTER_MODEL || 'anthropic/claude-haiku-4-5')

      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools: AGENT_TOOLS, tool_choice: 'auto', max_tokens: 2000 }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        return res.status(503).json({ error: err.error?.message ?? `API error ${r.status}` })
      }
      const data = await r.json()
      const choice = data.choices?.[0]
      messages.push(choice.message)

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        return res.json({ answer: choice.message.content ?? '', provider: 'agent' })
      }

      // Execute tool calls
      for (const tc of choice.message.tool_calls) {
        let toolResult
        try {
          toolResult = await executeTool(tc.function.name, JSON.parse(tc.function.arguments))
        } catch (e) {
          toolResult = `Erro ao executar ${tc.function.name}: ${e.message}`
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult })
      }
    }
    return res.json({ answer: 'Análise concluída — dados processados.', provider: 'agent' })
  } catch (err) {
    console.error('[agent] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── Pluggy connections file backup (survives localStorage wipe) ──────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '.data')
const CONNECTIONS_FILE = join(DATA_DIR, 'pluggy-connections.json')
ENGINE_FILE = join(DATA_DIR, 'engine-config.json')
AUDIT_FILE  = join(DATA_DIR, 'engine-audit.json')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

app.post('/api/pluggy/backup-connections', (req, res) => {
  const connections = req.body?.connections
  if (!Array.isArray(connections) || connections.length === 0) {
    return res.status(400).json({ ok: false, error: 'connections array vazio ou ausente' })
  }
  try {
    ensureDataDir()
    writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), 'utf-8')
    console.log(`[pluggy] backup saved: ${connections.length} connection(s) → ${CONNECTIONS_FILE}`)
    return res.json({ ok: true, count: connections.length })
  } catch (err) {
    console.error('[pluggy] backup write error:', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/pluggy/backup-connections', (_req, res) => {
  try {
    if (!existsSync(CONNECTIONS_FILE)) {
      return res.json({ ok: true, connections: [], source: 'none' })
    }
    const raw = readFileSync(CONNECTIONS_FILE, 'utf-8')
    const connections = JSON.parse(raw)
    if (!Array.isArray(connections)) {
      return res.json({ ok: true, connections: [], source: 'invalid' })
    }
    return res.json({ ok: true, connections, source: 'file' })
  } catch (err) {
    console.error('[pluggy] backup read error:', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
})

app.listen(PORT, HOST, () => {
  const s = getProviderStatus()
  console.log(`[advisor] http://${HOST}:${PORT}`)
  console.log(`[advisor] GPT:    ${s.gpt ? '✓ configurado' : '✗ OPENAI_API_KEY ausente'}`)
  console.log(`[advisor] Claude: ${s.claude ? '✓ configurado' : '✗ ANTHROPIC_API_KEY ausente'}`)
  const pluggyOk = !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
  console.log(`[advisor] Pluggy: ${pluggyOk ? '✓ configurado' : '✗ PLUGGY_CLIENT_SECRET ausente'}`)
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[advisor] ERRO: porta ${PORT} já está em uso.`)
    console.error(`[advisor] O servidor pode já estar rodando. Verifique:`)
    console.error(`[advisor]   lsof -ti:${PORT}`)
    console.error(`[advisor]   kill $(lsof -ti:${PORT})`)
    process.exit(1)
  }
  console.error('[advisor] Erro ao iniciar servidor:', err.message)
  process.exit(1)
})

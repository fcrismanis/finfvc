/**
 * AI Advisor service.
 *
 * SECURITY: Never call OpenAI/Anthropic APIs directly from the browser with a key.
 * Architecture:
 *   1. Frontend builds a context payload (month summary, categories, etc.)
 *   2. Frontend sends to backend: POST /api/advisor { prompt, context }
 *   3. Backend holds the API key, builds system prompt, calls Claude/GPT
 *   4. Backend streams response back to frontend
 *
 * See docs/ai-advisor-integration.md for full setup guide.
 */

export type AIProvider = 'simulated' | 'gpt' | 'claude' | 'openrouter' | 'custom'

export interface CustomLLMConfig {
  url: string          // e.g. http://localhost:11434/api/chat ou qualquer endpoint compatível
  apiKey?: string      // opcional
  model?: string       // opcional, ex: "llama3", "mixtral", etc.
}

const CUSTOM_LLM_CONFIG_KEY = 'fin_custom_llm_config'

export function loadCustomLLMConfig(): CustomLLMConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_LLM_CONFIG_KEY)
    return raw ? JSON.parse(raw) : { url: '', apiKey: '', model: '' }
  } catch { return { url: '', apiKey: '', model: '' } }
}

export function saveCustomLLMConfig(cfg: CustomLLMConfig) {
  localStorage.setItem(CUSTOM_LLM_CONFIG_KEY, JSON.stringify(cfg))
}

export interface AdvisorContext {
  month: string
  operationalIncome: number
  totalExpenses: number
  operationalResult: number
  savingsRate: number
  topCategories: { name: string; amount: number; color?: string }[]
  pendingAmount?: number
}

export interface AdvisorMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AdvisorResponse {
  answer: string
  provider: AIProvider
}

export async function askAdvisor(
  prompt: string,
  context: AdvisorContext,
  provider: AIProvider = 'simulated',
): Promise<AdvisorResponse> {
  if (provider === 'simulated') {
    return simulatedResponse(prompt, context)
  }

  if (provider === 'custom') {
    return askCustomLLM(prompt, context)
  }

  // gpt / claude / openrouter → secure backend; keys never in browser
  let res: Response
  try {
    res = await fetch('/api/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        question: prompt,
        month: context.month,
        context: { summary: context, transactions: [], budget: {} },
      }),
    })
  } catch {
    throw new Error('Não foi possível conectar ao backend. Inicie o servidor com: cd server && npm run dev')
  }

  let body: { answer?: string; error?: string; details?: string; warnings?: string[] }
  try {
    body = await res.json()
  } catch {
    throw new Error(`Resposta inválida do backend (HTTP ${res.status})`)
  }
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `Erro ${res.status} no endpoint /api/advisor`)
  }
  return { answer: body.answer ?? '', provider }
}

// ── Endpoint LLM personalizado ──────────────────────────────────────────────
function buildSystemPrompt(ctx: AdvisorContext): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const cats = ctx.topCategories.slice(0, 8).map((c, i) => `${i + 1}. ${c.name}: R$ ${fmt(c.amount)}`).join('\n')
  return `Você é o Arquiteto do Segundo Cérebro, consultor financeiro pessoal da família. Analise os dados abaixo e responda de forma direta, em português do Brasil.

DADOS DO MÊS ${ctx.month}:
- Receita operacional: R$ ${fmt(ctx.operationalIncome)}
- Despesas totais: R$ ${fmt(ctx.totalExpenses)}
- Resultado: ${ctx.operationalResult >= 0 ? '+' : ''}R$ ${fmt(ctx.operationalResult)}
- Margem familiar: ${(ctx.savingsRate * 100).toFixed(1)}%
${ctx.pendingAmount ? `- Compromissos pendentes: R$ ${fmt(ctx.pendingAmount)}` : ''}

TOP CATEGORIAS DE DESPESA:
${cats}

Seja objetivo, use dados reais acima. Formate usando markdown quando útil.`
}

async function askCustomLLM(prompt: string, context: AdvisorContext): Promise<AdvisorResponse> {
  const cfg = loadCustomLLMConfig()
  if (!cfg.url.trim()) {
    throw new Error('URL do endpoint personalizado não configurada. Configure em Configurações > Consultor IA.')
  }

  const systemPrompt = buildSystemPrompt(context)

  // Tenta formato OpenAI-compatible (funciona com Ollama, LM Studio, OpenRouter, etc.)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`

  const body = {
    model: cfg.model || 'llama3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    stream: false,
  }

  let res: Response
  try {
    res = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch (e) {
    throw new Error(`Não foi possível conectar ao endpoint em ${cfg.url}. Verifique se o serviço está rodando.`)
  }

  const text = await res.text()
  if (!text.trim()) throw new Error('Endpoint retornou resposta vazia.')

  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch { throw new Error(`Resposta inválida do endpoint: ${text.slice(0, 200)}`) }

  // Suporte a formato OpenAI (choices[0].message.content) e Ollama (message.content)
  const answer =
    (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ??
    (data as { message?: { content?: string } }).message?.content ??
    (data as { response?: string }).response ??
    String(data)

  return { answer, provider: 'custom' }
}

function simulatedResponse(prompt: string, ctx: AdvisorContext): Promise<AdvisorResponse> {
  const q = prompt.toLowerCase()
  const result = ctx.operationalResult
  const margin = (ctx.savingsRate * 100).toFixed(1)
  const topCat = ctx.topCategories[0]

  let answer: string

  if (q.includes('resultado') || q.includes('saldo') || q.includes('sobr')) {
    answer = result >= 0
      ? `Em ${ctx.month} o resultado operacional foi **positivo: R$ ${fmt(result)}** (margem ${margin}%). Isso significa que as receitas superaram as despesas — bom sinal! ${topCat ? `A maior categoria foi ${topCat.name} com R$ ${fmt(topCat.amount)}.` : ''}`
      : `Em ${ctx.month} o resultado operacional foi **negativo: −R$ ${fmt(Math.abs(result))}** (margem ${margin}%). As despesas superaram as receitas. ${topCat ? `A maior categoria foi ${topCat.name} com R$ ${fmt(topCat.amount)}.` : ''} Recomendo revisar os lançamentos de alto valor.`
  } else if (q.includes('categori') || q.includes('gast') || q.includes('despesa')) {
    const cats = ctx.topCategories.slice(0, 3).map(c => `${c.name} (R$ ${fmt(c.amount)})`).join(', ')
    answer = `As maiores categorias de despesa em ${ctx.month} foram: **${cats || 'sem dados'}**. ${result < 0 ? 'Como o resultado está negativo, vale revisar se alguma dessas categorias tem gastos acima do habitual.' : 'O resultado está positivo, mas sempre vale verificar se as categorias de lazer e compras estão dentro do planejado.'}`
  } else if (q.includes('margin') || q.includes('poupan') || q.includes('invest')) {
    answer = `Sua margem familiar em ${ctx.month} foi de **${margin}%** sobre a receita. ${
      parseFloat(margin) >= 20
        ? 'Excelente! Uma margem acima de 20% indica boa saúde financeira e capacidade de investimento.'
        : parseFloat(margin) >= 10
        ? 'Razoável. Meta recomendada: 20%+ de margem para garantir reserva e investimentos.'
        : 'Abaixo do ideal. Tente identificar despesas que podem ser reduzidas para aumentar a margem.'
    }`
  } else if (q.includes('orçamento') || q.includes('planej') || q.includes('corte') || q.includes('meta')) {
    answer = `Para equilibrar o orçamento em ${ctx.month}, sugiro: (1) verificar se há assinaturas ou compras recorrentes que podem ser renegociadas; (2) comparar as despesas de lazer e compras com os meses anteriores; (3) definir um teto por categoria no Orçamento antes do início do próximo mês.`
  } else if (q.includes('pendente') || q.includes('futuro')) {
    const pending = ctx.pendingAmount ?? 0
    answer = pending > 0
      ? `Há **R$ ${fmt(pending)}** em lançamentos pendentes para ${ctx.month}. Esses compromissos futuros ainda não foram confirmados como pagos — revise em Lançamentos para confirmar quais são reais.`
      : `Não há lançamentos pendentes relevantes identificados em ${ctx.month}.`
  } else {
    answer = `Pergunta registrada: *"${prompt}"*\n\n**Modo simulado ativo** — para respostas reais de IA, configure o endpoint \`/api/advisor\` no backend com sua chave do Claude ou GPT. Ver \`docs/ai-advisor-integration.md\`.\n\nPosso analisar: resultado operacional, maiores categorias, margem familiar, pendentes e comparativos de orçamento.`
  }

  return Promise.resolve({ answer, provider: 'simulated' })
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const SUGGESTED_PROMPTS = [
  'Como está meu resultado operacional este mês?',
  'Quais categorias estão consumindo mais que o previsto?',
  'Como está minha margem familiar em relação aos últimos 3 meses?',
  'Sugira metas de corte para equilibrar o orçamento.',
  'Estou priorizando investimentos o suficiente?',
  'Quais compromissos pendentes tenho este mês?',
]

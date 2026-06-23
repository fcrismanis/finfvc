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

export type AIProvider = 'simulated' | 'gpt' | 'claude' | 'openrouter'

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

  // gpt / claude → secure backend; keys never in browser
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

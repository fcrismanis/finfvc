/**
 * AI Advisor service stub.
 *
 * IMPORTANT: Do NOT call OpenAI/Anthropic/Claude directly from the frontend
 * with an API key. API keys must stay server-side.
 *
 * Architecture for production:
 *   1. Create a backend endpoint (edge function / serverless)
 *   2. That endpoint receives the user prompt + financial context
 *   3. Builds the Claude/GPT system prompt with the context
 *   4. Returns the streamed response to the frontend
 *
 * Example endpoint: POST /api/advisor  { prompt, context }
 */

export interface AdvisorContext {
  month: string
  operationalIncome: number
  totalExpenses: number
  operationalResult: number
  savingsRate: number
  topCategories: { name: string; amount: number }[]
}

export interface AdvisorResponse {
  answer: string
  suggestedPrompts?: string[]
}

export async function askAdvisor(_prompt: string, _context: AdvisorContext): Promise<AdvisorResponse> {
  // TODO: call your backend/edge function
  // e.g. POST /api/advisor { prompt, context }
  throw new Error('Backend endpoint not implemented yet. See services/aiAdvisor.service.ts for instructions.')
}

export const SUGGESTED_PROMPTS = [
  'Por que meu resultado operacional caiu este mês?',
  'Quais categorias estão consumindo mais que o previsto?',
  'Como está minha margem familiar em relação aos últimos 3 meses?',
  'Sugira metas de corte para equilibrar o orçamento.',
  'Estou priorizando investimentos o suficiente?',
  'Quais compromissos fixos posso renegociar?',
]

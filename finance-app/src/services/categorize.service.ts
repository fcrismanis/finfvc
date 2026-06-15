import type { Transaction, ClassificationType } from '../types'

interface CategorySuggestion {
  categoryId: string
  macroCategoryId: string
  classificationType: ClassificationType
  confidence: 'high' | 'medium'
  reason: string
  subCategoryId?: string
}

interface Rule {
  patterns: RegExp[]
  categoryId: string
  macroCategoryId: string
  classificationType: ClassificationType
  confidence: 'high' | 'medium'
  reason: string
}

const RULES: Rule[] = [
  // Alimentação
  { patterns: [/supermercado|mercado|atacad|carrefour|extra\b|assaí|atacadão|dia\b|hortifruti/i],
    categoryId: 'cat_alimentacao', macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', confidence: 'high', reason: 'Supermercado' },
  { patterns: [/restaurante|lanchonete|hamburger|mcdonalds|bob'?s|subway|madero|coxinha|sushi|pizza|ifood|rappi|delivery|uber.?eat/i],
    categoryId: 'cat_restaurantes', macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', confidence: 'high', reason: 'Restaurante/Delivery' },
  { patterns: [/padaria|paes|confeitaria|cafe\b|cafeteria/i],
    categoryId: 'cat_padaria', macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', confidence: 'high', reason: 'Padaria/Café' },
  { patterns: [/acougue|frigorífico|carnes\b/i],
    categoryId: 'cat_acougue', macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', confidence: 'high', reason: 'Açougue' },
  { patterns: [/suplemento|whey|creatina|proteina/i],
    categoryId: 'cat_suplementos', macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', confidence: 'high', reason: 'Suplemento' },

  // Casa
  { patterns: [/aluguel|prestacao|financiamento.?imov|hipoteca/i],
    categoryId: 'cat_prestacao', macroCategoryId: 'mac_casa', classificationType: 'operational_expense', confidence: 'high', reason: 'Aluguel/Prestação' },
  { patterns: [/energia|eletricidade|celesc|cemig|copel|light\b|enel|cpfl|comlurb|saneamento|sabesp|embasa|cedae|agua\b|gas\b|cgas|comgas|naturgy/i],
    categoryId: 'cat_contas', macroCategoryId: 'mac_casa', classificationType: 'operational_expense', confidence: 'high', reason: 'Conta de consumo' },
  { patterns: [/iptu\b/i],
    categoryId: 'cat_iptu', macroCategoryId: 'mac_casa', classificationType: 'operational_expense', confidence: 'high', reason: 'IPTU' },
  { patterns: [/manutencao|reforma|construcao|eletricista|encanador|pintura|obra\b/i],
    categoryId: 'cat_manutencao_casa', macroCategoryId: 'mac_casa', classificationType: 'operational_expense', confidence: 'medium', reason: 'Manutenção' },

  // Saúde
  { patterns: [/farmacia|drogaria|droga\b|ultrafarma|drogasil|pacheco|panvel/i],
    categoryId: 'cat_farmacia', macroCategoryId: 'mac_saude', classificationType: 'operational_expense', confidence: 'high', reason: 'Farmácia' },
  { patterns: [/academia|smartfit|bluefit|bodytech|crossfit|gym\b|fitness/i],
    categoryId: 'cat_academias', macroCategoryId: 'mac_saude', classificationType: 'operational_expense', confidence: 'high', reason: 'Academia' },

  // Transporte
  { patterns: [/combustivel|gasolina|etanol|diesel|posto\b|shell|ipiranga|petrobras\b|br.?dist/i],
    categoryId: 'cat_combustivel', macroCategoryId: 'mac_transporte', classificationType: 'operational_expense', confidence: 'high', reason: 'Combustível' },
  { patterns: [/estacionamento|sem.?parar|estapar|estapark|veloe\b|parking/i],
    categoryId: 'cat_estacionamento', macroCategoryId: 'mac_transporte', classificationType: 'operational_expense', confidence: 'high', reason: 'Estacionamento' },

  // Assinaturas
  { patterns: [/spotify\b/i],
    categoryId: 'cat_spotify', macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense', confidence: 'high', reason: 'Spotify' },
  { patterns: [/openai|anthropic|claude\b|chatgpt|github.?copilot|cursor\b|notion\b|figma\b|adobe\b/i],
    categoryId: 'cat_ia', macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense', confidence: 'high', reason: 'IA/Produtividade' },
  { patterns: [/netflix|amazon.?prime|disney|hbo|max\b|globoplay|telecine|paramount/i],
    categoryId: 'cat_ia', macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense', confidence: 'medium', reason: 'Streaming' },

  // Compras
  { patterns: [/mercado.?livre|mercadolivre|shopee|amazon\b/i],
    categoryId: 'cat_ml', macroCategoryId: 'mac_compras', classificationType: 'operational_expense', confidence: 'high', reason: 'Marketplace' },

  // Receitas
  { patterns: [/salario|pagamento.?sal|folha/i],
    categoryId: 'cat_salario', macroCategoryId: 'mac_receita_op', classificationType: 'operational_income', confidence: 'high', reason: 'Salário' },

  // Movimentação financeira
  { patterns: [/transferencia|pix\b|ted\b|doc\b|entre.?contas/i],
    categoryId: 'cat_resgate', macroCategoryId: 'mac_movfin', classificationType: 'neutral', confidence: 'medium', reason: 'Transferência/PIX' },
]

export function suggestCategory(tx: Transaction): CategorySuggestion | null {
  if (tx.categoryId) return null  // already categorized

  const text = `${tx.description} ${tx.originalDescription}`.toLowerCase()

  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(text))) {
      // Skip income rules for expense transactions and vice-versa
      const isIncomeRule = rule.classificationType === 'operational_income' || rule.classificationType === 'extraordinary_income'
      if (isIncomeRule && tx.type !== 'income') continue
      if (!isIncomeRule && tx.type !== 'expense') continue
      return {
        categoryId:         rule.categoryId,
        macroCategoryId:    rule.macroCategoryId,
        classificationType: rule.classificationType,
        confidence:         rule.confidence,
        reason:             rule.reason,
      }
    }
  }
  return null
}

export function suggestCategories(transactions: Transaction[]): Map<string, CategorySuggestion> {
  const result = new Map<string, CategorySuggestion>()
  for (const tx of transactions) {
    if (tx.categoryId) continue
    const suggestion = suggestCategory(tx)
    if (suggestion) result.set(tx.id, suggestion)
  }
  return result
}

export function suggestCategoryWithHistory(
  tx: Transaction,
  existingTxs: Transaction[],
): CategorySuggestion | null {
  if (tx.categoryId || tx.macroCategoryId) return null

  const descUpper = tx.description.trim().toUpperCase()
  const origUpper = (tx.originalDescription ?? '').trim().toUpperCase()

  for (const existing of existingTxs) {
    if (!existing.macroCategoryId || existing.needsReview || existing.id === tx.id) continue
    if (existing.type !== tx.type) continue
    const eDesc = existing.description.trim().toUpperCase()
    const eOrig = (existing.originalDescription ?? '').trim().toUpperCase()
    if (eDesc === descUpper || eOrig === origUpper || (descUpper.length > 8 && eDesc === descUpper)) {
      return {
        categoryId: existing.categoryId ?? '',
        macroCategoryId: existing.macroCategoryId,
        classificationType: existing.classificationType,
        confidence: 'high',
        reason: 'Histórico: mesma descrição já categorizada',
        subCategoryId: existing.subCategoryId,
      }
    }
  }

  return suggestCategory(tx)
}

export function buildClipboardPrompt(txs: Transaction[]): string {
  const lines = txs
    .slice(0, 60)
    .map(t => `- ${t.transactionDate} | ${t.type === 'income' ? '+' : '-'}R$${t.amount.toFixed(2)} | ${t.description}`)
    .join('\n')

  return `Categorize as transações abaixo em grupos: Alimentação, Casa, Saúde, Transporte, Assinaturas, Compras, Dívida, Receita Operacional, Receita Eventual, Neutro/Transferência.\n\nResposta: JSON com { id (desc hash), categoria }.\n\n${lines}`
}

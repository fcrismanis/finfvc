import { MACRO_CATEGORIES } from '../config/categories'
import { normalizeText } from './categoryRules.service'
import { getAllCategories } from './financeCategories.service'
import { loadSubCategories } from './subcategory.service'

export type FinanceCommandIntent =
  | 'bulk_categorize'
  | 'bulk_subcategorize'
  | 'create_category'
  | 'create_subcategory'
  | 'create_rule'
  | 'mark_neutral'
  | 'mark_income'
  | 'mark_expense'
  | 'tag_transactions'
  | 'find_transactions'
  | 'undo_last'
  | 'undo_command'
  | 'unknown'

export type FinanceCommandPlan = {
  id: string
  originalPrompt: string
  intent: FinanceCommandIntent
  filters: {
    descriptionContains?: string[]
    accountContains?: string[]
    categoryContains?: string[]
    subCategoryContains?: string[]
    amountMin?: number
    amountMax?: number
    dateFrom?: string
    dateTo?: string
    type?: 'income' | 'expense' | 'transfer' | 'any'
    onlyUncategorized?: boolean
  }
  actions: {
    categoryName?: string
    categoryId?: string
    createCategoryIfMissing?: boolean
    subCategoryName?: string
    subCategoryId?: string
    createSubCategoryIfMissing?: boolean
    classificationType?: string
    tagsToAdd?: string[]
    createRule?: boolean
    rulePattern?: string
  }
  executionMode: 'apply_immediately' | 'preview_optional'
}

function newPlanId(): string {
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function cleanValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').trim()
}

function cleanNeedle(value: string): string {
  return cleanValue(value).replace(/^(?:que\s+)?(?:tiver(?:em)?|tenha(?:m)?)\s+/i, '').trim()
}

function splitCategoryPath(raw: string): { categoryName: string; subCategoryName?: string } {
  const parts = raw.split('/').map(part => cleanValue(part)).filter(Boolean)
  return {
    categoryName: parts[0] ?? raw.trim(),
    subCategoryName: parts[1],
  }
}

function inferTypeFromTarget(target: string): 'income' | 'expense' | 'transfer' | 'any' {
  const norm = normalizeText(target)
  if (norm.includes('SALARIO') || norm.includes('RECEITA')) return 'income'
  if (norm.includes('TRANSFER') || norm.includes('MOVIMENT')) return 'transfer'
  return 'expense'
}

function findExistingNames(target: { categoryName?: string; subCategoryName?: string }) {
  const categories = getAllCategories()
  const subCategories = loadSubCategories()
  const category = target.categoryName
    ? categories.find(item => normalizeText(item.name) === normalizeText(target.categoryName!))
    : undefined
  const macro = target.categoryName
    ? MACRO_CATEGORIES.find(item => normalizeText(item.name) === normalizeText(target.categoryName!))
    : undefined
  const subCategory = target.subCategoryName
    ? subCategories.find(item => normalizeText(item.name) === normalizeText(target.subCategoryName!))
    : undefined
  return { category, macro, subCategory }
}

export function buildFinanceCommandPlan(prompt: string): FinanceCommandPlan {
  const originalPrompt = prompt.trim()
  const plan: FinanceCommandPlan = {
    id: newPlanId(),
    originalPrompt,
    intent: 'unknown',
    filters: { type: 'any' },
    actions: {},
    executionMode: 'apply_immediately',
  }

  if (!originalPrompt) return plan

  const lower = originalPrompt.toLowerCase()
  if (/(desfazer|reverter|voltar ao estado anterior)/.test(lower)) {
    plan.intent = /(últim|ultimo)/.test(lower) ? 'undo_last' : 'undo_command'
    const match = originalPrompt.match(/(?:comando|ação|alteração)\s+(?:da|do|de)\s+(.+)$/i)
    if (match) plan.filters.descriptionContains = [cleanValue(match[1])]
    return plan
  }

  const directAssignPatterns = [
    /(?:quero que\s+)?(?:tudo\s+que\s+tiver|o\s+que\s+tiver|se\s+tiver|quando\s+tiver|todas?\s+as?\s+descri(?:c|ç)(?:ões|oes)?\s+que\s+tiverem|descri(?:c|ç)(?:ão|ao)\s+contendo|descri(?:c|ç)(?:ões|oes)\s+que\s+contenham)\s+(.+?)\s+(?:coloque\s+(?:em|como)|considere\s+como|considere|seja(?:m)?|sejam?\s+consideradas?\s+como|classifique\s+como|classifique|marque\s+como|marque)\s+(.+)/i,
    /(?:quero que\s+)?(.+?)\s+(?:coloque\s+(?:em|como)|considere\s+como|considere|seja(?:m)?|classifique\s+como|classifique|marque\s+como|marque)\s+(.+)/i,
    /(.+?)\s+deve ser\s+(.+)/i,
  ]

  for (const pattern of directAssignPatterns) {
    const match = originalPrompt.match(pattern)
    if (!match) continue
    const needle = cleanNeedle(match[1])
    if (!needle) continue
    const target = splitCategoryPath(cleanValue(match[2]))
    const existing = findExistingNames(target)
    plan.intent = target.subCategoryName ? 'bulk_subcategorize' : 'bulk_categorize'
    plan.filters.descriptionContains = [needle]
    plan.filters.type = inferTypeFromTarget(target.categoryName)
    plan.actions.categoryName = target.categoryName
    plan.actions.subCategoryName = target.subCategoryName
    plan.actions.categoryId = existing.category?.id
    plan.actions.subCategoryId = existing.subCategory?.id
    plan.actions.createCategoryIfMissing = !existing.category && !existing.macro
    plan.actions.createSubCategoryIfMissing = Boolean(target.subCategoryName && !existing.subCategory)
    plan.actions.classificationType = existing.category?.classificationType ?? existing.macro?.classificationType
    plan.actions.createRule = true
    plan.actions.rulePattern = needle
    return plan
  }

  if (/encontre|busque|mostre/.test(lower)) {
    const match = originalPrompt.match(/(?:encontre|busque|mostre).+?(?:com|que tenha|que tiver)\s+(.+)/i)
    plan.intent = 'find_transactions'
    plan.executionMode = 'preview_optional'
    if (match) plan.filters.descriptionContains = [cleanValue(match[1])]
    return plan
  }

  return plan
}

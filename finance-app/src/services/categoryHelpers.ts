import type { MacroCategory, Category, BudgetClassification } from '../types'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { loadCustomCategories } from './financeCategories.service'
import { loadCustomMacroCategories } from './financeParentCategories.service'

// Generic weights — lower = less specific
const LOW_WEIGHT_KEYWORDS = new Set([
  'pagamento', 'boleto', 'pix', 'compra', 'débito', 'crédito',
  'payment', 'transfer', 'debit', 'credit',
])

function kwWeight(kw: string): number {
  const normalized = kw.toLowerCase().trim()
  if (LOW_WEIGHT_KEYWORDS.has(normalized)) return 1
  if (normalized.length <= 4) return 2
  if (normalized.length <= 8) return 4
  return 6
}

interface KeywordMatch {
  macroCategoryId: string
  categoryId?: string
  score: number
  reason: string
}

export function matchCategoryByKeywords(
  description: string,
  macros?: MacroCategory[],
  cats?: Category[],
): KeywordMatch | null {
  const allMacros = macros ?? [...MACRO_CATEGORIES, ...loadCustomMacroCategories()]
  const allCats = cats ?? [...CATEGORIES, ...loadCustomCategories()]
  const text = description.toUpperCase()
  let best: KeywordMatch | null = null

  // Check subcategory keywords first (higher priority)
  for (const cat of allCats) {
    if (!cat.active) continue
    const kws = cat.keywords ?? []
    for (const kw of kws) {
      if (!kw.trim()) continue
      if (text.includes(kw.toUpperCase())) {
        const score = kwWeight(kw) + 2 // +2 = subcategory bonus
        if (!best || score > best.score) {
          best = { macroCategoryId: cat.macroCategoryId, categoryId: cat.id, score, reason: kw }
        }
      }
    }
  }

  // Then check parent category keywords
  for (const macro of allMacros) {
    if (macro.tabType === 'none') continue
    const kws = macro.keywords ?? []
    for (const kw of kws) {
      if (!kw.trim()) continue
      if (text.includes(kw.toUpperCase())) {
        const score = kwWeight(kw)
        if (!best || score > best.score) {
          best = { macroCategoryId: macro.id, score, reason: kw }
        }
      }
    }
  }

  return best
}

export function getEffectiveBudgetClassification(
  item: MacroCategory | Category,
  parent?: MacroCategory,
): BudgetClassification {
  const bc = item.budgetClassification
  if (bc && bc !== 'none') return bc

  // If category has no classification, inherit from parent macro
  if (parent) {
    const pbc = parent.budgetClassification
    if (pbc && pbc !== 'none') return pbc
  }

  return 'none'
}

export const BUDGET_CLASSIFICATION_LABELS: Record<BudgetClassification, string> = {
  essential: 'Essencial',
  non_essential: 'Não essencial',
  none: 'Sem classificação',
}

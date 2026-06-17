import type { MacroCategory, Category, SubCategory, BudgetClassification } from '../types'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { loadCustomCategories } from './financeCategories.service'
import { loadCustomMacroCategories } from './financeParentCategories.service'

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

function scoreToConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function loadSubCategories(): SubCategory[] {
  try {
    const raw = localStorage.getItem('finance_subcategories')
    return raw ? (JSON.parse(raw) as SubCategory[]) : []
  } catch {
    return []
  }
}

export interface KeywordCategoryMatch {
  macroCategoryId: string
  categoryId?: string
  subCategoryId?: string
  confidence: 'high' | 'medium' | 'low'
  matchedKeyword: string
  matchedOn: 'subcategory' | 'category' | 'macro'
  reason: string
}

export function matchCategoryByKeywords(
  description: string,
  macros?: MacroCategory[],
  cats?: Category[],
  subs?: SubCategory[],
): KeywordCategoryMatch | null {
  const allMacros = macros ?? [...MACRO_CATEGORIES, ...loadCustomMacroCategories()]
  const allCats = cats ?? [...CATEGORIES, ...loadCustomCategories()]
  const allSubs = subs ?? loadSubCategories()
  const text = description.toUpperCase()
  let bestScore = -1
  let best: KeywordCategoryMatch | null = null

  // 1. SubCategory keywords — highest priority (+4 bonus)
  for (const sub of allSubs) {
    if (!sub.active) continue
    const kws = sub.keywords ?? []
    for (const kw of kws) {
      if (!kw.trim()) continue
      if (text.includes(kw.toUpperCase())) {
        const score = kwWeight(kw) + 4
        if (score > bestScore) {
          bestScore = score
          best = {
            macroCategoryId: sub.macroCategoryId,
            subCategoryId: sub.id,
            confidence: scoreToConfidence(score),
            matchedKeyword: kw,
            matchedOn: 'subcategory',
            reason: `SubCategory keyword: "${kw}"`,
          }
        }
      }
    }
  }

  // 2. Category keywords (+2 bonus)
  for (const cat of allCats) {
    if (!cat.active) continue
    const kws = cat.keywords ?? []
    for (const kw of kws) {
      if (!kw.trim()) continue
      if (text.includes(kw.toUpperCase())) {
        const score = kwWeight(kw) + 2
        if (score > bestScore) {
          bestScore = score
          best = {
            macroCategoryId: cat.macroCategoryId,
            categoryId: cat.id,
            confidence: scoreToConfidence(score),
            matchedKeyword: kw,
            matchedOn: 'category',
            reason: `Category keyword: "${kw}"`,
          }
        }
      }
    }
  }

  // 3. MacroCategory keywords (no bonus)
  for (const macro of allMacros) {
    if (macro.tabType === 'none') continue
    const kws = macro.keywords ?? []
    for (const kw of kws) {
      if (!kw.trim()) continue
      if (text.includes(kw.toUpperCase())) {
        const score = kwWeight(kw)
        if (score > bestScore) {
          bestScore = score
          best = {
            macroCategoryId: macro.id,
            confidence: scoreToConfidence(score),
            matchedKeyword: kw,
            matchedOn: 'macro',
            reason: `MacroCategory keyword: "${kw}"`,
          }
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

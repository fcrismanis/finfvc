import type { Transaction, ClassificationType } from '../types'

/**
 * Learned category rules — local, file-free.
 *
 * When the user corrects a category manually, we derive a reusable rule from the
 * transaction's description so the next similar import comes pre-classified.
 * Rules are applied BEFORE the generic Pluggy/heuristic inference (see priority
 * order in docs/pluggy-category-map.md).
 */

export type RuleOrigin = 'manual' | 'pluggy' | 'csv'

export interface CategoryRule {
  id: string
  pattern: string            // normalized substring to match against the description
  macroCategoryId: string
  subCategoryId?: string
  classificationType?: ClassificationType
  tags?: string[]
  origin: RuleOrigin
  active: boolean
  useCount: number
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'fin_category_rules'

// ── Normalization ─────────────────────────────────────────────────────────────

/** Uppercase, strip accents/symbols, collapse spaces. */
export function normalizeText(text: string): string {
  return (text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Derive a stable merchant-ish pattern from a description (e.g. "AGGILE ENGLISH", "NETFLIX"). */
export function derivePattern(description: string): string {
  const norm = normalizeText(description)
  if (!norm) return ''
  const tokens = norm.split(' ').filter(t => t.length >= 2 && !/^\d+$/.test(t))
  const candidate = tokens.slice(0, 2).join(' ')
  return candidate.length >= 4 ? candidate : norm.slice(0, 24)
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadRules(): CategoryRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CategoryRule[]) : []
  } catch {
    return []
  }
}

function saveRules(rules: CategoryRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function deleteRule(id: string): void {
  saveRules(loadRules().filter(r => r.id !== id))
}

export function toggleRule(id: string, active: boolean): void {
  const rules = loadRules()
  const r = rules.find(x => x.id === id)
  if (!r) return
  r.active = active
  r.updatedAt = new Date().toISOString()
  saveRules(rules)
}

export function updateRule(id: string, patch: Partial<CategoryRule>): void {
  const rules = loadRules()
  const idx = rules.findIndex(x => x.id === id)
  if (idx < 0) return
  rules[idx] = { ...rules[idx], ...patch, updatedAt: new Date().toISOString() }
  saveRules(rules)
}

/** Insert or merge a rule keyed by its normalized pattern. */
export function upsertRule(input: {
  pattern: string
  macroCategoryId: string
  subCategoryId?: string
  classificationType?: ClassificationType
  tags?: string[]
  origin?: RuleOrigin
}): CategoryRule | null {
  const pattern = normalizeText(input.pattern)
  if (pattern.length < 4 || !input.macroCategoryId) return null

  const rules = loadRules()
  const now = new Date().toISOString()
  const existing = rules.find(r => r.pattern === pattern)

  if (existing) {
    existing.macroCategoryId = input.macroCategoryId
    existing.subCategoryId = input.subCategoryId
    existing.classificationType = input.classificationType
    if (input.tags?.length) existing.tags = Array.from(new Set([...(existing.tags ?? []), ...input.tags]))
    existing.useCount += 1
    existing.active = true
    existing.updatedAt = now
    saveRules(rules)
    return existing
  }

  const rule: CategoryRule = {
    id: `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    pattern,
    macroCategoryId: input.macroCategoryId,
    subCategoryId: input.subCategoryId,
    classificationType: input.classificationType,
    tags: input.tags,
    origin: input.origin ?? 'manual',
    active: true,
    useCount: 1,
    createdAt: now,
    updatedAt: now,
  }
  rules.push(rule)
  saveRules(rules)
  return rule
}

// ── Learning ──────────────────────────────────────────────────────────────────

/**
 * Auto-learn a rule from a categorized transaction, when safe:
 *  - a macro category is set
 *  - the derived pattern is specific enough (≥4 chars, not a pure number)
 *  - not a generic neutral movement (PIX/transfer) where the merchant is meaningless
 */
export function learnRuleFromTransaction(tx: Transaction, origin: RuleOrigin = 'manual'): CategoryRule | null {
  if (!tx.macroCategoryId) return null
  if (tx.classificationType === 'neutral' || tx.classificationType === 'transfer') return null
  const pattern = derivePattern(tx.originalDescription || tx.description || '')
  if (pattern.length < 4) return null
  return upsertRule({
    pattern,
    macroCategoryId: tx.macroCategoryId,
    subCategoryId: tx.subCategoryId,
    classificationType: tx.classificationType,
    tags: tx.tags,
    origin,
  })
}

// ── Matching ──────────────────────────────────────────────────────────────────

export interface RuleSuggestion {
  ruleId: string
  macroCategoryId: string
  subCategoryId?: string
  classificationType?: ClassificationType
  tags?: string[]
}

/** First active rule whose pattern is contained in the transaction text. */
export function suggestFromRules(tx: Transaction, rules?: CategoryRule[]): RuleSuggestion | null {
  const all = rules ?? loadRules()
  if (all.length === 0) return null
  const text = normalizeText(`${tx.description} ${tx.originalDescription ?? ''}`)
  // Longer patterns first → most specific match wins.
  const active = all.filter(r => r.active).sort((a, b) => b.pattern.length - a.pattern.length)
  for (const r of active) {
    if (r.pattern && text.includes(r.pattern)) {
      return {
        ruleId: r.id,
        macroCategoryId: r.macroCategoryId,
        subCategoryId: r.subCategoryId,
        classificationType: r.classificationType,
        tags: r.tags,
      }
    }
  }
  return null
}

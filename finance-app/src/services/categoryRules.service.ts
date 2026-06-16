import type { Transaction, ClassificationType } from '../types'

/**
 * Learned category rules — local, file-free.
 *
 * Priority of application in import pipeline:
 *  0. canAutoCategorize() guard — skip if any manual override present
 *  1. receiverName/payerName exact-ish match  (most specific)
 *  2. description/originalDescription pattern match
 *  3. pluggyCategoryId match
 *  4. pluggyCategory name match
 *
 * Rules are applied BEFORE Pluggy inference (Priority 2 in import).
 */

export type RuleOrigin = 'manual' | 'pluggy' | 'csv' | 'ai' | 'command'

export interface CategoryRule {
  id: string
  pattern: string              // normalized substring to match description
  receiverName?: string        // normalized receiver name (exact/contains match)
  payerName?: string           // normalized payer name
  pluggyCategoryId?: string    // exact Pluggy categoryId match
  pluggyCategory?: string      // normalized Pluggy category name match
  macroCategoryId: string
  subCategoryId?: string
  classificationType?: ClassificationType
  tags?: string[]
  confidence?: 'high' | 'medium' | 'low'
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

/** Derive a stable merchant-ish pattern from a description. */
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

export function incrementRuleUseCount(id: string): void {
  const rules = loadRules()
  const r = rules.find(x => x.id === id)
  if (!r) return
  r.useCount += 1
  r.updatedAt = new Date().toISOString()
  saveRules(rules)
}

/** Insert or merge a rule keyed by pattern (or receiverName if pattern is absent). */
export function upsertRule(input: {
  pattern?: string
  receiverName?: string
  payerName?: string
  pluggyCategoryId?: string
  pluggyCategory?: string
  macroCategoryId: string
  subCategoryId?: string
  classificationType?: ClassificationType
  tags?: string[]
  confidence?: 'high' | 'medium' | 'low'
  origin?: RuleOrigin
}): CategoryRule | null {
  const pattern = normalizeText(input.pattern ?? '')
  const receiverName = input.receiverName ? normalizeText(input.receiverName) : undefined
  const payerName = input.payerName ? normalizeText(input.payerName) : undefined

  // Need at least one match key and a macro category
  if (!input.macroCategoryId) return null
  if (pattern.length < 4 && !receiverName && !payerName && !input.pluggyCategoryId) return null

  const rules = loadRules()
  const now = new Date().toISOString()

  // Match existing rule by pattern or receiverName
  const existing = rules.find(r =>
    (pattern.length >= 4 && r.pattern === pattern) ||
    (receiverName && r.receiverName === receiverName)
  )

  if (existing) {
    existing.macroCategoryId = input.macroCategoryId
    existing.subCategoryId = input.subCategoryId
    existing.classificationType = input.classificationType
    if (input.tags?.length) existing.tags = Array.from(new Set([...(existing.tags ?? []), ...input.tags]))
    if (receiverName) existing.receiverName = receiverName
    if (payerName) existing.payerName = payerName
    if (input.pluggyCategoryId) existing.pluggyCategoryId = input.pluggyCategoryId
    if (input.pluggyCategory) existing.pluggyCategory = normalizeText(input.pluggyCategory)
    if (input.confidence) existing.confidence = input.confidence
    existing.useCount += 1
    existing.active = true
    existing.updatedAt = now
    saveRules(rules)
    return existing
  }

  const rule: CategoryRule = {
    id: `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    pattern: pattern.length >= 4 ? pattern : '',
    receiverName,
    payerName,
    pluggyCategoryId: input.pluggyCategoryId,
    pluggyCategory: input.pluggyCategory ? normalizeText(input.pluggyCategory) : undefined,
    macroCategoryId: input.macroCategoryId,
    subCategoryId: input.subCategoryId,
    classificationType: input.classificationType,
    tags: input.tags,
    confidence: input.confidence ?? 'high',
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

// ── Guard ─────────────────────────────────────────────────────────────────────

/** Returns false when any manual override is present — auto-categorization must be skipped. */
export function canAutoCategorize(tx: Transaction): boolean {
  return !(tx.manualCategoryOverride || tx.manualSubCategoryOverride || tx.manualTextOverride)
}

// ── Learning ──────────────────────────────────────────────────────────────────

/**
 * Auto-learn a rule from a categorized transaction when safe:
 *  - macro category is set
 *  - derived pattern is specific enough (≥4 chars, not a pure number)
 *  - not a generic neutral movement where the merchant is meaningless
 */
export function learnRuleFromTransaction(tx: Transaction, origin: RuleOrigin = 'manual'): CategoryRule | null {
  if (!tx.macroCategoryId) return null
  if (tx.classificationType === 'neutral' || tx.classificationType === 'transfer') return null

  const pattern = derivePattern(tx.originalDescription || tx.description || '')
  const receiverName = tx.pluggyReceiverName ? normalizeText(tx.pluggyReceiverName) : undefined
  const payerName = tx.pluggyPayerName ? normalizeText(tx.pluggyPayerName) : undefined

  if (pattern.length < 4 && !receiverName) return null

  return upsertRule({
    pattern,
    receiverName,
    payerName,
    pluggyCategoryId: tx.pluggyCategoryId,
    pluggyCategory: tx.pluggyCategory,
    macroCategoryId: tx.macroCategoryId,
    subCategoryId: tx.subCategoryId,
    classificationType: tx.classificationType,
    tags: tx.tags,
    confidence: 'high',
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
  confidence?: 'high' | 'medium' | 'low'
}

function toSuggestion(r: CategoryRule): RuleSuggestion {
  return {
    ruleId: r.id,
    macroCategoryId: r.macroCategoryId,
    subCategoryId: r.subCategoryId,
    classificationType: r.classificationType,
    tags: r.tags,
    confidence: r.confidence ?? 'high',
  }
}

/**
 * Find the best matching active rule for a transaction.
 *
 * Priority order:
 *  1. receiverName match (most specific)
 *  2. payerName match
 *  3. description/originalDescription pattern match (longest pattern wins)
 *  4. pluggyCategoryId match
 *  5. pluggyCategory name match
 */
export function suggestFromRules(tx: Transaction, rules?: CategoryRule[]): RuleSuggestion | null {
  const all = (rules ?? loadRules()).filter(r => r.active)
  if (all.length === 0) return null

  const txRecv  = normalizeText(tx.pluggyReceiverName ?? '')
  const txPayer = normalizeText(tx.pluggyPayerName ?? '')
  const txText  = normalizeText(`${tx.description} ${tx.originalDescription ?? ''}`)
  const txPluggyId  = tx.pluggyCategoryId ?? ''
  const txPluggyCat = normalizeText(tx.pluggyCategory ?? '')

  // 1. receiverName
  const withReceiver = all.filter(r => r.receiverName)
    .sort((a, b) => b.receiverName!.length - a.receiverName!.length)
  for (const r of withReceiver) {
    if (txRecv && txRecv.includes(r.receiverName!)) return toSuggestion(r)
  }

  // 2. payerName
  const withPayer = all.filter(r => r.payerName)
    .sort((a, b) => b.payerName!.length - a.payerName!.length)
  for (const r of withPayer) {
    if (txPayer && txPayer.includes(r.payerName!)) return toSuggestion(r)
  }

  // 3. description pattern (longest first)
  const withPattern = all.filter(r => r.pattern && r.pattern.length >= 4)
    .sort((a, b) => b.pattern.length - a.pattern.length)
  for (const r of withPattern) {
    if (txText.includes(r.pattern)) return toSuggestion(r)
  }

  // 4. pluggyCategoryId
  if (txPluggyId) {
    const byId = all.filter(r => r.pluggyCategoryId === txPluggyId)
    if (byId.length > 0) return toSuggestion(byId[0])
  }

  // 5. pluggyCategory name
  if (txPluggyCat) {
    const byCat = all.filter(r => r.pluggyCategory && r.pluggyCategory === txPluggyCat)
    if (byCat.length > 0) return toSuggestion(byCat[0])
  }

  return null
}

/** Test a rule against a set of transactions; returns matching transaction IDs. */
export function testRule(rule: CategoryRule, transactions: Transaction[]): string[] {
  return transactions
    .filter(tx => canAutoCategorize(tx) && suggestFromRules(tx, [rule]) !== null)
    .map(tx => tx.id)
}

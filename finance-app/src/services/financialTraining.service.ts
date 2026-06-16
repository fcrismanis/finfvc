/**
 * Financial AI training service.
 * Builds training examples from real imported history and uses them to
 * suggest categories for new transactions.
 *
 * Priority stack (1=highest):
 *  1. Manual override
 *  2. Learned rule (categoryRules.service)
 *  3. Training example from real xlsx (this service)
 *  4. Pluggy categoryId
 *  5. Pluggy category name
 *  6. Local heuristic (classifier)
 *  7. AI / Ollama (with training examples as context)
 *  8. A classificar
 */
import type { Transaction } from '../types'
import type { RealFinanceRow } from './realFinanceImport.service'
import { classifyByDescription } from '../importers/classifier'
import { normalizeDescription } from '../importers/normalizer'
import { normalizeText, derivePattern } from './categoryRules.service'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrainingExample {
  id: string
  descriptionNorm: string
  descriptionOriginal: string
  tipo: string
  amountApprox: number
  conta: string
  formaPagamento: string
  macroCategoryId: string
  subCategoryId?: string
  tags: string[]
  isRecurring: boolean
  grupo: string
  source: 'real_2026_xlsx'
  createdAt: string
}

export interface TrainingSuggestion {
  macroCategoryId: string
  subCategoryId?: string
  confidence: 'high' | 'medium' | 'low'
  source: 'training'
  examples: TrainingExample[]
}

const STORAGE_KEY = 'fin_ai_training_examples'
const MAX_EXAMPLES = 3000

// ── Normalization ─────────────────────────────────────────────────────────────

function roundAmount(v: number): number {
  if (v < 10) return Math.round(v)
  if (v < 100) return Math.round(v / 5) * 5
  if (v < 1000) return Math.round(v / 10) * 10
  return Math.round(v / 50) * 50
}

function normConta(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')
}

// ── Build examples from rows ──────────────────────────────────────────────────

export function buildTrainingExamplesFromRows(
  rows: RealFinanceRow[],
  subByName: Map<string, string>,
): TrainingExample[] {
  const examples: TrainingExample[] = []
  const seen = new Set<string>()
  const now = new Date().toISOString()

  for (const row of rows) {
    const categoria = row.categoria.trim()
    if (!categoria) continue

    const descNorm = normalizeText(row.descricao)
    if (!descNorm) continue

    const pattern = derivePattern(descNorm)
    const dedupeKey = `${pattern}::${categoria.toLowerCase()}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const cls = classifyByDescription(normalizeDescription(row.descricao), row.tipo, categoria)
    const catKey = categoria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    // Try to resolve subcategoryId from categoria name if it's a specific sub
    const subCategoryId = subByName.get(catKey) ?? subByName.get(categoria.toLowerCase()) ?? undefined

    const amt = parseFloat(String(row.valor).replace(',', '.')) || 0

    examples.push({
      id: `train_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      descriptionNorm: descNorm,
      descriptionOriginal: row.descricao,
      tipo: row.tipo,
      amountApprox: roundAmount(Math.abs(amt)),
      conta: normConta(row.conta),
      formaPagamento: row.formaPagamento.toLowerCase(),
      macroCategoryId: cls.macroCategoryId,
      subCategoryId,
      tags: row.tags ? row.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
      isRecurring: row.recorrente.toLowerCase().includes('sim'),
      grupo: row.grupo,
      source: 'real_2026_xlsx',
      createdAt: now,
    })
  }

  return examples
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadTrainingExamples(): TrainingExample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TrainingExample[]) : []
  } catch { return [] }
}

export function saveTrainingExamples(examples: TrainingExample[]): void {
  // Keep only the most recent MAX_EXAMPLES entries
  const trimmed = examples.slice(-MAX_EXAMPLES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function appendTrainingExamples(newExamples: TrainingExample[]): void {
  const existing = loadTrainingExamples()
  const existingKeys = new Set(existing.map(e => `${e.descriptionNorm}::${e.macroCategoryId}`))
  const unique = newExamples.filter(e => !existingKeys.has(`${e.descriptionNorm}::${e.macroCategoryId}`))
  saveTrainingExamples([...existing, ...unique])
}

// ── Suggestion ────────────────────────────────────────────────────────────────

/** Similarity score 0-100 between normalized descriptions */
function similarity(a: string, b: string): number {
  if (a === b) return 100
  const tokA = new Set(a.split(' ').filter(t => t.length >= 3))
  const tokB = new Set(b.split(' ').filter(t => t.length >= 3))
  if (tokA.size === 0 || tokB.size === 0) return 0
  let matches = 0
  for (const t of tokA) if (tokB.has(t)) matches++
  return Math.round((matches / Math.max(tokA.size, tokB.size)) * 100)
}

export function findTrainingExamplesForTransaction(tx: Transaction, topK = 10): TrainingExample[] {
  const examples = loadTrainingExamples()
  if (examples.length === 0) return []

  const descNorm = normalizeText(tx.description)
  const scored = examples
    .map(e => ({ e, score: similarity(descNorm, e.descriptionNorm) }))
    .filter(x => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(x => x.e)
}

export function suggestCategoryFromTraining(tx: Transaction): TrainingSuggestion | null {
  if (tx.manualCategoryOverride) return null
  const examples = findTrainingExamplesForTransaction(tx, 5)
  if (examples.length === 0) return null

  // Vote: most common macroCategoryId among top examples
  const votes = new Map<string, { count: number; subIds: (string | undefined)[] }>()
  for (const e of examples) {
    const v = votes.get(e.macroCategoryId) ?? { count: 0, subIds: [] }
    v.count++
    v.subIds.push(e.subCategoryId)
    votes.set(e.macroCategoryId, v)
  }

  let bestCat = ''
  let bestCount = 0
  votes.forEach((v, cat) => { if (v.count > bestCount) { bestCat = cat; bestCount = v.count } })
  if (!bestCat) return null

  const { subIds } = votes.get(bestCat)!
  const subVotes = new Map<string, number>()
  subIds.forEach(s => { if (s) subVotes.set(s, (subVotes.get(s) ?? 0) + 1) })
  let bestSub: string | undefined
  let bestSubCount = 0
  subVotes.forEach((c, s) => { if (c > bestSubCount) { bestSub = s; bestSubCount = c } })

  const confidence: 'high' | 'medium' | 'low' =
    bestCount >= 3 ? 'high' : bestCount >= 2 ? 'medium' : 'low'

  return {
    macroCategoryId: bestCat,
    subCategoryId: bestSub,
    confidence,
    source: 'training',
    examples: examples.filter(e => e.macroCategoryId === bestCat),
  }
}

export function exportTrainingProfile(): object {
  const examples = loadTrainingExamples()
  const byMacro: Record<string, number> = {}
  examples.forEach(e => {
    byMacro[e.macroCategoryId] = (byMacro[e.macroCategoryId] ?? 0) + 1
  })
  return {
    total: examples.length,
    source: 'real_2026_xlsx',
    byMacroCategory: byMacro,
    exportedAt: new Date().toISOString(),
  }
}

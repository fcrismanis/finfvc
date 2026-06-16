/**
 * Cross-source transaction deduplication.
 * Detects duplicates between Excel, Pluggy, CSV imports — even when IDs,
 * importHashes and account names differ across sources.
 */
import type { Transaction } from '../types'

// ── Stop words stripped from descriptions before comparison ──────────────────

const STOP_WORDS = new Set([
  'compra', 'pagamento', 'pagto', 'debito', 'credito', 'pix', 'ted', 'doc',
  'boleto', 'cartao', 'cartão', 'parcela', 'transf', 'transferencia',
  'transferência', 'debi', 'cred', 'no', 'em', 'de', 'da', 'do', 'dos',
  'das', 'ao', 'na', 'para', 'via',
])

// Bank/account name aliases → canonical key
const ACCOUNT_CANON: Record<string, string> = {
  'btg black':       'btg',
  'btg banking':     'btg',
  'banco btg':       'btg',
  'btg pactual':     'btg',
  'btg':             'btg',
  'nu - jana':       'nubank',
  'nubank':          'nubank',
  'nu':              'nubank',
  'santander free':  'santander',
  'santander':       'santander',
  'rico':            'rico',
  'rico conta corrente': 'rico',
  'itau':            'itau',
  'itaú':            'itau',
  'inter prime':     'inter',
  'banco inter':     'inter',
  'inter':           'inter',
  'bradesco':        'bradesco',
  'banco bradesco':  'bradesco',
  'mercado pago':    'mercadopago',
  "sam's club":      'samsclub',
  'samsclub':        'samsclub',
}

// ── Text normalization ────────────────────────────────────────────────────────

/** Lower, remove accents, keep alphanum+space. */
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Strips bank transaction noise. Returns 2-4 significant merchant tokens.
 * "Compra débito - Drogasil 0042 SP 04/01" → "drogasil"
 * "AGGILE ENGLISH - parcela 3/12"           → "aggile english"
 */
export function normalizeDescriptionForDedupe(raw: string): string {
  let s = deaccent(raw)
  // Remove long numeric sequences (NSU / auth codes / CPF-like)
  s = s.replace(/\b\d{5,}\b/g, ' ')
  // Remove date-like patterns
  s = s.replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, ' ')
  // Remove common bank prefixes up to first dash/hyphen
  s = s.replace(/^(compra|pagamento|pagto|debi?to|cred?ito|pix|ted|doc|boleto)\s*[\-:–]?\s*/i, '')
  // Tokenize and strip stop words
  const tokens = s.split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, '')).filter(t => t.length >= 2 && !STOP_WORDS.has(t))
  return tokens.slice(0, 4).join(' ').trim()
}

/** Normalize account/card name to canonical alias. */
export function normalizeAccountForDedupe(raw: string): string {
  const k = deaccent(raw.trim())
  return ACCOUNT_CANON[k] ?? k.split(/\s+/).slice(0, 2).join('_')
}

// ── Fingerprints ──────────────────────────────────────────────────────────────

/**
 * Strong fingerprint: desc + exact amount + YYYY-MM (credit-card drift tolerance).
 * Same fingerprint across sources → almost certainly the same transaction.
 */
export function buildSoftFingerprint(tx: { description: string; originalDescription?: string; amount: number; transactionDate: string; competenceDate?: string }): string {
  const desc = normalizeDescriptionForDedupe(tx.originalDescription ?? tx.description)
  const amt = tx.amount.toFixed(2)
  const month = (tx.competenceDate ?? tx.transactionDate).slice(0, 7)
  return `${desc}|${amt}|${month}`
}

// ── Date proximity ────────────────────────────────────────────────────────────

function daysDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.abs(Math.round((da - db) / 86400000))
}

function closestDateDiff(a: Transaction, b: Transaction): number {
  const aDates = [a.transactionDate, a.competenceDate, a.paymentDate].filter(Boolean) as string[]
  const bDates = [b.transactionDate, b.competenceDate, b.paymentDate].filter(Boolean) as string[]
  let min = Infinity
  for (const da of aDates) for (const db of bDates) min = Math.min(min, daysDiff(da, db))
  return min
}

// ── Token similarity (Jaccard) ────────────────────────────────────────────────

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = new Set(a.split(' ').filter(t => t.length >= 2))
  const tb = new Set(b.split(' ').filter(t => t.length >= 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter) // Jaccard
}

// ── Cross-source duplicate check ──────────────────────────────────────────────

export type DupeConfidence = 'strong' | 'soft'

export interface DupeMatch {
  existing: Transaction
  confidence: DupeConfidence
  reason: string
}

/**
 * Check if `candidate` is a duplicate of any transaction in `existing`.
 * Returns the best match or null.
 */
export function findCrossSourceDuplicate(
  candidate: Transaction,
  existing: Transaction[],
): DupeMatch | null {
  const candidateFp = buildSoftFingerprint(candidate)
  const candidateDescNorm = normalizeDescriptionForDedupe(candidate.originalDescription ?? candidate.description)

  for (const tx of existing) {
    // Level 1: exact importHash
    if (candidate.importHash && tx.importHash && candidate.importHash === tx.importHash) {
      return { existing: tx, confidence: 'strong', reason: 'importHash' }
    }
    // Level 1: same id
    if (candidate.id === tx.id) {
      return { existing: tx, confidence: 'strong', reason: 'id' }
    }

    // Level 2: soft fingerprint (desc + amount + month) — cross-source
    const txFp = buildSoftFingerprint(tx)
    if (candidateFp === txFp && candidateFp !== '||') {
      return { existing: tx, confidence: 'strong', reason: 'fingerprint' }
    }

    // Level 3: amount + date (≤3 days) + desc similarity ≥60%
    if (Math.abs(candidate.amount - tx.amount) <= 0.02 && candidate.type === tx.type) {
      const dateDiff = closestDateDiff(candidate, tx)
      if (dateDiff <= 3) {
        const txDescNorm = normalizeDescriptionForDedupe(tx.originalDescription ?? tx.description)
        const sim = tokenSimilarity(candidateDescNorm, txDescNorm)
        if (sim >= 0.6) {
          const conf: DupeConfidence = dateDiff <= 1 && sim >= 0.8 ? 'strong' : 'soft'
          return { existing: tx, confidence: conf, reason: `sim=${Math.round(sim * 100)}%,days=${dateDiff}` }
        }
      }
    }
  }

  return null
}

/**
 * For a batch of incoming candidates, mark each as new or duplicate.
 * Returns only the non-duplicate ones (strong dupes filtered out; soft dupes flagged).
 */
export interface DedupeResult {
  unique: Transaction[]
  strongDupes: Array<{ candidate: Transaction; match: DupeMatch }>
  softDupes: Array<{ candidate: Transaction; match: DupeMatch }>
}

export function dedupeIncomingBatch(
  candidates: Transaction[],
  existing: Transaction[],
): DedupeResult {
  const result: DedupeResult = { unique: [], strongDupes: [], softDupes: [] }
  const acceptedFingerprints = new Set(existing.map(t => buildSoftFingerprint(t)))

  for (const c of candidates) {
    const match = findCrossSourceDuplicate(c, existing)
    if (match?.confidence === 'strong') {
      result.strongDupes.push({ candidate: c, match })
      continue
    }
    // Check within-batch duplicates too (by fingerprint)
    const fp = buildSoftFingerprint(c)
    if (acceptedFingerprints.has(fp)) {
      result.strongDupes.push({ candidate: c, match: match ?? { existing: c, confidence: 'strong', reason: 'within-batch' } })
      continue
    }
    acceptedFingerprints.add(fp)
    if (match?.confidence === 'soft') {
      result.softDupes.push({ candidate: c, match })
    }
    result.unique.push(c)
  }

  return result
}

// ── Find existing duplicates in a stored set ──────────────────────────────────

export interface DuplicateGroup {
  id: string
  transactions: Transaction[]
  confidence: DupeConfidence
  reason: string
  keepId: string | null
}

export type AllDuplicateGroupConfidence = 'high' | 'medium' | 'low'

export interface AllDuplicateGroup {
  id: string
  confidence: AllDuplicateGroupConfidence
  reason: string
  transactions: Transaction[]
  suggestedKeepId?: string
  suggestedMergeIds?: string[]
}

/**
 * Scan ALL stored transactions for duplicates — same source or cross-source.
 * High: same importHash / pluggyTransactionId / externalId / dedupeFingerprint / soft fingerprint
 * Medium: same value±0.02, date ≤3 days, desc similarity ≥50%
 * Low: same value, date ≤7 days, desc similarity ≥25%
 */
export function findAllDuplicateGroups(transactions: Transaction[]): AllDuplicateGroup[] {
  const groups: AllDuplicateGroup[] = []
  const grouped = new Set<string>()

  // ── High confidence: exact key matches ──────────────────────────────────────

  // Group by importHash
  const byHash = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (!tx.importHash) continue
    const arr = byHash.get(tx.importHash) ?? []
    arr.push(tx)
    byHash.set(tx.importHash, arr)
  }
  for (const [hash, txs] of byHash) {
    if (txs.length < 2) continue
    if (txs.every(t => grouped.has(t.id))) continue
    txs.forEach(t => grouped.add(t.id))
    groups.push({ id: `hash:${hash}`, confidence: 'high', reason: 'importHash idêntico', transactions: txs, suggestedKeepId: preferKeep(txs) ?? undefined })
  }

  // Group by soft fingerprint (desc + amount + month) — ALL sources
  const byFp = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (grouped.has(tx.id)) continue
    const fp = buildSoftFingerprint(tx)
    if (!fp || fp === '||') continue
    const arr = byFp.get(fp) ?? []
    arr.push(tx)
    byFp.set(fp, arr)
  }
  for (const [fp, txs] of byFp) {
    if (txs.length < 2) continue
    if (txs.some(t => grouped.has(t.id))) continue
    txs.forEach(t => grouped.add(t.id))
    const keepId = preferKeep(txs) ?? undefined
    groups.push({
      id: `fp:${fp}`,
      confidence: 'high',
      reason: 'descrição+valor+mês idênticos',
      transactions: txs,
      suggestedKeepId: keepId,
      suggestedMergeIds: txs.filter(t => t.id !== keepId).map(t => t.id),
    })
  }

  // ── Medium confidence: value + date (≤3 days) + desc similarity ≥50% ────────
  const remaining = transactions.filter(t => !grouped.has(t.id))
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]
    if (grouped.has(a.id)) continue
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j]
      if (grouped.has(b.id)) continue
      if (Math.abs(a.amount - b.amount) > 0.02) continue
      const dateDiff = closestDateDiff(a, b)
      if (dateDiff > 7) continue
      const aNorm = normalizeDescriptionForDedupe(a.originalDescription ?? a.description)
      const bNorm = normalizeDescriptionForDedupe(b.originalDescription ?? b.description)
      const sim = tokenSimilarity(aNorm, bNorm)
      if (dateDiff <= 3 && sim >= 0.5) {
        grouped.add(a.id); grouped.add(b.id)
        const keepId = preferKeep([a, b]) ?? undefined
        groups.push({
          id: `med:${a.id}::${b.id}`,
          confidence: 'medium',
          reason: `similaridade ${Math.round(sim * 100)}%, ${dateDiff}d de diferença`,
          transactions: [a, b],
          suggestedKeepId: keepId,
          suggestedMergeIds: [a, b].filter(t => t.id !== keepId).map(t => t.id),
        })
        break
      } else if (dateDiff <= 7 && sim >= 0.25 && sim < 0.5) {
        grouped.add(a.id); grouped.add(b.id)
        groups.push({
          id: `low:${a.id}::${b.id}`,
          confidence: 'low',
          reason: `similaridade parcial ${Math.round(sim * 100)}%, ${dateDiff}d de diferença`,
          transactions: [a, b],
          suggestedKeepId: preferKeep([a, b]) ?? undefined,
        })
        break
      }
    }
  }

  return groups
}

/**
 * Legacy cross-source-only scanner. Use findAllDuplicateGroups for general dedupe.
 * @deprecated
 */
export function findExistingDuplicateGroups(transactions: Transaction[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const grouped = new Set<string>()

  const byFp = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const fp = buildSoftFingerprint(tx)
    if (!fp || fp === '||') continue
    const arr = byFp.get(fp) ?? []
    arr.push(tx)
    byFp.set(fp, arr)
  }

  for (const [fp, txs] of byFp) {
    if (txs.length < 2) continue
    const sources = new Set(txs.map(t => t.source ?? t.origin))
    if (sources.size < 2) continue
    const ids = txs.map(t => t.id)
    if (ids.some(id => grouped.has(id))) continue
    ids.forEach(id => grouped.add(id))
    const keepId = preferKeep(txs)
    groups.push({ id: fp, transactions: txs, confidence: 'strong', reason: 'fingerprint', keepId })
  }

  const remaining = transactions.filter(t => !grouped.has(t.id))
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]
    if (grouped.has(a.id)) continue
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j]
      if (grouped.has(b.id)) continue
      const aSource = a.source ?? a.origin
      const bSource = b.source ?? b.origin
      if (aSource === bSource) continue
      if (Math.abs(a.amount - b.amount) > 0.02 || a.type !== b.type) continue
      const dateDiff = closestDateDiff(a, b)
      if (dateDiff > 3) continue
      const aNorm = normalizeDescriptionForDedupe(a.originalDescription ?? a.description)
      const bNorm = normalizeDescriptionForDedupe(b.originalDescription ?? b.description)
      const sim = tokenSimilarity(aNorm, bNorm)
      if (sim < 0.6) continue
      const conf: DupeConfidence = dateDiff <= 1 && sim >= 0.8 ? 'strong' : 'soft'
      grouped.add(a.id); grouped.add(b.id)
      const keepId = preferKeep([a, b])
      groups.push({ id: `${a.id}::${b.id}`, transactions: [a, b], confidence: conf, reason: `sim=${Math.round(sim * 100)}%,days=${dateDiff}`, keepId })
      break
    }
  }

  return groups
}

/** Prefer keeping the transaction with more data (manual category > xlsx > pluggy) */
function preferKeep(txs: Transaction[]): string | null {
  if (txs.length === 0) return null
  return txs.slice().sort((a, b) => keepScore(b) - keepScore(a))[0].id
}

function keepScore(tx: Transaction): number {
  let s = 0
  if (tx.manualCategoryOverride) s += 100
  if (tx.manualSubCategoryOverride) s += 50
  if (tx.source === 'real_xlsx' || tx.source === 'real_2026_xlsx' || tx.origin === 'import_xlsx') s += 30
  if (tx.macroCategoryId) s += 20
  if (tx.subCategoryId) s += 10
  if (tx.categorySuggestionSource === 'history' || tx.categorySuggestionSource === 'rule') s += 15
  return s
}

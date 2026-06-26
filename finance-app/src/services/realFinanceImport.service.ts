/**
 * Real finance import service.
 * Parses the user's personal Excel export from their finance app.
 * Creates subcategories, accounts and training rules from the imported history.
 */
import * as XLSX from 'xlsx'
import type { Transaction, SubCategory } from '../types'
import { classifyByDescription } from '../importers/classifier'
import { computeImportHash } from '../importers/deduplicator'
import { normalizeAmount, normalizeDate, normalizeDescription, normalizePaymentMethod, parseInstallment } from '../importers/normalizer'
import { currentFinancialDate, normalizeFinancialDate } from '../utils/date'
import { loadSubCategories, saveSubCategories, newSubCategoryId } from './subcategory.service'

// ── Sub-category seeds from real history ─────────────────────────────────────

interface SubSeed {
  name: string
  macroCategoryId: string
  essentiality: 'essential' | 'non_essential'
}

const SUB_SEEDS: SubSeed[] = [
  // Assinaturas
  { name: 'VIVO', macroCategoryId: 'mac_assinaturas', essentiality: 'non_essential' },
  { name: 'Claro TV', macroCategoryId: 'mac_assinaturas', essentiality: 'non_essential' },
  { name: 'Youtube', macroCategoryId: 'mac_assinaturas', essentiality: 'non_essential' },
  { name: 'Brasil Paralelo', macroCategoryId: 'mac_assinaturas', essentiality: 'non_essential' },
  { name: 'Apple Storage', macroCategoryId: 'mac_assinaturas', essentiality: 'non_essential' },
  // Casa
  { name: 'Limpeza / Faxina', macroCategoryId: 'mac_casa', essentiality: 'essential' },
  { name: 'Manutenção', macroCategoryId: 'mac_casa', essentiality: 'essential' },
  // Compras
  { name: 'Acessórios', macroCategoryId: 'mac_compras', essentiality: 'non_essential' },
  // Saúde
  { name: 'Consultas', macroCategoryId: 'mac_saude', essentiality: 'essential' },
  { name: 'Exames', macroCategoryId: 'mac_saude', essentiality: 'essential' },
  // Educação
  { name: 'Treinamentos', macroCategoryId: 'mac_educacao', essentiality: 'non_essential' },
  // Impostos
  { name: 'Multas e Taxas', macroCategoryId: 'mac_impostos', essentiality: 'non_essential' },
  // Serviços
  { name: 'Manutenção', macroCategoryId: 'mac_servicos', essentiality: 'non_essential' },
]
// Subcategorias agora são criadas dinamicamente no import (importRealFinanceBase),
// uma por categoria do xlsx, sob o macro classificado. Sem mapa estático.

// ── Row type ─────────────────────────────────────────────────────────────────

export interface RealFinanceRow {
  tipo: string
  descricao: string
  valor: string | number
  data: string | number
  dataCompetencia: string | number
  dataPagamento: string | number
  status: string
  formaPagamento: string
  conta: string
  categoria: string
  cliente: string
  parcela: string
  recorrente: string
  tags: string
  grupo: string
  rowIndex: number
}

export interface RealImportResult {
  imported: number
  skipped: number
  duplicates: number
  subcategoriesCreated: number
  trainingExamples: number
  accounts: string[]
  cards: string[]
  categoriesFound: string[]
}

// ── Normalize column key ──────────────────────────────────────────────────────

function normKey(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const COL_MAP: Record<string, keyof RealFinanceRow> = {
  'tipo': 'tipo',
  'descricao': 'descricao',
  'valor': 'valor',
  'data': 'data',
  'data competencia': 'dataCompetencia',
  'data competência': 'dataCompetencia',
  'data pagamento': 'dataPagamento',
  'data de pagamento': 'dataPagamento',
  'status': 'status',
  'forma de pagamento': 'formaPagamento',
  'forma pagamento': 'formaPagamento',
  'conta/cartao': 'conta',
  'conta/cartão': 'conta',
  'conta': 'conta',
  'categoria': 'categoria',
  'cliente': 'cliente',
  'parcela': 'parcela',
  'recorrente': 'recorrente',
  'tags': 'tags',
  'grupo': 'grupo',
}

// ── Excel date to ISO string ──────────────────────────────────────────────────

function xlsxDateToIso(value: string | number | undefined): string {
  if (!value && value !== 0) return currentFinancialDate()
  if (typeof value === 'number') return normalizeFinancialDate(value, currentFinancialDate())
  const s = String(value).trim()
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return normalizeDate(s)
}

// ── Parse raw Excel ───────────────────────────────────────────────────────────

export function parseRealFinanceXlsx(buffer: ArrayBuffer, _fileName?: string): RealFinanceRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: undefined, blankrows: false,
  })
  if (rows.length < 2) return []

  const headers = (rows[0] as (string | number | undefined)[]).map(h => normKey(String(h ?? '')))
  const colIdx: Partial<Record<keyof RealFinanceRow, number>> = {}
  headers.forEach((h, i) => {
    const key = COL_MAP[h]
    if (key && !(key in colIdx)) colIdx[key] = i
  })

  function cell(row: (string | number | undefined)[], key: keyof RealFinanceRow): string | number {
    const i = colIdx[key]
    if (i === undefined) return ''
    return row[i] ?? ''
  }

  const result: RealFinanceRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number | undefined)[]
    const descricao = String(cell(row, 'descricao') ?? '').trim()
    if (!descricao) continue
    result.push({
      tipo: String(cell(row, 'tipo') ?? ''),
      descricao,
      valor: cell(row, 'valor'),
      data: cell(row, 'data'),
      dataCompetencia: cell(row, 'dataCompetencia'),
      dataPagamento: cell(row, 'dataPagamento'),
      status: String(cell(row, 'status') ?? ''),
      formaPagamento: String(cell(row, 'formaPagamento') ?? ''),
      conta: String(cell(row, 'conta') ?? ''),
      categoria: String(cell(row, 'categoria') ?? ''),
      cliente: String(cell(row, 'cliente') ?? ''),
      parcela: String(cell(row, 'parcela') ?? ''),
      recorrente: String(cell(row, 'recorrente') ?? ''),
      tags: String(cell(row, 'tags') ?? ''),
      grupo: String(cell(row, 'grupo') ?? ''),
      rowIndex: i,
    })
  }
  return result
}

// ── Ensure subcategories exist ────────────────────────────────────────────────

export function ensureSubCategories(): { created: number; byName: Map<string, string> } {
  const existing = loadSubCategories()
  const byName = new Map<string, string>(existing.map(s => [s.name.toLowerCase(), s.id]))
  let created = 0
  const now = new Date().toISOString()

  for (const seed of SUB_SEEDS) {
    const key = seed.name.toLowerCase()
    if (!byName.has(key)) {
      const id = newSubCategoryId()
      existing.push({
        id,
        name: seed.name,
        macroCategoryId: seed.macroCategoryId,
        essentiality: seed.essentiality,
        active: true,
        createdAt: now,
      } as SubCategory)
      byName.set(key, id)
      created++
    }
  }
  if (created > 0) saveSubCategories(existing)
  return { created, byName }
}

// ── Build import hash ─────────────────────────────────────────────────────────

export function buildRealFinanceImportHash(row: RealFinanceRow): string {
  const desc = normalizeDescription(String(row.descricao))
  const amt = normalizeAmount(row.valor)
  const date = xlsxDateToIso(row.data)
  const account = String(row.conta).slice(0, 20)
  const parcela = String(row.parcela)
  return computeImportHash(desc, amt, date, account) + '_' + parcela.replace('/', '_')
}

// ── Main import function ──────────────────────────────────────────────────────

export function importRealFinanceBase(
  rows: RealFinanceRow[],
  existingTransactions: Transaction[],
  batchId: string,
): { transactions: Transaction[]; result: Omit<RealImportResult, 'trainingExamples'> } {
  const existingHashes = new Set(existingTransactions.map(t => t.importHash).filter(Boolean))
  const now = new Date().toISOString()

  // Subcategorias espelham a planilha: cada categoria do xlsx vira uma subcategoria
  // com o nome EXATO, sob o macro que o classifier resolveu. Criadas sob demanda.
  const subs = loadSubCategories()
  const subByKey = new Map(subs.map(s => [normKey(s.name) + '|' + s.macroCategoryId, s.id]))
  let subsCreated = 0
  const ensureSub = (name: string, macroId: string): string | undefined => {
    const clean = name.trim()
    if (!clean || !macroId) return undefined
    const key = normKey(clean) + '|' + macroId
    const hit = subByKey.get(key)
    if (hit) return hit
    const id = newSubCategoryId()
    subs.push({ id, name: clean, macroCategoryId: macroId, essentiality: 'non_essential', active: true, createdAt: now } as SubCategory)
    subByKey.set(key, id)
    subsCreated++
    return id
  }

  const accounts = new Set<string>()
  const cards = new Set<string>()
  const categoriesFound = new Set<string>()

  let skipped = 0
  let duplicates = 0
  const imported: Transaction[] = []

  for (const row of rows) {
    const hash = buildRealFinanceImportHash(row)
    if (existingHashes.has(hash)) { duplicates++; continue }

    const descricao = normalizeDescription(String(row.descricao))
    const amt = Math.abs(normalizeAmount(row.valor))
    if (isNaN(amt)) { skipped++; continue }

    const transactionDate = xlsxDateToIso(row.data)
    const competenceDate = row.dataCompetencia ? xlsxDateToIso(row.dataCompetencia) : transactionDate
    const paymentDate = row.dataPagamento ? xlsxDateToIso(row.dataPagamento) : undefined

    const categoria = row.categoria.trim()
    if (categoria) categoriesFound.add(categoria)
    const classification = classifyByDescription(descricao, row.tipo, categoria)

    // Subcategoria = nome exato da categoria do xlsx, sob o macro classificado.
    const subCategoryId = ensureSub(categoria, classification.macroCategoryId)

    const formaPagamento = row.formaPagamento.toLowerCase()
    if (formaPagamento === 'cartão' || formaPagamento === 'cartao') {
      cards.add(row.conta)
    } else {
      accounts.add(row.conta)
    }

    const accountId = row.conta
      ? `acc_real_${row.conta.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24)}`
      : 'acc_unknown'

    const statusRaw = row.status.toLowerCase()
    const status: Transaction['status'] =
      statusRaw.includes('pend') ? 'pending' :
      statusRaw.includes('cancel') ? 'cancelled' : 'paid'

    const installment = parseInstallment(row.parcela)
    const isRecurring = row.recorrente.toLowerCase().includes('sim')
    const paymentMethod = normalizePaymentMethod(row.formaPagamento)

    const tx: Transaction = {
      id: `real_${batchId}_${row.rowIndex}`,
      description: descricao,
      originalDescription: row.descricao,
      amount: amt,
      type: classification.type,
      classificationType: classification.classificationType,
      transactionDate,
      competenceDate,
      paymentDate,
      status,
      accountId,
      creditCardId: (formaPagamento === 'cartão' || formaPagamento === 'cartao')
        ? `card_real_${row.conta.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24)}`
        : undefined,
      macroCategoryId: classification.macroCategoryId,
      subCategoryId,
      paymentMethod,
      installmentCurrent: installment.current,
      installmentTotal: installment.total,
      isRecurring,
      includeInOperationalResult: classification.includeInOperationalResult,
      includeInCashflow: classification.includeInCashflow,
      includeInBudget: classification.includeInBudget,
      isInternalTransfer: classification.isInternalTransfer,
      isAdjustment: false,
      sourceFile: 'lancamentos_real_2026.xlsx',
      importBatchId: batchId,
      importHash: hash,
      origin: 'import_xlsx',
      source: 'real_xlsx',
      tags: row.tags ? row.tags.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) : [],
      group: row.grupo || undefined,
      categorySuggestionSource: categoria ? 'history' : 'none',
      categoryConfidence: categoria ? 'high' : undefined,
      needsReview: !categoria,
      createdAt: now,
      updatedAt: now,
    }

    imported.push(tx)
    existingHashes.add(hash)
  }

  if (subsCreated > 0) saveSubCategories(subs)

  return {
    transactions: imported,
    result: {
      imported: imported.length,
      skipped,
      duplicates,
      subcategoriesCreated: subsCreated,
      accounts: Array.from(accounts).sort(),
      cards: Array.from(cards).sort(),
      categoriesFound: Array.from(categoriesFound).sort(),
    },
  }
}

// ── Storage key for account/card registry ─────────────────────────────────────

const ACCOUNT_REGISTRY_KEY = 'fin_real_account_registry'

export interface AccountRegistry {
  accounts: Array<{ id: string; name: string; type: 'conta' | 'cartao' }>
}

export function loadAccountRegistry(): AccountRegistry {
  try {
    const raw = localStorage.getItem(ACCOUNT_REGISTRY_KEY)
    return raw ? (JSON.parse(raw) as AccountRegistry) : { accounts: [] }
  } catch { return { accounts: [] } }
}

export function upsertAccountRegistry(accounts: string[], cards: string[]): void {
  const registry = loadAccountRegistry()
  const existing = new Set(registry.accounts.map(a => a.id))
  const add = (name: string, type: 'conta' | 'cartao') => {
    const id = `acc_real_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24)}`
    if (!existing.has(id)) {
      registry.accounts.push({ id, name, type })
      existing.add(id)
    }
  }
  accounts.forEach(n => add(n, 'conta'))
  cards.forEach(n => add(n, 'cartao'))
  localStorage.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(registry))
}

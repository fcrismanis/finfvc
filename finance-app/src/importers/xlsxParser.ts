import * as XLSX from 'xlsx'
import type { RawTransaction } from './types'

const COLUMN_ALIASES: Record<string, string> = {
  // Type
  tipo: 'tipo',
  type: 'tipo',
  // Description
  descricao: 'descricao',
  descrição: 'descricao',
  description: 'descricao',
  memo: 'descricao',
  histórico: 'descricao',
  historico: 'descricao',
  lancamento: 'descricao', // Itaú: coluna "Lançamento"
  lancamentos: 'descricao',
  // Amount
  valor: 'valor',
  value: 'valor',
  amount: 'valor',
  quantia: 'valor',
  // Date
  data: 'data',
  date: 'data',
  'data lançamento': 'data',
  'data lancamento': 'data',
  // Competence date
  'data competencia': 'data_competencia',
  'data competência': 'data_competencia',
  competence: 'data_competencia',
  competência: 'data_competencia',
  // Payment date
  'data pagamento': 'data_pagamento',
  'data de pagamento': 'data_pagamento',
  'paid date': 'data_pagamento',
  // Status
  status: 'status',
  situacao: 'status',
  situação: 'status',
  // Payment method
  'forma de pagamento': 'forma_pagamento',
  'forma pagamento': 'forma_pagamento',
  'payment method': 'forma_pagamento',
  pagamento: 'forma_pagamento',
  // Account
  'conta/cartao': 'conta',
  'conta/cartão': 'conta',
  conta: 'conta',
  account: 'conta',
  cartao: 'conta',
  cartão: 'conta',
  // Category
  categoria: 'categoria',
  category: 'categoria',
  // Installment
  parcela: 'parcela',
  installment: 'parcela',
  // Recurring
  recorrente: 'recorrente',
  recurring: 'recorrente',
  // Tags
  tags: 'tags',
  etiquetas: 'tags',
  // Group
  grupo: 'grupo',
  group: 'grupo',
}

function normalizeColumnName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '') // drop trailing unit, e.g. "valor (r$)" -> "valor"
    .trim()
}

/** True if a numeric/string amount carries a negative sign (Itaú signed convention). */
function isNegativeAmount(value: string): boolean {
  return /-/.test(value) && /\d/.test(value)
}

/**
 * Statement exports (Itaú etc.) prepend metadata rows before the real header.
 * Find the first row that maps to a date plus a value or description column.
 */
function findHeaderRow(rows: (string | number | undefined)[][]): number {
  const limit = Math.min(rows.length, 25)
  for (let i = 0; i < limit; i++) {
    const headers = (rows[i] ?? []).map(h => String(h ?? ''))
    const map = mapColumns(headers)
    if ('data' in map && ('valor' in map || 'descricao' in map)) return i
  }
  return 0
}

function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const norm = normalizeColumnName(h)
    const alias = COLUMN_ALIASES[norm]
    if (alias && !(alias in map)) {
      map[alias] = i
    }
  })
  return map
}

function rowToRaw(row: (string | number | undefined)[], colMap: Record<string, number>, rowIndex: number, sourceFile: string, signedAmounts: boolean): RawTransaction | null {
  const get = (col: string): string => {
    const idx = colMap[col]
    if (idx === undefined) return ''
    const v = row[idx]
    return v !== undefined && v !== null ? String(v) : ''
  }

  const descricao = get('descricao').trim()
  const valor = get('valor').trim()

  if (!descricao && !valor) return null

  // No explicit "tipo" column (e.g. Itaú): derive from the sign of the amount.
  const rawType = get('tipo') || (signedAmounts ? (isNegativeAmount(valor) ? 'Despesa' : 'Receita') : 'Despesa')

  return {
    originalDescription: descricao,
    rawAmount: valor,
    rawDate: get('data'),
    rawCompetenceDate: get('data_competencia') || get('data'),
    rawPaymentDate: get('data_pagamento') || undefined,
    rawType,
    rawStatus: get('status') || 'Pago',
    rawPaymentMethod: get('forma_pagamento'),
    rawAccount: get('conta'),
    rawCategory: get('categoria'),
    rawInstallment: get('parcela') || undefined,
    rawRecurring: get('recorrente') || undefined,
    rawTags: get('tags') || undefined,
    rawGroup: get('grupo') || undefined,
    rowIndex,
    sourceFile,
  }
}

function rowsToRaw(rows: (string | number | undefined)[][], fileName: string): RawTransaction[] {
  if (rows.length < 2) return []

  const headerIdx = findHeaderRow(rows)
  const headers = (rows[headerIdx] ?? []).map(h => String(h ?? ''))
  const colMap = mapColumns(headers)

  // Detect signed convention (e.g. Itaú): if any value is negative and there is
  // no explicit "tipo" column, treat positives as income and negatives as expense.
  const valorIdx = colMap['valor']
  const signedAmounts =
    !('tipo' in colMap) &&
    valorIdx !== undefined &&
    rows.slice(headerIdx + 1).some(r => isNegativeAmount(String(r?.[valorIdx] ?? '')))

  const result: RawTransaction[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const raw = rowToRaw(rows[i] as (string | number | undefined)[], colMap, i, fileName, signedAmounts)
    if (raw) result.push(raw)
  }

  return result
}

function readRows(data: ArrayBuffer | string): (string | number | undefined)[][] {
  const wb = typeof data === 'string'
    ? XLSX.read(data, { type: 'string' })
    : XLSX.read(data, { type: 'array', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: undefined, blankrows: false })
}

export async function parseFile(file: File): Promise<RawTransaction[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return rowsToRaw(readRows(await file.text()), file.name)
  }

  return rowsToRaw(readRows(await file.arrayBuffer()), file.name)
}

export function validateParsedRows(rows: RawTransaction[]): { valid: RawTransaction[]; skipped: number } {
  const valid = rows.filter(r => r.originalDescription.trim() !== '' && r.rawAmount.trim() !== '')
  return { valid, skipped: rows.length - valid.length }
}

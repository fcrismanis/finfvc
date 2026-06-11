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
  return raw.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
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

function rowToRaw(row: (string | number | undefined)[], colMap: Record<string, number>, rowIndex: number, sourceFile: string): RawTransaction | null {
  const get = (col: string): string => {
    const idx = colMap[col]
    if (idx === undefined) return ''
    const v = row[idx]
    return v !== undefined && v !== null ? String(v) : ''
  }

  const descricao = get('descricao').trim()
  const valor = get('valor').trim()

  if (!descricao && !valor) return null

  return {
    originalDescription: descricao,
    rawAmount: valor,
    rawDate: get('data'),
    rawCompetenceDate: get('data_competencia') || get('data'),
    rawPaymentDate: get('data_pagamento') || undefined,
    rawType: get('tipo') || 'Despesa',
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

async function parseWorkbook(buffer: ArrayBuffer, fileName: string): Promise<RawTransaction[]> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]

  const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: undefined,
    blankrows: false,
  })

  if (rows.length < 2) return []

  const headers = (rows[0] as (string | number | undefined)[]).map(h => String(h ?? ''))
  const colMap = mapColumns(headers)

  const result: RawTransaction[] = []
  for (let i = 1; i < rows.length; i++) {
    const raw = rowToRaw(rows[i] as (string | number | undefined)[], colMap, i, fileName)
    if (raw) result.push(raw)
  }

  return result
}

async function parseCSVText(text: string, fileName: string): Promise<RawTransaction[]> {
  const wb = XLSX.read(text, { type: 'string' })
  const sheet = wb.Sheets[wb.SheetNames[0]]

  const rows: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: undefined,
    blankrows: false,
  })

  if (rows.length < 2) return []

  const headers = (rows[0] as (string | number | undefined)[]).map(h => String(h ?? ''))
  const colMap = mapColumns(headers)

  const result: RawTransaction[] = []
  for (let i = 1; i < rows.length; i++) {
    const raw = rowToRaw(rows[i] as (string | number | undefined)[], colMap, i, fileName)
    if (raw) result.push(raw)
  }

  return result
}

export async function parseFile(file: File): Promise<RawTransaction[]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    return parseCSVText(text, file.name)
  }

  const buffer = await file.arrayBuffer()
  return parseWorkbook(buffer, file.name)
}

export function validateParsedRows(rows: RawTransaction[]): { valid: RawTransaction[]; skipped: number } {
  const valid = rows.filter(r => r.originalDescription.trim() !== '' && r.rawAmount.trim() !== '')
  return { valid, skipped: rows.length - valid.length }
}

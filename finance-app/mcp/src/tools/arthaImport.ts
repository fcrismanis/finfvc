import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { classifyByDescription, isRawCategoryMapped } from '../importers/classifier.js'
import { fetchTransactions } from '../data/supabase.js'

/**
 * Importa a planilha do Artha para o ledger do FINFVC (Supabase).
 * - Padrão: SIMULAÇÃO (nada é gravado).
 * - Grava só com confirmed=true. Cada importação recebe um batch_id e pode ser desfeita
 *   com tool_arthaImportRollback.
 * - Reaproveita o classificador do app (neutraliza pagamento de fatura, transferências etc.).
 */

const dir = () => process.env.ARTHA_DIR ?? '/data/artha'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

function familyId(): string {
  const id = process.env.FAMILY_ID
  if (!id) throw new Error('FAMILY_ID não configurado')
  return id
}

// ── normalização (porte de finance-app/src/importers/normalizer.ts) ──────────

function normAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.abs(raw)
  let s = String(raw ?? '').replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const v = parseFloat(s.replace(/[^\d.-]/g, ''))
  return Number.isNaN(v) ? 0 : Math.abs(v)
}

function normDate(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  return undefined
}

const strip = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function normStatus(raw: string): 'paid' | 'pending' | 'cancelled' {
  const v = strip(raw)
  if (v.includes('pendente') || v.includes('agendado') || v.includes('previsto')) return 'pending'
  if (v.includes('cancel')) return 'cancelled'
  return 'paid'
}

function normPayment(raw: string): string {
  const v = strip(raw)
  if (v.includes('cartao') || v.includes('credito') || v.includes('card')) return 'card'
  if (v.includes('debito') || v.includes('debit')) return 'debit'
  if (v.includes('pix')) return 'pix'
  if (v.includes('boleto')) return 'boleto'
  if (v.includes('dinheiro') || v.includes('especie')) return 'cash'
  return 'account'
}

function parseInstallment(raw: string): { current?: number; total?: number } {
  const m = raw.match(/(\d+)\s*(?:\/|-|de)\s*(\d+)/i)
  return m ? { current: parseInt(m[1]), total: parseInt(m[2]) } : {}
}

const sameText = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase()
const fingerprint = (desc: string) => strip(desc).replace(/[^a-z0-9]/g, '').slice(0, 14)

// ── leitura da planilha ──────────────────────────────────────────────────────

type Row = Record<string, unknown>

function readMonth(month: string): { rows: Row[]; file: string } {
  const file = `artha-${month}.xlsx`
  const path = join(dir(), file)
  if (!existsSync(path)) throw new Error(`Planilha ${file} não encontrada. Use artha_list_exports.`)
  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
  return { rows, file }
}

const get = (r: Row, ...keys: string[]) => {
  for (const k of keys) if (r[k] != null && String(r[k]).trim() !== '') return String(r[k]).trim()
  return ''
}

interface Planned {
  row: Record<string, unknown>
  desc: string
  amount: number
  date: string
  macro: string
  cls: string
  neutral: boolean
  possibleDuplicate: boolean
  rawCategory: string
}

// ── plano ────────────────────────────────────────────────────────────────────

async function buildPlan(month: string, batchId: string) {
  const { rows, file } = readMonth(month)
  const now = new Date().toISOString()

  const seen = new Map<string, number>()
  const parsed: Planned[] = []
  let skippedEmpty = 0

  rows.forEach((r, idx) => {
    const original = get(r, 'Descrição', 'Descricao')
    const amount = normAmount(get(r, 'Valor'))
    const date = normDate(get(r, 'Data'))
    if (!original || !amount || !date) { skippedEmpty++; return }

    const competence = normDate(get(r, 'Data Competência', 'Data Competencia')) ?? date
    const payment = normDate(get(r, 'Data Pagamento'))
    const account = get(r, 'Conta/Cartão', 'Conta/Cartao')
    const rawType = get(r, 'Tipo') || 'Despesa'
    const rawCategory = get(r, 'Categoria / Subcategoria', 'Categoria')
    const installmentRaw = get(r, 'Parcela')
    const inst = parseInstallment(installmentRaw)
    const description = sameText(original)
    const cls = classifyByDescription(description, rawType, rawCategory)

    // hash estável: mesma linha reexportada gera o mesmo hash; linhas idênticas no mesmo dia
    // recebem sufixo de ocorrência (#1, #2…), independente da ordem da planilha.
    const base = ['ARTHA', description, amount.toFixed(2), date, account, installmentRaw].join('|')
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const importHash = createHash('sha1').update(`${base}#${n}`).digest('hex').slice(0, 24)

    const tags = get(r, 'Tags') ? get(r, 'Tags').split(',').map(t => t.trim()).filter(Boolean) : []
    const group = get(r, 'Grupo') || undefined

    parsed.push({
      desc: description,
      amount,
      date,
      macro: cls.macroCategoryId,
      cls: cls.classificationType,
      neutral: cls.classificationType === 'transfer' || cls.classificationType === 'neutral' || cls.isInternalTransfer,
      possibleDuplicate: false,
      rawCategory,
      row: {
        id: `imp_${batchId}_${idx}`,
        family_id: familyId(),
        description,
        original_description: original,
        amount,
        transaction_type: cls.type,
        classification_type: cls.classificationType,
        transaction_date: date,
        competence_date: competence,
        payment_date: payment ?? null,
        status: normStatus(get(r, 'Status') || 'Pago'),
        payment_method: normPayment(get(r, 'Forma de Pagamento')),
        account_id: account ? `acc_${account.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}` : 'acc_unknown',
        category_id: cls.categoryId,
        macro_category_id: cls.macroCategoryId,
        installment_current: inst.current ?? null,
        installment_total: inst.total ?? null,
        is_recurring: strip(get(r, 'Recorrente')).includes('sim'),
        include_in_operational_result: cls.includeInOperationalResult,
        include_in_cashflow: cls.includeInCashflow,
        include_in_budget: cls.includeInBudget,
        is_internal_transfer: cls.isInternalTransfer,
        import_batch_id: batchId,
        import_hash: importHash,
        source_file: file,
        raw_data: {
          origin: 'import_xlsx',
          source: 'artha',
          pluggyInstitutionName: 'Artha',
          arthaCategory: rawCategory || undefined,
          ...(tags.length ? { tags } : {}),
          ...(group ? { group } : {}),
        },
        manual_category_override: false,
        created_at: now,
        updated_at: now,
      },
    })
  })

  // possíveis duplicatas contra o ledger (mesmo valor + data + descrição parecida)
  const dates = parsed.map(p => p.date).sort()
  let existingInRange = 0
  if (dates.length) {
    const existing = await fetchTransactions({ periodFrom: dates[0].slice(0, 7), periodTo: dates[dates.length - 1].slice(0, 7) })
    const keys = new Set(existing.map(e => `${e.amount.toFixed(2)}|${e.transactionDate}|${fingerprint(e.description)}`))
    existingInRange = existing.length
    for (const p of parsed) {
      if (keys.has(`${p.amount.toFixed(2)}|${p.date}|${fingerprint(p.desc)}`)) p.possibleDuplicate = true
    }
  }

  return { parsed, skippedEmpty, existingInRange, file, totalRows: rows.length }
}

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100

export async function tool_arthaImportMonth(input: {
  month: string
  confirmed?: boolean
  include_possible_duplicates?: boolean
}) {
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new Error('month deve ser AAAA-MM')
  const batchId = `artha_${input.month.replace('-', '')}_${Date.now().toString(36)}`
  const plan = await buildPlan(input.month, batchId)

  const dups = plan.parsed.filter(p => p.possibleDuplicate)
  const toInsert = plan.parsed.filter(p => input.include_possible_duplicates || !p.possibleDuplicate)

  const byClass: Record<string, { n: number; total: number }> = {}
  const byMacro: Record<string, number> = {}
  for (const p of toInsert) {
    byClass[p.cls] ??= { n: 0, total: 0 }
    byClass[p.cls].n++
    byClass[p.cls].total = sum([byClass[p.cls].total, p.amount])
    if (!p.neutral) byMacro[p.macro] = sum([byMacro[p.macro] ?? 0, p.amount])
  }
  const real = toInsert.filter(p => !p.neutral)
  const incomeReal = sum(real.filter(p => p.row.transaction_type === 'income').map(p => p.amount))
  const expenseReal = sum(real.filter(p => p.row.transaction_type === 'expense').map(p => p.amount))

  const unmapped: Record<string, { n: number; total: number }> = {}
  for (const p of toInsert) {
    if (isRawCategoryMapped(p.rawCategory)) continue
    unmapped[p.rawCategory] ??= { n: 0, total: 0 }
    unmapped[p.rawCategory].n++
    unmapped[p.rawCategory].total = sum([unmapped[p.rawCategory].total, p.amount])
  }

  const summary = {
    month: input.month,
    file: plan.file,
    rows_in_file: plan.totalRows,
    skipped_invalid_rows: plan.skippedEmpty,
    to_insert: toInsert.length,
    possible_duplicates_of_existing: dups.length,
    existing_rows_in_period: plan.existingInRange,
    neutralized_count: toInsert.filter(p => p.neutral).length,
    income_real: incomeReal,
    expense_real: expenseReal,
    result_real: sum([incomeReal, -expenseReal]),
    by_classification: byClass,
    categories_without_mapping_fell_back_to_compras_or_keywords: Object.fromEntries(Object.entries(unmapped).sort((a, b) => b[1].total - a[1].total)),
    expense_by_macro_category: Object.fromEntries(Object.entries(byMacro).sort((a, b) => b[1] - a[1])),
    sample: toInsert.slice(0, 8).map(p => ({ description: p.desc, amount: p.amount, date: p.date, macro: p.macro, class: p.cls })),
    possible_duplicate_sample: dups.slice(0, 5).map(p => ({ description: p.desc, amount: p.amount, date: p.date })),
  }

  if (!input.confirmed) {
    return { mode: 'SIMULAÇÃO — nada foi gravado', ...summary, next: 'Para gravar, chame novamente com confirmed=true.' }
  }

  const rows = toInsert.map(p => p.row)
  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const { data, error } = await (sb().from('transactions') as any)
      .upsert(chunk, { onConflict: 'family_id,import_hash', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Falha ao gravar lote ${i / 200 + 1}: ${error.message}. Já gravados: ${inserted}. batch_id=${batchId}`)
    inserted += data?.length ?? 0
  }
  return {
    mode: 'GRAVADO',
    batch_id: batchId,
    inserted,
    ignored_by_hash: rows.length - inserted,
    ...summary,
    undo: `artha_import_rollback com batch_id=${batchId} e confirmed=true desfaz esta importação.`,
  }
}

export async function tool_arthaImportRollback(input: { batch_id: string; confirmed: boolean }) {
  if (!input.batch_id.startsWith('artha_')) throw new Error('Só é possível desfazer lotes criados por artha_import_month (batch_id começa com "artha_").')
  const q = sb().from('transactions').select('id', { count: 'exact', head: true })
    .eq('family_id', familyId()).eq('import_batch_id', input.batch_id)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  if (!input.confirmed) return { mode: 'SIMULAÇÃO', batch_id: input.batch_id, would_delete: count ?? 0, next: 'Chame com confirmed=true para excluir.' }
  const { error: delErr } = await sb().from('transactions').delete()
    .eq('family_id', familyId()).eq('import_batch_id', input.batch_id)
  if (delErr) throw new Error(delErr.message)
  return { mode: 'EXCLUÍDO', batch_id: input.batch_id, deleted: count ?? 0 }
}

import { suggestCategoryWithHistory } from './categorize.service'

/**
 * Pluggy Open Finance service.
 *
 * SECURITY: Never include Pluggy client_id or client_secret in frontend code.
 * Flow:
 *   1. Frontend calls your backend → backend calls Pluggy POST /auth/token
 *   2. Backend returns short-lived connect_token to frontend
 *   3. Frontend opens PluggyConnect widget with that token
 *   4. On success, backend webhook receives item_id
 *   5. Backend fetches /items/:id/transactions and stores them
 *
 * See docs/pluggy-integration.md for full setup guide.
 */

export type PluggyConnectStatus =
  | 'idle'
  | 'loading_token'
  | 'connecting'
  | 'syncing'
  | 'success'
  | 'error'

export type PluggyItemStatus =
  | 'UPDATED'
  | 'UPDATING'
  | 'WAITING_USER_INPUT'
  | 'LOGIN_ERROR'
  | 'OUTDATED'

export interface PluggyItem {
  id: string
  connectorName: string
  connectorImageUrl?: string
  status: PluggyItemStatus
  lastUpdatedAt: string
  createdAt: string
  error?: string
}

export interface PluggyAccount {
  id: string
  itemId: string
  name: string
  type: 'BANK' | 'CREDIT'
  subtype?: string
  balance: number
  currencyCode: string
}

export interface PluggyTransaction {
  id: string
  accountId: string
  date: string
  description: string
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
  providerCode?: string
  category?: string
}

export interface PluggyConnection {
  item: PluggyItem
  accounts: PluggyAccount[]
  lastSync: string
}

export interface PluggyDeduplicationKey {
  providerTransactionId?: string
  fallback?: string  // `${date}|${amount}|${description}|${accountId}`
}

export async function getConnectToken(_userId: string): Promise<string> {
  const res = await fetch('/api/pluggy/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: _userId }),
  })
  const data = await res.json() as { ok: boolean; token?: string; error?: string }
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(data.error ?? 'Token Pluggy ausente na resposta do servidor')
  }
  return data.token
}

export async function listConnections(_userId: string): Promise<PluggyConnection[]> {
  // Call your backend: GET /api/pluggy/connections
  const res = await fetch('/api/pluggy/connections')
  if (!res.ok) throw new Error('Failed to list Pluggy connections')
  return res.json() as Promise<PluggyConnection[]>
}

export interface PluggyPaymentData {
  paymentMethod?: string | null
  receiver?: { name?: string | null; documentNumber?: string | null } | null
  payer?: { name?: string | null; documentNumber?: string | null } | null
  reason?: string | null
}

export interface PluggyRawTransaction {
  id: string
  accountId: string
  accountType?: 'BANK' | 'CREDIT'
  date: string
  description: string
  descriptionRaw?: string | null
  amount: number
  type: 'DEBIT' | 'CREDIT'
  status: 'POSTED' | 'PENDING'
  providerCode: string | null
  category: string | null
  categoryId: string | null
  operationType?: string | null
  paymentData?: PluggyPaymentData | null
}

export async function fetchPluggyTransactions(
  params: { accountId: string; from: string; to: string } | { itemId: string; from: string; to: string }
): Promise<PluggyRawTransaction[]> {
  const res = await fetch('/api/pluggy/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json() as { ok: boolean; transactions?: PluggyRawTransaction[]; error?: string }
  if (!res.ok || !data.ok) throw new Error(data.error ?? 'Erro ao buscar transações Pluggy')
  return data.transactions ?? []
}

export function makeDeduplicationKey(tx: PluggyTransaction, accountId: string): PluggyDeduplicationKey {
  return {
    providerTransactionId: tx.providerCode,
    fallback: `${tx.date}|${Math.abs(tx.amount)}|${tx.description.slice(0, 40).toUpperCase()}|${accountId}`,
  }
}

// ── Local persistence for connections (localStorage) ──────────────────────────

const CONNECTIONS_KEY = 'fin_pluggy_connections'

export interface PluggyLocalAccount {
  id: string
  itemId: string
  name: string
  type: 'BANK' | 'CREDIT'
  subtype: string | null
  balance: number
  currencyCode: string
  limit: number | null
  availableLimit: number | null
  closeDate: string | null
  dueDate: string | null
  lastSyncAt?: string
  lastSyncCount?: number
}

export interface PluggyLocalConnection {
  itemId: string
  connectorName: string
  connectorImageUrl: string | null
  status: string
  createdAt: string
  lastUpdatedAt: string | null
  savedAt: string
  accounts: PluggyLocalAccount[]
}

export function getLocalConnections(): PluggyLocalConnection[] {
  try {
    const raw = localStorage.getItem(CONNECTIONS_KEY)
    return raw ? (JSON.parse(raw) as PluggyLocalConnection[]) : []
  } catch {
    return []
  }
}

export function saveLocalConnection(conn: PluggyLocalConnection): void {
  const all = getLocalConnections()
  const idx = all.findIndex(c => c.itemId === conn.itemId)
  if (idx >= 0) all[idx] = conn
  else all.push(conn)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
}

export function removeLocalConnection(itemId: string): void {
  const updated = getLocalConnections().filter(c => c.itemId !== itemId)
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(updated))
}

export async function registerConnection(itemId: string): Promise<PluggyLocalConnection> {
  const res = await fetch('/api/pluggy/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  const data = await res.json() as { ok: boolean; connection?: Omit<PluggyLocalConnection, 'savedAt'>; error?: string }
  if (!res.ok || !data.ok || !data.connection) {
    throw new Error(data.error ?? 'Erro ao registrar conexão Pluggy')
  }
  return { ...data.connection, savedAt: new Date().toISOString() }
}

// ── Pluggy category mapping ───────────────────────────────────────────────────
// Priority: categoryId (numeric code) → category (English name) → null

interface PluggyCatResult {
  macroCategoryId: string
  classificationType: import('../types').ClassificationType
  includeInOperationalResult?: boolean
  includeInBudget?: boolean
  includeInCashflow?: boolean
  isInternalTransfer?: boolean
}

const NEUTRAL: Partial<PluggyCatResult> = {
  classificationType: 'neutral',
  includeInOperationalResult: false,
  includeInBudget: false,
}

// Pluggy categoryId codes → FIN macro category
const PLUGGY_ID_MAP: Record<string, PluggyCatResult> = {
  // Alimentação
  '01010000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  '01020000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  '01030000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  '01040000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  '01050000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  '01000000': { macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense' },
  // Casa / Moradia
  '08000000': { macroCategoryId: 'mac_casa', classificationType: 'operational_expense' },
  '08010000': { macroCategoryId: 'mac_casa', classificationType: 'operational_expense' },
  '08020000': { macroCategoryId: 'mac_casa', classificationType: 'operational_expense' },
  '08030000': { macroCategoryId: 'mac_casa', classificationType: 'operational_expense' },
  '08040000': { macroCategoryId: 'mac_casa', classificationType: 'operational_expense' },
  // Saúde
  '09000000': { macroCategoryId: 'mac_saude', classificationType: 'operational_expense' },
  '09010000': { macroCategoryId: 'mac_saude', classificationType: 'operational_expense' },
  '09020000': { macroCategoryId: 'mac_saude', classificationType: 'operational_expense' },
  '09030000': { macroCategoryId: 'mac_saude', classificationType: 'operational_expense' },
  // Transporte
  '10000000': { macroCategoryId: 'mac_transporte', classificationType: 'operational_expense' },
  '10010000': { macroCategoryId: 'mac_transporte', classificationType: 'operational_expense' },
  '10020000': { macroCategoryId: 'mac_transporte', classificationType: 'operational_expense' },
  '10030000': { macroCategoryId: 'mac_transporte', classificationType: 'operational_expense' },
  // Educação — confirmado no payload real
  '07000000': { macroCategoryId: 'mac_educacao', classificationType: 'operational_expense' },
  '07010000': { macroCategoryId: 'mac_educacao', classificationType: 'operational_expense' },
  '07020000': { macroCategoryId: 'mac_educacao', classificationType: 'operational_expense' },
  // Assinaturas
  '11000000': { macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense' },
  '11010000': { macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense' },
  '11020000': { macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense' },
  // Compras
  '12000000': { macroCategoryId: 'mac_compras', classificationType: 'operational_expense' },
  '12010000': { macroCategoryId: 'mac_compras', classificationType: 'operational_expense' },
  '12020000': { macroCategoryId: 'mac_compras', classificationType: 'operational_expense' },
  // Serviços
  '13000000': { macroCategoryId: 'mac_servicos', classificationType: 'operational_expense' },
  // Seguros
  '14000000': { macroCategoryId: 'mac_seguros', classificationType: 'operational_expense' },
  // Lazer
  '15000000': { macroCategoryId: 'mac_lazer', classificationType: 'operational_expense' },
  '15010000': { macroCategoryId: 'mac_lazer', classificationType: 'operational_expense' },
  // Impostos
  '16000000': { macroCategoryId: 'mac_impostos', classificationType: 'operational_expense' },
  // Cuidados pessoais
  '17000000': { macroCategoryId: 'mac_cuidados', classificationType: 'operational_expense' },
  // Pets
  '18000000': { macroCategoryId: 'mac_pets', classificationType: 'operational_expense' },
  // Dívida / Financiamento — confirmado no payload real
  '02000000': { macroCategoryId: 'mac_divida', classificationType: 'debt_cost' },
  '02010000': { macroCategoryId: 'mac_divida', classificationType: 'debt_cost' },
  '02020000': { macroCategoryId: 'mac_divida', classificationType: 'debt_cost' },
  // Receita
  '03000000': { macroCategoryId: 'mac_receita_op', classificationType: 'operational_income' },
  '03010000': { macroCategoryId: 'mac_receita_op', classificationType: 'operational_income' },
  '03020000': { macroCategoryId: 'mac_receita_ev', classificationType: 'extraordinary_income' },
  // Transferências / movfin — confirmados no payload real
  '04000000': { macroCategoryId: 'mac_movfin', ...NEUTRAL, isInternalTransfer: true } as PluggyCatResult,
  '04010000': { macroCategoryId: 'mac_movfin', ...NEUTRAL, isInternalTransfer: true } as PluggyCatResult,
  '05000000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05010000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05020000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05030000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05040000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05050000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05060000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult,
  '05070000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult, // PIX — confirmado
  '06000000': { macroCategoryId: 'mac_movfin', ...NEUTRAL } as PluggyCatResult, // Investimentos
}

const PLUGGY_CAT_MAP: Record<string, string> = {
  // ── English (Pluggy API output) ──
  // Food & drink
  'Groceries':             'mac_alimentacao',
  'Eating out':            'mac_alimentacao',
  'Bars and restaurants':  'mac_alimentacao',
  'Food and drink':        'mac_alimentacao',
  'Bakeries':              'mac_alimentacao',
  'Coffee shops':          'mac_alimentacao',
  // Housing & utilities
  'Housing':               'mac_casa',
  'Rent':                  'mac_casa',
  'Water and sewage':      'mac_casa',
  'Electricity':           'mac_casa',
  'Gas':                   'mac_casa',
  'Internet and telephone':'mac_casa',
  'Home maintenance':      'mac_casa',
  'Home and garden':       'mac_casa',
  'Bills and utilities':   'mac_casa',
  // Health
  'Healthcare':            'mac_saude',
  'Pharmacy':              'mac_saude',
  'Doctors and clinics':   'mac_saude',
  'Gym and fitness centers':'mac_saude',
  'Health insurance':      'mac_saude',
  'Health and beauty':     'mac_saude',
  // Transport
  'Transport':             'mac_transporte',
  'Fuel':                  'mac_transporte',
  'Parking':               'mac_transporte',
  'Tolls and parking':     'mac_transporte',
  'Public transport':      'mac_transporte',
  'Ride hailing':          'mac_transporte',
  'Car maintenance':       'mac_transporte',
  // Education
  'Education':             'mac_educacao',
  'Courses and training':  'mac_educacao',
  'School supplies':       'mac_educacao',
  // Subscriptions
  'Digital services':      'mac_assinaturas',
  'Streaming':             'mac_assinaturas',
  'Subscriptions':         'mac_assinaturas',
  'Apps':                  'mac_assinaturas',
  // Shopping
  'Shopping':              'mac_compras',
  'Online shopping':       'mac_compras',
  'Electronics':           'mac_compras',
  'Clothing':              'mac_compras',
  'Home appliances':       'mac_compras',
  // Services
  'Services':              'mac_servicos',
  'Professional services': 'mac_servicos',
  'Domestic services':     'mac_servicos',
  // Insurance
  'Insurance':             'mac_seguros',
  'Life insurance':        'mac_seguros',
  'Car insurance':         'mac_seguros',
  // Leisure
  'Leisure and tourism':   'mac_lazer',
  'Travel':                'mac_lazer',
  'Cinema and theater':    'mac_lazer',
  'Sports and leisure':    'mac_lazer',
  'Entertainment':         'mac_lazer',
  // Personal care
  'Personal care':         'mac_cuidados',
  'Beauty salon':          'mac_cuidados',
  'Wellness':              'mac_cuidados',
  // Pets
  'Pets':                  'mac_pets',
  'Veterinary':            'mac_pets',
  // Taxes & fees
  'Taxes':                 'mac_impostos',
  'Bank fees':             'mac_impostos',
  'Fees':                  'mac_impostos',
  // Income
  'Salary':                'mac_receita_op',
  'Income':                'mac_receita_ev',
  'Other credits':         'mac_receita_ev',
  'Investment returns':    'mac_receita_ev',
  // Financial movements (neutral — must be handled specially in mapper)
  'Credit card payment':   'mac_movfin',
  'Transfers':             'mac_movfin',
  'Investments':           'mac_movfin',
  // Debt
  'Loans and financing':   'mac_divida',
  'Loan':                  'mac_divida',
  'Financing':             'mac_divida',

  // ── Portuguese fallback ──
  'Alimentação e Bebidas': 'mac_alimentacao',
  'Restaurantes e Bares':  'mac_alimentacao',
  'Supermercados':         'mac_alimentacao',
  'Padaria e Confeitaria': 'mac_alimentacao',
  'Açougue e Peixaria':    'mac_alimentacao',
  'Bebidas':               'mac_alimentacao',
  'Casa e Jardim':         'mac_casa',
  'Contas e Utilidades':   'mac_casa',
  'Aluguel':               'mac_casa',
  'Água e Esgoto':         'mac_casa',
  'Energia Elétrica':      'mac_casa',
  'Gás':                   'mac_casa',
  'Internet e Telefone':   'mac_casa',
  'Manutenção e Reparos':  'mac_casa',
  'Saúde e Beleza':        'mac_saude',
  'Farmácias':             'mac_saude',
  'Médicos e Clínicas':    'mac_saude',
  'Academia e Esportes':   'mac_saude',
  'Plano de Saúde':        'mac_saude',
  'Transporte':            'mac_transporte',
  'Combustível':           'mac_transporte',
  'Pedágios e Estacionamentos':'mac_transporte',
  'Transporte Público':    'mac_transporte',
  'Aplicativos de Transporte':'mac_transporte',
  'Manutenção de Veículo': 'mac_transporte',
  'Educação':              'mac_educacao',
  'Cursos e Treinamentos': 'mac_educacao',
  'Material Escolar':      'mac_educacao',
  'Assinaturas e Serviços':'mac_assinaturas',
  'Streaming e Entretenimento':'mac_assinaturas',
  'Aplicativos':           'mac_assinaturas',
  'Compras e Shopping':    'mac_compras',
  'Vestuário e Calçados':  'mac_compras',
  'Eletrônicos':           'mac_compras',
  'Eletrodomésticos':      'mac_compras',
  'Lojas Online':          'mac_compras',
  'Serviços Profissionais':'mac_servicos',
  'Serviços Domésticos':   'mac_servicos',
  'Seguros':               'mac_seguros',
  'Seguro de Vida':        'mac_seguros',
  'Seguro Veicular':       'mac_seguros',
  'Lazer e Turismo':       'mac_lazer',
  'Viagens':               'mac_lazer',
  'Cinema e Teatro':       'mac_lazer',
  'Bares e Baladas':       'mac_lazer',
  'Esportes e Lazer':      'mac_lazer',
  'Animais e Pets':        'mac_pets',
  'Veterinário':           'mac_pets',
  'Impostos e Taxas':      'mac_impostos',
  'IPTU':                  'mac_impostos',
  'IPVA':                  'mac_impostos',
  'Cuidados Pessoais':     'mac_cuidados',
  'Salão de Beleza':       'mac_cuidados',
  'Bem Estar':             'mac_cuidados',
  'Salário':               'mac_receita_op',
  'Receita':               'mac_receita_ev',
  'Outros Créditos':       'mac_receita_ev',
  'Transferências':        'mac_movfin',
  'Investimentos':         'mac_movfin',
  'Empréstimos':           'mac_divida',
  'Financiamentos':        'mac_divida',
}

const NEUTRAL_CATEGORY_NAMES = new Set([
  'Credit card payment', 'Transfers', 'Transferências',
  'Same person transfer', 'Transfer - PIX',
])

export function pluggyCategoryToResult(
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): PluggyCatResult | null {
  // Priority 1: numeric code (most reliable)
  if (categoryId) {
    const byId = PLUGGY_ID_MAP[categoryId]
    if (byId) return byId
  }
  // Priority 2: English name
  if (categoryName) {
    const macroId = PLUGGY_CAT_MAP[categoryName]
    if (macroId) {
      const isNeutral = NEUTRAL_CATEGORY_NAMES.has(categoryName)
      return isNeutral
        ? { macroCategoryId: macroId, ...NEUTRAL } as PluggyCatResult
        : { macroCategoryId: macroId, classificationType: 'operational_expense' }
    }
  }
  return null
}

/** @deprecated use pluggyCategoryToResult */
export function pluggyCategoryToMacro(pluggyCategory: string | null): string | null {
  if (!pluggyCategory) return null
  return PLUGGY_CAT_MAP[pluggyCategory] ?? null
}

// ── Map Pluggy raw transactions → app Transaction format ──────────────────────

export interface MapResult {
  newTxs: import('../types').Transaction[]
  duplicateCount: number
  incomeCount: number
  expenseCount: number
  autoCategorizedCount: number
  needsReviewCount: number
}

export interface ConnInfo {
  accountName: string
  institutionName: string
  institutionLogoUrl: string | null
}

export function mapPluggyToTransactions(
  pluggyTxs: PluggyRawTransaction[],
  accountId: string,
  existingTxs: import('../types').Transaction[],
  connInfo?: ConnInfo,
): MapResult {
  const existingHashes = new Set(existingTxs.map(t => t.importHash).filter(Boolean))
  const existingIds = new Set(existingTxs.map(t => t.id))
  const batchId = `pluggy_${Date.now().toString(36)}`
  const now = new Date().toISOString()

  const allMapped: import('../types').Transaction[] = pluggyTxs.map(ptx => {
    const importHash = ptx.providerCode
      ? `pluggy_${ptx.providerCode}`
      : `${(ptx.date ?? '').slice(0, 10)}|${Math.abs(ptx.amount)}|${(ptx.description ?? '').slice(0, 40).toUpperCase()}|${accountId}`

    const type: import('../types').TransactionType = ptx.type === 'CREDIT' ? 'income' : 'expense'
    const defaultClassification: import('../types').ClassificationType =
      type === 'income' ? 'operational_income' : 'operational_expense'

    const baseTx: import('../types').Transaction = {
      id: `pluggy_${ptx.id}`,
      description: ptx.description ?? '',
      originalDescription: ptx.description ?? '',
      amount: Math.abs(ptx.amount),
      type,
      classificationType: defaultClassification,
      transactionDate: (ptx.date ?? now).slice(0, 10),
      competenceDate: (ptx.date ?? now).slice(0, 10),
      status: ptx.status === 'POSTED' ? 'paid' : 'pending',
      accountId,
      paymentMethod: 'account' as import('../types').PaymentMethod,
      isRecurring: false,
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: true,
      isInternalTransfer: false,
      isAdjustment: false,
      origin: 'import_api' as const,
      source: 'pluggy',
      needsReview: true,
      importHash,
      importBatchId: batchId,
      lastImportedAt: now,
      pluggyCategory:      ptx.category ?? undefined,
      pluggyCategoryId:    ptx.categoryId ?? undefined,
      pluggyOperationType: ptx.operationType ?? undefined,
      pluggyPaymentMethod: ptx.paymentData?.paymentMethod ?? undefined,
      pluggyReceiverName:  ptx.paymentData?.receiver?.name ?? undefined,
      pluggyPayerName:     ptx.paymentData?.payer?.name ?? undefined,
      pluggyAccountName:   connInfo?.accountName,
      pluggyInstitutionName: connInfo?.institutionName,
      pluggyInstitutionLogoUrl: connInfo?.institutionLogoUrl ?? undefined,
      createdAt: now,
      updatedAt: now,
    }

    // Priority 1: history-based (high confidence wins; medium also applied)
    const suggestion = suggestCategoryWithHistory(baseTx, existingTxs)
    if (suggestion && suggestion.classificationType !== 'neutral') {
      return {
        ...baseTx,
        macroCategoryId: suggestion.macroCategoryId,
        categoryId: suggestion.categoryId || undefined,
        subCategoryId: suggestion.subCategoryId,
        classificationType: suggestion.classificationType,
        needsReview: suggestion.confidence !== 'high',
      }
    }

    // Priority 2: Pluggy provider category (by ID first, then by name)
    const catResult = pluggyCategoryToResult(ptx.categoryId, ptx.category)
    if (catResult) {
      return {
        ...baseTx,
        macroCategoryId:           catResult.macroCategoryId,
        classificationType:        catResult.classificationType,
        includeInOperationalResult: catResult.includeInOperationalResult ?? true,
        includeInBudget:           catResult.includeInBudget ?? true,
        includeInCashflow:         catResult.includeInCashflow ?? true,
        isInternalTransfer:        catResult.isInternalTransfer ?? false,
        needsReview: false,
      }
    }

    return baseTx
  })

  const newTxs = allMapped.filter(t =>
    !existingIds.has(t.id) && !(t.importHash && existingHashes.has(t.importHash))
  )

  const autoCategorizedCount = newTxs.filter(t => t.macroCategoryId && !t.needsReview).length
  const needsReviewCount = newTxs.filter(t => t.needsReview).length

  return {
    newTxs,
    duplicateCount: allMapped.length - newTxs.length,
    incomeCount: newTxs.filter(t => t.type === 'income').length,
    expenseCount: newTxs.filter(t => t.type === 'expense').length,
    autoCategorizedCount,
    needsReviewCount,
  }
}

// ── Update per-account sync metadata in localStorage ─────────────────────────

export function updateConnectionSyncMeta(itemId: string, accountId: string, importedCount: number): void {
  const all = getLocalConnections()
  const conn = all.find(c => c.itemId === itemId)
  if (!conn) return
  const acc = conn.accounts.find(a => a.id === accountId)
  if (!acc) return
  acc.lastSyncAt = new Date().toISOString()
  acc.lastSyncCount = (acc.lastSyncCount ?? 0) + importedCount
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(all))
}

// ── Compute period date range from a preset ───────────────────────────────────

export function getPeriodDates(
  period: 'current_month' | 'last_30d' | 'last_90d' | 'custom',
  _customFrom?: string,
  _customTo?: string,
): { from: string; to: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (period === 'current_month') {
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const lastDay = new Date(y, m, 0).getDate()
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` }
  }
  const days = period === 'last_30d' ? 30 : 90
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  }
  // 'custom' handled by caller
}

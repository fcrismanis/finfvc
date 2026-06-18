import { useState, useEffect, useRef } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import { useData } from '../context/DataContext'
import {
  getConnectToken,
  getLocalConnections,
  saveLocalConnection,
  removeLocalConnection,
  registerConnection,
  fetchPluggyTransactions,
  mapPluggyToTransactions,
  lookupPluggyCategory,
  inferCategoryFromText,
  updateConnectionSyncMeta,
  toggleAccountDailySync,
  getPeriodDates,
  restoreConnectionsFromServer,
  type ConnInfo,
} from '../services/pluggy.service'
import {
  diagnosePluggyStorage,
  recoverPluggyStorage,
  hasPluggyConnectionsBackup,
  restorePluggyConnectionsFromBackup,
  updateAccountDiagnostics,
  type DiagnosticResult,
  type RecoveryResult,
} from '../services/pluggyStorage.service'
import { MACRO_CATEGORIES } from '../config/categories'
import { currentFinancialDate, formatFinancialDateBR, normalizeFinancialDate } from '../utils/date'
import { loadDailySyncStatus, type DailySyncStatus } from '../hooks/useDailyPluggySync'
import { SyncModal, PERIOD_LABELS, type SyncSession, type PeriodPreset } from '../components/pluggy/PluggySyncModal'
import type { PluggyLocalConnection, MapResult } from '../services/pluggy.service'
import type { Transaction } from '../types'

const IS_DEV = import.meta.env.DEV
const DEBUG_DATES = IS_DEV && import.meta.env.VITE_DEBUG_PLUGGY_DATES

interface ReclassExample {
  description: string
  before: string
  after: string
  source: string
  confidence: string
}

interface ReclassPreview {
  total: number
  fromPluggyCat: number
  fromInference: number
  willReclassify: number
  willSkip: number
  noMap: number
  byMacro: Record<string, number>
  examples: ReclassExample[]
  patches: Array<{ id: string; patch: Partial<Transaction> }>
}

const SOURCE_LABEL: Record<string, string> = {
  id:        'Pluggy categoryId',
  name:      'Pluggy category',
  inference: 'Inferência por texto',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'alta',
  medium: 'média',
  low:    'baixa',
}

function buildReclassPreview(pluggyTxs: Transaction[]): ReclassPreview {
  const patches: ReclassPreview['patches'] = []
  const byMacro: Record<string, number> = {}
  const examples: ReclassExample[] = []
  let noMap = 0
  let willSkip = 0
  let fromPluggyCat = 0
  let fromInference = 0
  const now = new Date().toISOString()

  for (const tx of pluggyTxs) {
    if (tx.manualCategoryOverride || tx.manualSubCategoryOverride || (tx.manualEditedAt && tx.macroCategoryId)) {
      willSkip++
      continue
    }
    if (tx.macroCategoryId && !tx.needsReview) continue

    let result = lookupPluggyCategory(tx.pluggyCategoryId ?? null, tx.pluggyCategory ?? null)
    if (!result) {
      const descParts = [tx.description, tx.originalDescription, tx.pluggyOperationType, tx.pluggyPaymentMethod]
        .filter(Boolean).join(' ')
      result = inferCategoryFromText(descParts, tx.pluggyReceiverName ?? null, tx.pluggyPayerName ?? null)
    }
    if (!result) { noMap++; continue }

    if (result.source === 'inference') fromInference++
    else fromPluggyCat++

    byMacro[result.macroCategoryId] = (byMacro[result.macroCategoryId] ?? 0) + 1

    const suggestionSource: Transaction['categorySuggestionSource'] =
      result.source === 'id' ? 'pluggy_id' : result.source === 'name' ? 'pluggy_name' : 'text_inference'

    patches.push({
      id: tx.id,
      patch: {
        macroCategoryId:            result.macroCategoryId,
        subCategoryId:              result.subCategoryId,
        subCategoryNameSuggested:   result.subCategoryNameSuggested,
        classificationType:         result.classificationType,
        includeInOperationalResult: result.includeInOperationalResult ?? true,
        includeInBudget:            result.includeInBudget ?? true,
        includeInCashflow:          result.includeInCashflow ?? true,
        isInternalTransfer:         result.isInternalTransfer ?? false,
        pluggyCategoryMapped:       result.source !== 'inference',
        categoryConfidence:         result.confidence,
        categorySuggestionSource:   suggestionSource,
        needsReview:                result.confidence !== 'high',
        updatedAt: now,
      },
    })

    if (examples.length < 5) {
      const beforeMacro = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
      const afterMacro = MACRO_CATEGORIES.find(m => m.id === result.macroCategoryId)
      examples.push({
        description: tx.description,
        before: beforeMacro?.name ?? 'A classificar',
        after: result.subCategoryNameSuggested
          ? `${afterMacro?.name ?? result.macroCategoryId} · ${result.subCategoryNameSuggested}`
          : (afterMacro?.name ?? result.macroCategoryId),
        source: SOURCE_LABEL[result.source] ?? result.source,
        confidence: CONFIDENCE_LABEL[result.confidence] ?? result.confidence,
      })
    }
  }

  return {
    total: pluggyTxs.length,
    fromPluggyCat,
    fromInference,
    willReclassify: patches.length,
    willSkip,
    noMap,
    byMacro,
    examples,
    patches,
  }
}

type BackendStatus = 'checking' | 'configured' | 'not_configured'

interface PluggyDateRepairCandidate {
  id: string
  description: string
  reason: string
  beforeDate: string
  afterDate: string
  beforeCompetenceDate: string
  afterCompetenceDate: string
  beforePaymentDate?: string
  afterPaymentDate?: string
  patch: Partial<Transaction>
}

interface PluggyDateRepairPreview {
  analyzed: number
  missingEvidence: number
  candidates: PluggyDateRepairCandidate[]
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso: string) =>
  formatFinancialDateBR(iso)

const STATUS_LABEL: Record<string, string> = {
  UPDATED:            'Atualizado',
  UPDATING:           'Sincronizando…',
  WAITING_USER_INPUT: 'Aguardando input',
  LOGIN_ERROR:        'Erro de login',
  OUTDATED:           'Desatualizado',
}

const STATUS_COLOR: Record<string, string> = {
  UPDATED:            'var(--pos)',
  UPDATING:           'var(--warn)',
  WAITING_USER_INPUT: 'var(--warn)',
  LOGIN_ERROR:        'var(--crit)',
  OUTDATED:           'var(--crit)',
}


function firstRawDate(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

function isLikelyPluggyTransaction(tx: Transaction): boolean {
  return tx.source === 'pluggy'
    || tx.origin === 'import_api'
    || tx.id.startsWith('pluggy_')
    || Boolean(tx.importHash?.startsWith('pluggy_'))
    || Boolean(
      tx.pluggyCategory
      || tx.pluggyCategoryId
      || tx.pluggyInstitutionName
      || tx.pluggyRawDate
      || tx.pluggyRawTransactionDate
    )
}

function buildPluggyDateRepairPreview(transactions: Transaction[]): PluggyDateRepairPreview {
  const pluggyTxs = transactions.filter(isLikelyPluggyTransaction)
  const candidates: PluggyDateRepairCandidate[] = []
  let missingEvidence = 0

  for (const tx of pluggyTxs) {
    const primaryRaw = firstRawDate(
      tx.pluggyRawTransactionDate,
      tx.pluggyRawDate,
      tx.pluggyRawOperationDate,
      tx.pluggyRawPaymentDate,
      tx.pluggyRawCompetenceDate,
    )
    if (!primaryRaw) {
      missingEvidence++
      continue
    }

    const expectedDate = normalizeFinancialDate(primaryRaw, '')
    if (!expectedDate) {
      missingEvidence++
      continue
    }

    const expectedCompetenceDate = normalizeFinancialDate(tx.pluggyRawCompetenceDate ?? primaryRaw, expectedDate)
    const expectedPaymentDate = tx.pluggyRawPaymentDate ? normalizeFinancialDate(tx.pluggyRawPaymentDate, '') : undefined
    const reasons: string[] = []
    const patch: Partial<Transaction> = {}

    if (tx.transactionDate !== expectedDate) {
      patch.transactionDate = expectedDate
      reasons.push('transactionDate')
    }
    if (tx.competenceDate !== expectedCompetenceDate) {
      patch.competenceDate = expectedCompetenceDate
      reasons.push('competenceDate')
    }
    if (expectedPaymentDate && tx.paymentDate !== expectedPaymentDate) {
      patch.paymentDate = expectedPaymentDate
      reasons.push('paymentDate')
    }

    if (reasons.length === 0) continue

    candidates.push({
      id: tx.id,
      description: tx.description,
      reason: reasons.join(', '),
      beforeDate: tx.transactionDate,
      afterDate: expectedDate,
      beforeCompetenceDate: tx.competenceDate,
      afterCompetenceDate: expectedCompetenceDate,
      beforePaymentDate: tx.paymentDate,
      afterPaymentDate: expectedPaymentDate,
      patch,
    })
  }

  return { analyzed: pluggyTxs.length, missingEvidence, candidates }
}

export function PluggyPage() {
  const { transactions, appendTransactions, updateTransaction, updateTransactions } = useData()
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [fetchingToken, setFetchingToken] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncSession | null>(null)
  const [syncAll, setSyncAll] = useState(false)
  const [showBackupBanner, setShowBackupBanner] = useState(false)
  const [reclassPreview, setReclassPreview] = useState<ReclassPreview | null>(null)
  const [reclassRunning, setReclassRunning] = useState(false)
  const [repairPreview, setRepairPreview] = useState<PluggyDateRepairPreview | null>(null)
  const [repairRunning, setRepairRunning] = useState(false)
  const [recoveryDiag, setRecoveryDiag] = useState<DiagnosticResult | null>(null)
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null)
  const [dailySyncStatus, setDailySyncStatus] = useState<DailySyncStatus | null>(() => loadDailySyncStatus())
  const pendingPersistTraceRef = useRef<string[] | null>(null)

  useEffect(() => {
    fetch('/api/pluggy/status')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { configured: boolean }) => setBackendStatus(d.configured ? 'configured' : 'not_configured'))
      .catch(() => setBackendStatus('not_configured'))
    const loaded = getLocalConnections()
    if (loaded.length > 0) {
      setConnections(loaded)
    } else {
      if (hasPluggyConnectionsBackup()) {
        setShowBackupBanner(true)
      }
      restoreConnectionsFromServer().then(restored => {
        if (restored.length > 0) {
          setConnections(restored)
          setShowBackupBanner(false)
        }
      })
    }
  }, [])

  // Poll daily sync status while it's running so the banner updates
  useEffect(() => {
    if (!dailySyncStatus?.running) return
    const id = setInterval(() => {
      const latest = loadDailySyncStatus()
      setDailySyncStatus(latest)
      if (!latest?.running) {
        clearInterval(id)
        setConnections(getLocalConnections())
      }
    }, 1500)
    return () => clearInterval(id)
  }, [dailySyncStatus?.running])

  useEffect(() => {
    if (!DEBUG_DATES || !pendingPersistTraceRef.current?.length) return
    const pendingIds = new Set(pendingPersistTraceRef.current)
    const persisted = transactions.filter(tx => pendingIds.has(tx.id))
    if (persisted.length === 0) return
    console.debug('[PluggyDateTrace:Persisted]', persisted.map(tx => ({
      id: tx.id,
      description: tx.description,
      transactionDate: tx.transactionDate,
      competenceDate: tx.competenceDate,
      paymentDate: tx.paymentDate,
      providerRawDate: tx.providerRawDate,
      providerDateField: tx.providerDateField,
    })))
    pendingPersistTraceRef.current = null
  }, [transactions])

  function handleDiagnose() {
    setRecoveryResult(null)
    setRecoveryDiag(diagnosePluggyStorage())
  }

  function handleRecover() {
    const result = recoverPluggyStorage()
    setRecoveryResult(result)
    if (result.ok && result.count > 0) {
      setConnections(getLocalConnections())
    }
    setRecoveryDiag(null)
  }

  function handleRestoreBackup() {
    const result = restorePluggyConnectionsFromBackup()
    if (result.ok && result.count > 0) {
      setConnections(getLocalConnections())
      setRecoveryResult({
        ok: true,
        source: 'fin_pluggy_connections_backup',
        count: result.count,
        backupKey: null,
        message: result.message,
      })
    }
    setShowBackupBanner(false)
  }

  async function handleConnect() {
    setFetchingToken(true)
    setTokenError(null)
    try {
      const token = await getConnectToken('local-user')
      setConnectToken(token)
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Erro ao obter token Pluggy')
    } finally {
      setFetchingToken(false)
    }
  }

  async function handleSuccess({ item }: { item: { id: string } }) {
    setConnectToken(null)
    setRegistering(true)
    setTokenError(null)
    try {
      const conn = await registerConnection(item.id)
      saveLocalConnection(conn)
      setConnections(getLocalConnections())
      setShowBackupBanner(false)
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Erro ao salvar conexão')
    } finally {
      setRegistering(false)
    }
  }

  function handleError(error: { message: string }) {
    setConnectToken(null)
    setTokenError(`Erro na conexão: ${error.message}`)
  }

  function handleClose() { setConnectToken(null) }

  function handleDisconnect(itemId: string) {
    if (!confirm('Remover esta conexão do FIN? Isso não desconecta o banco na Pluggy.')) return
    removeLocalConnection(itemId)
    setConnections(getLocalConnections())
  }

  function handleToggleDailySync(itemId: string, accountId: string, enabled: boolean) {
    toggleAccountDailySync(itemId, accountId, enabled)
    setConnections(getLocalConnections())
  }

  function handleReclassPreview() {
    const pluggyTxs = transactions.filter(isLikelyPluggyTransaction)
    setReclassPreview(buildReclassPreview(pluggyTxs))
  }

  async function handleReclassConfirm() {
    if (!reclassPreview) return
    setReclassRunning(true)
    try {
      for (const { id, patch } of reclassPreview.patches) {
        updateTransaction(id, patch)
      }
      await new Promise(r => setTimeout(r, 200))
    } finally {
      setReclassRunning(false)
      setReclassPreview(null)
    }
  }

  function handleRepairPreview() {
    setRepairPreview(buildPluggyDateRepairPreview(transactions))
  }

  async function handleRepairConfirm() {
    if (!repairPreview || repairPreview.candidates.length === 0) return
    setRepairRunning(true)
    try {
      await updateTransactions(
        repairPreview.candidates.map(candidate => ({ id: candidate.id, patch: candidate.patch })),
        { markManual: false },
      )
      setRepairPreview(null)
    } finally {
      setRepairRunning(false)
    }
  }

  function buildConnInfo(itemId: string, _accountId: string, accountName: string): ConnInfo | undefined {
    const conn = connections.find(c => c.itemId === itemId)
    if (!conn) return undefined
    return {
      accountName,
      institutionName: conn.connectorName,
      institutionLogoUrl: conn.connectorImageUrl,
    }
  }

  function startSync(itemId: string, accountId: string, accountName: string) {
    const today = currentFinancialDate()
    setSync({ itemId, accountId, accountName, period: 'last_7d', customFrom: '2024-01-01', customTo: today, phase: 'period_select' })
  }

  async function doFetch(period: PeriodPreset, customFrom: string, customTo: string) {
    if (!sync) return
    let from: string; let to: string
    if (period === 'custom') {
      if (!customFrom || !customTo) return
      from = customFrom; to = customTo
    } else {
      const dates = getPeriodDates(period)
      from = dates.from; to = dates.to
    }
    const connInfo = buildConnInfo(sync.itemId, sync.accountId, sync.accountName)
    setSync(s => s ? { ...s, period, customFrom, customTo, phase: 'fetching', result: undefined } : s)
    try {
      const raw = await fetchPluggyTransactions({ accountId: sync.accountId, from, to })
      const result = mapPluggyToTransactions(raw, sync.accountId, transactions, connInfo)
      setSync(s => s ? { ...s, phase: 'preview', result } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao buscar transações' } : s)
    }
  }

  function resetPeriod() {
    setSync(s => s ? { ...s, phase: 'period_select', result: undefined } : s)
  }

  async function runImport() {
    if (!sync?.result) return
    const { itemId, accountId, result } = sync
    setSync(s => s ? { ...s, phase: 'importing' } : s)
    try {
      pendingPersistTraceRef.current = result.newTxs.map(tx => tx.id)
      await appendTransactions(result.newTxs as Transaction[])
      updateConnectionSyncMeta(itemId, accountId, result.newTxs.length)
      updateAccountDiagnostics({
        accountId,
        accountName: sync.accountName,
        lastSyncAt: new Date().toISOString(),
        rawReturnedCount: result.rawReturnedCount,
        newTxsCount: result.newTxs.length,
        duplicateCount: result.duplicateCount,
        missingFinancialDateCount: result.missingFinancialDateCount,
        dateConfidenceCounts: result.dateConfidenceCounts,
      })
      setConnections(getLocalConnections())
      setSync(s => s ? { ...s, phase: 'done' } : s)
    } catch (err) {
      setSync(s => s ? { ...s, phase: 'error', error: err instanceof Error ? err.message : 'Erro ao importar' } : s)
    }
  }

  const allAccounts = connections.flatMap(c => c.accounts)
  const bankAccounts = connections.flatMap(c => c.accounts.filter(a => a.type === 'BANK'))
  const creditCards  = connections.flatMap(c => c.accounts.filter(a => a.type === 'CREDIT'))

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Pluggy</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Conecte bancos e cartões via Open Finance
              <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 8, padding: '1px 5px', borderRadius: 3, background: 'var(--warn)', color: '#fff', verticalAlign: 'middle' }}>BETA</span>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, marginTop: 6, opacity: 0.75 }}
            onClick={handleDiagnose}
            title="Diagnosticar e recuperar dados Pluggy do localStorage"
          >
            Recuperar dados Pluggy
          </button>
        </div>

        {dailySyncStatus && (dailySyncStatus.running || dailySyncStatus.finishedAt) && (
          <div style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 12.5,
            background: dailySyncStatus.errors.length > 0 ? 'var(--warn-soft, var(--well))' : 'var(--pos-soft)',
            border: `1px solid ${dailySyncStatus.errors.length > 0 ? 'var(--warn)' : 'var(--pos)'}`,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            {dailySyncStatus.running ? (
              <p style={{ color: 'var(--ink-2)', flex: 1 }}>
                Sync diária em andamento… {dailySyncStatus.accountsSynced} conta(s) · {dailySyncStatus.newTxsTotal} novos lançamentos
              </p>
            ) : (
              <p style={{ color: 'var(--ink-2)', flex: 1 }}>
                Sync diária concluída · {dailySyncStatus.accountsSynced} conta(s) · {dailySyncStatus.newTxsTotal} novos lançamentos
                {dailySyncStatus.errors.length > 0 && ` · ${dailySyncStatus.errors.length} erro(s)`}
              </p>
            )}
            <button onClick={() => setDailySyncStatus(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {showBackupBanner && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--warn-soft, var(--well))', border: '1px solid var(--warn)', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--ink-2)' }}>Há backup local de contas Pluggy. Deseja restaurar?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleRestoreBackup}>Restaurar</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowBackupBanner(false)}>Ignorar</button>
            </div>
          </div>
        )}

        {backendStatus === 'not_configured' && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--faint)' }}>
            <strong style={{ color: 'var(--ink-2)' }}>Backend não configurado</strong> — adicione{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_ID</code> e{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PLUGGY_CLIENT_SECRET</code> no{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>server/.env</code>.
          </div>
        )}

        {tokenError && (
          <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>
            {tokenError}
          </div>
        )}
        {registering && (
          <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--faint)' }}>
            Salvando conexão…
          </div>
        )}

        {/* Environment status card */}
        <PluggyStatusCard
          connections={connections}
          pluggyTxCount={transactions.filter(t => t.source === 'pluggy' || t.origin === 'import_api').length}
          backendStatus={backendStatus}
        />

        {/* Connections list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>
              Conexões ativas
              {connections.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                  {connections.length}
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allAccounts.length >= 1 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSyncAll(true)}
                  style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                >
                  Sincronizar todas as contas
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                disabled={backendStatus !== 'configured' || fetchingToken || registering}
                onClick={handleConnect}
                style={{ opacity: backendStatus !== 'configured' ? 0.4 : 1 }}
              >
                {fetchingToken ? 'Obtendo token…' : '+ Conectar banco/cartão'}
              </button>
            </div>
          </div>

          {connections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--faint)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.35 }}>
                <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <p style={{ fontSize: 12.5 }}>Nenhuma conexão ativa</p>
              <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7, maxWidth: 380, margin: '4px auto 0' }}>
                Se você já tinha conexões antes, clique em &ldquo;Recuperar dados Pluggy&rdquo;. Também confirme que está usando o mesmo navegador e o endereço <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>http://localhost:5173</code>.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 14, fontSize: 11.5 }}
                onClick={handleDiagnose}
              >
                Recuperar dados Pluggy
              </button>
            </div>
          ) : (
            <div>
              {connections.map(conn => (
                <div key={conn.itemId} style={{ borderBottom: '1px solid var(--line)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {conn.connectorImageUrl ? (
                        <img src={conn.connectorImageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--faint)' }}>
                          {conn.connectorName[0]}
                        </div>
                      )}
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{conn.connectorName}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[conn.status] ?? 'var(--faint)', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{STATUS_LABEL[conn.status] ?? conn.status}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDisconnect(conn.itemId)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
                      Remover
                    </button>
                  </div>

                  {conn.accounts.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'var(--faint)', paddingLeft: 4 }}>Nenhuma conta encontrada.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {conn.accounts.map(acc => (
                        <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{acc.displayName ?? acc.name}</span>
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '.06em', padding: '1px 5px', borderRadius: 3,
                                background: acc.type === 'CREDIT' ? 'var(--accent-soft)' : 'var(--pos-soft)',
                                color: acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)',
                                border: `1px solid ${acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)'}40`,
                              }}>
                                {acc.type === 'CREDIT' ? 'CARTÃO' : 'CONTA'}
                              </span>
                              {acc.selectedForDailySync && (
                                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', padding: '1px 5px', borderRadius: 3, background: 'var(--pos-soft)', color: 'var(--pos)', border: '1px solid var(--pos)40' }}>
                                  SYNC DIÁRIA
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {acc.lastSyncAt && (
                                <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                                  Última sync: {fmtDate(acc.lastSyncAt)}
                                  {acc.lastSyncCount != null && ` · ${acc.lastSyncCount} importados`}
                                </p>
                              )}
                              {acc.selectedForDailySync && acc.lastDailySyncDate && (
                                <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                                  Auto: {acc.lastDailySyncDate} · Próx.: amanhã
                                </p>
                              )}
                              {acc.dailySyncError && (
                                <p style={{ fontSize: 10.5, color: 'var(--crit)' }} title={acc.dailySyncError}>
                                  Erro sync auto
                                </p>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={() => handleToggleDailySync(conn.itemId, acc.id, !acc.selectedForDailySync)}
                              title={acc.selectedForDailySync ? 'Desativar sync diária' : 'Ativar sync diária automática'}
                              style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                                cursor: 'pointer', fontFamily: 'var(--ui)', whiteSpace: 'nowrap',
                                background: acc.selectedForDailySync ? 'var(--pos-soft)' : 'var(--well)',
                                color: acc.selectedForDailySync ? 'var(--pos)' : 'var(--faint)',
                                border: `1px solid ${acc.selectedForDailySync ? 'var(--pos)' : 'var(--line)'}`,
                              }}
                            >
                              {acc.selectedForDailySync ? '● Auto' : '○ Auto'}
                            </button>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: acc.balance != null ? 'var(--ink)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                                {acc.balance != null ? fmtBRL(acc.balance) : 'Saldo indisponível'}
                              </p>
                              {acc.type === 'CREDIT' && acc.limit != null && (
                                <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
                                  Limite: {fmtBRL(acc.limit)}
                                  {acc.availableLimit != null && ` · Disponível: ${fmtBRL(acc.availableLimit)}`}
                                </p>
                              )}
                              {acc.type === 'BANK' && acc.availableBalance != null && acc.availableBalance !== acc.balance && (
                                <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>Disponível: {fmtBRL(acc.availableBalance)}</p>
                              )}
                            </div>
                            <button
                              onClick={() => startSync(conn.itemId, acc.id, acc.displayName ?? acc.name)}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                            >
                              Sincronizar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary chips */}
        {connections.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {bankAccounts.length > 0 && <SummaryChip label="Contas bancárias" value={fmtBRL(bankAccounts.reduce((s, a) => s + (a.balance ?? 0), 0))} />}
            {creditCards.length > 0 && <SummaryChip label="Cartões — fatura" value={fmtBRL(creditCards.reduce((s, a) => s + (a.balance ?? 0), 0))} />}
          </div>
        )}

        {/* Reclassify imported */}
        {transactions.some(isLikelyPluggyTransaction) && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Lançamentos Pluggy já importados</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                Aplica o mapeamento de categorias atualizado (Pluggy + inferência por texto) nos importados sem categoria manual.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleRepairPreview}>
                Corrigir datas Pluggy
              </button>
              <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleReclassPreview}>
                Reclassificar importados
              </button>
            </div>
          </div>
        )}

      </div>

      {connectToken && (
        <PluggyConnect connectToken={connectToken} onSuccess={handleSuccess} onError={handleError} onClose={handleClose} />
      )}

      {sync && (
        <SyncModal
          sync={sync}
          onFetch={doFetch}
          onResetPeriod={resetPeriod}
          onImport={runImport}
          onClose={() => setSync(null)}
        />
      )}

      {syncAll && (
        <SyncAllModal
          connections={connections}
          existingTxs={transactions}
          appendTransactions={appendTransactions as (txs: Transaction[]) => Promise<void>}
          onSyncComplete={() => setConnections(getLocalConnections())}
          onClose={() => setSyncAll(false)}
        />
      )}

      {reclassPreview && (
        <ReclassModal
          preview={reclassPreview}
          running={reclassRunning}
          onConfirm={handleReclassConfirm}
          onClose={() => setReclassPreview(null)}
        />
      )}

      {repairPreview && (
        <RepairDatesModal
          preview={repairPreview}
          running={repairRunning}
          onConfirm={handleRepairConfirm}
          onClose={() => setRepairPreview(null)}
        />
      )}

      {recoveryDiag && (
        <RecoveryModal
          diag={recoveryDiag}
          onRecover={handleRecover}
          onClose={() => setRecoveryDiag(null)}
        />
      )}

      {recoveryResult && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 400, background: recoveryResult.ok ? 'var(--card-bg)' : 'var(--crit-soft)',
          border: `1px solid ${recoveryResult.ok ? 'var(--line)' : 'var(--crit)'}`,
          borderRadius: 10, padding: '12px 20px', boxShadow: '0 6px 24px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480,
        }}>
          <p style={{ fontSize: 12.5, color: recoveryResult.ok ? 'var(--ink)' : 'var(--crit)', flex: 1 }}>
            {recoveryResult.message}
          </p>
          <button onClick={() => setRecoveryResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
    </main>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ReclassModal({ preview, running, onConfirm, onClose }: {
  preview: ReclassPreview
  running: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => !running && e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Reclassificar lançamentos Pluggy</p>
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>Aplica mapa Pluggy + inferência por texto. Não sobrescreve categorias manuais.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {([
            ['Analisados', String(preview.total), 'var(--ink-2)'],
            ['Via Pluggy', String(preview.fromPluggyCat), 'var(--pos)'],
            ['Via texto', String(preview.fromInference), 'var(--accent)'],
            ['Ignor. manual', String(preview.willSkip), 'var(--faint)'],
            ['Sem mapa', String(preview.noMap), 'var(--warn)'],
            ['Total a aplicar', String(preview.willReclassify), 'var(--pos)'],
          ] as [string,string,string][]).map(([l,v,c]) => (
            <div key={l} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
              <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{l}</p>
            </div>
          ))}
        </div>
        {Object.keys(preview.byMacro).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Distribuição por macro</p>
            {Object.entries(preview.byMacro).sort((a, b) => b[1] - a[1]).map(([macroId, count]) => {
              const macro = MACRO_CATEGORIES.find(m => m.id === macroId)
              return (
                <div key={macroId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)' }}>
                  <span>{macro?.name ?? macroId}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}
        {preview.examples.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Exemplos (antes → depois)</p>
            {preview.examples.map((ex, i) => (
              <div key={i} style={{ padding: '7px 10px', borderRadius: 7, background: 'var(--well)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 11, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--faint)' }}>{ex.before}</span>
                  <span style={{ color: 'var(--faint)' }}>→</span>
                  <span style={{ fontWeight: 700 }}>{ex.after}</span>
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: 'var(--card-bg)', border: '1px solid var(--line)', color: 'var(--faint)' }}>
                    {ex.source} · conf. {ex.confidence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button className="btn btn-primary" disabled={running || preview.willReclassify === 0} onClick={onConfirm}>
            {running ? 'Aplicando…' : `Aplicar ${preview.willReclassify} classificação${preview.willReclassify !== 1 ? 'ões' : ''}`}
          </button>
          <button className="btn btn-secondary" disabled={running} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function RepairDatesModal({ preview, running, onConfirm, onClose }: {
  preview: PluggyDateRepairPreview
  running: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => !running && e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 620, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Corrigir datas Pluggy</p>
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>Só corrige quando existe evidência raw salva. Sem adivinhação agressiva.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {([
            ['Analisados', String(preview.analyzed), 'var(--ink-2)'],
            ['Sem evidência raw', String(preview.missingEvidence), 'var(--faint)'],
            ['Corrigíveis', String(preview.candidates.length), 'var(--warn)'],
          ] as [string, string, string][]).map(([l, v, c]) => (
            <div key={l} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</p>
              <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{l}</p>
            </div>
          ))}
        </div>
        {preview.candidates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {preview.candidates.slice(0, 12).map(candidate => (
              <div key={candidate.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{candidate.description}</p>
                <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{candidate.reason}</p>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>Data: {candidate.beforeDate} → {candidate.afterDate}</span>
                  <span>Comp.: {candidate.beforeCompetenceDate} → {candidate.afterCompetenceDate}</span>
                  {candidate.afterPaymentDate && (
                    <span>Pgto.: {candidate.beforePaymentDate ?? '—'} → {candidate.afterPaymentDate}</span>
                  )}
                </div>
              </div>
            ))}
            {preview.candidates.length > 12 && (
              <p style={{ fontSize: 11, color: 'var(--faint)' }}>Mostrando 12 exemplos de {preview.candidates.length}.</p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ok)' }}>Nenhuma correção com evidência suficiente.</p>
        )}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button className="btn btn-primary" disabled={running || preview.candidates.length === 0} onClick={onConfirm}>
            {running ? 'Aplicando…' : `Aplicar ${preview.candidates.length} correção${preview.candidates.length !== 1 ? 'ões' : ''}`}
          </button>
          <button className="btn btn-secondary" disabled={running} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

// ── SyncAllModal ──────────────────────────────────────────────────────────────

interface SyncAllAccountInfo {
  id: string
  itemId: string
  name: string
  displayName?: string
  type: 'BANK' | 'CREDIT'
  institutionName: string
  institutionLogoUrl: string | null
  lastSyncAt?: string
}

interface SyncAllAccountResult {
  accountId: string
  accountName: string
  itemId: string
  status: 'pending' | 'fetching' | 'done' | 'error'
  result?: MapResult
  error?: string
}

type SyncAllPhase = 'setup' | 'fetching' | 'preview' | 'importing' | 'done'

interface SyncAllModalProps {
  connections: PluggyLocalConnection[]
  existingTxs: Transaction[]
  appendTransactions: (txs: Transaction[]) => Promise<void>
  onSyncComplete: () => void
  onClose: () => void
}

function SyncAllModal({ connections, existingTxs, appendTransactions, onSyncComplete, onClose }: SyncAllModalProps) {
  const allAccounts: SyncAllAccountInfo[] = connections.flatMap(c =>
    c.accounts.map(a => ({
      id: a.id,
      itemId: c.itemId,
      name: a.displayName ?? a.name,
      type: a.type,
      institutionName: c.connectorName,
      institutionLogoUrl: c.connectorImageUrl,
      lastSyncAt: a.lastSyncAt,
    }))
  )

  const [phase, setPhase] = useState<SyncAllPhase>('setup')
  const [period, setPeriod] = useState<PeriodPreset>('last_7d')
  const [customFrom, setCustomFrom] = useState('2024-01-01')
  const [customTo, setCustomTo] = useState(currentFinancialDate())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(allAccounts.map(a => a.id)))
  const [accountResults, setAccountResults] = useState<SyncAllAccountResult[]>([])
  const [allNewTxs, setAllNewTxs] = useState<Transaction[]>([])
  const localFmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const isWorking = phase === 'fetching' || phase === 'importing'
  const selectedAccounts = allAccounts.filter(a => selectedIds.has(a.id))

  function toggleAccount(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedIds(new Set(allAccounts.map(a => a.id))) }
  function deselectAll() { setSelectedIds(new Set()) }

  async function handleFetchAll() {
    if (selectedAccounts.length === 0) return
    const { from, to } = period === 'custom'
      ? { from: customFrom, to: customTo }
      : getPeriodDates(period)

    const initial: SyncAllAccountResult[] = selectedAccounts.map(a => ({
      accountId: a.id, accountName: a.displayName ?? a.name, itemId: a.itemId, status: 'pending',
    }))
    setAccountResults(initial)
    setPhase('fetching')

    const batchAccepted: Transaction[] = []
    const finalResults: SyncAllAccountResult[] = initial.map(r => ({ ...r }))

    for (let i = 0; i < selectedAccounts.length; i++) {
      const acc = selectedAccounts[i]
      finalResults[i] = { ...finalResults[i], status: 'fetching' }
      setAccountResults([...finalResults])

      try {
        const raw = await fetchPluggyTransactions({ accountId: acc.id, from, to })
        const allExisting = [...existingTxs, ...batchAccepted]
        const connInfo: ConnInfo = {
          accountName: acc.displayName ?? acc.name,
          institutionName: acc.institutionName,
          institutionLogoUrl: acc.institutionLogoUrl,
        }
        const result = mapPluggyToTransactions(raw, acc.id, allExisting, connInfo)
        batchAccepted.push(...result.newTxs)
        finalResults[i] = { ...finalResults[i], status: 'done', result }
      } catch (err) {
        finalResults[i] = { ...finalResults[i], status: 'error', error: err instanceof Error ? err.message : 'Erro ao buscar' }
      }
      setAccountResults([...finalResults])
    }

    setAllNewTxs(batchAccepted)
    setPhase('preview')
  }

  async function handleImport() {
    if (allNewTxs.length === 0) return
    setPhase('importing')
    try {
      await appendTransactions(allNewTxs)
      const syncedAt = new Date().toISOString()
      for (const r of accountResults) {
        if (r.status === 'done' && r.result) {
          if (r.result.newTxs.length > 0) {
            updateConnectionSyncMeta(r.itemId, r.accountId, r.result.newTxs.length)
          }
          updateAccountDiagnostics({
            accountId: r.accountId,
            accountName: r.accountName,
            lastSyncAt: syncedAt,
            rawReturnedCount: r.result.rawReturnedCount,
            newTxsCount: r.result.newTxs.length,
            duplicateCount: r.result.duplicateCount,
            missingFinancialDateCount: r.result.missingFinancialDateCount,
            dateConfidenceCounts: r.result.dateConfidenceCounts,
          })
        }
      }
      onSyncComplete()
      setPhase('done')
    } catch {
      setPhase('preview')
    }
  }

  const totalNew = allNewTxs.length
  const totalDupes = accountResults.reduce((s, r) => s + (r.result?.duplicateCount ?? 0), 0)
  const totalUncategorized = allNewTxs.filter(t => !t.macroCategoryId && t.classificationType !== 'neutral').length

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !isWorking && onClose()}
    >
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Sincronizar contas Pluggy</h2>
          {!isWorking && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 20, lineHeight: 1, fontFamily: 'var(--ui)', padding: 4 }}>×</button>
          )}
        </div>

        {/* Setup */}
        {phase === 'setup' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Contas</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={selectAll} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}>Selecionar tudo</button>
                  <button onClick={deselectAll} style={{ fontSize: 11, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}>Desmarcar tudo</button>
                </div>
              </div>
              {allAccounts.map(acc => (
                <label key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--well)', border: `1px solid ${selectedIds.has(acc.id) ? 'var(--accent)' : 'var(--line)'}`, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{acc.displayName ?? acc.name}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: acc.type === 'CREDIT' ? 'var(--accent-soft)' : 'var(--pos-soft)',
                        color: acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)',
                        border: `1px solid ${acc.type === 'CREDIT' ? 'var(--accent)' : 'var(--pos)'}40`,
                      }}>
                        {acc.type === 'CREDIT' ? 'CARTÃO' : 'CONTA'}
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
                      {acc.institutionName}
                      {acc.lastSyncAt && ` · última sync: ${fmtDate(acc.lastSyncAt)}`}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 700 }}>Período</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['last_7d', 'current_month', 'last_30d', 'last_90d', 'custom'] as PeriodPreset[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                      fontFamily: 'var(--ui)', fontWeight: period === p ? 700 : 400,
                      background: period === p ? 'var(--accent-soft)' : 'var(--well)',
                      border: `1px solid ${period === p ? 'var(--accent)' : 'var(--line)'}`,
                      color: period === p ? 'var(--accent)' : 'var(--ink-2)',
                    }}
                  >
                    {PERIOD_LABELS[p]}
                    {p === 'last_7d' && <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color: 'var(--pos)', background: 'var(--pos-soft)', border: '1px solid var(--pos)40', borderRadius: 3, padding: '0 4px' }}>REC</span>}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>até</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="login-field" style={{ fontSize: 12, flex: 1 }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                disabled={selectedIds.size === 0 || (period === 'custom' && (!customFrom || !customTo))}
                onClick={handleFetchAll}
              >
                Buscar transações ({selectedIds.size} conta{selectedIds.size !== 1 ? 's' : ''})
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}

        {/* Fetching */}
        {phase === 'fetching' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', marginBottom: 4 }}>Buscando transações…</p>
            {accountResults.map(r => (
              <div key={r.accountId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12.5, flex: 1, color: 'var(--ink)' }}>{r.accountName}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: r.status === 'done' ? 'var(--pos)' : r.status === 'error' ? 'var(--crit)' : r.status === 'fetching' ? 'var(--warn)' : 'var(--faint)' }}>
                  {r.status === 'pending' ? '—' : r.status === 'fetching' ? 'buscando…' : r.status === 'done' ? `${r.result?.newTxs.length ?? 0} novas` : 'erro'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {phase === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Resultado consolidado</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([
                  ['Novas', String(totalNew), 'var(--pos)'],
                  ['Duplicadas', String(totalDupes), 'var(--faint)'],
                  ['Sem categoria', String(totalUncategorized), totalUncategorized > 0 ? 'var(--warn)' : 'var(--faint)'],
                ] as [string, string, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                    <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Por conta</p>
              {accountResults.map(r => (
                <div key={r.accountId} style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.accountName}</span>
                    <span style={{ fontWeight: 700, color: r.status === 'error' ? 'var(--crit)' : (r.result?.newTxs.length ?? 0) === 0 ? 'var(--faint)' : 'var(--pos)' }}>
                      {r.status === 'error'
                        ? (r.error ?? 'Erro')
                        : `${r.result?.newTxs.length ?? 0} novas · ${r.result?.duplicateCount ?? 0} dup`}
                    </span>
                  </div>
                  {r.result && r.result.rawReturnedCount > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                      {r.result.dateConfidenceCounts.high > 0 && (
                        <span style={{ fontSize: 9.5, padding: '0 5px', borderRadius: 3, background: 'var(--pos-soft)', color: 'var(--pos)', fontWeight: 600, border: '1px solid var(--pos)30' }}>
                          data alta: {r.result.dateConfidenceCounts.high}
                        </span>
                      )}
                      {r.result.dateConfidenceCounts.medium > 0 && (
                        <span style={{ fontSize: 9.5, padding: '0 5px', borderRadius: 3, background: 'var(--well)', color: 'var(--faint)', fontWeight: 600, border: '1px solid var(--line)' }}>
                          média: {r.result.dateConfidenceCounts.medium}
                        </span>
                      )}
                      {r.result.missingFinancialDateCount > 0 && (
                        <span style={{ fontSize: 9.5, padding: '0 5px', borderRadius: 3, background: 'var(--warn-soft, var(--well))', color: 'var(--warn)', fontWeight: 600, border: '1px solid var(--warn)40' }}>
                          sem data: {r.result.missingFinancialDateCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalNew > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--pos-soft)', border: '1px solid var(--pos)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--pos)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Entradas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)', fontVariantNumeric: 'tabular-nums' }}>{localFmtBRL(allNewTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}</p>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)30' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--crit)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Saídas</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{localFmtBRL(allNewTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}</p>
                </div>
              </div>
            )}

            {totalNew === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center' }}>
                Nenhuma transação nova — todas já importadas ou período sem dados.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              {totalNew > 0 ? (
                <>
                  <button className="btn btn-primary" onClick={handleImport}>
                    Importar {totalNew} lançamento{totalNew !== 1 ? 's' : ''}
                  </button>
                  <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                </>
              ) : (
                <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
              )}
            </div>
          </div>
        )}

        {/* Importing */}
        {phase === 'importing' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Importando lançamentos…</p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <p style={{ fontSize: 22 }}>✓</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>
              {allNewTxs.length} lançamento{allNewTxs.length !== 1 ? 's' : ''} importado{allNewTxs.length !== 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: 12, color: 'var(--faint)' }}>
              {accountResults.filter(r => r.status === 'done').length} conta{accountResults.filter(r => r.status === 'done').length !== 1 ? 's' : ''} sincronizada{accountResults.filter(r => r.status === 'done').length !== 1 ? 's' : ''}
              {accountResults.some(r => r.status === 'error') && ` · ${accountResults.filter(r => r.status === 'error').length} com erro`}
            </p>
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── RecoveryModal ─────────────────────────────────────────────────────────────

function RecoveryModal({ diag, onRecover, onClose }: {
  diag: DiagnosticResult
  onRecover: () => void
  onClose: () => void
}) {
  const recoverableKeys = diag.keys.filter(k => k.looksLikeConnections && k.recordCount > 0)
  const currentKey = diag.keys.find(k => k.source === 'current')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(16,15,10,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Diagnóstico de dados Pluggy</p>
          <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>{diag.message}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'Conexões', value: diag.probableConnections },
            { label: 'Contas', value: diag.probableAccounts },
            { label: 'Transações', value: diag.probableTransactions },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{value}</p>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {diag.keys.length > 0 && (
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>Chaves encontradas no localStorage</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {diag.keys.map(k => (
                <div key={k.key} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: 'var(--well)', border: `1px solid ${k.looksLikeConnections ? 'var(--accent)' : 'var(--line)'}`, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', wordBreak: 'break-all' }}>{k.key}</span>
                  <span style={{ color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                    {k.isArray ? `${k.recordCount} registros` : k.isValidJson ? 'JSON' : 'raw'}
                    {' · '}{(k.byteSize / 1024).toFixed(1)}KB
                    {k.looksLikeConnections && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> ← conexões</span>}
                    {k.source === 'current' && <span style={{ color: 'var(--pos)', fontWeight: 700 }}> (atual)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentKey && currentKey.recordCount > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--pos-soft)', border: '1px solid var(--pos)', fontSize: 12 }}>
            Conexões já presentes na chave atual ({currentKey.recordCount}). Recarregue a página se não estiverem aparecendo.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
          {recoverableKeys.some(k => k.key !== 'fin_pluggy_connections') && (
            <button className="btn btn-primary btn-sm" onClick={onRecover}>
              Restaurar conexões encontradas
            </button>
          )}
          {currentKey && currentKey.recordCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => { onClose(); window.location.reload() }}>
              Recarregar página
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PluggyStatusCard ──────────────────────────────────────────────────────────

function PluggyStatusCard({ connections, pluggyTxCount, backendStatus }: {
  connections: PluggyLocalConnection[]
  pluggyTxCount: number
  backendStatus: 'checking' | 'configured' | 'not_configured'
}) {
  const totalAccounts = connections.flatMap(c => c.accounts).length
  const lastSyncAt = connections
    .flatMap(c => c.accounts)
    .map(a => a.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null

  const isClean = connections.length === 0 && pluggyTxCount === 0

  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: isClean ? 'var(--pos-soft)' : 'var(--well)',
      border: `1px solid ${isClean ? 'var(--pos)' : 'var(--line)'}`,
      fontSize: 12.5,
    }}>
      {isClean ? (
        <p style={{ color: 'var(--pos)', fontWeight: 700 }}>
          Ambiente Pluggy limpo. Pronto para nova conexão.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)' }}>{connections.length}</strong> conexão(ões)
          </span>
          <span style={{ color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)' }}>{totalAccounts}</strong> conta(s)
          </span>
          <span style={{ color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)' }}>{pluggyTxCount}</strong> transações importadas
          </span>
          {lastSyncAt && (
            <span style={{ color: 'var(--faint)', fontSize: 11.5 }}>
              última sync: {new Date(lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>
          backend:{' '}
          <span style={{ color: backendStatus === 'configured' ? 'var(--pos)' : backendStatus === 'checking' ? 'var(--warn)' : 'var(--crit)', fontWeight: 600 }}>
            {backendStatus === 'configured' ? 'configurado' : backendStatus === 'checking' ? 'verificando…' : 'não configurado'}
          </span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>
          chave: <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>fin_pluggy_connections</code>
        </span>
      </div>
    </div>
  )
}

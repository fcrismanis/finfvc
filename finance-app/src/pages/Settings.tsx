import { useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'
import { supabase } from '../lib/supabase'
import { SupabaseDataProvider } from '../providers/supabase.data.provider'
import type { Transaction, Budget, MonthClosing } from '../types'

// ── localStorage keys used by local provider ───────────────────────────────
const LOCAL_KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings']

// ── Shared helpers ─────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [
  { value: '100', label: '100 por página' },
  { value: '250', label: '250 por página' },
  { value: '500', label: '500 por página (padrão)' },
  { value: '1000', label: '1000 por página' },
]

const ALERT_SETTINGS_KEY = 'fin_alert_settings'
interface AlertSettings { categoryAlert50: boolean; categoryAlert75: boolean; categoryAlert100: boolean; globalAlert90: boolean; globalAlert100: boolean }
function loadAlertSettings(): AlertSettings {
  try { const r = localStorage.getItem(ALERT_SETTINGS_KEY); return r ? JSON.parse(r) : { categoryAlert50: false, categoryAlert75: true, categoryAlert100: true, globalAlert90: true, globalAlert100: true } }
  catch { return { categoryAlert50: false, categoryAlert75: true, categoryAlert100: true, globalAlert90: true, globalAlert100: true } }
}
function saveAlertSettings(s: AlertSettings) { localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(s)) }

interface BackupData { transactions: Transaction[]; budgets: Budget[]; closings: MonthClosing[]; exportedAt?: string; schemaVersion?: number; provider?: string }

interface Props { onNavigate: (route: string) => void }

export function Settings({ onNavigate }: Props) {
  const { transactions, budgets, closings, appendTransactions } = useData()

  // ── Preferences ───────────────────────────────────────────────────────────
  const [pageSize, setPageSize] = useState(() => localStorage.getItem('fin_transactions_page_size') ?? '500')
  const [alerts, setAlerts] = useState<AlertSettings>(loadAlertSettings)
  function toggleAlert(key: keyof AlertSettings) {
    setAlerts(prev => { const next = { ...prev, [key]: !prev[key] }; saveAlertSettings(next); return next })
  }

  // ── Sync from production ──────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [syncEmail, setSyncEmail] = useState('')
  const [syncPassword, setSyncPassword] = useState('')
  const [syncNeedsLogin, setSyncNeedsLogin] = useState(false)

  async function syncFromProduction() {
    setSyncing(true)
    setSyncResult(null)
    try {
      let session = (await supabase.auth.getSession()).data.session

      // Se não há sessão e o usuário forneceu credenciais, tenta login
      if (!session && syncEmail && syncPassword) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: syncEmail, password: syncPassword })
        if (error || !data.session) {
          setSyncResult({ ok: false, msg: `Login falhou: ${error?.message ?? 'credenciais inválidas'}` })
          return
        }
        session = data.session
      }

      if (!session) {
        setSyncNeedsLogin(true)
        setSyncResult({ ok: false, msg: 'Informe suas credenciais do Supabase abaixo para sincronizar.' })
        return
      }

      const { data: member, error: memberErr } = await supabase
        .from('family_members').select('family_id').eq('user_id', session.user.id).single()
      if (memberErr || !member) {
        setSyncResult({ ok: false, msg: 'Família não encontrada no Supabase.' })
        return
      }
      const familyId = (member as { family_id: string }).family_id
      const provider = new SupabaseDataProvider(familyId)
      const result = await provider.load()
      const cl = await provider.getMonthlyClosings()
      localStorage.setItem('finance_transactions', JSON.stringify(result.transactions))
      localStorage.setItem('finance_budgets', JSON.stringify(result.budgets))
      localStorage.setItem('finance_closings', JSON.stringify(cl))
      setSyncResult({ ok: true, msg: `Sincronizado: ${result.transactions.length} lançamentos, ${result.budgets.length} orçamentos, ${cl.length} fechamentos. Recarregando…` })
      setTimeout(() => window.location.reload(), 1800)
    } catch (e) {
      setSyncResult({ ok: false, msg: `Erro: ${(e as Error).message}` })
    } finally {
      setSyncing(false)
    }
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<BackupData | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  function handleExport() {
    const data: BackupData = { transactions, budgets, closings, exportedAt: new Date().toISOString(), schemaVersion: 1, provider: DATA_PROVIDER }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `fin-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData
        if (!Array.isArray(data.transactions)) throw new Error('Campo "transactions" ausente ou inválido')
        setImportPreview(data)
      } catch (err) { setImportError(`Arquivo inválido: ${(err as Error).message}`) }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleConfirmImport() {
    if (!importPreview) return
    if (importMode === 'replace' && DATA_PROVIDER !== 'supabase') {
      LOCAL_KEYS.forEach(k => localStorage.removeItem(k))
    }
    await appendTransactions(importPreview.transactions ?? [])
    setImportPreview(null); setImportDone(true)
  }

  // ── Danger zone ───────────────────────────────────────────────────────────
  const [dangerMonth, setDangerMonth] = useState('')
  const allMonths = [...new Set(transactions.map(t => t.competenceDate.slice(0, 7)))].sort().reverse()

  function handleClearMonth() {
    if (!dangerMonth) return
    if (!window.confirm(`Excluir TODOS os lançamentos de ${dangerMonth}? Ação irreversível.`)) return
    const all: Transaction[] = JSON.parse(localStorage.getItem('finance_transactions') ?? '[]')
    const kept = all.filter(t => !t.competenceDate.startsWith(dangerMonth))
    localStorage.setItem('finance_transactions', JSON.stringify(kept))
    window.location.reload()
  }

  function handleClearAll() {
    if (!window.confirm('Limpar TODOS os dados locais? Ação irreversível.')) return
    LOCAL_KEYS.forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Configurações</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Preferências, dados e ferramentas de gestão</div>
        </div>

        {/* ── Armazenamento ── */}
        <Section title="Armazenamento">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DATA_PROVIDER === 'supabase' ? 'var(--pos)' : 'var(--warn)', flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-2)' }}>
              Provider: <strong style={{ color: 'var(--ink)' }}>{DATA_PROVIDER === 'supabase' ? 'Supabase (nuvem)' : 'Local (localStorage)'}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--faint)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--ink-2)' }}>{transactions.length}</strong> lançamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{budgets.length}</strong> orçamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{closings.length}</strong> fechamentos</span>
          </div>
        </Section>

        {/* ── Sincronização com produção ── */}
        <Section title="Sincronizar com produção">
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Baixa os dados reais do Supabase (produção) para o localStorage local. Útil para equalizar o ambiente de desenvolvimento com os dados de produção.
            Requer sessão ativa no Supabase.
          </p>
          {syncNeedsLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: '12px 14px', background: 'var(--well)', borderRadius: 9, border: '1px solid var(--line)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Login no Supabase (produção)</p>
              <input
                type="email"
                value={syncEmail}
                onChange={e => setSyncEmail(e.target.value)}
                placeholder="Email"
                className="login-field"
                style={{ fontSize: 12.5 }}
              />
              <input
                type="password"
                value={syncPassword}
                onChange={e => setSyncPassword(e.target.value)}
                placeholder="Senha"
                className="login-field"
                style={{ fontSize: 12.5 }}
                onKeyDown={e => e.key === 'Enter' && syncFromProduction()}
              />
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={syncFromProduction}
            disabled={syncing}
            style={{ fontSize: 13 }}
          >
            {syncing ? 'Sincronizando…' : '⬇ Baixar dados da produção'}
          </button>
          {syncResult && (
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: syncResult.ok ? 'var(--pos)' : 'var(--crit)' }}>
              {syncResult.msg}
            </div>
          )}
        </Section>

        {/* ── Preferências de exibição ── */}
        <Section title="Preferências de exibição">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Lançamentos por página</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>Quantidade exibida no ledger. Valores maiores podem ser mais lentos.</p>
            </div>
            <select value={pageSize} onChange={e => { setPageSize(e.target.value); localStorage.setItem('fin_transactions_page_size', e.target.value) }} className="ledger-select" style={{ fontSize: 12, minWidth: 160, flexShrink: 0 }}>
              {PAGE_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </Section>

        {/* ── Alertas de orçamento ── */}
        <Section title="Alertas de orçamento">
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 16 }}>Controla quando o sistema gera alertas no Dashboard ao cruzar percentuais do orçamento.</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Por categoria</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {([{ key: 'categoryAlert50' as const, label: '50%' }, { key: 'categoryAlert75' as const, label: '75%' }, { key: 'categoryAlert100' as const, label: '100%' }]).map(({ key, label }) => (
              <button key={key} onClick={() => toggleAlert(key)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--ui)', background: alerts[key] ? 'var(--ink)' : 'var(--well)', color: alerts[key] ? 'white' : 'var(--faint)', border: `1px solid ${alerts[key] ? 'var(--ink)' : 'var(--line)'}` }}>{label}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Orçamento geral</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([{ key: 'globalAlert90' as const, label: '90%' }, { key: 'globalAlert100' as const, label: '100%' }]).map(({ key, label }) => (
              <button key={key} onClick={() => toggleAlert(key)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--ui)', background: alerts[key] ? 'var(--ink)' : 'var(--well)', color: alerts[key] ? 'white' : 'var(--faint)', border: `1px solid ${alerts[key] ? 'var(--ink)' : 'var(--line)'}` }}>{label}</button>
            ))}
          </div>
        </Section>

        {/* ── Links rápidos ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Categorias', description: 'Visualizar macro e subcategorias', route: '/categorias' },
            { label: 'Regras de categoria', description: 'Gerenciar regras automáticas', route: '/regras' },
          ].map(link => (
            <button key={link.route} onClick={() => onNavigate(link.route)} className="card" style={{ padding: '16px 18px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'none', fontFamily: 'var(--ui)' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{link.label}</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>{link.description}</p>
            </button>
          ))}
        </div>

        {/* ── Backup ── */}
        <Section title="Backup">
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Exporte todos os dados em JSON ou restaure a partir de um backup anterior.
          </p>

          {/* Export */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Exportar</p>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>⬆ Exportar backup JSON</button>
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{transactions.length} lançamentos · {budgets.length} orçamentos · {closings.length} fechamentos</p>
          </div>

          {/* Import */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Importar</p>
            {importDone ? (
              <div style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
                Backup importado! <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => setImportDone(false)}>Importar outro</button>
              </div>
            ) : importPreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-2)' }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>Preview: {importPreview.transactions?.length ?? 0} lançamentos · {importPreview.budgets?.length ?? 0} orçamentos</p>
                  {importPreview.exportedAt && <p style={{ color: 'var(--faint)', fontSize: 11 }}>Exportado em {new Date(importPreview.exportedAt).toLocaleDateString('pt-BR')}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setImportMode('merge')} className={importMode === 'merge' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>Mesclar</button>
                  <button onClick={() => setImportMode('replace')} className={importMode === 'replace' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={importMode === 'replace' ? { background: 'var(--crit)', borderColor: 'var(--crit)' } : {}}>Substituir tudo</button>
                </div>
                {importMode === 'replace' && <p style={{ fontSize: 12, color: 'var(--crit)', fontWeight: 600 }}>⚠ Substituir apaga todos os dados atuais antes de importar.</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleConfirmImport} className="btn btn-primary btn-sm">Confirmar importação</button>
                  <button onClick={() => setImportPreview(null)} className="btn btn-secondary btn-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>⬇ Selecionar arquivo JSON</button>
                {importError && <p style={{ marginTop: 6, fontSize: 12, color: 'var(--crit)' }}>{importError}</p>}
              </>
            )}
          </div>
        </Section>

        {/* ── Zona de perigo ── */}
        <Section title="Zona de Perigo" danger>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 16, lineHeight: 1.6 }}>
            Ações irreversíveis. Use com cautela. Apenas disponível no modo local.
          </p>

          {DATA_PROVIDER === 'supabase' ? (
            <p style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>
              Operações de limpeza não disponíveis no modo Supabase. Gerencie via Supabase Dashboard.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Clear month */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Limpar lançamentos de um mês</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="ledger-select" value={dangerMonth} onChange={e => setDangerMonth(e.target.value)} style={{ fontSize: 12, minWidth: 160 }}>
                    <option value="">Selecione o mês</option>
                    {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={handleClearMonth} disabled={!dangerMonth} className="btn btn-secondary btn-sm" style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }}>
                    Limpar mês
                  </button>
                </div>
              </div>

              {/* Clear all */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--crit)', marginBottom: 6 }}>Limpar todos os dados locais</p>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 8 }}>Remove lançamentos, orçamentos e fechamentos do localStorage. Não afeta backups exportados.</p>
                <button onClick={handleClearAll} className="btn btn-secondary btn-sm" style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }}>
                  Limpar tudo
                </button>
              </div>
            </div>
          )}
        </Section>

      </div>
    </main>
  )
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: '18px 22px', border: danger ? '1px solid var(--crit)30' : undefined }}>
      <h3 style={{ fontSize: 13, fontWeight: 750, color: danger ? 'var(--crit)' : 'var(--ink)', marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  )
}

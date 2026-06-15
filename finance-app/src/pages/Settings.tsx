import { useState, useRef, useMemo, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { DATA_PROVIDER } from '../config/env'
import { newSubCategoryId, ESSENTIALITY_LABELS } from '../services/subcategory.service'
import type { SubCategory, SubCategoryEssentiality, Transaction, Budget, MonthClosing } from '../types'

interface BackupData {
  transactions: Transaction[]
  budgets: Budget[]
  closings: MonthClosing[]
  exportedAt?: string
  schemaVersion?: number
  provider?: string
}

export function Settings() {
  const {
    transactions, budgets, closings, subCategories,
    appendTransactions, saveSubCategory, deleteSubCategory, reload,
  } = useData()
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  // ── Backup import state ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<BackupData | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // ── Month clear state ──
  const [clearMonth, setClearMonth] = useState('')
  const [clearMonthConfirm, setClearMonthConfirm] = useState('')
  const [monthCleared, setMonthCleared] = useState(false)

  // ── Subcategory state ──
  const [editingSub, setEditingSub] = useState<Partial<SubCategory> | null>(null)
  const [subMacroFilter, setSubMacroFilter] = useState('')
  const [subSaveStatus, setSubSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  function fmtMonth(ym: string): string {
    const [y, m] = ym.split('-')
    return `${y}-${PT_MONTHS[parseInt(m, 10) - 1] ?? m}`
  }

  const allMonths = useMemo(() => {
    const set = new Set([
      ...transactions.map(t => t.competenceDate.slice(0, 7)),
      ...budgets.map(b => b.referenceMonth.slice(0, 7)),
    ])
    return Array.from(set).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse()
  }, [transactions, budgets])

  const monthImpact = useMemo(() => {
    if (!clearMonth) return null
    return {
      transactions: transactions.filter(t => t.competenceDate.startsWith(clearMonth)).length,
      budgets: budgets.filter(b => b.referenceMonth === clearMonth).length,
      closings: closings.filter(c => c.month === clearMonth).length,
    }
  }, [clearMonth, transactions, budgets, closings])

  function handleExportBackup() {
    const data: BackupData = {
      transactions, budgets, closings,
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      provider: DATA_PROVIDER,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fin-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClearLocal() {
    const KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings', 'finance_migration_banner_dismissed']
    KEYS.forEach(k => localStorage.removeItem(k))
    setConfirmClear(false)
    setCleared(true)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData
        if (!Array.isArray(data.transactions)) throw new Error('Campo "transactions" ausente ou inválido')
        setImportPreview(data)
      } catch (err) {
        setImportError(`Arquivo inválido: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleConfirmImport() {
    if (!importPreview) return
    if (importMode === 'merge') {
      await appendTransactions(importPreview.transactions ?? [])
    } else {
      // Replace: clear local then append
      if (DATA_PROVIDER !== 'supabase') {
        const KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings']
        KEYS.forEach(k => localStorage.removeItem(k))
      }
      await appendTransactions(importPreview.transactions ?? [])
    }
    setImportPreview(null)
    setImportDone(true)
  }

  function handleClearMonth() {
    if (DATA_PROVIDER === 'supabase') return
    const newTxs = transactions.filter(t => !t.competenceDate.startsWith(clearMonth))
    const newBudgets = budgets.filter(b => !b.referenceMonth.startsWith(clearMonth))
    const newClosings = closings.filter(c => c.month !== clearMonth)
    localStorage.setItem('finance_transactions', JSON.stringify(newTxs))
    localStorage.setItem('finance_budgets', JSON.stringify(newBudgets))
    localStorage.setItem('finance_closings', JSON.stringify(newClosings))
    setMonthCleared(true)
    setClearMonthConfirm('')
    reload()
  }

  const doSaveSub = useCallback(async (draft: Partial<SubCategory>) => {
    if (!draft.name?.trim() || !draft.macroCategoryId) return
    const sub: SubCategory = {
      id: draft.id ?? newSubCategoryId(),
      name: draft.name.trim(),
      macroCategoryId: draft.macroCategoryId,
      essentiality: (draft.essentiality ?? 'inherit') as SubCategoryEssentiality,
      active: true,
      createdAt: draft.createdAt ?? new Date().toISOString(),
    }
    await saveSubCategory(sub)
  }, [saveSubCategory])

  async function saveSub() {
    if (!editingSub) return
    try {
      await doSaveSub(editingSub)
      setEditingSub(null)
    } catch {
      // error shown to user via alert in DataContext
    }
  }

  function handleSubFieldChange(patch: Partial<SubCategory>) {
    const updated = { ...editingSub, ...patch }
    setEditingSub(updated)

    // Auto-save only for existing subs
    if (!updated.id) return
    if (!updated.name?.trim() || !updated.macroCategoryId) return

    setSubSaveStatus('saving')
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await doSaveSub(updated)
        setSubSaveStatus('saved')
        setTimeout(() => setSubSaveStatus('idle'), 2000)
      } catch {
        setSubSaveStatus('error')
      }
    }, 600)
  }

  async function removeSub(id: string) {
    if (!confirm('Remover subcategoria? Os lançamentos com ela não serão afetados.')) return
    await deleteSubCategory(id)
  }

  const filteredSubs = subMacroFilter
    ? subCategories.filter(s => s.macroCategoryId === subMacroFilter)
    : subCategories

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Configurações</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Dados, categorias e preferências do FIN
          </div>
        </div>

        {/* ── Provider info ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Armazenamento</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DATA_PROVIDER === 'supabase' ? 'var(--pos)' : 'var(--warn)', flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-2)' }}>
              Provider: <strong style={{ color: 'var(--ink)' }}>{DATA_PROVIDER === 'supabase' ? 'Supabase (nuvem)' : 'Local (localStorage)'}</strong>
            </span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 20, fontSize: 12, color: 'var(--faint)' }}>
            <span>{transactions.length} lançamentos</span>
            <span>{budgets.length} orçamentos</span>
            <span>{closings.length} fechamentos</span>
          </div>
        </div>

        {/* ── Backup export ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 6 }}>Exportar backup</h3>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Exporta todos os lançamentos, orçamentos e fechamentos em formato JSON com versão do schema e data de exportação.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
            Exportar backup JSON
          </button>
        </div>

        {/* ── Backup import ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 6 }}>Importar backup JSON</h3>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Restaure dados de um backup exportado pelo FIN. Pode mesclar com dados existentes ou substituir tudo.
          </p>

          {importDone ? (
            <div style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
              Backup importado com sucesso! Recarregue a página para ver os dados.
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={() => setImportDone(false)}>
                Importar outro
              </button>
            </div>
          ) : importPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-2)' }}>
                <p style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Preview do backup</p>
                <div style={{ display: 'flex', gap: 20 }}>
                  <span>{importPreview.transactions?.length ?? 0} lançamentos</span>
                  <span>{importPreview.budgets?.length ?? 0} orçamentos</span>
                  <span>{importPreview.closings?.length ?? 0} fechamentos</span>
                </div>
                {importPreview.exportedAt && (
                  <p style={{ marginTop: 4, color: 'var(--faint)', fontSize: 11 }}>
                    Exportado em {new Date(importPreview.exportedAt).toLocaleDateString('pt-BR')} · Provider: {importPreview.provider ?? '?'}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setImportMode('merge')}
                  className={importMode === 'merge' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  Mesclar
                </button>
                <button
                  onClick={() => setImportMode('replace')}
                  className={importMode === 'replace' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  style={importMode === 'replace' ? { background: 'var(--crit)', borderColor: 'var(--crit)' } : {}}
                >
                  Substituir tudo
                </button>
              </div>
              {importMode === 'replace' && (
                <p style={{ fontSize: 12, color: 'var(--crit)', fontWeight: 600 }}>
                  ⚠ Todos os dados locais atuais serão removidos antes da importação. Esta ação é irreversível.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleConfirmImport}>
                  Confirmar importação
                </button>
                <button className="btn btn-secondary" onClick={() => setImportPreview(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {importError && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 7, fontSize: 12, color: 'var(--crit)' }}>
                  {importError}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                Selecionar arquivo JSON…
              </button>
            </>
          )}
        </div>

        {/* ── Subcategories ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Subcategorias</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={subMacroFilter}
                onChange={e => setSubMacroFilter(e.target.value)}
                className="ledger-select"
                style={{ fontSize: 11 }}
              >
                <option value="">Todas as macros</option>
                {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingSub({ macroCategoryId: subMacroFilter || MACRO_CATEGORIES[0]?.id, essentiality: 'inherit' })}
              >
                + Nova
              </button>
            </div>
          </div>

          {editingSub && (
            <div style={{ padding: '14px 20px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>
                  {editingSub.id ? 'Editar subcategoria' : 'Nova subcategoria'}
                </p>
                {editingSub.id && subSaveStatus !== 'idle' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: subSaveStatus === 'saved' ? 'var(--pos)' : subSaveStatus === 'error' ? 'var(--crit)' : 'var(--faint)',
                  }}>
                    {subSaveStatus === 'saving' ? 'Salvando…' : subSaveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  value={editingSub.name ?? ''}
                  onChange={e => handleSubFieldChange({ name: e.target.value })}
                  placeholder="Nome da subcategoria"
                  className="login-field"
                  style={{ fontSize: 12, flex: '1 1 160px' }}
                />
                <select
                  value={editingSub.macroCategoryId ?? ''}
                  onChange={e => handleSubFieldChange({ macroCategoryId: e.target.value })}
                  className="ledger-select"
                  style={{ fontSize: 12, flex: '1 1 140px' }}
                >
                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select
                  value={editingSub.essentiality ?? 'inherit'}
                  onChange={e => handleSubFieldChange({ essentiality: e.target.value as SubCategoryEssentiality })}
                  className="ledger-select"
                  style={{ fontSize: 12, flex: '1 1 160px' }}
                >
                  {(Object.entries(ESSENTIALITY_LABELS) as [SubCategoryEssentiality, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!editingSub.id && (
                  <button className="btn btn-primary btn-sm" onClick={saveSub}>Adicionar</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSub(null); setSubSaveStatus('idle') }}>
                  {editingSub.id ? 'Fechar' : 'Cancelar'}
                </button>
              </div>
            </div>
          )}

          {filteredSubs.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 12.5 }}>
              Nenhuma subcategoria cadastrada. Clique em "+ Nova" para criar.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Nome</th>
                    <th className="table-th">Macro</th>
                    <th className="table-th">Essencialidade</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map(sub => {
                    const macro = MACRO_CATEGORIES.find(m => m.id === sub.macroCategoryId)
                    return (
                      <tr key={sub.id} className="table-row">
                        <td className="table-td">
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{sub.name}</span>
                        </td>
                        <td className="table-td">
                          {macro && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                              {macro.name}
                            </span>
                          )}
                        </td>
                        <td className="table-td">
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                            {ESSENTIALITY_LABELS[sub.essentiality]}
                          </span>
                        </td>
                        <td className="table-td" style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setEditingSub({ ...sub })}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => removeSub(sub.id)}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Macro categories (read-only list) ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Macro categorias</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                  <th className="table-th">Nome</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>Subcategorias</th>
                </tr>
              </thead>
              <tbody>
                {MACRO_CATEGORIES.map(m => {
                  const subs = subCategories.filter(s => s.macroCategoryId === m.id)
                  return (
                    <tr key={m.id} className="table-row">
                      <td className="table-td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{m.name}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <span style={{ fontSize: 11, color: 'var(--faint)' }}>{m.classificationType}</span>
                      </td>
                      <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: subs.length > 0 ? 'var(--ink-2)' : 'var(--faint)' }}>
                        {subs.length}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Danger zone ── */}
        <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--crit)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--crit)', marginBottom: 16 }}>Zona de perigo</h3>

          {/* Clear specific month */}
          {DATA_PROVIDER !== 'supabase' && (
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--crit)22' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Limpar mês específico</p>
              <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 12, lineHeight: 1.6 }}>
                Remove todos os lançamentos, orçamentos e fechamentos de um mês específico.
              </p>

              {monthCleared ? (
                <div style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
                  Mês {fmtMonth(clearMonth)} removido. Recarregue a página.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={clearMonth}
                      onChange={e => { setClearMonth(e.target.value); setClearMonthConfirm('') }}
                      className="ledger-select"
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Selecionar mês…</option>
                      {allMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                    </select>
                    {monthImpact && (
                      <span style={{ fontSize: 11.5, color: 'var(--warn)', fontWeight: 600 }}>
                        {monthImpact.transactions} lançamentos · {monthImpact.budgets} orçamentos · {monthImpact.closings} fechamentos
                      </span>
                    )}
                  </div>
                  {clearMonth && (
                    <>
                      <div>
                        <p style={{ fontSize: 11.5, color: 'var(--crit)', marginBottom: 5 }}>
                          Digite <strong>LIMPAR MES</strong> para confirmar:
                        </p>
                        <input
                          value={clearMonthConfirm}
                          onChange={e => setClearMonthConfirm(e.target.value)}
                          placeholder="LIMPAR MES"
                          className="login-field"
                          style={{ fontSize: 12, maxWidth: 200 }}
                        />
                      </div>
                      <button
                        onClick={handleClearMonth}
                        disabled={clearMonthConfirm !== 'LIMPAR MES'}
                        style={{
                          fontSize: 12, fontWeight: 700, color: '#fff',
                          background: clearMonthConfirm === 'LIMPAR MES' ? 'var(--crit)' : 'var(--line)',
                          border: 'none', borderRadius: 8, padding: '7px 16px',
                          cursor: clearMonthConfirm === 'LIMPAR MES' ? 'pointer' : 'not-allowed',
                          fontFamily: 'var(--ui)', width: 'fit-content',
                        }}
                      >
                        Limpar {fmtMonth(clearMonth)}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {DATA_PROVIDER === 'supabase' && (
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--crit)22' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Limpar mês específico</p>
              <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
                Indisponível no modo Supabase. Para remover dados de um mês, execute uma SQL segura diretamente no painel do Supabase com cláusula WHERE.
              </p>
            </div>
          )}

          {/* Clear all local */}
          {DATA_PROVIDER !== 'supabase' && (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Limpar todos os dados locais</p>
              {cleared ? (
                <div style={{ fontSize: 13, color: 'var(--pos)', fontWeight: 600 }}>
                  Dados locais removidos. Recarregue a página para reiniciar.
                </div>
              ) : confirmClear ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12.5, color: 'var(--crit)', fontWeight: 600 }}>
                    Esta ação remove todos os dados locais permanentemente. Exporte um backup antes?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleClearLocal}
                      style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--crit)', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                    >
                      Confirmar limpeza total
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Cancelar</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>Exportar primeiro</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
                    Remove todos os lançamentos, orçamentos e fechamentos armazenados localmente. Irreversível.
                  </p>
                  <button
                    onClick={() => setConfirmClear(true)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--crit)', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                  >
                    Limpar todos os dados locais
                  </button>
                </>
              )}
            </>
          )}
        </div>

      </div>
    </main>
  )
}

import { useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'
import type { Transaction, Budget, MonthClosing } from '../types'

interface BackupData {
  transactions: Transaction[]
  budgets: Budget[]
  closings: MonthClosing[]
  exportedAt?: string
  schemaVersion?: number
  provider?: string
}

export function BackupPage() {
  const { transactions, budgets, closings, appendTransactions } = useData()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<BackupData | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

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
      if (DATA_PROVIDER !== 'supabase') {
        const KEYS = ['finance_transactions', 'finance_budgets', 'finance_closings']
        KEYS.forEach(k => localStorage.removeItem(k))
      }
      await appendTransactions(importPreview.transactions ?? [])
    }
    setImportPreview(null)
    setImportDone(true)
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Backup</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Exporte e restaure seus dados financeiros
          </div>
        </div>

        {/* Stats */}
        <div className="card" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--faint)' }}>
            <span><strong style={{ color: 'var(--ink-2)' }}>{transactions.length}</strong> lançamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{budgets.length}</strong> orçamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{closings.length}</strong> fechamentos</span>
          </div>
        </div>

        {/* Export */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 6 }}>Exportar backup</h3>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.6 }}>
            Exporta todos os lançamentos, orçamentos e fechamentos em formato JSON com versão do schema e data de exportação.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
            Exportar backup JSON
          </button>
        </div>

        {/* Import */}
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
                  Todos os dados locais atuais serão removidos antes da importação. Esta ação é irreversível.
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

      </div>
    </main>
  )
}

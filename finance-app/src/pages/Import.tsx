import { useState } from 'react'
import { ImportDropzone } from '../components/import/ImportDropzone'
import { ImportPreview } from '../components/import/ImportPreview'
import { ImportSummary } from '../components/import/ImportSummary'
import { parseAndPreview, confirmImport } from '../services/import.service'
import { useData } from '../context/DataContext'
import type { ParsedImportItem, ImportSummaryData } from '../importers/types'

type Stage = 'idle' | 'parsing' | 'preview' | 'complete'

interface Props {
  onNavigate: (route: string) => void
}

const STAGE_ORDER: Record<Stage, number> = { idle: 0, parsing: 0, preview: 1, complete: 2 }
const STAGE_LABELS = ['Upload', 'Revisão', 'Concluído']
const STAGES: Array<'idle' | 'preview' | 'complete'> = ['idle', 'preview', 'complete']

export function Import({ onNavigate }: Props) {
  const { transactions, appendTransactions } = useData()
  const [stage, setStage] = useState<Stage>('idle')
  const [items, setItems] = useState<ParsedImportItem[]>([])
  const [summary, setSummary] = useState<ImportSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setStage('parsing')
    try {
      const parsed = await parseAndPreview(file, transactions)
      if (parsed.length === 0) {
        setError('Nenhum lançamento encontrado. Verifique se o arquivo tem o formato esperado.')
        setStage('idle')
        return
      }
      setItems(parsed)
      setStage('preview')
    } catch (err) {
      setError(`Erro ao processar o arquivo: ${err instanceof Error ? err.message : String(err)}`)
      setStage('idle')
    }
  }

  async function handleConfirm() {
    const { transactions: imported, summary: s } = confirmImport(items)
    await appendTransactions(imported)
    setSummary(s)
    setStage('complete')
  }

  function handleNewImport() {
    setItems([])
    setSummary(null)
    setError(null)
    setStage('idle')
  }

  const current = STAGE_ORDER[stage]

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Page header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Importação</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            XLSX, XLS ou CSV — colunas detectadas automaticamente
          </div>
        </div>

        {/* ── Steps breadcrumb ── */}
        <div className="step-row">
          {STAGES.map((s, i) => {
            const done = current > i
            const active = current === i
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={`step-dot ${done ? 'done' : active ? 'active' : 'idle'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`step-label ${done ? 'done' : active ? 'active' : ''}`}>
                  {STAGE_LABELS[i]}
                </span>
                {i < 2 && <span className="step-sep">›</span>}
              </div>
            )
          })}
        </div>

        {/* ── Content card ── */}
        <div className="card" style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 8, fontSize: 12.5, color: 'var(--crit)' }}>
              {error}
            </div>
          )}

          {(stage === 'idle' || stage === 'parsing') && (
            <>
              <ImportDropzone onFile={handleFile} loading={stage === 'parsing'} />
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>Colunas esperadas no arquivo</p>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.6 }}>
                  Tipo · Descrição · Valor · Data · Data Competência · Status · Forma de Pagamento · Conta/Cartão
                </p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
                  Colunas opcionais: Parcela · Recorrente · Tags · Grupo
                </p>
              </div>
            </>
          )}

          {stage === 'preview' && (
            <ImportPreview
              items={items}
              onUpdate={setItems}
              onConfirm={handleConfirm}
              onCancel={handleNewImport}
            />
          )}

          {stage === 'complete' && summary && (
            <ImportSummary
              summary={summary}
              onNewImport={handleNewImport}
              onGoToDashboard={() => onNavigate('/')}
            />
          )}
        </div>
      </div>
    </main>
  )
}

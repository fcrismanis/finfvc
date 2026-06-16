import { useState, useRef } from 'react'
import { ImportDropzone } from '../components/import/ImportDropzone'
import { ImportPreview } from '../components/import/ImportPreview'
import { ImportSummary } from '../components/import/ImportSummary'
import { parseAndPreview, confirmImport } from '../services/import.service'
import {
  parseRealFinanceXlsx, importRealFinanceBase, ensureSubCategories, upsertAccountRegistry,
  type RealImportResult,
} from '../services/realFinanceImport.service'
import { buildTrainingExamplesFromRows, appendTrainingExamples } from '../services/financialTraining.service'
import { useData } from '../context/DataContext'
import type { ParsedImportItem, ImportSummaryData } from '../importers/types'
import type { NavFilter } from '../App'

type Stage = 'idle' | 'parsing' | 'preview' | 'complete'
type RealStage = 'idle' | 'importing' | 'done' | 'error'

interface Props {
  onNavigate: (route: string, filter?: NavFilter) => void
}

const STAGE_ORDER: Record<Stage, number> = { idle: 0, parsing: 0, preview: 1, complete: 2 }
const STAGE_LABELS = ['Upload', 'Revisão', 'Concluído']
const STAGES: Array<'idle' | 'preview' | 'complete'> = ['idle', 'preview', 'complete']

export function Import({ onNavigate }: Props) {
  const { transactions, appendTransactions } = useData()
  const realInputRef = useRef<HTMLInputElement>(null)
  const [realStage, setRealStage] = useState<RealStage>('idle')
  const [realResult, setRealResult] = useState<RealImportResult | null>(null)
  const [realError, setRealError] = useState<string | null>(null)
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

  async function handleRealImport(file: File) {
    setRealStage('importing')
    setRealError(null)
    setRealResult(null)
    try {
      const buffer = await file.arrayBuffer()
      const rows = parseRealFinanceXlsx(buffer, file.name)
      if (rows.length === 0) throw new Error('Nenhuma linha encontrada no arquivo.')

      const batchId = `real_${Date.now().toString(36)}`
      const { transactions: txns, result } = importRealFinanceBase(rows, transactions, batchId)

      // Ensure subcategories exist and get the map for training
      const { created, byName } = ensureSubCategories()

      // Build and save training examples
      const trainingExamples = buildTrainingExamplesFromRows(rows, byName)
      appendTrainingExamples(trainingExamples)

      // Save account/card registry
      upsertAccountRegistry(result.accounts, result.cards)

      if (txns.length > 0) await appendTransactions(txns)

      setRealResult({ ...result, subcategoriesCreated: created, trainingExamples: trainingExamples.length })
      setRealStage('done')
    } catch (e) {
      setRealError(e instanceof Error ? e.message : String(e))
      setRealStage('error')
    }
  }

  const current = STAGE_ORDER[stage]

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Importação</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Importe extratos em CSV ou XLSX
          </div>
        </div>

        {/* Steps breadcrumb */}
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

        {/* Content card */}
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

        {/* ── Base real 2026 ── */}
        <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--accent)20' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            Importar base real 2026
          </p>
          <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.5 }}>
            Use esta opção para carregar a base real de lançamentos, contas, cartões, categorias e regras de IA.
            Importar o mesmo arquivo novamente não gera duplicatas.
          </p>

          {realStage === 'idle' && (
            <>
              <input
                ref={realInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleRealImport(f) }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => realInputRef.current?.click()}
              >
                Importar base real 2026
              </button>
            </>
          )}

          {realStage === 'importing' && (
            <p style={{ fontSize: 12, color: 'var(--faint)' }}>Processando arquivo…</p>
          )}

          {realStage === 'error' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--crit)', marginBottom: 8 }}>{realError}</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setRealStage('idle')}>
                Tentar novamente
              </button>
            </div>
          )}

          {realStage === 'done' && realResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Importados', value: realResult.imported },
                  { label: 'Duplicatas ignoradas', value: realResult.duplicates },
                  { label: 'Subcategorias criadas', value: realResult.subcategoriesCreated },
                  { label: 'Exemplos de treinamento', value: realResult.trainingExamples },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{s.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {realResult.cards.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>Cartões: </span>
                  {realResult.cards.join(', ')}
                </div>
              )}
              {realResult.accounts.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>Contas: </span>
                  {realResult.accounts.join(', ')}
                </div>
              )}
              {realResult.categoriesFound.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>Categorias do arquivo: </span>
                  {realResult.categoriesFound.join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate('/lancamentos', { monthOverride: '' })}>
                  Ver lançamentos importados
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setRealStage('idle'); setRealResult(null) }}>
                  Importar outro arquivo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pluggy reference */}
        <div
          style={{
            padding: '14px 18px', borderRadius: 10, background: 'var(--well)',
            border: '1px solid var(--line)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}
        >
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>Sincronização automática</p>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
              Para conectar banco ou cartão via Open Finance, acesse Integrações → Pluggy.
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('/pluggy')}
            style={{ flexShrink: 0 }}
          >
            Acessar Pluggy
          </button>
        </div>

      </div>
    </main>
  )
}

import { useState } from 'react'
import { ImportDropzone } from '../components/import/ImportDropzone'
import { ImportPreview } from '../components/import/ImportPreview'
import { ImportSummary } from '../components/import/ImportSummary'
import { parseAndPreview, confirmImport } from '../services/import.service'
import { useData } from '../context/DataContext'
import type { ParsedImportItem, ImportSummaryData } from '../importers/types'

type Stage = 'idle' | 'parsing' | 'preview' | 'complete'
type ImportTab = 'file' | 'pluggy'

interface Props {
  onNavigate: (route: string) => void
}

const STAGE_ORDER: Record<Stage, number> = { idle: 0, parsing: 0, preview: 1, complete: 2 }
const STAGE_LABELS = ['Upload', 'Revisão', 'Concluído']
const STAGES: Array<'idle' | 'preview' | 'complete'> = ['idle', 'preview', 'complete']

export function Import({ onNavigate }: Props) {
  const { transactions, appendTransactions } = useData()
  const [tab, setTab] = useState<ImportTab>('file')
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
            Importe extratos ou conecte seu banco via Open Finance
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
          {([
            { key: 'file',   label: 'Upload de arquivo' },
            { key: 'pluggy', label: 'Conectar banco' },
          ] as { key: ImportTab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--ink)' : 'var(--faint)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontFamily: 'var(--ui)',
                borderBottom: tab === t.key ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
              {t.key === 'pluggy' && (
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'var(--well)', color: 'var(--faint)', verticalAlign: 'middle' }}>
                  EM BREVE
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Pluggy tab ── */}
        {tab === 'pluggy' && (
          <div className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', letterSpacing: '-.01em' }}>
                  Open Finance via Pluggy
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 4, lineHeight: 1.6, maxWidth: 440 }}>
                  Conecte sua conta bancária diretamente e sincronize transações automaticamente, sem precisar exportar arquivos manualmente.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Conexão segura via Open Finance regulado pelo Banco Central',
                'Sincronização automática de transações',
                'Suporte a mais de 300 bancos e corretoras brasileiras',
                'Sem armazenar credenciais bancárias no app',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-2)', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--well)', borderRadius: 9, border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--ink-2)' }}>Requer backend:</strong> a integração com Pluggy usa um connect_token gerado server-side para proteger as credenciais da API. Configure seu endpoint antes de ativar.
            </div>

            <button className="btn btn-secondary" disabled style={{ width: 'fit-content', opacity: 0.45 }}>
              Conectar banco — em breve
            </button>
          </div>
        )}

        {tab === 'file' && (
          <>
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
          </>
        )}
      </div>
    </main>
  )
}

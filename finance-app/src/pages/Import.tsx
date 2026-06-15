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
                <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'var(--warn)', color: '#fff', verticalAlign: 'middle' }}>
                  BETA
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Pluggy tab ── */}
        {tab === 'pluggy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Status banner */}
            <div style={{ padding: '14px 18px', borderRadius: 11, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Backend não configurado</p>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                  Configure o endpoint <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>/api/pluggy/token</code> para ativar a conexão. Ver <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>docs/pluggy-integration.md</code>.
                </p>
              </div>
            </div>

            {/* Connection list (mock empty state) */}
            <div className="card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Conexões ativas</h3>
                <button className="btn btn-secondary btn-sm" disabled style={{ opacity: 0.4 }}>
                  + Conectar banco
                </button>
              </div>
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--faint)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }}>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <p style={{ fontSize: 12.5 }}>Nenhuma conexão configurada</p>
                <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7 }}>Quando ativar, seus bancos aparecerão aqui</p>
              </div>
            </div>

            {/* How it works */}
            <div className="card" style={{ padding: '18px 22px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Como funciona</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['1', 'Você clica em "Conectar banco"'],
                  ['2', 'Backend gera um connect_token via Pluggy API (server-side)'],
                  ['3', 'Widget Pluggy abre — você autentifica com suas credenciais bancárias'],
                  ['4', 'Transações sincronizam via webhook para o backend'],
                  ['5', 'FIN importa e deduplica as transações automaticamente'],
                ].map(([n, text]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, color: 'var(--faint)' }}>{n}</span>
                    {text}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--well)', borderRadius: 8, border: '1px solid var(--line)', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--ink-2)' }}>Segurança:</strong> suas credenciais bancárias nunca passam pelo FIN. O app só recebe o connect_token de curta duração gerado pelo backend.
              </div>
            </div>

            {/* Supported banks preview */}
            <div className="card" style={{ padding: '16px 22px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Suporte estimado</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Itaú', 'Bradesco', 'Santander', 'BB', 'Nubank', 'C6 Bank', 'BTG', 'XP', 'Inter', '+ 300 mais'].map(b => (
                  <span key={b} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>{b}</span>
                ))}
              </div>
            </div>
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

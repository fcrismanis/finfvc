import { useMemo, useState } from 'react'
import { Bot, RotateCcw, Search, Sparkles } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { formatFinancialDateBR } from '../utils/date'
import { buildFinanceCommandPlan } from '../services/financeCommand.service'
import { executePromptAsFinanceCommand, undoCommand, type FinanceCommandPreview, type FinanceCommandResult } from '../services/financeCommandExecutor.service'
import { getCommandHistory, type FinanceCommandHistoryEntry } from '../services/financeCommandHistory.service'

const EXAMPLES = [
  'Tudo que tiver Sulamerica coloque como Salário',
  'Tudo que tiver Drogasil coloque em Saúde / Farmácia',
  'Tudo que tiver Sem Parar coloque em Transporte / Estacionamento',
  'Tudo que tiver Spotify coloque em Assinaturas / Música',
  'Desfazer última alteração',
]

type CommandOutput = FinanceCommandPreview | FinanceCommandResult | null

function isResult(output: CommandOutput): output is FinanceCommandResult {
  return Boolean(output && 'message' in output)
}

function isPreview(output: CommandOutput): output is FinanceCommandPreview {
  return Boolean(output && 'matchedTransactions' in output)
}

function buildPreviewFilterLabel(preview: FinanceCommandPreview): string {
  return preview.plan.filters.descriptionContains?.join(', ') || 'não identificado'
}

function buildPreviewTargetLabel(preview: FinanceCommandPreview): string {
  const { categoryName, subCategoryName } = preview.plan.actions
  if (categoryName && subCategoryName) return `${categoryName} / ${subCategoryName}`
  return categoryName || subCategoryName || 'não identificado'
}

export function FinanceAssistantPage() {
  const { transactions, subCategories, updateTransactions, saveSubCategory, deleteSubCategory, reload } = useData()
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<CommandOutput>(null)
  const [history, setHistory] = useState<FinanceCommandHistoryEntry[]>(() => getCommandHistory())

  const ctx = useMemo(() => ({
    transactions,
    subCategories,
    updateTransactions,
    saveSubCategory,
    deleteSubCategory,
    reload,
  }), [transactions, subCategories, updateTransactions, saveSubCategory, deleteSubCategory, reload])

  async function run(mode: 'apply' | 'preview', customPrompt?: string) {
    const value = (customPrompt ?? prompt).trim()
    if (!value) return
    setRunning(true)
    try {
      const result = await executePromptAsFinanceCommand(value, ctx, mode)
      setOutput(result)
      setHistory(getCommandHistory())
      if (customPrompt) setPrompt(customPrompt)
    } finally {
      setRunning(false)
    }
  }

  async function undoEntry(entry: FinanceCommandHistoryEntry) {
    setRunning(true)
    try {
      const result = await undoCommand(entry.id, ctx)
      setOutput(result)
      setHistory(getCommandHistory())
    } finally {
      setRunning(false)
    }
  }

  const parsedPlan = useMemo(() => buildFinanceCommandPlan(prompt), [prompt])
  const previewMessage = isPreview(output) && output.plan.intent === 'unknown'
    ? 'Não entendi o comando. Tente algo como: Tudo que tiver BANCO INTER coloque em Movimentação Financeira / Pg. Cartão de Credito.'
    : isPreview(output) && output.matchedTransactions.length > 100
      ? 'Filtro amplo demais. Refine o comando antes de aplicar.'
      : null

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Assistente</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Comando natural com aplicação direta e desfazer reversível.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={18} color="var(--accent)" />
            <p style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Digite um comando financeiro</p>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ex.: Tudo que tiver Sulamerica coloque como Salário"
            className="login-field"
            style={{ minHeight: 92, resize: 'vertical', fontSize: 13, lineHeight: 1.55 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" disabled={running || !prompt.trim()} onClick={() => void run('apply')}>
              {running ? 'Executando…' : 'Executar'}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={running || !prompt.trim()} onClick={() => void run('preview')}>
              Pré-visualizar
            </button>
            <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--faint)' }}>
              intenção: <strong style={{ color: 'var(--ink-2)' }}>{parsedPlan.intent}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map(example => (
              <button
                key={example}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
                disabled={running}
                onClick={() => { setPrompt(example); void run('preview', example) }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {isResult(output) && (
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="var(--pos)" />
              <p style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Resultado</p>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{output.message}</p>
          </div>
        )}

        {isPreview(output) && (
          <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={16} color="var(--warn)" />
              <p style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Pré-visualização</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <InfoPill label="Intent" value={output.plan.intent} />
              <InfoPill label="Lançamentos" value={String(output.matchedTransactions.length)} />
              <InfoPill label="Filtro" value={buildPreviewFilterLabel(output)} />
              <InfoPill label="Destino" value={buildPreviewTargetLabel(output)} />
              <InfoPill label="Criar categoria" value={output.wouldCreateCategories.join(', ') || 'não'} />
              <InfoPill label="Criar subcat." value={output.wouldCreateSubCategories.join(', ') || 'não'} />
              <InfoPill label="Criar regra" value={output.wouldCreateRules.join(', ') || 'não'} />
            </div>
            {previewMessage && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(214, 140, 44, 0.08)', border: '1px solid rgba(214, 140, 44, 0.28)' }}>
                <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>{previewMessage}</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {output.matchedTransactions.slice(0, 12).map(tx => (
                <div key={tx.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{tx.description}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: tx.type === 'income' ? 'var(--pos)' : 'var(--crit)' }}>{formatBRL(tx.amount)}</p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{formatFinancialDateBR(tx.competenceDate)} · {tx.accountId}</p>
                </div>
              ))}
              {output.matchedTransactions.length > 12 && (
                <p style={{ fontSize: 11, color: 'var(--faint)' }}>Mostrando 12 de {output.matchedTransactions.length} lançamentos.</p>
              )}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} color="var(--accent)" />
            <p style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Histórico dos comandos</p>
          </div>
          {history.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--faint)' }}>Nenhum comando registrado ainda.</p>
          ) : (
            history.slice(0, 10).map((entry, idx) => {
              const canUndo = entry.status === 'applied' && entry.summary.affectedTransactions > 0
              const affectedIds = new Set(entry.before.transactions.map(t => t.id))
              const hasSubsequent = canUndo && history.slice(0, idx).some(
                e => e.status === 'applied' && e.before.transactions.some(t => affectedIds.has(t.id))
              )
              const statusLabel = entry.status === 'no_match' ? 'sem resultados' : entry.status === 'undone' ? 'desfeito' : 'aplicado'
              return (
                <div key={entry.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{entry.command}</p>
                      <p style={{ fontSize: 11, color: entry.status === 'no_match' ? 'var(--warn)' : 'var(--faint)', marginTop: 2 }}>
                        {entry.summary.affectedTransactions} lançamento(s) · {statusLabel}
                      </p>
                    </div>
                    {canUndo && (
                      <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => void undoEntry(entry)}>
                        Desfazer
                      </button>
                    )}
                  </div>
                  {hasSubsequent && (
                    <p style={{ fontSize: 11, color: 'var(--warn)', lineHeight: 1.5 }}>
                      Este comando foi seguido de outras alterações. Desfazer pode reverter ajustes posteriores.
                    </p>
                  )}
                  {(entry.summary.createdCategories.length > 0 || entry.summary.createdSubCategories.length > 0 || entry.summary.createdRules.length > 0) && (
                    <p style={{ fontSize: 11, color: 'var(--faint)' }}>
                      {entry.summary.createdCategories.length > 0 ? `categorias: ${entry.summary.createdCategories.join(', ')} · ` : ''}
                      {entry.summary.createdSubCategories.length > 0 ? `subcategorias: ${entry.summary.createdSubCategories.join(', ')} · ` : ''}
                      {entry.summary.createdRules.length > 0 ? `regras: ${entry.summary.createdRules.join(', ')}` : ''}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>{value}</p>
    </div>
  )
}

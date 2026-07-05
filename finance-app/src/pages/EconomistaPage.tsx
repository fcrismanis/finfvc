import { useState, useRef, useEffect } from 'react'
import { Send, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { askEconomista, type EconomistaProvider, type EconomistaResponse } from '../agent/economista.service'

import { formatBRL } from '../utils/currency'
import type { GetTransactionsOutput } from '../agent/tools/getTransactions'
import type { GetBudgetAnalysisOutput } from '../agent/tools/getBudgetAnalysis'
import type { GetSpendingInsightsOutput } from '../agent/tools/getSpendingInsights'
import type { GetReconciliationStatusOutput } from '../agent/tools/getReconciliationStatus'

interface Props {
  selectedMonth: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  response?: EconomistaResponse
  timestamp: string
}

const SUGGESTED = [
  'O que fugiu do padrão este mês?',
  'Onde posso economizar 15%?',
  'Quais lançamentos precisam revisão?',
  'Quais categorias estão crescendo?',
  'Como está minha reconciliação?',
  'Resumo do mês',
]

function DiagnosticCards({ response }: { response: EconomistaResponse }) {
  const tx = response.diagnosticData['getTransactions']?.data as GetTransactionsOutput | undefined
  const bud = response.diagnosticData['getBudgetAnalysis']?.data as GetBudgetAnalysisOutput | undefined
  const ins = response.diagnosticData['getSpendingInsights']?.data as GetSpendingInsightsOutput | undefined
  const rec = response.diagnosticData['getReconciliationStatus']?.data as GetReconciliationStatusOutput | undefined

  const cards: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }[] = []

  if (tx) {
    const saldo = tx.totalIncome - tx.totalExpense
    cards.push({
      label: 'Resultado',
      value: formatBRL(saldo),
      sub: `Receita ${formatBRL(tx.totalIncome)} · Despesas ${formatBRL(tx.totalExpense)}`,
      color: saldo >= 0 ? 'var(--pos)' : 'var(--neg)',
      icon: saldo >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
    })
    if (tx.needsReviewCount > 0) {
      cards.push({ label: 'Revisão pendente', value: `${tx.needsReviewCount}`, sub: 'lançamentos aguardando', color: 'var(--warn)', icon: <AlertTriangle size={14} /> })
    }
    if (tx.uncategorizedCount > 0) {
      cards.push({ label: 'Sem categoria', value: `${tx.uncategorizedCount}`, sub: 'lançamentos', color: 'var(--warn)', icon: <AlertTriangle size={14} /> })
    }
  }

  if (bud && !bud.noBudgetSet && bud.totalPlanned > 0) {
    const overPct = bud.totalPlanned > 0 ? ((bud.totalActual - bud.totalPlanned) / bud.totalPlanned) * 100 : 0
    cards.push({
      label: 'Orçamento',
      value: `${overPct >= 0 ? '+' : ''}${overPct.toFixed(0)}%`,
      sub: `${formatBRL(bud.totalActual)} de ${formatBRL(bud.totalPlanned)}`,
      color: overPct > 10 ? 'var(--neg)' : overPct > -5 ? 'var(--warn)' : 'var(--pos)',
    })
  }

  if (ins && ins.insights.length > 0) {
    cards.push({
      label: 'Gastos vs média',
      value: formatBRL(ins.totalSpendingVsAvg),
      sub: ins.topGrowthCategories.length > 0 ? `↑ ${ins.topGrowthCategories.join(', ')}` : 'vs 3 meses anteriores',
      color: ins.totalSpendingVsAvg > 0 ? 'var(--neg)' : 'var(--pos)',
      icon: ins.totalSpendingVsAvg > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
    })
  }

  if (rec) {
    const hasIssues = rec.neutralCandidates > 0 || rec.needsReviewCount > 0 || rec.pendingExpenses > 0
    cards.push({
      label: 'Reconciliação',
      value: hasIssues ? `${rec.neutralCandidates + rec.needsReviewCount} pendências` : 'OK',
      sub: hasIssues ? 'movimentos a revisar' : 'sem pendências',
      color: hasIssues ? 'var(--warn)' : 'var(--pos)',
      icon: hasIssues ? <AlertTriangle size={14} /> : <CheckCircle size={14} />,
    })
  }

  if (cards.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
      {cards.map((card, i) => (
        <div key={i} className="card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            {card.icon && <span style={{ color: card.color }}>{card.icon}</span>}
            {card.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: card.color ?? 'var(--ink)', letterSpacing: '-.02em' }}>{card.value}</div>
          {card.sub && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{card.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export function EconomistaPage({ selectedMonth }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const provider: EconomistaProvider = 'gpt'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await askEconomista(q, { month: selectedMonth }, provider)
      const assistantMsg: Message = {
        role: 'assistant',
        content: response.answer,
        response,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
  }

  const isEmpty = messages.length === 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)', marginBottom: 2 }}>
              ✦ Economista FIN
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--faint)' }}>
              Agente de diagnóstico financeiro · mês {selectedMonth} · modo leitura
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pos)', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)' }}>
              {provider === 'gpt' ? 'GPT' : provider === 'simulated' ? 'Simulado' : 'LLM Custom'}
            </span>
          </div>
        </div>

        {/* Empty state / suggestions */}
        {isEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 0' }}>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 600 }}>Perguntas sugeridas para {selectedMonth}:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, border: '1px solid var(--line)', background: 'var(--card-bg)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--ui)' }}
                >
                  {s}
                  <ChevronRight size={12} style={{ opacity: .5 }} />
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)' }}>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.7, margin: 0 }}>
                <strong style={{ color: 'var(--ink-2)' }}>Modo Diagnóstico</strong> — somente leitura.
                Nenhuma ação será executada. Toda sugestão será apresentada para aprovação antes de qualquer alteração.
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '72%', padding: '10px 16px', borderRadius: '16px 16px 4px 16px', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {msg.response && <DiagnosticCards response={msg.response} />}
                    <div className="card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                        ✦ Economista FIN
                      </div>
                      <div
                        style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7 }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                      {msg.response && msg.response.alerts.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {msg.response.alerts.map((a, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warn)' }}>
                              <AlertTriangle size={11} />
                              {a}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--faint)', display: 'flex', gap: 8 }}>
                        {msg.response?.toolsUsed.map(t => (
                          <span key={t} style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--well)', border: '1px solid var(--line)' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
                  Analisando dados financeiros…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-end', position: 'sticky', bottom: 16 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte ao Economista FIN…"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13.5,
              fontFamily: 'var(--ui)',
              color: 'var(--ink)',
              lineHeight: 1.5,
              padding: 0,
            }}
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--well)',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              color: input.trim() && !loading ? '#fff' : 'var(--faint)',
              flexShrink: 0,
              transition: 'all .12s',
            }}
          >
            <Send size={15} />
          </button>
        </div>

      </div>
    </main>
  )
}

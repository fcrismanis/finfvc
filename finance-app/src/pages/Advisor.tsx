import { useState, useMemo, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getMonthSummary, getMacroCategoryTotals } from '../engine/calculate'
import { formatBRL, formatPct } from '../utils/currency'
import { currentYearMonth } from '../utils/date'
import { askAdvisor, SUGGESTED_PROMPTS } from '../services/aiAdvisor.service'
import type { AIProvider, AdvisorMessage } from '../services/aiAdvisor.service'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

interface ProviderStatus { mock: boolean; gpt: boolean; claude: boolean }

export function Advisor({ selectedMonth, onNavigate }: Props) {
  const { transactions, budgets } = useData()
  const month = selectedMonth ?? currentYearMonth()
  const [provider, setProvider] = useState<AIProvider>('simulated')
  const [messages, setMessages] = useState<AdvisorMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/advisor')
      .then(r => r.ok ? r.json() as Promise<ProviderStatus> : null)
      .then(s => { if (s) setProviderStatus(s) })
      .catch(() => { /* backend offline — keep null, show warning */ })
  }, [])

  const summary = useMemo(
    () => getMonthSummary(transactions, month, budgets),
    [transactions, month, budgets]
  )

  const topCats = useMemo(() => {
    const totals = getMacroCategoryTotals(transactions, month)
    return totals.sort((a, b) => b.total - a.total).slice(0, 5).map(c => ({
      name: c.name,
      amount: c.total,
      color: c.color,
    }))
  }, [transactions, month])

  const context = useMemo(() => ({
    month,
    operationalIncome: summary.operationalIncome,
    totalExpenses: summary.totalExpenses,
    operationalResult: summary.operationalResult,
    savingsRate: summary.savingsRate,
    topCategories: topCats,
    pendingAmount: summary.pendingAmount,
  }), [month, summary, topCats])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: AdvisorMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const response = await askAdvisor(text.trim(), context, provider)
      const assistantMsg: AdvisorMessage = { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() }
      setMessages(m => [...m, assistantMsg])
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao consultar IA')
    } finally {
      setLoading(false)
    }
  }

  const resultOk = summary.operationalResult >= 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Consultor IA</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Análise contextual — {month}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Modelo</span>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as AIProvider)}
              className="ledger-select"
              style={{ fontSize: 12 }}
            >
              <option value="simulated">Simulado (local)</option>
              <option value="gpt" disabled={providerStatus !== null && !providerStatus.gpt}>
                {`GPT${providerStatus && !providerStatus.gpt ? ' — sem chave' : providerStatus?.gpt ? ' ✓' : ' (requer backend)'}`}
              </option>
              <option value="claude" disabled={providerStatus !== null && !providerStatus.claude}>
                {`Claude${providerStatus && !providerStatus.claude ? ' — sem chave' : providerStatus?.claude ? ' ✓' : ' (requer backend)'}`}
              </option>
            </select>
          </div>
        </div>

        {/* Backend offline */}
        {providerStatus === null && provider !== 'simulated' && (
          <div style={{ padding: '10px 14px', background: 'var(--well)', border: '1px solid var(--warn)', borderRadius: 9, fontSize: 12, color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)' }}>Backend offline</strong> — inicie o servidor:{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>cd finance-app/server && npm run dev</code>
          </div>
        )}

        {/* Claude not configured */}
        {providerStatus !== null && provider === 'claude' && !providerStatus.claude && (
          <div style={{ padding: '10px 14px', background: 'var(--well)', border: '1px solid var(--crit)', borderRadius: 9, fontSize: 12, color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--crit)' }}>Claude não configurado</strong> — adicione{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>ANTHROPIC_API_KEY</code> em{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>server/.env</code>. Obtenha em console.anthropic.com.
          </div>
        )}

        {/* GPT not configured */}
        {providerStatus !== null && provider === 'gpt' && !providerStatus.gpt && (
          <div style={{ padding: '10px 14px', background: 'var(--well)', border: '1px solid var(--crit)', borderRadius: 9, fontSize: 12, color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--crit)' }}>GPT não configurado</strong> — adicione{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>OPENAI_API_KEY</code> em{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>server/.env</code>. Obtenha em platform.openai.com/api-keys.
          </div>
        )}

        {/* GPT configured but may have quota issues */}
        {providerStatus?.gpt && provider === 'gpt' && (
          <div style={{ padding: '10px 14px', background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 9, fontSize: 12, color: 'var(--faint)' }}>
            Usando GPT via backend seguro. Se receber erro de cota, adicione créditos em{' '}
            <strong style={{ color: 'var(--ink-2)' }}>platform.openai.com/settings/billing</strong>.
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── Chat ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

            {/* Messages */}
            <div className="card" style={{
              padding: '16px', display: 'flex', flexDirection: 'column', gap: 12,
              minHeight: 280, maxHeight: 440, overflowY: 'auto',
            }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--well)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Bot size={20} color="var(--ink-2)" />
                  </div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Consultor IA</p>
                  <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.6, maxWidth: 320 }}>
                    Faça uma pergunta sobre suas finanças. O contexto de {month} já foi carregado.
                    {provider === 'simulated' && ' (modo simulado — respostas locais baseadas nos seus dados)'}
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <ChatBubble key={i} msg={msg} />
                ))
              )}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={14} color="var(--accent)" />
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--faint)',
                        animation: 'pulse 1.2s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <div style={{ padding: '10px 12px', background: 'var(--crit-soft)', border: '1px solid var(--crit)', borderRadius: 8, fontSize: 12, color: 'var(--crit)' }}>
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggested prompts (only when no messages) */}
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    disabled={loading}
                    style={{
                      textAlign: 'left', background: 'var(--paper)', border: '1px solid var(--line)',
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--ui)', lineHeight: 1.4,
                      transition: 'border-color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--ink-2)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              display: 'flex', gap: 8, background: 'var(--card-bg)',
              border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px',
              alignItems: 'flex-end',
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="Pergunte sobre seus dados financeiros…"
                rows={2}
                disabled={loading}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  fontSize: 13, lineHeight: 1.5, background: 'transparent',
                  fontFamily: 'var(--ui)', color: 'var(--ink)',
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: input.trim() && !loading ? 'var(--accent)' : 'var(--well)',
                  border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                  transition: 'background .15s', flexShrink: 0,
                }}
              >
                <Send size={14} color={input.trim() && !loading ? '#fff' : 'var(--faint)'} />
              </button>
            </div>
          </div>

          {/* ── Context sidebar ── */}
          <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Contexto {month}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <CtxRow label="Receita" value={formatBRL(summary.operationalIncome)} color="var(--pos)" />
                <CtxRow label="Despesas" value={formatBRL(summary.totalExpenses)} color="var(--crit)" />
                <CtxRow label="Resultado" value={formatBRL(summary.operationalResult)} color={resultOk ? 'var(--pos)' : 'var(--crit)'} />
                <CtxRow label="Margem" value={formatPct(summary.savingsRate * 100)} color="var(--ink-2)" />
              </div>
            </div>

            {topCats.length > 0 && (
              <div className="card" style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Top categorias</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {topCats.slice(0, 4).map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color ?? 'var(--faint)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span className="num" style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 11 }}>{formatBRL(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }} onClick={() => onNavigate('/lancamentos')}>
                Ver lançamentos
              </button>
              <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }} onClick={() => onNavigate('/orcamento')}>
                Ver orçamento
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}

function ChatBubble({ msg }: { msg: AdvisorMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--ink)' : 'var(--accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={13} color="#fff" />
          : <Bot size={13} color="var(--accent)" />
        }
      </div>
      <div style={{
        maxWidth: '80%', padding: '9px 13px', borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        background: isUser ? 'var(--ink)' : 'var(--well)',
        color: isUser ? '#fff' : 'var(--ink)',
        fontSize: 13, lineHeight: 1.6,
      }}>
        {msg.content.split('\n').map((line, i) => {
          const bold = line.replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong>${t}</strong>`)
          return <p key={i} style={{ marginBottom: i < msg.content.split('\n').length - 1 ? 4 : 0 }} dangerouslySetInnerHTML={{ __html: bold }} />
        })}
      </div>
    </div>
  )
}

function CtxRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{label}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

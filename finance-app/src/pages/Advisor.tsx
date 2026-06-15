import { useState, useMemo, useRef, useEffect } from 'react'
import { Send, Bot, User, Copy, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getMonthSummary, getMacroCategoryTotals } from '../engine/calculate'
import { formatBRL, formatPct } from '../utils/currency'
import { currentYearMonth } from '../utils/date'
import { askAdvisor, SUGGESTED_PROMPTS } from '../services/aiAdvisor.service'
import { MACRO_CATEGORIES } from '../config/categories'
import type { AIProvider, AdvisorMessage } from '../services/aiAdvisor.service'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

interface ProviderStatus { mock: boolean; gpt: boolean; claude: boolean }

type UiMode = 'simulated' | 'copy' | 'api'

// ── Build clipboard context ──────────────────────────────────────────────────
function buildCopyContext(
  month: string,
  income: number,
  expenses: number,
  result: number,
  margin: number,
  topCats: { name: string; amount: number }[],
  pendingAmount: number,
  budgets: { macroCategoryId?: string; plannedAmount: number; referenceMonth: string }[],
  pendingDescs: { date: string; description: string; amount: number }[],
): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = result >= 0 ? '+' : ''
  const monthBudgets = budgets
    .filter(b => b.referenceMonth === month && b.macroCategoryId)
    .map(b => {
      const cat = MACRO_CATEGORIES.find(m => m.id === b.macroCategoryId)
      const actual = topCats.find(c => c.name === cat?.name)?.amount ?? 0
      return { name: cat?.name ?? b.macroCategoryId!, planned: b.plannedAmount, actual }
    })
    .filter(b => b.planned > 0)

  const lines: string[] = [
    `# Contexto Financeiro FIN — ${month}`,
    `# Cole este texto no ChatGPT ou Claude para análise do seu mês.`,
    ``,
    `## Resumo do mês`,
    `- Receita operacional: R$ ${fmt(income)}`,
    `- Despesas: R$ ${fmt(expenses)}`,
    `- Resultado: ${sign}R$ ${fmt(result)} (${result >= 0 ? 'positivo' : 'negativo'})`,
    `- Margem familiar: ${margin.toFixed(1)}%`,
    pendingAmount > 0 ? `- Comprometido pendente: R$ ${fmt(pendingAmount)}` : '',
    ``,
    `## Maiores categorias de despesa`,
    ...topCats.slice(0, 6).map((c, i) => `${i + 1}. ${c.name}: R$ ${fmt(c.amount)}`),
  ]

  if (monthBudgets.length > 0) {
    lines.push(``, `## Orçamento vs Realizado`)
    monthBudgets.slice(0, 6).forEach(b => {
      const diff = b.actual - b.planned
      const pct = b.planned > 0 ? ((diff / b.planned) * 100).toFixed(0) : '—'
      lines.push(`- ${b.name}: planejado R$ ${fmt(b.planned)} | realizado R$ ${fmt(b.actual)} | desvio ${diff >= 0 ? '+' : ''}${pct}%`)
    })
  }

  if (pendingDescs.length > 0) {
    lines.push(``, `## Lançamentos pendentes (${pendingDescs.length})`)
    pendingDescs.slice(0, 8).forEach(t => {
      lines.push(`- ${t.date} | ${t.description} | R$ ${fmt(t.amount)}`)
    })
  }

  lines.push(
    ``,
    `---`,
    `**Instrução para a IA:** Use apenas os dados acima. Responda em português do Brasil.`,
    `Separe claramente fatos observados, hipóteses e recomendações práticas.`,
    `Avise quando faltar dado. Não invente valores.`,
    ``,
    `## Sugestões de perguntas`,
    `- Como está meu resultado operacional em ${month}?`,
    `- Quais categorias estão acima do habitual?`,
    `- Onde posso cortar gastos para melhorar minha margem?`,
    `- Tenho comprometimentos pendentes relevantes?`,
    `- Como posso chegar a uma margem de 20% no próximo mês?`,
  )

  return lines.filter(l => l !== null && l !== undefined).join('\n')
}

export function Advisor({ selectedMonth, onNavigate }: Props) {
  const { transactions, budgets } = useData()
  const month = selectedMonth ?? currentYearMonth()

  const [uiMode, setUiMode] = useState<UiMode>('simulated')
  const [provider, setProvider] = useState<AIProvider>('simulated')
  const [messages, setMessages] = useState<AdvisorMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showApiSection, setShowApiSection] = useState(false)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const summary = useMemo(
    () => getMonthSummary(transactions, month, budgets),
    [transactions, month, budgets]
  )

  const topCats = useMemo(() => {
    const totals = getMacroCategoryTotals(transactions, month)
    return totals.sort((a, b) => b.total - a.total).slice(0, 6).map(c => ({
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

  const pendingTxs = useMemo(() =>
    transactions
      .filter(t => t.status === 'pending' && t.competenceDate.slice(0, 7) === month)
      .slice(0, 8)
      .map(t => ({ date: t.competenceDate, description: t.description, amount: t.amount })),
    [transactions, month]
  )

  const copyText = useMemo(() => buildCopyContext(
    month,
    summary.operationalIncome,
    summary.totalExpenses,
    summary.operationalResult,
    summary.savingsRate * 100,
    topCats,
    summary.pendingAmount ?? 0,
    budgets,
    pendingTxs,
  ), [month, summary, topCats, budgets, pendingTxs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    fetch('/api/advisor')
      .then(r => r.ok ? r.json() as Promise<ProviderStatus> : null)
      .then(s => { if (s) setProviderStatus(s) })
      .catch(() => { /* backend offline — not required */ })
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: AdvisorMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const activeProvider: AIProvider = uiMode === 'simulated' ? 'simulated' : provider
      const response = await askAdvisor(text.trim(), context, activeProvider)
      const assistantMsg: AdvisorMessage = { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() }
      setMessages(m => [...m, assistantMsg])
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao consultar IA')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  const resultOk = summary.operationalResult >= 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Consultor IA</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Análise contextual — {month}</div>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--well)', borderRadius: 10, padding: 4, border: '1px solid var(--line)' }}>
            {([
              { key: 'simulated', label: 'Simulado' },
              { key: 'copy',      label: 'Copiar para IA' },
            ] as { key: UiMode; label: string }[]).map(m => (
              <button
                key={m.key}
                onClick={() => setUiMode(m.key)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)',
                  background: uiMode === m.key ? 'var(--card-bg)' : 'transparent',
                  color: uiMode === m.key ? 'var(--ink)' : 'var(--faint)',
                  boxShadow: uiMode === m.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  transition: 'all .12s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Info banner ── */}
        <div style={{ padding: '10px 14px', background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 9, fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
          IA externa via API é opcional e exige cobrança separada. Você pode usar o <strong style={{ color: 'var(--ink-2)' }}>modo simulado</strong> ou <strong style={{ color: 'var(--ink-2)' }}>copiar o contexto</strong> para usar no seu ChatGPT / Claude atual.
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── Left column ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

            {/* ── COPY MODE ── */}
            {uiMode === 'copy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Contexto para ChatGPT / Claude</p>
                      <p style={{ fontSize: 11.5, color: 'var(--faint)' }}>Copie, abra seu ChatGPT ou Claude, cole e faça suas perguntas.</p>
                    </div>
                    <button
                      onClick={handleCopy}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 12.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8,
                        border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)',
                        flexShrink: 0,
                        background: copied ? 'var(--pos)' : 'var(--accent)',
                        color: '#fff', transition: 'background .2s',
                      }}
                    >
                      {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                      {copied ? 'Copiado!' : 'Copiar contexto'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={copyText}
                    style={{
                      width: '100%', height: 360, fontFamily: 'var(--mono)', fontSize: 11.5,
                      lineHeight: 1.7, border: '1px solid var(--line)', borderRadius: 8,
                      padding: '12px 14px', resize: 'vertical', outline: 'none',
                      background: 'var(--well)', color: 'var(--ink-2)', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div className="card" style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Como usar</p>
                  <ol style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
                    <li>Clique em <strong>Copiar contexto</strong> acima</li>
                    <li>Abra o <a href="https://chatgpt.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>ChatGPT</a> ou o <a href="https://claude.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Claude</a> no plano que você já usa</li>
                    <li>Cole o contexto e escreva sua pergunta</li>
                  </ol>
                </div>
              </div>
            )}

            {/* ── SIMULATED / API CHAT ── */}
            {uiMode !== 'copy' && (
              <>
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
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                        {uiMode === 'simulated' ? 'Modo Simulado' : 'Consultor IA'}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.6, maxWidth: 320 }}>
                        {uiMode === 'simulated'
                          ? `Respostas automáticas baseadas nos seus dados de ${month}. Sem API externa.`
                          : `Usando ${provider === 'gpt' ? 'GPT' : 'Claude'} via backend. Contexto de ${month} carregado.`}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)
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
                      {uiMode === 'api' && (
                        <span style={{ marginLeft: 8, color: 'var(--ink-2)', fontWeight: 400 }}>
                          — tente o <button onClick={() => setUiMode('copy')} style={{ fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--ui)', fontSize: 12 }}>modo Copiar</button> como alternativa.
                        </span>
                      )}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Suggested prompts */}
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
              </>
            )}

            {/* ── API EXTERNA (collapsible) ── */}
            <div>
              <button
                onClick={() => setShowApiSection(s => !s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '8px 12px', background: 'var(--well)', border: '1px solid var(--line)',
                  borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  color: 'var(--faint)', fontFamily: 'var(--ui)', textAlign: 'left',
                }}
              >
                {showApiSection ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Integração via API externa (opcional, requer billing separado)
              </button>

              {showApiSection && (
                <div style={{ marginTop: 8, padding: '14px 16px', background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                    Para usar GPT ou Claude diretamente no app, configure o backend com chaves de API pagas. Ver <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>docs/advisor-endpoint.md</code>.
                  </p>
                  {providerStatus === null && (
                    <p style={{ fontSize: 11.5, color: 'var(--faint)' }}>Backend offline — inicie com <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>cd finance-app/server && npm run dev</code></p>
                  )}
                  {providerStatus !== null && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                      <span style={{ color: providerStatus.gpt ? 'var(--pos)' : 'var(--faint)' }}>
                        {providerStatus.gpt ? '✓' : '✗'} GPT
                      </span>
                      <span style={{ color: providerStatus.claude ? 'var(--pos)' : 'var(--faint)' }}>
                        {providerStatus.claude ? '✓' : '✗'} Claude
                      </span>
                    </div>
                  )}
                  {providerStatus !== null && (providerStatus.gpt || providerStatus.claude) && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={provider}
                        onChange={e => { setProvider(e.target.value as AIProvider); setUiMode('api') }}
                        className="ledger-select"
                        style={{ fontSize: 12 }}
                      >
                        <option value="gpt" disabled={!providerStatus.gpt}>GPT {providerStatus.gpt ? '✓' : '(sem chave)'}</option>
                        <option value="claude" disabled={!providerStatus.claude}>Claude {providerStatus.claude ? '✓' : '(sem chave)'}</option>
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setUiMode('api')}
                      >
                        Usar API
                      </button>
                    </div>
                  )}
                </div>
              )}
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
        {isUser ? <User size={13} color="#fff" /> : <Bot size={13} color="var(--accent)" />}
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
  const resultOk = true
  void resultOk
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{label}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

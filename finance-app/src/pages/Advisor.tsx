import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { getMonthSummary, getMacroCategoryTotals } from '../engine/calculate'
import { formatBRL, formatPct } from '../utils/currency'
import { currentYearMonth } from '../utils/date'
import { SUGGESTED_PROMPTS } from '../services/aiAdvisor.service'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

export function Advisor({ selectedMonth, onNavigate }: Props) {
  const { transactions, budgets } = useData()
  const month = selectedMonth ?? currentYearMonth()

  const summary = useMemo(
    () => getMonthSummary(transactions, month, budgets),
    [transactions, month, budgets]
  )

  const topCats = useMemo(() => {
    const totals = getMacroCategoryTotals(transactions, month)
    return totals.sort((a, b) => b.total - a.total).slice(0, 5)
  }, [transactions, month])

  const resultOk = summary.operationalResult >= 0

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Consultor IA</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Análise contextual das suas finanças — {month}
          </div>
        </div>

        {/* ── Context snapshot ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-.01em' }}>
            Contexto financeiro do mês
          </h3>
          <div className="stats-grid-4" style={{ gap: 12 }}>
            <CtxCard label="Receita" value={formatBRL(summary.operationalIncome)} color="var(--pos)" />
            <CtxCard label="Despesas" value={formatBRL(summary.totalExpenses)} color="var(--crit)" />
            <CtxCard label="Resultado" value={formatBRL(summary.operationalResult)} color={resultOk ? 'var(--pos)' : 'var(--crit)'} />
            <CtxCard label="Margem" value={formatPct(summary.savingsRate * 100)} color="var(--ink-2)" />
          </div>
          {topCats.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Maiores categorias</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {topCats.map(c => (
                  <div key={c.macroCategoryId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', background: 'var(--well)', borderRadius: 6, padding: '4px 10px', border: '1px solid var(--line)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    {c.name} · <span className="num" style={{ fontWeight: 700 }}>{formatBRL(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Coming soon message ── */}
        <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--well)', border: '1px solid var(--line)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            Análise por linguagem natural
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 16px' }}>
            O consultor envia o contexto financeiro do mês para um modelo de linguagem e responde suas perguntas em português. Requer configuração de um endpoint backend.
          </p>
          <div style={{ display: 'inline-flex', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', padding: '4px 11px', borderRadius: 5, color: 'var(--ink-2)', background: 'var(--well)', border: '1px solid var(--line)' }}>
            REQUER BACKEND — VER aiAdvisor.service.ts
          </div>
        </div>

        {/* ── Suggested prompts ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Perguntas sugeridas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={i}
                disabled
                style={{
                  textAlign: 'left', background: 'var(--paper)', border: '1px solid var(--line)',
                  borderRadius: 9, padding: '10px 14px', cursor: 'not-allowed', opacity: 0.6,
                  fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--ui)', lineHeight: 1.4,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── Navigate hint ── */}
        <div style={{ paddingBottom: 16, display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/lancamentos')}>
            Ver lançamentos
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/orcamento')}>
            Ver orçamento
          </button>
        </div>

      </div>
    </main>
  )
}

function CtxCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--paper)' }}>
      <span className="eyebrow" style={{ display: 'block', marginBottom: 5 }}>{label}</span>
      <p className="num" style={{ fontSize: 16, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}

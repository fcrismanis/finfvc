import { AlertTriangle, FlaskConical } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { ClarityFunnel } from '../components/dashboard/ClarityFunnel'
import { BudgetComparison } from '../components/dashboard/BudgetComparison'
import { AlertsPanel } from '../components/dashboard/AlertsPanel'
import { TopExpenses } from '../components/dashboard/TopExpenses'
import { formatBRL } from '../utils/currency'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

export function Dashboard({ selectedMonth, onNavigate }: Props) {
  const { summary, funnelSteps, budgetComparison, alerts, topExpenses, isDemo } = useDashboard(selectedMonth)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 max-w-[1280px] mx-auto w-full" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Demo banner */}
        {isDemo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
            <FlaskConical size={13} />
            <span>
              Usando dados demonstrativos —{' '}
              <button className="underline font-medium" onClick={() => onNavigate('/conectar')}>
                importe seu extrato
              </button>{' '}
              para ver dados reais.
            </span>
          </div>
        )}

        {/* Atypical / distortion banner */}
        {(summary.hasRedemption || summary.isAtypicalMonth) && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
            <span>
              {summary.isAtypicalMonth && <>Mês com receita atípica ({summary.atypicalReason}). </>}
              {summary.hasRedemption && <>Inclui {formatBRL(summary.redemptionAmount)} em resgates — não é receita operacional.</>}
            </span>
          </div>
        )}

        {/* KPI hero cards */}
        <SummaryCards data={summary} trendValues={[]} />

        {/* ── Funil da Clareza ── central element */}
        <ClarityFunnel income={summary.operationalIncome} steps={funnelSteps} />

        {/* ── Análise complementar ── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'var(--border-card)' }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#98A2B3' }}>
            Análise complementar
          </span>
          <div className="h-px flex-1" style={{ background: 'var(--border-card)' }} />
        </div>

        {/* Budget + alerts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <BudgetComparison data={budgetComparison} onNavigate={onNavigate} />
          <AlertsPanel alerts={alerts} onNavigate={onNavigate} />
        </div>

        {/* Top expenses — full width */}
        <TopExpenses data={topExpenses} />

      </div>
    </div>
  )
}

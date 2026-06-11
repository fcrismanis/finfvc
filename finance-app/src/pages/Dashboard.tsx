import { AlertTriangle, FlaskConical } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { ExpenseBreakdown } from '../components/dashboard/ExpenseBreakdown'
import { BudgetComparison } from '../components/dashboard/BudgetComparison'
import { AlertsPanel } from '../components/dashboard/AlertsPanel'
import { MonthlyTrendChart } from '../components/dashboard/MonthlyTrendChart'
import { TopExpenses } from '../components/dashboard/TopExpenses'
import { QuickActions } from '../components/dashboard/QuickActions'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'

interface Props {
  selectedMonth: string
  onNavigate: (route: string) => void
}

export function Dashboard({ selectedMonth, onNavigate }: Props) {
  const { summary, expenseBreakdown, budgetComparison, alerts, trend, topExpenses, isDemo } = useDashboard(selectedMonth)
  const { transactions } = useData()
  const totalTxns = transactions.length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 space-y-4 max-w-[1280px] mx-auto w-full">

        {/* Demo mode banner */}
        {isDemo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
            <FlaskConical size={13} />
            <span>Usando dados demonstrativos — <button className="underline font-medium" onClick={() => onNavigate('/conectar')}>importe seu extrato</button> para ver dados reais.</span>
          </div>
        )}

        {/* Distortion banner */}
        {(summary.hasRedemption || summary.isAtypicalMonth) && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
            <span>
              {summary.isAtypicalMonth && <>Mês com receita atípica ({summary.atypicalReason}). </>}
              {summary.hasRedemption && <>Inclui {formatBRL(summary.redemptionAmount)} em resgates — não é receita operacional.</>}
            </span>
          </div>
        )}

        {/* Summary cards */}
        <SummaryCards data={summary} />

        {/* Mid row: breakdown + budget */}
        <div className="grid grid-cols-2 gap-4">
          <ExpenseBreakdown data={expenseBreakdown} totalExpenses={summary.totalExpenses} />
          <BudgetComparison data={budgetComparison} />
        </div>

        {/* Alerts */}
        <AlertsPanel alerts={alerts} />

        {/* Trend chart */}
        <MonthlyTrendChart data={trend} />

        {/* Bottom row: top expenses + quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <TopExpenses data={topExpenses} />
          <QuickActions
            totalTransactions={totalTxns}
            monthIsClosed={false}
            pendingReviewCount={0}
            lastImportDate="10/06/2026"
            onNavigate={onNavigate}
          />
        </div>

      </div>
    </div>
  )
}

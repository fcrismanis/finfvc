import type { ImportSummaryData } from '../../importers/types'
import { formatBRL } from '../../utils/currency'

interface Props {
  summary: ImportSummaryData
  onNewImport: () => void
  onGoToDashboard: () => void
}

export function ImportSummary({ summary, onNewImport, onGoToDashboard }: Props) {
  const resultValue = summary.totalIncome - summary.totalExpenses
  const resultPositive = resultValue >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--pos-soft)', border: '1px solid var(--pos)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', letterSpacing: '-.01em' }}>
            {summary.total} lançamentos importados com sucesso
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, fontFamily: 'var(--mono)' }}>
            {summary.sourceFile}
          </p>
        </div>
      </div>

      {/* Breakdown cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <SummaryMiniCard label="Receitas" count={summary.incomeCount} amount={summary.totalIncome} color="var(--pos)" bg="var(--pos-soft)" />
        <SummaryMiniCard label="Despesas" count={summary.expenseCount} amount={summary.totalExpenses} color="var(--ink-2)" bg="var(--well)" />
        <SummaryMiniCard label="Neutros" count={summary.neutralCount} amount={null} color="var(--faint)" bg="var(--well)" />
      </div>

      {/* Notices */}
      {(summary.duplicateCount > 0 || summary.uncategorizedCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {summary.duplicateCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--warn)', background: 'var(--warn-soft)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--warn)' }}>
              {summary.duplicateCount} lançamentos ignorados por serem duplicados.
            </div>
          )}
          {summary.uncategorizedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--accent-soft)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--line)' }}>
              {summary.uncategorizedCount} lançamentos sem categoria — revise em Lançamentos.
            </div>
          )}
        </div>
      )}

      {/* Result snapshot */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Resultado operacional bruto desta importação</span>
        <p className="num" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', color: resultPositive ? 'var(--pos)' : 'var(--crit)' }}>
          {formatBRL(resultValue)}
        </p>
        <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5 }}>
          Receitas − Despesas (excluindo neutros e resgates)
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={onGoToDashboard}>Ver no Dashboard</button>
        <button className="btn btn-secondary" onClick={onNewImport}>Importar outro arquivo</button>
      </div>
    </div>
  )
}

function SummaryMiniCard({ label, count, amount, color, bg }: {
  label: string; count: number; amount: number | null; color: string; bg: string
}) {
  return (
    <div style={{ background: bg, border: '1px solid var(--line)', borderRadius: 9, padding: '10px 14px' }}>
      <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{label}</span>
      <p style={{ fontSize: 20, fontWeight: 800, color }}>{count}</p>
      {amount !== null && (
        <p className="num" style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{formatBRL(amount)}</p>
      )}
    </div>
  )
}

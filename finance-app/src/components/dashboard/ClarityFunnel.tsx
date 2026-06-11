import { TrendingUp, AlertTriangle } from 'lucide-react'
import type { FunnelStep } from '../../utils/funnelSteps'
import { formatBRL } from '../../utils/currency'

interface Props {
  income: number
  steps: FunnelStep[]
}

export function ClarityFunnel({ income, steps }: Props) {
  const stepsWithData = steps.filter(s => s.hasData)
  const finalBalance = stepsWithData.length > 0
    ? stepsWithData[stepsWithData.length - 1].runningBalance
    : income
  const isPositive = finalBalance >= 0
  const savingsRate = income > 0 ? (finalBalance / income) * 100 : 0

  return (
    <div className="card p-[22px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: '#101828' }}>Funil da Clareza</h3>
          <p className="text-[12px] mt-0.5" style={{ color: '#98A2B3' }}>
            Do dinheiro que entrou ao que realmente sobrou.
          </p>
        </div>
        {income > 0 && stepsWithData.length > 0 && (
          <div
            className="rounded-lg px-3 py-1.5 text-right flex-shrink-0"
            style={{ background: isPositive ? '#F0FDF4' : '#FEF2F2' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isPositive ? '#059669' : '#DC2626' }}>
              {isPositive ? 'Sobrou' : 'Faltou'}
            </p>
            <p className="text-[15px] font-extrabold num tracking-tight" style={{ color: isPositive ? 'var(--color-pos)' : 'var(--color-neg)' }}>
              {isPositive ? '' : '−'}{formatBRL(Math.abs(finalBalance))}
            </p>
          </div>
        )}
      </div>

      {income === 0 || stepsWithData.length === 0 ? (
        <EmptyFunnel />
      ) : (
        <div className="flex flex-col gap-1">
          {/* Income entry row */}
          <div className="rounded-xl px-4 py-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} style={{ color: 'var(--color-pos)', flexShrink: 0 }} />
                <span className="text-[13px] font-semibold" style={{ color: '#101828' }}>Entrada do mês</span>
              </div>
              <span className="text-[17px] font-extrabold num tracking-tight" style={{ color: 'var(--color-pos)' }}>
                {formatBRL(income)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#DCFCE7' }}>
              <div className="h-full w-full rounded-full" style={{ background: 'var(--color-pos)' }} />
            </div>
          </div>

          {/* Expense steps */}
          {stepsWithData.map((step) => {
            const alreadyConsumed = income - step.runningBalance - step.amount
            const prevPct = income > 0 ? Math.max(0, (alreadyConsumed / income) * 100) : 0
            const thisPct = Math.max(0, Math.min(step.percentage, 100 - prevPct))

            return (
              <div key={step.id}>
                {/* Connector */}
                <div className="flex justify-center py-0.5">
                  <div className="w-px h-3" style={{ background: '#E9EDF3' }} />
                </div>

                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: step.isCritical ? '#FEF2F2' : step.isAboveAverage ? '#FFFBEB' : '#F8FAFC',
                    border: `1px solid ${step.isCritical ? '#FECACA' : step.isAboveAverage ? '#FDE68A' : '#E9EDF3'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: step.color }}
                      />
                      <span className="text-[13px] font-semibold truncate" style={{ color: '#101828' }}>
                        {step.label}
                      </span>
                      {step.isAboveAverage && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: '#FDE68A', color: '#92400E' }}
                        >
                          ↑ acima da média
                        </span>
                      )}
                      {step.isCritical && (
                        <AlertTriangle size={11} style={{ color: '#DC2626', flexShrink: 0 }} />
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="text-[14px] font-bold num" style={{ color: '#101828' }}>
                        −{formatBRL(step.amount)}
                      </span>
                      <span className="ml-1.5 text-[11px] font-semibold" style={{ color: '#98A2B3' }}>
                        {step.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Stacked bar: gray (previous) + color (this step) + bg (remaining) */}
                  <div className="h-2 rounded-full overflow-hidden flex" style={{ background: '#E9EDF3' }}>
                    {prevPct > 0 && (
                      <div className="h-full flex-shrink-0" style={{ width: `${prevPct}%`, background: '#CBD5E1' }} />
                    )}
                    <div className="h-full flex-shrink-0" style={{ width: `${thisPct}%`, background: step.color }} />
                  </div>

                  <div className="mt-1.5 text-right">
                    <span className="text-[11px]" style={{ color: '#98A2B3' }}>
                      Saldo restante:{' '}
                      <span
                        className="font-semibold num"
                        style={{ color: step.runningBalance >= 0 ? '#374151' : 'var(--color-neg)' }}
                      >
                        {formatBRL(step.runningBalance)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Final balance row */}
          <div className="flex justify-center py-0.5">
            <div className="w-px h-3" style={{ background: '#E9EDF3' }} />
          </div>
          <div
            className="rounded-xl px-4 py-4 text-center"
            style={{
              background: isPositive ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${isPositive ? '#BBF7D0' : '#FECACA'}`,
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: isPositive ? '#059669' : '#DC2626' }}>
              Resultado final
            </p>
            <p
              className="text-[28px] font-extrabold num tracking-tight"
              style={{ color: isPositive ? 'var(--color-pos)' : 'var(--color-neg)' }}
            >
              {isPositive ? '' : '−'}{formatBRL(Math.abs(finalBalance))}
            </p>
            <p className="text-[12px] mt-1 font-medium" style={{ color: isPositive ? '#059669' : '#DC2626' }}>
              {Math.abs(savingsRate).toFixed(1)}% da receita {isPositive ? 'ficou no bolso' : 'estourou o orçamento'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyFunnel() {
  return (
    <div className="py-10 flex flex-col items-center gap-3">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--accent-soft)' }}
      >
        <TrendingUp size={24} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold" style={{ color: '#101828' }}>
          Nenhum dado para este mês
        </p>
        <p className="text-[12px] mt-1" style={{ color: '#98A2B3' }}>
          Importe seus lançamentos para ver o Funil da Clareza.
        </p>
      </div>
    </div>
  )
}

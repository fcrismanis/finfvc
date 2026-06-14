import type { FunnelStep } from '../../utils/funnelSteps'
import { formatBRL } from '../../utils/currency'

interface Props {
  income: number
  steps: FunnelStep[]
  isPartial?: boolean
  partialDay?: number
  partialTotal?: number
}

const ENTRY_GREEN = '#1E6F49'
const SALDO_GREEN = '#1E6F49'
const CRITICAL_RED = '#9C4339'
// Rampa monocromática Ledger Editorial — grupos de despesa em escala de tinta;
// clay reservado pra grupo crítico (isCritical)
const INK_RAMP = ['#1B1A16', '#3A382F', '#55503F', '#6F6A5C', '#8A8475', '#A39D8C', '#B3AC9A']

function stepColor(index: number, isCritical: boolean): string {
  return isCritical ? CRITICAL_RED : INK_RAMP[index % INK_RAMP.length]
}

function compactBRL(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) {
    const mil = abs / 1000
    const s = mil >= 10 ? mil.toFixed(0) : mil.toFixed(1).replace('.', ',')
    return `R$ ${s} mil`
  }
  return formatBRL(abs)
}

export function ClarityFunnel({ income, steps, isPartial, partialDay, partialTotal }: Props) {
  const stepsWithData = steps.filter(s => s.hasData)
  const finalBalance = stepsWithData.length > 0
    ? stepsWithData[stepsWithData.length - 1].runningBalance
    : income

  if (income === 0 || stepsWithData.length === 0) {
    return (
      <div className="card clarity-funnel p-[22px]">
        <FunnelHeader />
        <EmptyFunnel />
      </div>
    )
  }

  // Build column model: entry + steps + saldo
  type Col = { key: string; label: string; topLabel: string; color: string; top: number; height: number; isCritical?: boolean }
  const H = 300 // bar area px
  const scale = income > 0 ? H / income : 0

  const cols: Col[] = []
  cols.push({
    key: 'entry', label: 'Entrou', topLabel: `R$ ${(income / 1000).toFixed(income / 1000 >= 10 ? 0 : 1).replace('.', ',')} mil`,
    color: ENTRY_GREEN, top: 0, height: H,
  })

  stepsWithData.forEach((s, idx) => {
    const before = s.runningBalance + s.amount
    const top = (income - before) * scale
    const height = Math.max(s.amount * scale, 2)
    cols.push({
      key: s.id,
      label: s.label.split(' ')[0],
      topLabel: `− ${compactBRL(s.amount)}`,
      color: stepColor(idx, s.isCritical),
      top,
      height,
      isCritical: s.isCritical,
    })
  })

  const saldoTop = (income - finalBalance) * scale
  cols.push({
    key: 'saldo', label: 'Saldo', topLabel: compactBRL(finalBalance),
    color: SALDO_GREEN, top: Math.max(0, saldoTop), height: Math.max(finalBalance * scale, 2),
  })

  return (
    <div className="card clarity-funnel p-[22px]">
      <FunnelHeader />

      {isPartial && partialDay != null && partialTotal != null && (
        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 mb-4 text-[11.5px] font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          Mês em andamento · dia {partialDay} de {partialTotal} · leitura parcial
        </div>
      )}

      {/* ── Desktop: waterfall horizontal (≥900px) ── */}
      <div className="hidden min-[900px]:block">
        {/* Top value labels */}
        <div className="flex items-end gap-2" style={{ marginBottom: 6 }}>
          {cols.map(c => (
            <div
              key={c.key}
              className="flex-1 text-center text-[12.5px] font-bold num"
              style={{ color: c.key === 'entry' || c.key === 'saldo' ? ENTRY_GREEN : c.isCritical ? CRITICAL_RED : '#3A382F' }}
            >
              {c.topLabel}
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-stretch" style={{ height: H, position: 'relative' }}>
          {cols.map((c, i) => {
            const next = cols[i + 1]
            const showConnector = next && c.key !== 'entry'
            return (
              <div key={c.key} className="flex-1" style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute', left: '9%', right: '9%',
                    top: c.top, height: c.height, background: c.color,
                    borderRadius: 10, transition: 'top 0.4s ease, height 0.4s ease',
                  }}
                />
                {showConnector && (
                  <div style={{ position: 'absolute', left: '86%', width: '28%', top: c.top + c.height, height: 1.5, background: '#E1DDD1' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom labels */}
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          {cols.map(c => (
            <div
              key={c.key}
              className="flex-1 text-center text-[12px] font-semibold"
              style={{ color: c.key === 'entry' || c.key === 'saldo' || c.label === 'Alimentação' ? '#1B1A16' : '#8A8578' }}
            >
              {c.label}
            </div>
          ))}
        </div>

        <p className="text-[12px] mt-5" style={{ color: '#8A8578' }}>
          A renda entra à esquerda e vai sendo consumida etapa a etapa até a sobra. Clique em um grupo para ver as categorias.
        </p>
      </div>

      {/* ── Mobile: fluxo vertical empilhado (<900px) ── */}
      <div className="min-[900px]:hidden flex flex-col gap-2">
        <FunnelRow label="Entrou" amount={income} color={ENTRY_GREEN} bold income />
        {stepsWithData.map((s, idx) => (
          <FunnelRow
            key={s.id}
            label={s.label}
            amount={-s.amount}
            color={stepColor(idx, s.isCritical)}
            running={s.runningBalance}
          />
        ))}
        <FunnelRow label="Saldo" amount={finalBalance} color={SALDO_GREEN} bold saldo />
      </div>
    </div>
  )
}

function FunnelRow({ label, amount, color, running, bold, income, saldo }: {
  label: string; amount: number; color: string; running?: number; bold?: boolean; income?: boolean; saldo?: boolean
}) {
  const bg = (income || saldo) ? '#E6EEE6' : '#EBE8DF'
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: bg }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className={`text-[13px] truncate ${bold ? 'font-bold' : 'font-semibold'}`} style={{ color: '#1B1A16' }}>{label}</span>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-[14px] font-bold num" style={{ color: amount < 0 ? '#57534A' : color }}>
          {amount < 0 ? '−' : ''}{formatBRL(Math.abs(amount))}
        </span>
        {running != null && (
          <span className="block text-[10.5px] num" style={{ color: '#8A8578' }}>saldo {formatBRL(running)}</span>
        )}
      </div>
    </div>
  )
}

function FunnelHeader() {
  return (
    <div className="mb-4">
      <h3 className="text-[15px] font-bold" style={{ color: '#1B1A16' }}>Funil da Clareza</h3>
      <p className="text-[12px] mt-0.5" style={{ color: '#8A8578' }}>
        entrada → saídas por grupo → sobra · clique para detalhar
      </p>
    </div>
  )
}

function EmptyFunnel() {
  return (
    <div className="py-10 flex flex-col items-center gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--well)', border: '1px dashed var(--line)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8578" strokeWidth={1.6} strokeLinecap="round">
          <line x1="5" y1="19" x2="5" y2="13" />
          <line x1="12" y1="19" x2="12" y2="8" />
          <line x1="19" y1="19" x2="19" y2="11" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-semibold" style={{ color: '#1B1A16' }}>Nenhum lançamento neste mês</p>
        <p className="text-[12px] mt-1" style={{ color: '#8A8578' }}>
          Importe seus lançamentos para ver o Funil da Clareza.
        </p>
      </div>
    </div>
  )
}

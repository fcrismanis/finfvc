import type { FunnelStep } from '../../utils/funnelSteps'
import { formatBRL } from '../../utils/currency'

interface Props {
  income: number
  steps: FunnelStep[]
  isPartial?: boolean
  partialDay?: number
  partialTotal?: number
  onStepClick?: (step: FunnelStep) => void
}

const ENTRY_GREEN  = '#1E6F49'
const SALDO_GREEN  = '#1E6F49'
const CRITICAL_CLAY = '#9C4339'

// Rampa monocromo near-black → sand (exato do design file)
const STEP_RAMP = ['#1B1A16', '#3a382f', '#6f6a5c', '#b3ac9a']

function stepColor(index: number, isCritical: boolean): string {
  return isCritical ? CRITICAL_CLAY : STEP_RAMP[index % STEP_RAMP.length]
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

export function ClarityFunnel({ income, steps, isPartial, partialDay, partialTotal, onStepClick }: Props) {
  const stepsWithData = steps.filter(s => s.hasData)
  const finalBalance = stepsWithData.length > 0
    ? stepsWithData[stepsWithData.length - 1].runningBalance
    : income

  if (income === 0 || stepsWithData.length === 0) {
    return (
      <div className="funnel-hero" style={{ padding: '22px' }}>
        <FunnelHeader />
        <div className="empty-state">
          <div className="empty-glyph" />
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Nenhum dado para este mês</h4>
          <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 240 }}>
            Importe seus lançamentos para ver o Funil da Clareza.
          </p>
        </div>
      </div>
    )
  }

  type Col = { key: string; label: string; topLabel: string; color: string; top: number; height: number; isCritical?: boolean; step?: FunnelStep }
  const H = 260
  const scale = income > 0 ? H / income : 0

  const cols: Col[] = []
  cols.push({
    key: 'entry',
    label: 'Entrou',
    topLabel: compactBRL(income),
    color: ENTRY_GREEN,
    top: 0,
    height: H,
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
      step: s,
    })
  })

  const saldoTop = (income - finalBalance) * scale
  cols.push({
    key: 'saldo',
    label: 'Saldo',
    topLabel: compactBRL(finalBalance),
    color: SALDO_GREEN,
    top: Math.max(0, saldoTop),
    height: Math.max(finalBalance * scale, 2),
  })

  return (
    <div className="funnel-hero" style={{ padding: '22px' }}>
      <FunnelHeader />

      {isPartial && partialDay != null && partialTotal != null && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: 5,
            background: 'var(--well)',
            color: 'var(--ink-2)',
            marginBottom: 14,
          }}
        >
          Mês em andamento · dia {partialDay} de {partialTotal} · leitura parcial
        </div>
      )}

      {/* ── Desktop: waterfall horizontal (≥900px) ── */}
      <div className="funnel-desktop" style={{ marginTop: 18 }}>
        {/* Rótulos de valor (topo) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          {cols.map(c => (
            <div
              key={c.key}
              className="num"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 12.5,
                fontWeight: 700,
                color: c.key === 'entry' || c.key === 'saldo'
                  ? ENTRY_GREEN
                  : c.isCritical
                  ? CRITICAL_CLAY
                  : '#3a382f',
              }}
            >
              {c.topLabel}
            </div>
          ))}
        </div>

        {/* Barras waterfall */}
        <div style={{ display: 'flex', height: H, position: 'relative' }}>
          {cols.map((c, i) => {
            const next = cols[i + 1]
            const showConnector = !!next && c.key !== 'entry'
            const clickable = !!c.step && !!onStepClick
            return (
              <div key={c.key} style={{ flex: 1, position: 'relative' }}>
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `Ver lançamentos de ${c.label}` : undefined}
                  onClick={clickable ? () => onStepClick!(c.step!) : undefined}
                  onKeyDown={clickable ? (e) => e.key === 'Enter' && onStepClick!(c.step!) : undefined}
                  style={{
                    position: 'absolute',
                    left: '11%',
                    right: '11%',
                    top: c.top,
                    height: c.height,
                    background: c.color,
                    borderRadius: 9,
                    transition: 'top .4s ease, height .4s ease, opacity .15s',
                    cursor: clickable ? 'pointer' : 'default',
                    outline: 'none',
                  }}
                  onMouseEnter={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' } : undefined}
                  onMouseLeave={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '1' } : undefined}
                />
                {showConnector && (
                  <div style={{
                    position: 'absolute',
                    left: '85%',
                    width: '30%',
                    top: c.top + c.height,
                    height: 1.5,
                    background: 'var(--line)',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Rótulos de categoria (base) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {cols.map(c => (
            <div
              key={c.key}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11.5,
                fontWeight: c.key === 'entry' || c.key === 'saldo' ? 700 : 600,
                color: c.isCritical ? 'var(--crit)' : c.key === 'entry' || c.key === 'saldo' ? 'var(--ink)' : 'var(--ink-2)',
              }}
            >
              {c.label}
              {c.isCritical && <span className="revisar">REVISAR</span>}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, marginTop: 18, color: 'var(--faint)' }}>
          A renda entra à esquerda e vai sendo consumida etapa a etapa até a sobra.
        </p>
      </div>

      {/* ── Mobile: lista vertical (<900px) ── */}
      <div className="funnel-mobile">
        <FunnelRow label="Entrou" amount={income} color={ENTRY_GREEN} income />
        {stepsWithData.map((s, idx) => (
          <FunnelRow
            key={s.id}
            label={s.label}
            amount={-s.amount}
            color={stepColor(idx, s.isCritical)}
            running={s.runningBalance}
            critical={s.isCritical}
            onClick={onStepClick ? () => onStepClick(s) : undefined}
          />
        ))}
        <FunnelRow label="Saldo" amount={finalBalance} color={SALDO_GREEN} saldo />
      </div>
    </div>
  )
}

function FunnelRow({ label, amount, color, running, income, saldo, critical, onClick }: {
  label: string; amount: number; color: string; running?: number;
  income?: boolean; saldo?: boolean; critical?: boolean; onClick?: () => void
}) {
  const bg = income ? 'var(--pos-soft)' : saldo ? 'var(--pos-soft)' : critical ? 'var(--crit-soft)' : 'var(--well)'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '11px 14px', borderRadius: 11, background: bg,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: income || saldo ? 700 : 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: amount < 0 ? (critical ? 'var(--crit)' : 'var(--ink-2)') : color }}>
          {amount < 0 ? '−' : ''}{formatBRL(Math.abs(amount))}
        </span>
        {running != null && (
          <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>
            saldo {formatBRL(running)}
          </span>
        )}
      </div>
    </div>
  )
}

function FunnelHeader() {
  return (
    <div style={{ marginBottom: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-.01em', color: 'var(--ink)' }}>Funil da Clareza</h3>
      <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
        entrada → saídas por grupo → sobra · clique para detalhar
      </p>
    </div>
  )
}

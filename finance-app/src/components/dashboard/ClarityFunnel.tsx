import { useState } from 'react'
import type { FunnelStep } from '../../utils/funnelSteps'
import { formatBRL } from '../../utils/currency'

// ── Types ──────────────────────────────────────────────────────────────────
type FunnelVariant = 'horizontal-lane' | 'stacked-bar' | 'executive-strip'
const FUNNEL_VARIANT_KEY = 'fin_clarity_funnel_variant'

// ── Palette ────────────────────────────────────────────────────────────────
const ENTRY_GREEN   = '#1E6F49'
const CRITICAL_CLAY = '#9C4339'
const STEP_RAMP     = ['#1B1A16', '#3a382f', '#6f6a5c', '#57534A', '#8a7d68', '#b3ac9a']

const SEG_COLORS: Record<string, string> = {
  fixed:         '#1B1A16',
  food:          '#8C6716',
  transport:     '#57534A',
  health_edu:    '#6f6a5c',
  subscriptions: '#8a7d68',
  shopping:      CRITICAL_CLAY,
  debt:          '#7A1D1D',
  saldo:         ENTRY_GREEN,
}

const SHORT_LABELS: Record<string, string> = {
  fixed:         'Fixos',
  food:          'Alimentação',
  transport:     'Transporte',
  health_edu:    'Saúde',
  subscriptions: 'Assinaturas',
  shopping:      'Compras',
  debt:          'Dívidas',
}

const EXEC_GROUPS = [
  { id: 'fixed',     label: 'Fixos',     microcopy: 'essencial',       stepIds: ['fixed'],                                           color: '#1B1A16' },
  { id: 'variaveis', label: 'Variáveis', microcopy: 'modo de vida',    stepIds: ['food', 'transport', 'health_edu', 'subscriptions'], color: '#8C6716' },
  { id: 'compras',   label: 'Compras',   microcopy: 'lazer & consumo', stepIds: ['shopping'],                                        color: CRITICAL_CLAY },
  { id: 'dividas',   label: 'Dívidas',   microcopy: 'revisar urgente', stepIds: ['debt'],                                            color: '#7A1D1D' },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) {
    const mil = abs / 1000
    const s = mil >= 10 ? mil.toFixed(0) : mil.toFixed(1).replace('.', ',')
    return `R$ ${s} mil`
  }
  return formatBRL(abs)
}

function fmtPct(amount: number, income: number): string {
  if (income === 0) return '0%'
  return `${Math.round((amount / income) * 100)}%`
}

function stepColor(index: number, isCritical: boolean): string {
  return isCritical ? CRITICAL_CLAY : STEP_RAMP[index % STEP_RAMP.length]
}

function makeSyntheticStep(id: string, label: string, matched: FunnelStep[], color: string, income: number): FunnelStep {
  const amount = matched.reduce((acc, s) => acc + s.amount, 0)
  return {
    id,
    label,
    color,
    macroIds: matched.flatMap(s => s.macroIds),
    amount,
    percentage: income > 0 ? (amount / income) * 100 : 0,
    runningBalance: 0,
    isAboveAverage: matched.some(s => s.isAboveAverage),
    isCritical: matched.some(s => s.isCritical),
    hasData: amount > 0,
  }
}

// ── Main component ──────────────────────────────────────────────────────────
interface Props {
  income: number
  steps: FunnelStep[]
  isPartial?: boolean
  partialDay?: number
  partialTotal?: number
  onStepClick?: (step: FunnelStep) => void
}

export function ClarityFunnel({ income, steps, isPartial, partialDay, partialTotal, onStepClick }: Props) {
  const [variant, setVariant] = useState<FunnelVariant>(() => {
    const v = localStorage.getItem(FUNNEL_VARIANT_KEY)
    return (v as FunnelVariant) || 'horizontal-lane'
  })

  const stepsWithData = steps.filter(s => s.hasData)
  const finalBalance = stepsWithData.length > 0
    ? stepsWithData[stepsWithData.length - 1].runningBalance
    : income

  function selectVariant(v: FunnelVariant) {
    setVariant(v)
    localStorage.setItem(FUNNEL_VARIANT_KEY, v)
  }

  function drilldown(step: FunnelStep) {
    onStepClick?.(step)
  }

  const partialBadge = isPartial && partialDay != null && partialTotal != null ? (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600,
      padding: '3px 9px', borderRadius: 5,
      background: 'var(--well)', color: 'var(--ink-2)', marginBottom: 14,
    }}>
      Mês em andamento · dia {partialDay} de {partialTotal} · leitura parcial
    </div>
  ) : null

  if (income === 0 || stepsWithData.length === 0) {
    return (
      <div className="funnel-hero" style={{ padding: '22px' }}>
        <FunnelHeader variant={variant} onVariantChange={selectVariant} />
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

  return (
    <div className="funnel-hero" style={{ padding: '22px' }}>
      <FunnelHeader variant={variant} onVariantChange={selectVariant} />
      {partialBadge}
      {variant === 'horizontal-lane' && (
        <HorizontalLane stepsWithData={stepsWithData} income={income} finalBalance={finalBalance} onDrilldown={drilldown} />
      )}
      {variant === 'stacked-bar' && (
        <StackedBar stepsWithData={stepsWithData} income={income} finalBalance={finalBalance} onDrilldown={drilldown} />
      )}
      {variant === 'executive-strip' && (
        <ExecutiveStrip stepsWithData={stepsWithData} income={income} finalBalance={finalBalance} onDrilldown={drilldown} />
      )}
    </div>
  )
}

// ── Selector header ─────────────────────────────────────────────────────────
const VARIANT_LABELS: { id: FunnelVariant; label: string }[] = [
  { id: 'horizontal-lane',  label: 'Esteira' },
  { id: 'stacked-bar',      label: 'Composição' },
  { id: 'executive-strip',  label: 'Executivo' },
]

function FunnelHeader({ variant, onVariantChange }: {
  variant: FunnelVariant
  onVariantChange: (v: FunnelVariant) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-.01em', color: 'var(--ink)' }}>Funil da Clareza</h3>
        <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>
          entrada → saídas por grupo → sobra · clique para detalhar
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {VARIANT_LABELS.map(v => (
          <button
            key={v.id}
            onClick={() => onVariantChange(v.id)}
            className={`filter-pill${variant === v.id ? ' active' : ''}`}
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Variante 1: Esteira (horizontal-lane) ───────────────────────────────────
function HorizontalLane({ stepsWithData, income, finalBalance, onDrilldown }: {
  stepsWithData: FunnelStep[]
  income: number
  finalBalance: number
  onDrilldown: (s: FunnelStep) => void
}) {
  type LaneCard = {
    key: string
    label: string
    value: number
    color: string
    step?: FunnelStep
    isEntry?: boolean
    isSaldo?: boolean
    isCritical?: boolean
    isAboveAverage?: boolean
  }

  const cards: LaneCard[] = [
    { key: 'entry', label: 'Entrou', value: income, color: ENTRY_GREEN, isEntry: true },
    ...stepsWithData.map((s, idx) => ({
      key: s.id,
      label: SHORT_LABELS[s.id] ?? s.label.split(' ')[0],
      value: s.amount,
      color: stepColor(idx, s.isCritical),
      step: s,
      isCritical: s.isCritical,
      isAboveAverage: s.isAboveAverage,
    })),
    { key: 'saldo', label: 'Sobrou', value: finalBalance, color: finalBalance >= 0 ? ENTRY_GREEN : CRITICAL_CLAY, isSaldo: true },
  ]

  function LaneCardEl({ c, hasNext }: { c: LaneCard; hasNext: boolean }) {
    const clickable = !!c.step
    const bg = c.isEntry || c.isSaldo
      ? 'var(--pos-soft)'
      : c.isCritical ? 'var(--crit-soft)'
      : c.isAboveAverage ? 'var(--warn-soft)'
      : 'var(--well)'
    const borderColor = c.isEntry || c.isSaldo
      ? 'rgba(30,111,73,.28)'
      : c.isCritical ? 'rgba(156,67,57,.28)'
      : 'var(--line)'
    const valColor = c.isEntry || c.isSaldo
      ? (finalBalance < 0 && c.isSaldo ? CRITICAL_CLAY : ENTRY_GREEN)
      : c.isCritical ? 'var(--crit)'
      : 'var(--ink)'

    return (
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <div
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          aria-label={clickable ? `Ver lançamentos de ${c.label}` : undefined}
          onClick={clickable ? () => onDrilldown(c.step!) : undefined}
          onKeyDown={clickable ? (e) => e.key === 'Enter' && onDrilldown(c.step!) : undefined}
          style={{
            flex: 1, minWidth: 0,
            background: bg,
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            padding: '11px 12px',
            cursor: clickable ? 'pointer' : 'default',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '0.75' } : undefined}
          onMouseLeave={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '1' } : undefined}
        >
          <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--faint)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.label}
          </div>
          <div className="num" style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-.02em', color: valColor, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fmtMoney(c.value)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
            {fmtPct(Math.abs(c.value), income)}
            {c.isCritical && <span style={{ marginLeft: 5, color: 'var(--crit)', fontWeight: 700 }}>crítico</span>}
            {c.isAboveAverage && !c.isCritical && <span style={{ marginLeft: 5, color: 'var(--warn)', fontWeight: 600 }}>acima</span>}
          </div>
        </div>
        {hasNext && (
          <div style={{ padding: '0 5px', color: 'var(--faint)', fontSize: 13, flexShrink: 0, userSelect: 'none', lineHeight: 1 }}>›</div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop: flex fill */}
      <div className="funnel-lane-desktop">
        {cards.map((c, i) => (
          <LaneCardEl key={c.key} c={c} hasNext={i < cards.length - 1} />
        ))}
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="funnel-lane-mobile">
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          {cards.map((c, i) => {
            const clickable = !!c.step
            const bg = c.isEntry || c.isSaldo ? 'var(--pos-soft)' : c.isCritical ? 'var(--crit-soft)' : c.isAboveAverage ? 'var(--warn-soft)' : 'var(--well)'
            const valColor = c.isEntry || c.isSaldo ? (finalBalance < 0 && c.isSaldo ? CRITICAL_CLAY : ENTRY_GREEN) : c.isCritical ? 'var(--crit)' : 'var(--ink)'
            return (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onDrilldown(c.step!) : undefined}
                  style={{ width: 106, background: bg, border: '1px solid var(--line)', borderRadius: 8, padding: '11px 12px', cursor: clickable ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--faint)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.label}
                  </div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 800, color: valColor, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmtMoney(c.value)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--faint)' }}>{fmtPct(Math.abs(c.value), income)}</div>
                </div>
                {i < cards.length - 1 && (
                  <div style={{ padding: '0 4px', color: 'var(--faint)', fontSize: 12, flexShrink: 0 }}>›</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p style={{ fontSize: 11.5, marginTop: 13, color: 'var(--faint)' }}>
        Cada etapa mostra o consumo acumulado · clique para ver lançamentos
      </p>
    </>
  )
}

// ── Variante 2: Composição (stacked-bar) ────────────────────────────────────
function StackedBar({ stepsWithData, income, finalBalance, onDrilldown }: {
  stepsWithData: FunnelStep[]
  income: number
  finalBalance: number
  onDrilldown: (s: FunnelStep) => void
}) {
  const totalExpenses = income - finalBalance
  const margin = income > 0 ? Math.round((finalBalance / income) * 100) : 0

  type Seg = { key: string; label: string; amount: number; color: string; step?: FunnelStep }
  const segments: Seg[] = [
    ...stepsWithData.map(s => ({
      key: s.id,
      label: s.label,
      amount: s.amount,
      color: SEG_COLORS[s.id] ?? '#57534A',
      step: s,
    })),
    { key: 'saldo', label: 'Sobra', amount: Math.max(finalBalance, 0), color: ENTRY_GREEN },
  ].filter(s => s.amount > 0)

  const marginColor = margin >= 20 ? ENTRY_GREEN : margin >= 10 ? 'var(--warn)' : 'var(--crit)'

  return (
    <div style={{ marginTop: 4 }}>
      {/* KPIs topo */}
      <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 14 }}>
        {[
          { label: 'Entrou',  display: fmtMoney(income),        color: ENTRY_GREEN },
          { label: 'Saiu',    display: fmtMoney(totalExpenses),  color: 'var(--ink)' },
          { label: 'Sobra',   display: fmtMoney(Math.abs(finalBalance)), color: finalBalance >= 0 ? ENTRY_GREEN : 'var(--crit)' },
          { label: 'Margem',  display: `${margin}%`,             color: marginColor },
        ].map((k, i) => (
          <div key={k.label} style={{
            flex: 1, padding: '10px 13px',
            borderLeft: i > 0 ? '1px solid var(--line)' : 'none',
            background: 'var(--card-bg)',
          }}>
            <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--faint)', marginBottom: 4 }}>
              {k.label}
            </div>
            <div className="num" style={{ fontSize: 14, fontWeight: 800, color: k.color }}>
              {k.display}
            </div>
          </div>
        ))}
      </div>

      {/* Barra empilhada */}
      <div style={{ height: 30, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
        {segments.map(s => {
          const w = income > 0 ? (s.amount / income) * 100 : 0
          const clickable = !!s.step
          return (
            <div
              key={s.key}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              title={`${s.label}: ${fmtMoney(s.amount)} (${Math.round(w)}%)`}
              onClick={clickable ? () => onDrilldown(s.step!) : undefined}
              onKeyDown={clickable ? e => e.key === 'Enter' && onDrilldown(s.step!) : undefined}
              style={{
                width: `${w}%`, flexShrink: 0,
                background: s.color,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'opacity 0.12s',
              }}
              onMouseEnter={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '0.72' } : undefined}
              onMouseLeave={clickable ? e => { (e.currentTarget as HTMLElement).style.opacity = '1' } : undefined}
            />
          )
        })}
      </div>

      {/* Legenda clicável */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
        {segments.map(s => {
          const clickable = !!s.step
          return (
            <button
              key={s.key}
              onClick={clickable ? () => onDrilldown(s.step!) : undefined}
              disabled={!clickable}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none',
                cursor: clickable ? 'pointer' : 'default',
                padding: '2px 0', fontFamily: 'var(--ui)',
                opacity: clickable ? 1 : 0.7,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{s.label}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>{fmtMoney(s.amount)}</span>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>{fmtPct(s.amount, income)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Variante 3: Executivo (executive-strip) ─────────────────────────────────
function ExecutiveStrip({ stepsWithData, income, finalBalance, onDrilldown }: {
  stepsWithData: FunnelStep[]
  income: number
  finalBalance: number
  onDrilldown: (s: FunnelStep) => void
}) {
  const totalExpenses = income - finalBalance
  const stepsById = new Map(stepsWithData.map(s => [s.id, s]))

  type ExecChip = {
    id: string
    label: string
    microcopy: string
    amount: number
    color: string
    isCritical: boolean
    isAboveAverage: boolean
    macroIds: string[]
    hasData: boolean
  }

  const chips: ExecChip[] = EXEC_GROUPS.map(g => {
    const matched = (g.stepIds as readonly string[]).map(id => stepsById.get(id)).filter(Boolean) as FunnelStep[]
    const synth = makeSyntheticStep(g.id, g.label, matched, g.color, income)
    return {
      id: g.id,
      label: g.label,
      microcopy: g.microcopy,
      amount: synth.amount,
      color: g.color,
      isCritical: synth.isCritical,
      isAboveAverage: synth.isAboveAverage,
      macroIds: synth.macroIds,
      hasData: synth.hasData,
    }
  }).filter(c => c.hasData)

  function handleChipClick(c: ExecChip) {
    if (c.macroIds.length === 0) return
    onDrilldown({
      id: c.id, label: c.label, color: c.color,
      macroIds: c.macroIds, amount: c.amount,
      percentage: income > 0 ? (c.amount / income) * 100 : 0,
      runningBalance: 0,
      isAboveAverage: c.isAboveAverage,
      isCritical: c.isCritical,
      hasData: true,
    })
  }

  return (
    <div style={{ marginTop: 4 }}>
      {/* Frase-resumo */}
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: 18, maxWidth: 560 }}>
        De{' '}
        <strong style={{ color: ENTRY_GREEN, fontWeight: 750 }}>{formatBRL(income)}</strong>
        {' '}que entrou,{' '}
        <strong style={{ color: 'var(--ink)', fontWeight: 750 }}>{formatBRL(totalExpenses)}</strong>
        {' '}foi consumido e{' '}
        <strong style={{ color: finalBalance >= 0 ? ENTRY_GREEN : 'var(--crit)', fontWeight: 750 }}>
          {formatBRL(Math.abs(finalBalance))}
        </strong>
        {finalBalance >= 0 ? ' sobrou.' : ' ficou negativo.'}
      </p>

      {/* Chips */}
      <div className="funnel-exec-grid">
        {chips.map(c => {
          const bg = c.isCritical ? 'var(--crit-soft)' : c.isAboveAverage ? 'var(--warn-soft)' : 'var(--well)'
          const borderColor = c.isCritical ? 'rgba(156,67,57,.35)' : c.isAboveAverage ? 'rgba(140,103,22,.3)' : 'var(--line)'
          const valColor = c.isCritical ? 'var(--crit)' : c.isAboveAverage ? 'var(--warn)' : 'var(--ink)'
          const noteColor = c.isCritical ? 'var(--crit)' : c.isAboveAverage ? 'var(--warn)' : 'var(--faint)'
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Ver lançamentos de ${c.label}`}
              onClick={() => handleChipClick(c)}
              onKeyDown={e => e.key === 'Enter' && handleChipClick(c)}
              style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 9, padding: '13px 14px', cursor: 'pointer', transition: 'opacity 0.12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--faint)', marginBottom: 6 }}>
                {c.label}
              </div>
              <div className="num" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', color: valColor, marginBottom: 3 }}>
                {fmtMoney(c.amount)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>
                {fmtPct(c.amount, income)} das entradas
              </div>
              <div style={{ fontSize: 10.5, color: noteColor, fontStyle: 'italic' }}>
                {c.microcopy}
              </div>
            </div>
          )
        })}

        {/* Sobra */}
        <div style={{
          background: finalBalance >= 0 ? 'var(--pos-soft)' : 'var(--crit-soft)',
          border: `1px solid ${finalBalance >= 0 ? 'rgba(30,111,73,.28)' : 'rgba(156,67,57,.35)'}`,
          borderRadius: 9, padding: '13px 14px',
        }}>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--faint)', marginBottom: 6 }}>
            Sobrou
          </div>
          <div className="num" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', color: finalBalance >= 0 ? ENTRY_GREEN : 'var(--crit)', marginBottom: 3 }}>
            {fmtMoney(Math.abs(finalBalance))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 3 }}>
            {fmtPct(Math.abs(finalBalance), income)} das entradas
          </div>
          <div style={{ fontSize: 10.5, color: finalBalance >= 0 ? ENTRY_GREEN : 'var(--crit)', fontStyle: 'italic' }}>
            {finalBalance >= income * 0.2 ? 'margem saudável' : finalBalance > 0 ? 'atenção à margem' : 'resultado negativo'}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { Settings2, RotateCcw, Check } from 'lucide-react'
import {
  loadEngineConfig,
  updateEngineConfig,
  resetEngineConfig,
  invalidateEngineCache,
  DEFAULT_ENGINE_CONFIG,
  type ClassificationRule,
  type EngineConfig,
} from '../services/financeEngine.service'

const FLAG_COLUMNS: { key: keyof ClassificationRule; label: string; short: string }[] = [
  { key: 'includeInOperationalResult', label: 'Resultado Operacional', short: 'Resultado' },
  { key: 'includeInCashflow',          label: 'Fluxo de Caixa',        short: 'Caixa' },
  { key: 'includeInBudget',            label: 'Orçamento',             short: 'Orçam.' },
  { key: 'includeInPatrimony',         label: 'Patrimônio',            short: 'Patrim.' },
  { key: 'includeInDashboard',         label: 'Dashboard',             short: 'Dash' },
  { key: 'includeInAI',               label: 'IA / Hermes',            short: 'IA' },
  { key: 'includeInIndicators',        label: 'Indicadores',           short: 'Indic.' },
  { key: 'includeInReports',           label: 'Relatórios',            short: 'Relat.' },
  { key: 'hideInDashboard',            label: 'Ocultar no Dashboard',  short: 'Ocultar' },
]

function Toggle({ value, onChange, inverted = false }: { value: boolean; onChange: (v: boolean) => void; inverted?: boolean }) {
  const active = inverted ? !value : value
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: active ? 'var(--accent)' : 'var(--well)',
        position: 'relative', transition: 'background .15s', flexShrink: 0,
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: active ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: active ? '#fff' : 'var(--faint)',
        transition: 'left .15s',
      }} />
    </button>
  )
}

export function FinanceEnginePage() {
  const [config, setConfig] = useState<EngineConfig>(() => loadEngineConfig())
  const [saved, setSaved] = useState(false)

  const updateRule = useCallback((classificationType: string, key: keyof ClassificationRule, value: boolean) => {
    setConfig(prev => {
      const next: EngineConfig = {
        ...prev,
        classifications: prev.classifications.map(r =>
          r.classificationType === classificationType ? { ...r, [key]: value } : r,
        ),
      }
      updateEngineConfig(next)
      invalidateEngineCache()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      return next
    })
  }, [])

  function handleReset() {
    resetEngineConfig()
    invalidateEngineCache()
    setConfig(DEFAULT_ENGINE_CONFIG)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const ROW_COLORS: Record<string, string> = {
    operational_income: 'var(--pos)',
    extraordinary_income: '#65A30D',
    operational_expense: 'var(--neg)',
    debt_cost: '#991B1B',
    investment: '#0891B2',
    redemption: '#0D9488',
    transfer: 'var(--faint)',
    reimbursement: '#8B5CF6',
    neutral: '#9CA3AF',
    adjustment: '#6B7280',
  }

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings2 size={22} style={{ color: 'var(--accent)' }} />
              Engine Financeira
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 4 }}>
              Fonte única de verdade para todas as regras financeiras. Alterações refletem imediatamente em Dashboard, Relatórios e IA.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--pos)', fontWeight: 600 }}>
                <Check size={13} /> Salvo
              </span>
            )}
            <button
              onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--well)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--faint)', fontFamily: 'var(--ui)' }}
            >
              <RotateCcw size={13} />
              Restaurar padrões
            </button>
          </div>
        </div>

        {/* Hierarquia info */}
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
          <strong>Hierarquia de regras:</strong> Subcategoria &gt; Categoria &gt; Classificação &gt; Padrão do sistema<br />
          <span style={{ color: 'var(--faint)' }}>Transações com override manual do usuário respeitam a classificação salva individualmente.</span>
        </div>

        {/* Tabela principal */}
        <div className="card" style={{ overflow: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)', minWidth: 180 }}>
                  Classificação
                </th>
                {FLAG_COLUMNS.map(col => (
                  <th key={col.key} title={col.label} style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', minWidth: 70 }}>
                    {col.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.classifications.map((rule, i) => (
                <tr key={rule.classificationType} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'var(--well)' }}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROW_COLORS[rule.classificationType] ?? 'var(--faint)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 12.5 }}>{rule.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{rule.classificationType}</div>
                      </div>
                    </div>
                  </td>
                  {FLAG_COLUMNS.map(col => (
                    <td key={col.key} style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Toggle
                          value={rule[col.key] as boolean}
                          inverted={col.key === 'hideInDashboard'}
                          onChange={v => updateRule(rule.classificationType, col.key, v)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {FLAG_COLUMNS.map(col => (
            <div key={col.key} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{col.short}</div>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{col.label}</div>
            </div>
          ))}
        </div>

        {/* Info próximas fases */}
        <div style={{ padding: '12px 16px', borderRadius: 10, border: '1px dashed var(--line)', fontSize: 12, color: 'var(--faint)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--ink-2)' }}>Próximas fases:</strong> Override por Categoria e por Subcategoria — permitirá que, ex., "Venda de Ações" tenha regras diferentes de "Investimentos" mesmo sendo mesma classificação.
        </div>
      </div>
    </main>
  )
}

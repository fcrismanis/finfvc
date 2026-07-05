import { useState, useCallback, useEffect } from 'react'
import { Settings2, RotateCcw, Check, Clock, Database } from 'lucide-react'
import {
  loadEngineConfigAsync, loadEngineConfigSync, updateEngineConfig, resetEngineConfig,
  invalidateEngineCache, buildDefaultConfig, patchScopeRule, loadAuditLog,
  DEFAULT_FLAGS,
  type EngineConfig, type ScopeOverride, type FlagName, type AuditEntry,
} from '../services/financeEngine.service'
import { useAuth } from '../context/AuthContext'
import { getAllCategories } from '../services/financeCategories.service'
import { loadSubCategories } from '../services/subcategory.service'
import type { Category, SubCategory } from '../types'
import { getAllMacroCategories } from '../services/financeParentCategories.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLAG_COLS_ALL: { key: FlagName; short: string; label: string; essential?: boolean }[] = [
  { key: 'includeInOperationalResult', short: 'Resultado', label: 'Resultado Operacional', essential: true },
  { key: 'includeInCashflow',          short: 'Caixa',     label: 'Fluxo de Caixa', essential: true },
  { key: 'includeInBudget',            short: 'Orçam.',    label: 'Orçamento', essential: true },
  { key: 'includeInPatrimony',         short: 'Patrim.',   label: 'Patrimônio' },
  { key: 'includeInDashboard',         short: 'Dash',      label: 'Dashboard' },
  { key: 'includeInAI',               short: 'IA',         label: 'IA / Consultor' },
  { key: 'includeInReports',           short: 'Relat.',    label: 'Relatórios' },
  { key: 'hideInDashboard',            short: 'Ocultar',   label: 'Ocultar no Dashboard' },
]
const FLAG_COLS_ESSENTIAL = FLAG_COLS_ALL.filter(c => c.essential)

const CLASS_COLORS: Record<string, string> = {
  operational_income: '#16A34A', extraordinary_income: '#65A30D',
  operational_expense: '#EF4444', debt_cost: '#991B1B',
  investment: '#0891B2', redemption: '#0D9488',
  transfer: '#9CA3AF', reimbursement: '#8B5CF6',
  neutral: '#D1D5DB', adjustment: '#6B7280',
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: value ? 'var(--accent)' : 'var(--well)', position: 'relative', transition: 'background .12s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: value ? '#fff' : 'var(--faint)', transition: 'left .12s' }} />
    </button>
  )
}

// ── Aba Classificações ────────────────────────────────────────────────────────

function TabClassifications({ config, onUpdate, flagCols }: { config: EngineConfig; onUpdate: (c: EngineConfig) => void; flagCols: typeof FLAG_COLS_ALL }) {
  function toggle(classificationType: string, flag: FlagName, newVal: boolean) {
    const old = config.classifications.find(c => c.classificationType === classificationType)
    const oldVal = old?.[flag]
    const next: EngineConfig = {
      ...config,
      classifications: config.classifications.map(r =>
        r.classificationType === classificationType ? { ...r, [flag]: newVal } : r,
      ),
    }
    onUpdate(next)
    patchScopeRule('classification', classificationType, old?.label ?? classificationType, { [flag]: newVal } as Partial<ScopeOverride>, flag, oldVal).catch(() => {})
  }

  return (
    <div className="card" style={{ overflow: 'auto', padding: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--faint)', minWidth: 200 }}>Classificação</th>
            {flagCols.map(c => (
              <th key={c.key} title={c.label} style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', minWidth: 68 }}>{c.short}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.classifications.map((rule, i) => (
            <tr key={rule.classificationType} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'var(--well)' }}>
              <td style={{ padding: '10px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: CLASS_COLORS[rule.classificationType] ?? '#9CA3AF', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 12.5 }}>{rule.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{rule.classificationType}</div>
                  </div>
                </div>
              </td>
              {flagCols.map(col => (
                <td key={col.key} style={{ textAlign: 'center', padding: '10px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Toggle value={rule[col.key] as boolean} onChange={v => toggle(rule.classificationType, col.key, v)} />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Aba Categorias ────────────────────────────────────────────────────────────

function TabCategories({ config, onUpdate, flagCols }: { config: EngineConfig; onUpdate: (c: EngineConfig) => void; flagCols: typeof FLAG_COLS_ALL }) {
  const macros = getAllMacroCategories()
  const categories = getAllCategories()

  function getScopeRule(catId: string): ScopeOverride {
    return config.scopes.category?.[catId] ?? { inherit: 'classification' }
  }

  function getEffectiveFlag(cat: Category, flag: FlagName): boolean {
    const rule = getScopeRule(cat.id)
    if (rule.inherit === 'custom' && flag in rule) return rule[flag] as boolean
    const classRule = config.classifications.find(c => c.classificationType === cat.classificationType)
    return classRule?.[flag] ?? DEFAULT_FLAGS[cat.classificationType as keyof typeof DEFAULT_FLAGS]?.[flag] ?? false
  }

  function setInherit(cat: Category, inherit: 'classification' | 'custom') {
    const current = getScopeRule(cat.id)
    const next: EngineConfig = {
      ...config,
      scopes: { ...config.scopes, category: { ...config.scopes.category, [cat.id]: { ...current, inherit } } },
    }
    onUpdate(next)
    patchScopeRule('category', cat.id, cat.name, { inherit }, 'inherit', current.inherit).catch(() => {})
  }

  function toggleFlag(cat: Category, flag: FlagName, val: boolean) {
    const current = getScopeRule(cat.id)
    const patch = { ...current, inherit: 'custom' as const, [flag]: val }
    const next: EngineConfig = {
      ...config,
      scopes: { ...config.scopes, category: { ...config.scopes.category, [cat.id]: patch } },
    }
    onUpdate(next)
    patchScopeRule('category', cat.id, cat.name, { inherit: 'custom', [flag]: val }, flag, current[flag]).catch(() => {})
  }

  const grouped = macros.map(m => ({ macro: m, cats: categories.filter(c => c.macroCategoryId === m.id) })).filter(g => g.cats.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)' }}>
        <strong style={{ color: 'var(--ink-2)' }}>Herda Classificação</strong> — usa as regras da classificação da categoria. &nbsp;
        <strong style={{ color: 'var(--ink-2)' }}>Personalizado</strong> — define regras próprias para esta categoria.
      </div>
      {grouped.map(({ macro, cats }) => (
        <div key={macro.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: macro.color + '18', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: macro.color }} />
            <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{macro.name}</span>
            <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{macro.classificationType}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)' }}>{cats.length} categorias</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '8px 16px', fontWeight: 600, fontSize: 10.5, color: 'var(--faint)', minWidth: 160 }}>Categoria</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 10.5, color: 'var(--faint)', width: 130 }}>Herança</th>
                {flagCols.map(c => (
                  <th key={c.key} title={c.label} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, fontSize: 10, color: 'var(--faint)', minWidth: 60 }}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((cat, i) => {
                const rule = getScopeRule(cat.id)
                const isCustom = rule.inherit === 'custom'
                return (
                  <tr key={cat.id} style={{ borderBottom: i < cats.length - 1 ? '1px solid var(--line)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--well)' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 600, color: 'var(--ink)' }}>{cat.name}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setInherit(cat, 'classification')} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: `1px solid ${!isCustom ? 'var(--accent)' : 'var(--line)'}`, background: !isCustom ? 'var(--accent-soft)' : 'transparent', color: !isCustom ? 'var(--accent)' : 'var(--faint)', cursor: 'pointer', fontFamily: 'var(--ui)', fontWeight: 600 }}>Herdar</button>
                        <button onClick={() => setInherit(cat, 'custom')} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: `1px solid ${isCustom ? 'var(--accent)' : 'var(--line)'}`, background: isCustom ? 'var(--accent-soft)' : 'transparent', color: isCustom ? 'var(--accent)' : 'var(--faint)', cursor: 'pointer', fontFamily: 'var(--ui)', fontWeight: 600 }}>Custom</button>
                      </div>
                    </td>
                    {flagCols.map(col => (
                      <td key={col.key} style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', opacity: !isCustom ? 0.4 : 1 }}>
                          <Toggle value={getEffectiveFlag(cat, col.key)} onChange={v => toggleFlag(cat, col.key, v)} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ── Aba Subcategorias ─────────────────────────────────────────────────────────

function TabSubcategories({ config, onUpdate, flagCols }: { config: EngineConfig; onUpdate: (c: EngineConfig) => void; flagCols: typeof FLAG_COLS_ALL }) {
  const [subcats, setSubcats] = useState<SubCategory[]>([])
  const categories = getAllCategories()

  useEffect(() => { setSubcats(loadSubCategories()) }, [])

  function getScopeRule(subId: string): ScopeOverride {
    return config.scopes.subcategory?.[subId] ?? { inherit: 'category' }
  }

  function getEffectiveFlag(sub: SubCategory, flag: FlagName): boolean {
    const subRule = getScopeRule(sub.id)
    if (subRule.inherit === 'custom' && flag in subRule) return subRule[flag] as boolean
    const cat = categories.find(c => c.id === sub.macroCategoryId)
    if (subRule.inherit === 'category' && cat) {
      const catRule = config.scopes.category?.[cat.id]
      if (catRule?.inherit === 'custom' && flag in catRule) return catRule[flag] as boolean
    }
    const classType = cat?.classificationType
    if (classType) {
      const classRule = config.classifications.find(c => c.classificationType === classType)
      if (classRule) return classRule[flag] as boolean
    }
    return false
  }

  function setInherit(sub: SubCategory, inherit: 'category' | 'classification' | 'custom') {
    const current = getScopeRule(sub.id)
    const next: EngineConfig = {
      ...config,
      scopes: { ...config.scopes, subcategory: { ...config.scopes.subcategory, [sub.id]: { ...current, inherit } } },
    }
    onUpdate(next)
    patchScopeRule('subcategory', sub.id, sub.name, { inherit }, 'inherit', current.inherit).catch(() => {})
  }

  function toggleFlag(sub: SubCategory, flag: FlagName, val: boolean) {
    const current = getScopeRule(sub.id)
    const patch = { ...current, inherit: 'custom' as const, [flag]: val }
    const next: EngineConfig = {
      ...config,
      scopes: { ...config.scopes, subcategory: { ...config.scopes.subcategory, [sub.id]: patch } },
    }
    onUpdate(next)
    patchScopeRule('subcategory', sub.id, sub.name, { inherit: 'custom', [flag]: val }, flag, current[flag]).catch(() => {})
  }

  const grouped = categories.map(cat => ({
    cat,
    subs: subcats.filter(s => s.macroCategoryId === cat.id),
  })).filter(g => g.subs.length > 0)

  if (subcats.length === 0) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--faint)' }}>
        Nenhuma subcategoria encontrada. Crie subcategorias em Categorias primeiro.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)' }}>
        <strong style={{ color: 'var(--ink-2)' }}>Herdar Categoria</strong> — usa regra da categoria pai. &nbsp;
        <strong style={{ color: 'var(--ink-2)' }}>Herdar Classificação</strong> — pula categoria, vai direto à classificação. &nbsp;
        <strong style={{ color: 'var(--ink-2)' }}>Personalizado</strong> — regra própria da subcategoria.
      </div>
      {grouped.map(({ cat, subs }) => (
        <div key={cat.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{cat.name}</span>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>{subs.length} subcategorias</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '8px 16px', fontWeight: 600, fontSize: 10.5, color: 'var(--faint)', minWidth: 160 }}>Subcategoria</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 10.5, color: 'var(--faint)', width: 200 }}>Herança</th>
                {flagCols.map(c => (
                  <th key={c.key} title={c.label} style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, fontSize: 10, color: 'var(--faint)', minWidth: 60 }}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((sub, i) => {
                const rule = getScopeRule(sub.id)
                const isCustom = rule.inherit === 'custom'
                return (
                  <tr key={sub.id} style={{ borderBottom: i < subs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--ink)' }}>{sub.name}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(['category', 'classification', 'custom'] as const).map(opt => (
                          <button key={opt} onClick={() => setInherit(sub, opt)} style={{ fontSize: 9.5, padding: '2px 5px', borderRadius: 4, border: `1px solid ${rule.inherit === opt ? 'var(--accent)' : 'var(--line)'}`, background: rule.inherit === opt ? 'var(--accent-soft)' : 'transparent', color: rule.inherit === opt ? 'var(--accent)' : 'var(--faint)', cursor: 'pointer', fontFamily: 'var(--ui)', fontWeight: 600 }}>
                            {opt === 'category' ? 'Categ.' : opt === 'classification' ? 'Class.' : 'Custom'}
                          </button>
                        ))}
                      </div>
                    </td>
                    {flagCols.map(col => (
                      <td key={col.key} style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', opacity: !isCustom ? 0.35 : 1 }}>
                          <Toggle value={getEffectiveFlag(sub, col.key)} onChange={v => toggleFlag(sub, col.key, v)} />
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ── Aba Auditoria ─────────────────────────────────────────────────────────────

function TabAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAuditLog().then(e => { setEntries(e); setLoading(false) })
  }, [])

  const SCOPE_COLOR: Record<string, string> = { classification: '#6B7280', category: '#0891B2', subcategory: '#8B5CF6' }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--faint)' }}>Carregando auditoria…</div>
  if (entries.length === 0) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--faint)' }}>
      <Clock size={24} style={{ opacity: .3, marginBottom: 8 }} />
      <div>Nenhuma alteração registrada ainda.</div>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            {['Data/Hora', 'Escopo', 'Identificador', 'Flag', 'Antes', 'Depois', 'Observação'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id ?? i} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'transparent' : 'var(--well)' }}>
              <td style={{ padding: '8px 14px', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                {new Date(e.changed_at).toLocaleString('pt-BR')}
              </td>
              <td style={{ padding: '8px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: (SCOPE_COLOR[e.scope] ?? '#9CA3AF') + '22', color: SCOPE_COLOR[e.scope] ?? '#9CA3AF' }}>
                  {e.scope}
                </span>
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--ink)', fontWeight: 600 }}>
                {e.scope_name ?? e.scope_id}
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>{e.flag ?? '—'}</td>
              <td style={{ padding: '8px 14px', color: String(e.old_value) === 'true' ? 'var(--pos)' : 'var(--neg)', fontWeight: 600 }}>
                {e.old_value !== undefined ? String(e.old_value) : '—'}
              </td>
              <td style={{ padding: '8px 14px', color: String(e.new_value) === 'true' ? 'var(--pos)' : 'var(--neg)', fontWeight: 600 }}>
                {e.new_value !== undefined ? String(e.new_value) : '—'}
              </td>
              <td style={{ padding: '8px 14px', color: 'var(--faint)', fontSize: 11 }}>{e.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'classifications' | 'categories' | 'subcategories' | 'audit'

export function FinanceEnginePage() {
  const { familyId } = useAuth()
  const [tab, setTab] = useState<Tab>('classifications')
  const [config, setConfig] = useState<EngineConfig>(() => loadEngineConfigSync())
  const [showAdvanced, setShowAdvanced] = useState(false)
  const flagCols = showAdvanced ? FLAG_COLS_ALL : FLAG_COLS_ESSENTIAL
  const [saved, setSaved] = useState(false)
  const [source, setSource] = useState<'supabase' | 'local' | 'loading'>('loading')

  // Carrega do Supabase ao montar
  useEffect(() => {
    if (!familyId) { setSource('local'); return }
    loadEngineConfigAsync(familyId).then(cfg => {
      setConfig(cfg)
      setSource('supabase')
    }).catch(() => setSource('local'))
  }, [familyId])

  const handleUpdate = useCallback((next: EngineConfig) => {
    updateEngineConfig(next)
    invalidateEngineCache()
    setConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [])

  async function handleReset() {
    await resetEngineConfig()
    invalidateEngineCache()
    setConfig(buildDefaultConfig())
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'classifications', label: 'Classificações' },
    { key: 'categories',      label: 'Categorias' },
    { key: 'subcategories',   label: 'Subcategorias' },
    { key: 'audit',           label: 'Auditoria' },
  ]

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 1140, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Settings2 size={22} style={{ color: 'var(--accent)' }} />
              Engine Financeira
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--faint)' }}>
              Define onde cada lançamento entra: Resultado, Caixa e Orçamento. Regras específicas
              herdam de cima (Subcategoria → Categoria → Classificação).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--well)', border: '1px solid var(--line)' }}>
              <Database size={12} style={{ color: source === 'supabase' ? 'var(--pos)' : source === 'loading' ? 'var(--warn)' : 'var(--faint)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)' }}>
                {source === 'supabase' ? 'Supabase' : source === 'loading' ? 'Carregando…' : 'Local (offline)'}
              </span>
            </div>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--pos)', fontWeight: 600 }}>
                <Check size={13} /> Salvo
              </span>
            )}
            <button onClick={() => void handleReset()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--well)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--faint)', fontFamily: 'var(--ui)' }}>
              <RotateCcw size={13} /> Restaurar padrões
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--well)', borderRadius: 10, padding: 4, border: '1px solid var(--line)' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', background: tab === t.key ? 'var(--card-bg)' : 'transparent', color: tab === t.key ? 'var(--ink)' : 'var(--faint)', boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none', transition: 'all .12s' }}>
                {t.label}
              </button>
            ))}
          </div>
          {tab !== 'audit' && (
            <button onClick={() => setShowAdvanced(v => !v)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: `1px solid ${showAdvanced ? 'var(--accent)' : 'var(--line)'}`, background: showAdvanced ? 'var(--accent-soft)' : 'var(--well)', color: showAdvanced ? 'var(--accent)' : 'var(--faint)', cursor: 'pointer', fontFamily: 'var(--ui)' }}>
              {showAdvanced ? 'Ocultar avançado' : `+ ${FLAG_COLS_ALL.length - FLAG_COLS_ESSENTIAL.length} escopos avançados`}
            </button>
          )}
        </div>

        {/* Content */}
        {tab === 'classifications' && <TabClassifications config={config} onUpdate={handleUpdate} flagCols={flagCols} />}
        {tab === 'categories'      && <TabCategories config={config} onUpdate={handleUpdate} flagCols={flagCols} />}
        {tab === 'subcategories'   && <TabSubcategories config={config} onUpdate={handleUpdate} flagCols={flagCols} />}
        {tab === 'audit'           && <TabAudit />}

      </div>
    </main>
  )
}

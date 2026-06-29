/**
 * Finance Engine — fonte única de verdade para regras financeiras.
 *
 * Hierarquia: Subcategoria > Categoria > Classificação > Default do sistema
 * Nenhum cálculo financeiro deve existir fora desta camada.
 */

import type { Transaction } from '../types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ClassificationType =
  | 'operational_income'
  | 'extraordinary_income'
  | 'operational_expense'
  | 'debt_cost'
  | 'investment'
  | 'redemption'
  | 'transfer'
  | 'reimbursement'
  | 'neutral'
  | 'adjustment'

export type EngineScope = 'classification' | 'category' | 'subcategory'

export interface EngineFlags {
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  includeInPatrimony: boolean
  includeInDashboard: boolean
  includeInAI: boolean
  includeInIndicators: boolean
  includeInReports: boolean
  hideInDashboard: boolean
  hideInCharts: boolean
  hideInAnalysis: boolean
}

export interface ClassificationRule extends EngineFlags {
  classificationType: ClassificationType
  label: string
  allowManualEdit: boolean
  allowCategoryOverride: boolean
  allowSubcategoryOverride: boolean
}

export interface ScopeOverride extends Partial<EngineFlags> {
  inherit: 'classification' | 'category' | 'custom'  // source of truth
  note?: string
  updatedAt?: string
}

export interface AuditEntry {
  id: string
  scope: EngineScope
  scope_id: string
  scope_name?: string
  flag?: string
  old_value?: unknown
  new_value?: unknown
  changed_at: string
  changed_by?: string
  note?: string
  origin: string
}

export interface EngineConfig {
  version: number
  updatedAt: string
  classifications: ClassificationRule[]
  scopes: {
    category?: Record<string, ScopeOverride>
    subcategory?: Record<string, ScopeOverride>
  }
}

// ── Configuração canônica padrão ──────────────────────────────────────────────

export const DEFAULT_FLAGS: Record<ClassificationType, EngineFlags> = {
  operational_income:   { includeInOperationalResult: true,  includeInCashflow: true,  includeInBudget: true,  includeInPatrimony: false, includeInDashboard: true,  includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: false, hideInCharts: false, hideInAnalysis: false },
  extraordinary_income: { includeInOperationalResult: true,  includeInCashflow: true,  includeInBudget: false, includeInPatrimony: false, includeInDashboard: true,  includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: false, hideInCharts: false, hideInAnalysis: false },
  operational_expense:  { includeInOperationalResult: true,  includeInCashflow: true,  includeInBudget: true,  includeInPatrimony: false, includeInDashboard: true,  includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: false, hideInCharts: false, hideInAnalysis: false },
  debt_cost:            { includeInOperationalResult: true,  includeInCashflow: true,  includeInBudget: true,  includeInPatrimony: true,  includeInDashboard: true,  includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: false, hideInCharts: false, hideInAnalysis: false },
  investment:           { includeInOperationalResult: false, includeInCashflow: true,  includeInBudget: false, includeInPatrimony: true,  includeInDashboard: false, includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: true,  hideInCharts: false, hideInAnalysis: false },
  redemption:           { includeInOperationalResult: false, includeInCashflow: true,  includeInBudget: false, includeInPatrimony: true,  includeInDashboard: false, includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: true,  hideInCharts: false, hideInAnalysis: false },
  transfer:             { includeInOperationalResult: false, includeInCashflow: false, includeInBudget: false, includeInPatrimony: false, includeInDashboard: false, includeInAI: false, includeInIndicators: false, includeInReports: false, hideInDashboard: true,  hideInCharts: true,  hideInAnalysis: true  },
  reimbursement:        { includeInOperationalResult: true,  includeInCashflow: true,  includeInBudget: false, includeInPatrimony: false, includeInDashboard: true,  includeInAI: true,  includeInIndicators: true,  includeInReports: true,  hideInDashboard: false, hideInCharts: false, hideInAnalysis: false },
  neutral:              { includeInOperationalResult: false, includeInCashflow: false, includeInBudget: false, includeInPatrimony: false, includeInDashboard: false, includeInAI: false, includeInIndicators: false, includeInReports: false, hideInDashboard: true,  hideInCharts: true,  hideInAnalysis: true  },
  adjustment:           { includeInOperationalResult: false, includeInCashflow: false, includeInBudget: false, includeInPatrimony: false, includeInDashboard: false, includeInAI: false, includeInIndicators: false, includeInReports: false, hideInDashboard: true,  hideInCharts: true,  hideInAnalysis: true  },
}

const CLASSIFICATION_META: Record<ClassificationType, { label: string; allowCategoryOverride: boolean; allowSubcategoryOverride: boolean }> = {
  operational_income:   { label: 'Receita Operacional',    allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  extraordinary_income: { label: 'Receita Extraordinária', allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  operational_expense:  { label: 'Despesa Operacional',    allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  debt_cost:            { label: 'Dívida / Passivo',       allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  investment:           { label: 'Investimento / Aporte',  allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  redemption:           { label: 'Resgate',                allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  transfer:             { label: 'Transferência Própria',  allowCategoryOverride: false, allowSubcategoryOverride: false },
  reimbursement:        { label: 'Reembolso',              allowCategoryOverride: true,  allowSubcategoryOverride: true  },
  neutral:              { label: 'Neutra',                  allowCategoryOverride: false, allowSubcategoryOverride: false },
  adjustment:           { label: 'Ajuste Contábil',         allowCategoryOverride: false, allowSubcategoryOverride: false },
}

export function buildDefaultConfig(): EngineConfig {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    scopes: { category: {}, subcategory: {} },
    classifications: (Object.keys(DEFAULT_FLAGS) as ClassificationType[]).map(ct => ({
      classificationType: ct,
      label: CLASSIFICATION_META[ct].label,
      allowManualEdit: true,
      allowCategoryOverride: CLASSIFICATION_META[ct].allowCategoryOverride,
      allowSubcategoryOverride: CLASSIFICATION_META[ct].allowSubcategoryOverride,
      ...DEFAULT_FLAGS[ct],
    })),
  }
}

export const DEFAULT_ENGINE_CONFIG = buildDefaultConfig()

// ── Cache em memória ──────────────────────────────────────────────────────────

let _cache: EngineConfig | null = null
const LOCAL_KEY = 'fin_engine_config'

// ── Persistência: localStorage + backend sync ─────────────────────────────────

export function loadEngineConfig(): EngineConfig {
  if (_cache) return _cache
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<EngineConfig>
      const def = buildDefaultConfig()
      _cache = {
        ...def,
        ...saved,
        scopes: {
          category: { ...(saved.scopes?.category ?? {}) },
          subcategory: { ...(saved.scopes?.subcategory ?? {}) },
        },
        classifications: def.classifications.map(d => {
          const override = saved.classifications?.find(c => c.classificationType === d.classificationType)
          return override ? { ...d, ...override } : d
        }),
      }
      return _cache
    }
  } catch { /* ignore */ }
  _cache = buildDefaultConfig()
  return _cache
}

export function invalidateEngineCache(): void { _cache = null }

export function updateEngineConfig(config: EngineConfig): void {
  _cache = config
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config))
  // Sync with server (fire and forget)
  fetch('/api/engine/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }).catch(() => {})
}

/** Atualiza uma regra específica de escopo com audit */
export async function patchScopeRule(
  scope: EngineScope,
  scopeId: string,
  scopeName: string,
  patch: Partial<ScopeOverride>,
  flag?: string,
  oldValue?: unknown,
  note?: string,
): Promise<void> {
  const config = loadEngineConfig()
  const current = config.scopes[scope === 'classification' ? 'category' : scope as 'category' | 'subcategory']?.[scopeId] ?? {}
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }

  if (scope === 'classification') {
    config.classifications = config.classifications.map(c =>
      c.classificationType === scopeId ? { ...c, ...patch } : c,
    )
  } else {
    const key = scope as 'category' | 'subcategory'
    config.scopes[key] = {
      ...(config.scopes[key] ?? {}),
      [scopeId]: updated as ScopeOverride,
    }
  }
  updateEngineConfig(config)

  // Audit via server
  fetch('/api/engine/config/' + scope + '/' + encodeURIComponent(scopeId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: patch, note, flag, oldValue, newValue: patch[flag as keyof ScopeOverride], scopeName }),
  }).catch(() => {})
}

export async function loadAuditLog(): Promise<AuditEntry[]> {
  try {
    const r = await fetch('/api/engine/audit')
    if (r.ok) return r.json() as Promise<AuditEntry[]>
  } catch { /* ignore */ }
  return []
}

export function resetEngineConfig(): void {
  localStorage.removeItem(LOCAL_KEY)
  _cache = null
  fetch('/api/engine/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildDefaultConfig()) }).catch(() => {})
}

// ── Motor de decisão — hierarquia completa ────────────────────────────────────

export type FlagName = keyof EngineFlags

export type RuleSource = 'subcategory' | 'category' | 'classification' | 'manual_override' | 'system_default'

export interface ResolvedFlag {
  value: boolean
  source: RuleSource
}

function getClassificationFlags(tx: Transaction, config: EngineConfig): EngineFlags {
  const rule = config.classifications.find(c => c.classificationType === tx.classificationType)
  return rule ?? DEFAULT_FLAGS[tx.classificationType as ClassificationType] ?? DEFAULT_FLAGS.neutral
}

export function resolveFlag(tx: Transaction, flag: FlagName, config: EngineConfig): ResolvedFlag {
  // 1. Subcategoria override
  if (tx.subCategoryId) {
    const subRule = config.scopes.subcategory?.[tx.subCategoryId]
    if (subRule && subRule.inherit === 'custom' && flag in subRule) {
      return { value: subRule[flag] as boolean, source: 'subcategory' }
    }
    if (subRule && subRule.inherit === 'classification') {
      // Skip category, go straight to classification
      const classFlags = getClassificationFlags(tx, config)
      return { value: classFlags[flag], source: 'classification' }
    }
  }

  // 2. Categoria override
  if (tx.categoryId) {
    const catRule = config.scopes.category?.[tx.categoryId]
    if (catRule && catRule.inherit === 'custom' && flag in catRule) {
      return { value: catRule[flag] as boolean, source: 'category' }
    }
  }

  // 3. Manual override por transação (apenas para includeInOperationalResult)
  if (tx.manualCategoryOverride && flag === 'includeInOperationalResult') {
    return { value: tx.includeInOperationalResult, source: 'manual_override' }
  }

  // 4. Classificação
  const classFlags = getClassificationFlags(tx, config)
  return { value: classFlags[flag], source: 'classification' }
}

/** API pública principal */
export function getEngineConfig(): EngineConfig {
  return loadEngineConfig()
}

export function includesInResult(tx: Transaction, config?: EngineConfig): boolean {
  return resolveFlag(tx, 'includeInOperationalResult', config ?? getEngineConfig()).value
}

export function includesInCashflow(tx: Transaction, config?: EngineConfig): boolean {
  return resolveFlag(tx, 'includeInCashflow', config ?? getEngineConfig()).value
}

export function includesInBudget(tx: Transaction, config?: EngineConfig): boolean {
  return resolveFlag(tx, 'includeInBudget', config ?? getEngineConfig()).value
}

export function includesInAI(tx: Transaction, config?: EngineConfig): boolean {
  return resolveFlag(tx, 'includeInAI', config ?? getEngineConfig()).value
}

export function isHiddenInDashboard(tx: Transaction, config?: EngineConfig): boolean {
  return resolveFlag(tx, 'hideInDashboard', config ?? getEngineConfig()).value
}

export function getSourceLabel(source: RuleSource): string {
  const labels: Record<RuleSource, string> = {
    subcategory: 'Regra da Subcategoria',
    category: 'Regra da Categoria',
    classification: 'Regra da Classificação',
    manual_override: 'Override Manual',
    system_default: 'Padrão do Sistema',
  }
  return labels[source]
}

export function getClassificationLabel(classificationType: string): string {
  return CLASSIFICATION_META[classificationType as ClassificationType]?.label ?? classificationType
}

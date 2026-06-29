/**
 * Finance Engine — fonte única de verdade para regras financeiras.
 *
 * Hierarquia: Subcategoria > Categoria > Classificação > Padrão do sistema
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

export interface ClassificationRule {
  classificationType: ClassificationType
  label: string
  // Participação nos cálculos
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  includeInPatrimony: boolean
  includeInDashboard: boolean
  includeInAI: boolean
  includeInIndicators: boolean
  includeInProjections: boolean
  includeInReports: boolean
  // Visibilidade
  hideInDashboard: boolean
  hideInCharts: boolean
  hideInAnalysis: boolean
  // Permissões
  allowManualEdit: boolean
  allowCategoryOverride: boolean
  allowSubcategoryOverride: boolean
}

export interface CategoryRuleOverride {
  categoryId: string
  name: string
  useClassificationDefault: boolean
  overrides: Partial<Pick<ClassificationRule,
    'includeInOperationalResult' | 'includeInCashflow' | 'includeInBudget' |
    'includeInDashboard' | 'includeInAI' | 'hideInDashboard'
  >>
}

export interface EngineConfig {
  version: number
  updatedAt: string
  classifications: ClassificationRule[]
  categoryOverrides: CategoryRuleOverride[]
}

// ── Configuração padrão canônica (resultado da auditoria) ─────────────────────

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categoryOverrides: [],
  classifications: [
    {
      classificationType: 'operational_income',
      label: 'Receita Operacional',
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: true,
      includeInPatrimony: false,
      includeInDashboard: true,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: true,
      includeInReports: true,
      hideInDashboard: false,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'extraordinary_income',
      label: 'Receita Extraordinária',
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: false,
      includeInPatrimony: false,
      includeInDashboard: true,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: false,
      includeInReports: true,
      hideInDashboard: false,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'operational_expense',
      label: 'Despesa Operacional',
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: true,
      includeInPatrimony: false,
      includeInDashboard: true,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: true,
      includeInReports: true,
      hideInDashboard: false,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'debt_cost',
      label: 'Dívida / Passivo',
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: true,
      includeInPatrimony: true,
      includeInDashboard: true,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: true,
      includeInReports: true,
      hideInDashboard: false,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'investment',
      label: 'Investimento / Aporte',
      includeInOperationalResult: false,
      includeInCashflow: true,
      includeInBudget: false,
      includeInPatrimony: true,
      includeInDashboard: false,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: true,
      includeInReports: true,
      hideInDashboard: true,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'redemption',
      label: 'Resgate',
      includeInOperationalResult: false,
      includeInCashflow: true,
      includeInBudget: false,
      includeInPatrimony: true,
      includeInDashboard: false,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: true,
      includeInReports: true,
      hideInDashboard: true,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'transfer',
      label: 'Transferência Própria',
      includeInOperationalResult: false,
      includeInCashflow: false,
      includeInBudget: false,
      includeInPatrimony: false,
      includeInDashboard: false,
      includeInAI: false,
      includeInIndicators: false,
      includeInProjections: false,
      includeInReports: false,
      hideInDashboard: true,
      hideInCharts: true,
      hideInAnalysis: true,
      allowManualEdit: true,
      allowCategoryOverride: false,
      allowSubcategoryOverride: false,
    },
    {
      classificationType: 'reimbursement',
      label: 'Reembolso',
      includeInOperationalResult: true,
      includeInCashflow: true,
      includeInBudget: false,
      includeInPatrimony: false,
      includeInDashboard: true,
      includeInAI: true,
      includeInIndicators: true,
      includeInProjections: false,
      includeInReports: true,
      hideInDashboard: false,
      hideInCharts: false,
      hideInAnalysis: false,
      allowManualEdit: true,
      allowCategoryOverride: true,
      allowSubcategoryOverride: true,
    },
    {
      classificationType: 'neutral',
      label: 'Neutra',
      includeInOperationalResult: false,
      includeInCashflow: false,
      includeInBudget: false,
      includeInPatrimony: false,
      includeInDashboard: false,
      includeInAI: false,
      includeInIndicators: false,
      includeInProjections: false,
      includeInReports: false,
      hideInDashboard: true,
      hideInCharts: true,
      hideInAnalysis: true,
      allowManualEdit: true,
      allowCategoryOverride: false,
      allowSubcategoryOverride: false,
    },
    {
      classificationType: 'adjustment',
      label: 'Ajuste Contábil',
      includeInOperationalResult: false,
      includeInCashflow: false,
      includeInBudget: false,
      includeInPatrimony: false,
      includeInDashboard: false,
      includeInAI: false,
      includeInIndicators: false,
      includeInProjections: false,
      includeInReports: false,
      hideInDashboard: true,
      hideInCharts: true,
      hideInAnalysis: true,
      allowManualEdit: false,
      allowCategoryOverride: false,
      allowSubcategoryOverride: false,
    },
  ],
}

// ── Persistência ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fin_engine_config'

export function loadEngineConfig(): EngineConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ENGINE_CONFIG
    const saved = JSON.parse(raw) as Partial<EngineConfig>
    // Merge: preserve any new defaults not yet in saved config
    const merged: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      ...saved,
      classifications: DEFAULT_ENGINE_CONFIG.classifications.map(def => {
        const override = saved.classifications?.find(c => c.classificationType === def.classificationType)
        return override ? { ...def, ...override } : def
      }),
    }
    return merged
  } catch {
    return DEFAULT_ENGINE_CONFIG
  }
}

export function saveEngineConfig(config: EngineConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }))
}

export function resetEngineConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Motor de decisão ──────────────────────────────────────────────────────────

function getRule(tx: Transaction, config: EngineConfig): ClassificationRule | null {
  // 1. Subcategoria — future
  // 2. Categoria — check category overrides
  if (tx.categoryId) {
    const catRule = config.categoryOverrides.find(o => o.categoryId === tx.categoryId)
    if (catRule && !catRule.useClassificationDefault) {
      const base = config.classifications.find(c => c.classificationType === (tx.classificationType as ClassificationType))
      if (base) return { ...base, ...catRule.overrides }
    }
  }
  // 3. Classificação
  return config.classifications.find(c => c.classificationType === (tx.classificationType as ClassificationType)) ?? null
}

// Resolve com respeito ao override manual do usuário
function resolveFlag(
  tx: Transaction,
  config: EngineConfig,
  flag: keyof ClassificationRule,
  storedValue: boolean,
): boolean {
  // Manual override: respeit flag armazenado na transação
  if (tx.manualCategoryOverride && flag === 'includeInOperationalResult') return storedValue
  const rule = getRule(tx, config)
  if (rule) return rule[flag] as boolean
  // Fallback sistema
  if (flag === 'includeInOperationalResult') return tx.type === 'income' || tx.type === 'expense'
  return false
}

// ── API pública da engine ─────────────────────────────────────────────────────

let _cachedConfig: EngineConfig | null = null

export function getEngineConfig(): EngineConfig {
  if (!_cachedConfig) _cachedConfig = loadEngineConfig()
  return _cachedConfig
}

export function invalidateEngineCache(): void {
  _cachedConfig = null
}

export function updateEngineConfig(config: EngineConfig): void {
  saveEngineConfig(config)
  _cachedConfig = config
}

/** Participa do resultado operacional? */
export function includesInResult(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  return resolveFlag(tx, cfg, 'includeInOperationalResult', tx.includeInOperationalResult)
}

/** Participa do fluxo de caixa? */
export function includesInCashflow(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  return resolveFlag(tx, cfg, 'includeInCashflow', tx.includeInCashflow)
}

/** Participa do orçamento? */
export function includesInBudget(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  return resolveFlag(tx, cfg, 'includeInBudget', tx.includeInBudget)
}

/** Participa do dashboard? */
export function includesInDashboard(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  const rule = getRule(tx, cfg)
  return rule ? !rule.hideInDashboard : true
}

/** Participa da IA / Hermes? */
export function includesInAI(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  return resolveFlag(tx, cfg, 'includeInAI', true)
}

/** Deve ser ocultado no dashboard? */
export function isHiddenInDashboard(tx: Transaction, config?: EngineConfig): boolean {
  const cfg = config ?? getEngineConfig()
  const rule = getRule(tx, cfg)
  return rule?.hideInDashboard ?? false
}

/** Retorna o label da classificação */
export function getClassificationLabel(classificationType: string): string {
  return DEFAULT_ENGINE_CONFIG.classifications.find(c => c.classificationType === classificationType)?.label ?? classificationType
}

/**
 * Finance Engine — Phase 2.1
 *
 * Fonte de verdade: Supabase (fin_engine_config, fin_engine_audit)
 * Fallback/cache: localStorage (leitura offline, performance)
 * JSON file no servidor: apenas para o agente backend (/api/engine/*)
 *
 * Hierarquia: Subcategoria > Categoria > Classificação > Default do sistema
 * Nenhum cálculo financeiro deve existir fora desta camada.
 */

import { supabase } from '../lib/supabase'
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
  inherit: 'classification' | 'category' | 'custom'
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

// ── Flags canônicas padrão (resultado da auditoria financeira) ─────────────────

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
let _familyId: string | null = null
const LOCAL_KEY = 'fin_engine_config'

export function setEngineFamily(fid: string) { _familyId = fid }
export function invalidateEngineCache() { _cache = null }

// ── Supabase: fonte de verdade ─────────────────────────────────────────────────

type DbEngineRow = {
  family_id: string
  scope: string
  scope_id: string
  config: Record<string, unknown>
  note?: string
  updated_at: string
  updated_by?: string
}

/** Carrega config do Supabase. Retorna null se tabela inacessível. */
async function loadFromSupabase(familyId: string): Promise<EngineConfig | null> {
  try {
    const { data, error } = await supabase
      .from('fin_engine_config')
      .select('scope,scope_id,config,updated_at')
      .eq('family_id', familyId)

    if (error) return null
    if (!data || data.length === 0) return null

    const base = buildDefaultConfig()

    for (const row of data as DbEngineRow[]) {
      if (row.scope === 'classification') {
        base.classifications = base.classifications.map(c =>
          c.classificationType === row.scope_id ? { ...c, ...(row.config as Partial<ClassificationRule>) } : c,
        )
      } else if (row.scope === 'category') {
        base.scopes.category = { ...base.scopes.category, [row.scope_id]: row.config as unknown as ScopeOverride }
      } else if (row.scope === 'subcategory') {
        base.scopes.subcategory = { ...base.scopes.subcategory, [row.scope_id]: row.config as unknown as ScopeOverride }
      }
    }

    base.updatedAt = data.reduce((max, r) => r.updated_at > max ? r.updated_at : max, '')
    return base
  } catch {
    return null
  }
}

/** Persiste uma regra no Supabase (upsert por family_id + scope + scope_id) */
async function saveToSupabase(
  familyId: string,
  scope: EngineScope,
  scopeId: string,
  config: Record<string, unknown>,
  note?: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('fin_engine_config').upsert(
      { family_id: familyId, scope, scope_id: scopeId, config, note, updated_at: new Date().toISOString() },
      { onConflict: 'family_id,scope,scope_id' },
    )
    return !error
  } catch {
    return false
  }
}

/** Grava entrada de auditoria no Supabase */
async function appendAuditToSupabase(
  familyId: string,
  entry: Omit<AuditEntry, 'id' | 'changed_at'>,
): Promise<void> {
  try {
    await supabase.from('fin_engine_audit').insert({
      family_id: familyId,
      scope: entry.scope,
      scope_id: entry.scope_id,
      scope_name: entry.scope_name,
      flag: entry.flag,
      old_value: entry.old_value !== undefined ? { v: entry.old_value } : null,
      new_value: entry.new_value !== undefined ? { v: entry.new_value } : null,
      changed_at: new Date().toISOString(),
      changed_by: entry.changed_by,
      note: entry.note,
      origin: entry.origin ?? 'ui',
    })
  } catch { /* não bloqueia UI */ }
}

// ── API pública de carregamento ───────────────────────────────────────────────

/** Carrega do Supabase (async). Fallback para localStorage. */
export async function loadEngineConfigAsync(familyId: string): Promise<EngineConfig> {
  setEngineFamily(familyId)

  // Tenta Supabase primeiro
  const fromSb = await loadFromSupabase(familyId)
  if (fromSb) {
    _cache = fromSb
    localStorage.setItem(LOCAL_KEY, JSON.stringify(fromSb))
    return fromSb
  }

  // Fallback: localStorage
  return loadEngineConfigSync()
}

/** Carrega sincrono do cache ou localStorage (sem Supabase). */
export function loadEngineConfigSync(): EngineConfig {
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
          const ov = saved.classifications?.find(c => c.classificationType === d.classificationType)
          return ov ? { ...d, ...ov } : d
        }),
      }
      return _cache
    }
  } catch { /* ignore */ }
  _cache = buildDefaultConfig()
  return _cache
}

/** Alias síncrono para calculate.ts (usa cache) */
export function getEngineConfig(): EngineConfig {
  return _cache ?? loadEngineConfigSync()
}

// ── Atualização de regras ─────────────────────────────────────────────────────

/** Atualiza config em memória, localStorage e Supabase */
export function updateEngineConfig(config: EngineConfig): void {
  _cache = config
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config))
  // Sync com servidor (fallback JSON)
  fetch('/api/engine/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch(() => {})
}

/** Patch atômico de uma regra: Supabase + cache + audit */
export async function patchScopeRule(
  scope: EngineScope,
  scopeId: string,
  scopeName: string,
  patch: Partial<ScopeOverride> | Partial<ClassificationRule>,
  flag?: string,
  oldValue?: unknown,
  note?: string,
): Promise<void> {
  const config = getEngineConfig()
  const familyId = _familyId

  // Atualiza em memória
  if (scope === 'classification') {
    config.classifications = config.classifications.map(c =>
      c.classificationType === scopeId ? { ...c, ...patch } : c,
    )
  } else {
    const key = scope as 'category' | 'subcategory'
    const current = config.scopes[key]?.[scopeId] ?? {}
    config.scopes[key] = { ...(config.scopes[key] ?? {}), [scopeId]: { ...current, ...patch } as ScopeOverride }
  }

  // Persiste no Supabase (fonte de verdade)
  const configToSave = scope === 'classification'
    ? (config.classifications.find(c => c.classificationType === scopeId) ?? {}) as Record<string, unknown>
    : (config.scopes[scope as 'category' | 'subcategory']?.[scopeId] ?? {}) as Record<string, unknown>

  if (familyId) {
    const saved = await saveToSupabase(familyId, scope, scopeId, configToSave, note)

    // Auditoria no Supabase
    if (flag !== undefined) {
      await appendAuditToSupabase(familyId, {
        scope,
        scope_id: scopeId,
        scope_name: scopeName,
        flag,
        old_value: oldValue,
        new_value: (patch as Record<string, unknown>)[flag],
        note,
        origin: 'ui',
      })
    }

    if (!saved) {
      // Fallback: servidor JSON
      fetch(`/api/engine/config/${scope}/${encodeURIComponent(scopeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: patch, note, flag, oldValue, newValue: flag ? (patch as Record<string, unknown>)[flag] : undefined, scopeName }),
      }).catch(() => {})
    }
  }

  // Atualiza cache e localStorage
  _cache = config
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config))
}

/** Resets para o padrão canônico — apaga Supabase + localStorage */
export async function resetEngineConfig(): Promise<void> {
  const familyId = _familyId
  if (familyId) {
    await supabase.from('fin_engine_config').delete().eq('family_id', familyId)
  }
  localStorage.removeItem(LOCAL_KEY)
  _cache = null
  fetch('/api/engine/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildDefaultConfig()),
  }).catch(() => {})
}

/** Carrega auditoria do Supabase (fallback: servidor) */
export async function loadAuditLog(familyId?: string): Promise<AuditEntry[]> {
  const fid = familyId ?? _familyId
  if (fid) {
    try {
      const { data } = await supabase
        .from('fin_engine_audit')
        .select('*')
        .eq('family_id', fid)
        .order('changed_at', { ascending: false })
        .limit(200)
      if (data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          scope: r.scope,
          scope_id: r.scope_id,
          scope_name: r.scope_name,
          flag: r.flag,
          old_value: r.old_value?.v,
          new_value: r.new_value?.v,
          changed_at: r.changed_at,
          changed_by: r.changed_by,
          note: r.note,
          origin: r.origin,
        })) as AuditEntry[]
      }
    } catch { /* fallback */ }
  }
  // Fallback: servidor JSON
  try {
    const r = await fetch('/api/engine/audit')
    if (r.ok) return r.json() as Promise<AuditEntry[]>
  } catch { /* ignore */ }
  return []
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
  // 1. Subcategoria
  if (tx.subCategoryId) {
    const sub = config.scopes.subcategory?.[tx.subCategoryId]
    if (sub?.inherit === 'custom' && flag in sub) return { value: sub[flag] as boolean, source: 'subcategory' }
    if (sub?.inherit === 'classification') {
      return { value: getClassificationFlags(tx, config)[flag], source: 'classification' }
    }
  }
  // 2. Categoria
  if (tx.categoryId) {
    const cat = config.scopes.category?.[tx.categoryId]
    if (cat?.inherit === 'custom' && flag in cat) return { value: cat[flag] as boolean, source: 'category' }
  }
  // 3. Override manual por transação (Opção A: apenas para compatibilidade — será depreciado)
  if (tx.manualCategoryOverride && flag === 'includeInOperationalResult') {
    // Opção A: campo antigo é legado. Engine tem prioridade sobre flag armazenado.
    // Por ora, respeitamos apenas se a engine não tem regra diferente.
    const classVal = getClassificationFlags(tx, config)[flag]
    if (classVal === tx.includeInOperationalResult) return { value: tx.includeInOperationalResult, source: 'manual_override' }
    // Engine diverge → engine vence (Opção A)
  }
  // 4. Classificação
  return { value: getClassificationFlags(tx, config)[flag], source: 'classification' }
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Opção A: engine é a fonte de verdade — não usa include_in_operational_result armazenado */
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

export function getClassificationLabel(classificationType: string): string {
  return CLASSIFICATION_META[classificationType as ClassificationType]?.label ?? classificationType
}

export function getSourceLabel(source: RuleSource): string {
  return {
    subcategory: 'Regra da Subcategoria',
    category: 'Regra da Categoria',
    classification: 'Regra da Classificação',
    manual_override: 'Override Manual (legado)',
    system_default: 'Padrão do Sistema',
  }[source]
}

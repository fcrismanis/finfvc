import type { MacroCategory, BudgetClassification, CategoryTabType, ClassificationType } from '../types'
import { MACRO_CATEGORIES } from '../config/categories'

const STORAGE_KEY = 'finance_parent_categories_custom'

export function loadCustomMacroCategories(): MacroCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MacroCategory[]) : []
  } catch {
    return []
  }
}

function saveCustomMacroCategories(items: MacroCategory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function getAllMacroCategories(): MacroCategory[] {
  const customs = loadCustomMacroCategories()
  const customIds = new Set(customs.map(m => m.id))
  return [...MACRO_CATEGORIES.filter(m => !customIds.has(m.id)), ...customs]
}

export function overrideDefaultMacro(baseId: string, patch: {
  keywords?: string[]
  budgetClassification?: BudgetClassification
  group?: 'personal' | 'business'
}): MacroCategory {
  const base = MACRO_CATEGORIES.find(m => m.id === baseId)
  if (!base) throw new Error(`MacroCategory ${baseId} not found in defaults`)
  const customs = loadCustomMacroCategories()
  const existing = customs.find(m => m.id === baseId)
  const next: MacroCategory = {
    ...(existing ?? base),
    keywords: patch.keywords ?? existing?.keywords ?? base.keywords ?? [],
    budgetClassification: patch.budgetClassification ?? existing?.budgetClassification ?? 'none',
    group: patch.group ?? existing?.group ?? base.group ?? 'personal',
  }
  const idx = existing ? customs.findIndex(m => m.id === baseId) : -1
  if (idx >= 0) customs[idx] = next
  else customs.push(next)
  saveCustomMacroCategories(customs)
  return next
}

export function findMacroById(id: string): MacroCategory | undefined {
  return getAllMacroCategories().find(m => m.id === id)
}

function newMacroId(name: string): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'custom'
  return `mac_custom_${slug}_${Math.random().toString(36).slice(2, 5)}`
}

export function upsertCustomMacroCategory(input: {
  id?: string
  name: string
  tabType: CategoryTabType
  classificationType?: ClassificationType
  budgetClassification?: BudgetClassification
  keywords?: string[]
  icon?: string
  color?: string
  group?: 'personal' | 'business'
  isNeutral?: boolean
}): MacroCategory {
  const customs = loadCustomMacroCategories()
  const existing = customs.find(m => input.id ? m.id === input.id : m.name.toLowerCase() === input.name.toLowerCase())

  const isExpense = input.tabType === 'expense' || input.tabType === 'both'
  const classType: ClassificationType = input.classificationType
    ?? (isExpense ? 'operational_expense' : 'operational_income')

  const next: MacroCategory = {
    id: existing?.id ?? input.id ?? newMacroId(input.name),
    name: input.name.trim(),
    classificationType: classType,
    displayInResult: !input.isNeutral,
    displayInCashflow: true,
    displayInBudget: !input.isNeutral && input.tabType === 'expense',
    color: input.color ?? (isExpense ? '#64748B' : '#16A34A'),
    icon: input.icon ?? (isExpense ? 'tag' : 'coins'),
    sortOrder: existing?.sortOrder ?? (MACRO_CATEGORIES.length + customs.length + 1),
    tabType: input.tabType,
    keywords: input.keywords ?? [],
    budgetClassification: input.budgetClassification ?? 'none',
    group: input.group ?? 'personal',
    isNeutral: input.isNeutral ?? false,
    isDefault: false,
  }

  const idx = existing ? customs.findIndex(m => m.id === existing.id) : -1
  if (idx >= 0) customs[idx] = next
  else customs.push(next)
  saveCustomMacroCategories(customs)
  return next
}

export function deleteCustomMacroCategory(id: string): void {
  saveCustomMacroCategories(loadCustomMacroCategories().filter(m => m.id !== id))
}

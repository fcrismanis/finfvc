import { CATEGORIES, MACRO_CATEGORIES } from '../config/categories'
import { normalizeText } from './categoryRules.service'
import { pushCategoryOverrides } from './categoryOverrideSync'
import type { Category, ClassificationType } from '../types'

const STORAGE_KEY = 'finance_categories_custom'

export function loadCustomCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Category[]) : []
  } catch {
    return []
  }
}

function saveCustomCategories(categories: Category[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  pushCategoryOverrides('category', categories)
}

export function getAllCategories(): Category[] {
  const customs = loadCustomCategories()
  const customIds = new Set(customs.map(c => c.id))
  return [...CATEGORIES.filter(c => !customIds.has(c.id)), ...customs]
}

export function isCustomCategoryId(categoryId: string | undefined): boolean {
  return Boolean(categoryId?.startsWith('cat_cmd_'))
}

export function findCategoryById(categoryId: string | undefined): Category | undefined {
  if (!categoryId) return undefined
  return getAllCategories().find(category => category.id === categoryId)
}

export function findCategoryByName(name: string | undefined): Category | undefined {
  if (!name?.trim()) return undefined
  const norm = normalizeText(name)
  return getAllCategories().find(category => normalizeText(category.name) === norm)
}

export function newCustomCategoryId(name: string): string {
  const slug = normalizeText(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'custom'
  return `cat_cmd_${slug}_${Math.random().toString(36).slice(2, 6)}`
}

export function overrideDefaultCategory(baseId: string, patch: {
  name?: string
  keywords?: string[]
  budgetClassification?: import('../types').BudgetClassification
  active?: boolean
  icon?: string
}): Category {
  const base = CATEGORIES.find(c => c.id === baseId)
  if (!base) throw new Error(`Category ${baseId} not found in defaults`)
  const customs = loadCustomCategories()
  const existing = customs.find(c => c.id === baseId)
  const next: Category = {
    ...(existing ?? base),
    name: patch.name ?? existing?.name ?? base.name,
    keywords: patch.keywords ?? existing?.keywords ?? base.keywords ?? [],
    budgetClassification: patch.budgetClassification ?? existing?.budgetClassification ?? 'none',
    active: patch.active ?? existing?.active ?? base.active ?? true,
    icon: patch.icon ?? existing?.icon ?? base.icon,
  }
  const idx = existing ? customs.findIndex(c => c.id === baseId) : -1
  if (idx >= 0) customs[idx] = next
  else customs.push(next)
  saveCustomCategories(customs)
  return next
}

export function upsertCustomCategory(input: {
  id?: string
  name: string
  macroCategoryId: string
  classificationType?: ClassificationType
  keywords?: string[]
  budgetClassification?: import('../types').BudgetClassification
  group?: 'personal' | 'business'
  active?: boolean
}): Category {
  const categories = loadCustomCategories()
  const normalizedName = normalizeText(input.name)
  const existing = categories.find(category =>
    (input.id && category.id === input.id)
    || normalizeText(category.name) === normalizedName
  )
  const macro = MACRO_CATEGORIES.find(item => item.id === input.macroCategoryId)
  const classType: ClassificationType = input.classificationType ?? macro?.classificationType ?? 'operational_expense'
  const next: Category = {
    id: existing?.id ?? input.id ?? newCustomCategoryId(input.name),
    name: input.name.trim(),
    macroCategoryId: input.macroCategoryId,
    classificationType: classType,
    defaultIncludeInOperationalResult: macro?.displayInResult ?? true,
    defaultIncludeInCashflow: macro?.displayInCashflow ?? true,
    defaultIncludeInBudget: macro?.displayInBudget ?? true,
    isInternalTransferDefault: false,
    sortOrder: existing?.sortOrder ?? (categories.length + 1),
    active: input.active ?? existing?.active ?? true,
    keywords: input.keywords ?? [],
    budgetClassification: input.budgetClassification ?? 'none',
    group: input.group ?? 'personal',
  }

  const idx = existing ? categories.findIndex(category => category.id === existing.id) : -1
  if (idx >= 0) categories[idx] = next
  else categories.push(next)
  saveCustomCategories(categories)
  return next
}

export function deleteCustomCategory(categoryId: string): void {
  saveCustomCategories(loadCustomCategories().filter(category => category.id !== categoryId))
}

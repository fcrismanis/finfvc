import { CATEGORIES, MACRO_CATEGORIES } from '../config/categories'
import { normalizeText } from './categoryRules.service'
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
}

export function getAllCategories(): Category[] {
  return [...CATEGORIES, ...loadCustomCategories()]
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

export function upsertCustomCategory(input: {
  id?: string
  name: string
  macroCategoryId: string
  classificationType: ClassificationType
}): Category {
  const categories = loadCustomCategories()
  const normalizedName = normalizeText(input.name)
  const existing = categories.find(category =>
    (input.id && category.id === input.id)
    || normalizeText(category.name) === normalizedName
  )
  const macro = MACRO_CATEGORIES.find(item => item.id === input.macroCategoryId)
  const next: Category = {
    id: existing?.id ?? input.id ?? newCustomCategoryId(input.name),
    name: input.name.trim(),
    macroCategoryId: input.macroCategoryId,
    classificationType: input.classificationType,
    defaultIncludeInOperationalResult: macro?.displayInResult ?? true,
    defaultIncludeInCashflow: macro?.displayInCashflow ?? true,
    defaultIncludeInBudget: macro?.displayInBudget ?? true,
    isInternalTransferDefault: false,
    sortOrder: existing?.sortOrder ?? (categories.length + 1),
    active: true,
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

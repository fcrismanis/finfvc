import type { SubCategory, SubCategoryEssentiality } from '../types'

const STORAGE_KEY = 'finance_subcategories'

export function loadSubCategories(): SubCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SubCategory[]) : []
  } catch {
    return []
  }
}

export function saveSubCategories(subs: SubCategory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
}

export function upsertSubCategory(sub: SubCategory): SubCategory[] {
  const all = loadSubCategories()
  const idx = all.findIndex(s => s.id === sub.id)
  if (idx >= 0) all[idx] = sub
  else all.push(sub)
  saveSubCategories(all)
  return all
}

export function deleteSubCategory(id: string): SubCategory[] {
  const all = loadSubCategories().filter(s => s.id !== id)
  saveSubCategories(all)
  return all
}

export function newSubCategoryId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function resolveEssentiality(
  macroCategoryId: string | undefined,
  subCategory: SubCategory | undefined,
): 'essential' | 'non_essential' {
  if (subCategory && subCategory.essentiality !== 'inherit') {
    return subCategory.essentiality as 'essential' | 'non_essential'
  }
  // Fallback: macros with operational_expense are non-essential by default
  // except housing (mac_casa), health (mac_saude), education (mac_educacao)
  const essentialMacros = new Set(['mac_casa', 'mac_saude', 'mac_educacao', 'mac_seguros'])
  return essentialMacros.has(macroCategoryId ?? '') ? 'essential' : 'non_essential'
}

export const ESSENTIALITY_LABELS: Record<SubCategoryEssentiality, string> = {
  essential: 'Essencial',
  non_essential: 'Não essencial',
  inherit: 'Herdar da categoria',
}

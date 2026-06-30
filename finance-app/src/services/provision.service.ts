import type { Provision } from '../types'

const STORAGE_KEY = 'finance_provisions'

export function loadProvisions(): Provision[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Provision[]) : []
  } catch {
    return []
  }
}

export function saveProvisions(provs: Provision[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(provs))
}

export function upsertProvision(prov: Provision): Provision[] {
  const all = loadProvisions()
  const idx = all.findIndex(p => p.id === prov.id)
  if (idx >= 0) all[idx] = prov
  else all.push(prov)
  saveProvisions(all)
  return all
}

export function deleteProvision(id: string): Provision[] {
  const all = loadProvisions().filter(p => p.id !== id)
  saveProvisions(all)
  return all
}

export function newProvisionId(): string {
  return `prov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

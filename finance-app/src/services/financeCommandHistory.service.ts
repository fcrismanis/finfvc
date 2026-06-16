import type { Category, SubCategory, Transaction } from '../types'
import type { CategoryRule } from './categoryRules.service'
import type { FinanceCommandPlan } from './financeCommand.service'

const STORAGE_KEY = 'fin_command_history'
const MAX_HISTORY = 30

export type FinanceCommandHistoryEntry = {
  id: string
  createdAt: string
  command: string
  plan: FinanceCommandPlan
  summary: {
    affectedTransactions: number
    createdCategories: string[]
    createdSubCategories: string[]
    createdRules: string[]
  }
  before: {
    transactions: Transaction[]
    categories: Category[]
    subCategories: SubCategory[]
    rules: CategoryRule[]
  }
  after?: {
    transactions: Transaction[]
    categories: Category[]
    subCategories: SubCategory[]
    rules: CategoryRule[]
  }
  status: 'applied' | 'undone'
}

export function getCommandHistory(): FinanceCommandHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FinanceCommandHistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveCommandHistory(entries: FinanceCommandHistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

export function createCommandSnapshot(input: {
  command: string
  plan: FinanceCommandPlan
  summary: FinanceCommandHistoryEntry['summary']
  before: FinanceCommandHistoryEntry['before']
}): FinanceCommandHistoryEntry {
  return {
    id: input.plan.id,
    createdAt: new Date().toISOString(),
    command: input.command,
    plan: input.plan,
    summary: input.summary,
    before: input.before,
    status: 'applied',
  }
}

export function saveCommandHistoryEntry(entry: FinanceCommandHistoryEntry): void {
  const entries = getCommandHistory().filter(item => item.id !== entry.id)
  entries.unshift(entry)
  saveCommandHistory(entries)
}

export function updateCommandHistoryEntry(entryId: string, patch: Partial<FinanceCommandHistoryEntry>): FinanceCommandHistoryEntry | null {
  const entries = getCommandHistory()
  const idx = entries.findIndex(entry => entry.id === entryId)
  if (idx < 0) return null
  entries[idx] = { ...entries[idx], ...patch }
  saveCommandHistory(entries)
  return entries[idx]
}

export function getLastAppliedCommand(): FinanceCommandHistoryEntry | null {
  return getCommandHistory().find(entry => entry.status === 'applied') ?? null
}

export function findCommandHistoryEntry(query: string): FinanceCommandHistoryEntry | null {
  const norm = query.trim().toLowerCase()
  return getCommandHistory().find(entry =>
    entry.status === 'applied' && entry.command.toLowerCase().includes(norm)
  ) ?? null
}

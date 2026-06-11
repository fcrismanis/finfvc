import type { ParsedImportItem } from './types'
import type { Transaction } from '../types'

function hashCode(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function computeImportHash(
  originalDescription: string,
  amount: number,
  transactionDate: string,
  account: string
): string {
  const key = [
    originalDescription.toUpperCase().trim(),
    amount.toFixed(2),
    transactionDate,
    account.trim(),
  ].join('|')
  return hashCode(key)
}

export function markDuplicates(
  incoming: ParsedImportItem[],
  existing: Transaction[]
): ParsedImportItem[] {
  const existingHashes = new Set(existing.map(tx => tx.importHash).filter(Boolean))
  const seenInBatch = new Set<string>()

  return incoming.map(item => {
    const isDuplicate = existingHashes.has(item.importHash) || seenInBatch.has(item.importHash)
    if (!isDuplicate) seenInBatch.add(item.importHash)
    return { ...item, isDuplicate }
  })
}

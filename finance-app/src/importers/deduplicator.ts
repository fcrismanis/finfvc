import type { ParsedImportItem } from './types'
import type { Transaction } from '../types'

// FNV-1a 64-bit using two 32-bit halves (2^64 collision space vs the old 2^32 djb2)
function hashCode(str: string): string {
  let hi = 0x811c9dc5 >>> 0
  let lo = 0x84222325 >>> 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    lo ^= c
    hi ^= c
    const loMul = Math.imul(lo, 0x01000193)
    const hiMul = Math.imul(hi, 0x01000193)
    lo = loMul >>> 0
    hi = (hiMul ^ Math.imul(lo, 0x00000100)) >>> 0
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')
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

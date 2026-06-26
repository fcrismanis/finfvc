/**
 * Compressed localStorage codec.
 *
 * localStorage caps at ~5 MB per origin. The transaction ledger (one big JSON
 * blob under `finance_transactions`) blows past that with real data volume, so
 * we LZ-compress large payloads before persisting (~5-10x on this JSON).
 *
 * Backward compatible: legacy uncompressed values (plain JSON) are read as-is;
 * new writes are compressed and tagged with PREFIX. Plain JSON always starts
 * with one of [ { " or a digit, never "LZ", so tag detection is unambiguous.
 */
import LZString from 'lz-string'

const PREFIX = 'LZ' // tag marking a compressed payload; cannot begin valid JSON

/** Compress `value` and persist under `key`. Throws if quota still exceeded. */
export function setCompressed(key: string, value: string): void {
  localStorage.setItem(key, PREFIX + LZString.compressToUTF16(value))
}

/** Read `key`, transparently decompressing tagged values; null if absent. */
export function getDecompressed(key: string): string | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  if (raw.startsWith(PREFIX)) return LZString.decompressFromUTF16(raw.slice(PREFIX.length))
  return raw // legacy plain JSON
}

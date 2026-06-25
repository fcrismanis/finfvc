// Investments the user chose to exclude from totals (kept, just not counted).
// Persisted locally; shared by Investimentos and Patrimônio so both totals agree.
const EXCLUDED_INVESTMENTS_KEY = 'fin_excluded_investments'

export function loadExcludedInvestments(): Set<string> {
  try {
    const raw = localStorage.getItem(EXCLUDED_INVESTMENTS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function saveExcludedInvestments(ids: Set<string>): void {
  try {
    localStorage.setItem(EXCLUDED_INVESTMENTS_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

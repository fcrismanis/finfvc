function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export function currentFinancialDate(): string {
  return formatLocalDate(new Date())
}

export function normalizeFinancialDate(raw: string | number | Date | undefined | null, fallback = currentFinancialDate()): string {
  if (raw == null || raw === '') return fallback

  if (typeof raw === 'number') {
    const excelEpochUtc = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpochUtc + raw * 86400000)
    return formatUtcDate(date)
  }

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? fallback : formatLocalDate(raw)
  }

  const s = String(raw).trim()
  if (!s) return fallback

  const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoPrefix) {
    // Date-only string (no time component) → keep the literal date, no timezone shift.
    // Full timestamp (e.g. Pluggy "2026-06-01T01:30:00Z") → convert to the LOCAL calendar
    // date. Slicing the UTC prefix pushes evening-BRT transactions (late UTC) onto the next
    // day — and at month/year boundaries onto the wrong month — misattributing competence.
    const hasTime = /[T ]\d{2}:\d{2}/.test(s)
    if (!hasTime) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`
    const parsed = new Date(s)
    if (!isNaN(parsed.getTime())) return formatLocalDate(parsed)
    return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`
  }

  const brMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? fallback : formatLocalDate(parsed)
}

export function formatFinancialDateBR(value?: string | null): string {
  const normalized = normalizeFinancialDate(value, '')
  if (!normalized) return ''
  const [year, month, day] = normalized.split('-')
  if (!year || !month || !day) return normalized
  return `${day}/${month}/${year}`
}

export function getCompetenceMonth(dateStr: string): string {
  return dateStr.substring(0, 7)
}

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`
}

export function formatMonthFull(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${months[parseInt(month) - 1]} ${year}`
}

export function prevMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const d = new Date(year, month, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function getLast6Months(refMonth: string): string[] {
  const months: string[] = []
  let current = refMonth
  for (let i = 0; i < 6; i++) {
    months.unshift(current)
    current = prevMonth(current)
  }
  return months
}

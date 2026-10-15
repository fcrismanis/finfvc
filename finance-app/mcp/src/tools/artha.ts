import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'

/**
 * Planilhas exportadas do Artha pelo robô (finance-app/artha-robot).
 * Somente leitura. Arquivos: artha-AAAA-MM.xlsx, artha-atual.xlsx, artha-anterior.xlsx.
 */
const dir = () => process.env.ARTHA_DIR ?? '/data/artha'

export async function tool_arthaListExports() {
  if (!existsSync(dir())) {
    return { files: [], hint: `Pasta ${dir()} não encontrada. Rode o robô do Artha (artha-robot/setup.sh) e monte a pasta no container.` }
  }
  const files = readdirSync(dir())
    .filter(f => /^artha-\d{4}-\d{2}\.xlsx$/.test(f))
    .sort()
    .map(f => {
      const s = statSync(join(dir(), f))
      return { file: f, month: f.slice(6, 13), size_kb: Math.round(s.size / 1024), exported_at: s.mtime.toISOString() }
    })
  return { files }
}

export interface ArthaInput { month?: string; text?: string; limit?: number }

export async function tool_arthaGetTransactions(input: ArthaInput) {
  const month = input.month ?? 'atual'
  const name = /^\d{4}-\d{2}$/.test(month) ? `artha-${month}.xlsx` : `artha-${month}.xlsx`
  const path = join(dir(), name)
  if (!existsSync(path)) throw new Error(`Planilha ${name} não encontrada. Use artha_list_exports para ver as disponíveis.`)

  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })
  const sheets = wb.SheetNames.map(sn => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], { defval: null, raw: false })
    return { sheet: sn, rows }
  })

  const needle = input.text?.toLowerCase()
  const limit = Math.min(input.limit ?? 200, 1000)
  const out = sheets.map(({ sheet, rows }) => {
    const filtered = needle
      ? rows.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(needle)))
      : rows
    return {
      sheet,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      total_rows: rows.length,
      matched_rows: filtered.length,
      truncated: filtered.length > limit,
      rows: filtered.slice(0, limit),
    }
  })
  return { file: name, exported_at: statSync(path).mtime.toISOString(), sheets: out }
}

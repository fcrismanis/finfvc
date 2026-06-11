/**
 * Import validation script — runs in Node.js
 * Uses same logic as src/importers/* but without DOM/browser deps
 */

import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'

const FILES = [
  '/Users/fcrismanis/Downloads/lancamentos_Pessoal_2026-01-01_2026-12-31 (1).xlsx',
  '/Users/fcrismanis/Downloads/clareza-financeira-2026-06-10 (1).xlsx',
]

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeAmount(raw) {
  if (typeof raw === 'number') return Math.abs(raw)
  const cleaned = String(raw)
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const v = parseFloat(cleaned)
  return isNaN(v) ? null : Math.abs(v)
}

function normalizeDate(raw) {
  if (!raw || raw === '') return null
  if (typeof raw === 'number') {
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + raw * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(raw).trim()
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const p = new Date(s)
  return isNaN(p.getTime()) ? null : p.toISOString().slice(0, 10)
}

// ─── Classification rules (same keywords as classifier.ts) ───────────────────

const RULES = [
  { kw: ['JUROS','LIMITE DA CONTA','IOF','CHEQUE ESPECIAL'], cls: 'debt_cost' },
  { kw: ['RESGATE','RESG.','RESGATE INVEST'], cls: 'redemption' },
  { kw: ['APORTE','APLICACAO','APLICAÇÃO','CDB','LCI','LCA','TESOURO','FUNDO'], cls: 'investment' },
  { kw: ['TRANSFERENCIA','TRANSFERÊNCIA','TRANSF.','TED','DOC','PAGAMENTO FATURA','FAT. CARTAO','FATURA CARTAO','PAG FATURA','PAG. FATURA'], cls: 'transfer' },
  { kw: ['SALARIO','SALÁRIO','FOLHA','PAGAMENTO FOLHA'], cls: 'operational_income' },
  { kw: ['PLR','13 SAL','DECIMO','DÉCIMO','FERIAS','FÉRIAS','BONUS','BÔNUS'], cls: 'extraordinary_income' },
  { kw: ['FIT ','FIT-','PAGAMENTO FIT'], cls: 'operational_income' },
]

function classify(description, rawType) {
  const upper = String(description).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
  for (const rule of RULES) {
    for (const kw of rule.kw) {
      if (upper.includes(kw)) return rule.cls
    }
  }
  const isIncome = String(rawType).toLowerCase().includes('receita') || String(rawType).toLowerCase().includes('entrada')
  return isIncome ? 'extraordinary_income' : 'operational_expense'
}

const NEUTRAL_TYPES = new Set(['redemption','investment','transfer','neutral','adjustment'])
const INCOME_TYPES  = new Set(['operational_income','extraordinary_income','redemption'])

// ─── Column aliases ───────────────────────────────────────────────────────────

const COL_ALIAS = {
  tipo:'tipo', type:'tipo',
  descricao:'descricao', descrição:'descricao', description:'descricao', memo:'descricao', histórico:'descricao', historico:'descricao',
  valor:'valor', value:'valor', amount:'valor',
  data:'data', date:'data', 'data lançamento':'data', 'data lancamento':'data',
  'data competencia':'data_comp','data competência':'data_comp', competência:'data_comp', competencia:'data_comp',
  'data pagamento':'data_pag','data de pagamento':'data_pag',
  status:'status', situacao:'status', situação:'status',
  'forma de pagamento':'forma','forma pagamento':'forma','payment method':'forma',
  'conta/cartao':'conta','conta/cartão':'conta', conta:'conta', cartao:'conta', cartão:'conta',
  categoria:'categoria', category:'categoria',
  parcela:'parcela', installment:'parcela',
  recorrente:'recorrente',
  tags:'tags',
  grupo:'grupo', group:'grupo',
}

function normKey(h) { return String(h||'').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'') }

// ─── Parse file ───────────────────────────────────────────────────────────────

function parseFile(path) {
  const buf = readFileSync(path)
  const wb = XLSX.read(buf, { type:'buffer', cellDates:false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:undefined, blankrows:false })

  if (rows.length < 2) return { headers:[], rows:[], colMap:{}, unknownHeaders:[] }

  const rawHeaders = rows[0].map(h => String(h??''))
  const colMap = {}
  rawHeaders.forEach((h,i) => {
    const norm = normKey(h)
    const alias = COL_ALIAS[norm]
    if (alias && !(alias in colMap)) colMap[alias] = i
  })

  const unknownHeaders = rawHeaders.filter(h => {
    const norm = normKey(h)
    return h.trim() !== '' && !COL_ALIAS[norm]
  })

  return { headers: rawHeaders, dataRows: rows.slice(1), colMap, unknownHeaders }
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

function analyzeFile(path) {
  console.log(`\nReading: ${path}`)
  const { headers, dataRows, colMap, unknownHeaders } = parseFile(path)

  const fileName = path.split('/').pop()
  const get = (row, col) => {
    const idx = colMap[col]
    return idx !== undefined && row[idx] !== undefined ? row[idx] : undefined
  }

  const stats = {
    file: fileName,
    headers,
    unknownHeaders,
    missingExpected: [],
    totalRows: dataRows.length,
    validRows: 0,
    skippedRows: 0,
    dateErrors: [],
    valueErrors: [],
    noCategory: [],
    byType: {},
    byStatus: {},
    byConta: {},
    byClassification: {},
    byRawCategory: {},
    topByValue: [],
    duplicateCandidates: [],
    allTxns: [],
  }

  // Check expected columns
  const expected = ['tipo','descricao','valor','data','data_comp','status','forma','conta','categoria']
  expected.forEach(col => {
    if (!(col in colMap)) stats.missingExpected.push(col)
  })

  const hashMap = {}
  const txns = []

  dataRows.forEach((row, rowIdx) => {
    const desc = get(row,'descricao')
    const rawVal = get(row,'valor')

    if (!desc && rawVal === undefined) { stats.skippedRows++; return }

    const description = String(desc||'').trim()
    const amount = normalizeAmount(rawVal)
    const transDate = normalizeDate(get(row,'data'))
    const compDate = normalizeDate(get(row,'data_comp') || get(row,'data'))
    const rawType = String(get(row,'tipo')||'Despesa')
    const rawStatus = String(get(row,'status')||'Pago').toLowerCase()
    const rawConta = String(get(row,'conta')||'')
    const rawCat = String(get(row,'categoria')||'')
    const rawParcela = get(row,'parcela')
    const rawGrupo = get(row,'grupo')

    if (amount === null || amount === 0) {
      stats.valueErrors.push({ row: rowIdx+2, description, raw: rawVal })
    }
    if (!transDate) {
      stats.dateErrors.push({ row: rowIdx+2, description, raw: get(row,'data') })
    }
    if (!rawCat || rawCat === 'undefined') {
      stats.noCategory.push({ row: rowIdx+2, description, amount })
    }

    const cls = classify(description, rawType)
    const isIncomeType = rawType.toLowerCase().includes('receita') || rawType.toLowerCase().includes('entrada')
    const type = INCOME_TYPES.has(cls) || isIncomeType ? 'income' : 'expense'

    // Status
    let status = 'paid'
    if (rawStatus.includes('pendente') || rawStatus.includes('agendado')) status = 'pending'
    else if (rawStatus.includes('cancel')) status = 'cancelled'

    // Parcela
    let installment = null
    if (rawParcela) {
      const m = String(rawParcela).match(/(\d+)\s*[\/\-]\s*(\d+)/)
      if (m) installment = `${m[1]}/${m[2]}`
    }

    // Dedup hash
    const hashKey = `${description.toUpperCase()}|${(amount||0).toFixed(2)}|${transDate||''}|${rawConta}`
    if (hashMap[hashKey]) hashMap[hashKey]++
    else hashMap[hashKey] = 1

    // Tally
    stats.byType[type] = (stats.byType[type]||0) + 1
    stats.byStatus[status] = (stats.byStatus[status]||0) + 1
    stats.byConta[rawConta||'(vazio)'] = (stats.byConta[rawConta||'(vazio)']||0) + 1
    stats.byClassification[cls] = (stats.byClassification[cls]||0) + 1
    stats.byRawCategory[rawCat||'(vazio)'] = (stats.byRawCategory[rawCat||'(vazio)']||0) + 1
    stats.validRows++

    txns.push({ description, amount: amount||0, date: transDate, competence: compDate, type, status, cls, rawConta, rawCat, installment, grupo: rawGrupo })
  })

  // Duplicates
  Object.entries(hashMap).forEach(([key, count]) => {
    if (count > 1) {
      const [desc,amt,date] = key.split('|')
      stats.duplicateCandidates.push({ description: desc, amount: parseFloat(amt), date, occurrences: count })
    }
  })

  // Top 20 by value
  stats.topByValue = [...txns]
    .filter(t => t.type === 'expense' && !NEUTRAL_TYPES.has(t.cls))
    .sort((a,b) => b.amount - a.amount)
    .slice(0,20)
    .map(t => ({ description: t.description, amount: t.amount, classification: t.cls }))

  stats.allTxns = txns
  return stats
}

// ─── Format BRL ──────────────────────────────────────────────────────────────

const brl = v => `R$ ${v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}`

// ─── Report ──────────────────────────────────────────────────────────────────

function buildReport(allStats) {
  const lines = []
  const h1 = t => lines.push(`# ${t}`)
  const h2 = t => lines.push(`\n## ${t}`)
  const h3 = t => lines.push(`\n### ${t}`)
  const ln = t => lines.push(t)
  const sep = () => lines.push('')

  h1('IMPORT_VALIDATION_REPORT')
  ln(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  sep()

  for (const s of allStats) {
    h2(`Arquivo: ${s.file}`)

    h3('Colunas detectadas')
    ln(`| Coluna original | Alias mapeado |`)
    ln(`|---|---|`)
    s.headers.forEach(h => {
      const norm = normKey(h)
      const alias = COL_ALIAS[norm] || '—'
      ln(`| ${h} | ${alias} |`)
    })

    if (s.unknownHeaders.length > 0) {
      sep()
      ln(`**Campos não reconhecidos:** ${s.unknownHeaders.join(', ')}`)
    }

    if (s.missingExpected.length > 0) {
      sep()
      ln(`**Campos esperados ausentes:** ${s.missingExpected.join(', ')}`)
    }

    h3('Totais')
    ln(`- Total de linhas lidas: **${s.totalRows}**`)
    ln(`- Transações válidas: **${s.validRows}**`)
    ln(`- Transações ignoradas (vazias): **${s.skippedRows}**`)
    ln(`- Linhas com erro de data: **${s.dateErrors.length}**`)
    ln(`- Linhas com erro de valor: **${s.valueErrors.length}**`)
    ln(`- Linhas sem categoria: **${s.noCategory.length}**`)
    ln(`- Possíveis duplicados: **${s.duplicateCandidates.length}**`)

    h3('Por tipo financeiro (income / expense)')
    Object.entries(s.byType).forEach(([k,v]) => ln(`- ${k}: ${v}`))

    h3('Por status')
    Object.entries(s.byStatus).forEach(([k,v]) => ln(`- ${k}: ${v}`))

    h3('Por classification_type')
    const CLS_LABELS = {
      operational_income:'Receita Operacional',
      extraordinary_income:'Receita Eventual',
      operational_expense:'Despesa Operacional',
      debt_cost:'Dívida / Juros',
      investment:'Investimento / Aporte',
      redemption:'Resgate',
      transfer:'Transferência',
      neutral:'Neutro',
      reimbursement:'Reembolso',
      adjustment:'Ajuste',
    }
    Object.entries(s.byClassification)
      .sort((a,b) => b[1]-a[1])
      .forEach(([k,v]) => ln(`- ${CLS_LABELS[k]||k}: ${v}`))

    // Specific checks
    h3('Verificações críticas')
    const resgates = s.allTxns.filter(t => t.cls === 'redemption')
    const resgatesAsIncome = resgates.filter(t => t.type === 'income')
    const resgatesMapped = resgates.map(t => `  - ${t.description} | ${brl(t.amount)} | tipo=${t.type}`)

    ln(`**Resgates classificados como receita operacional:** ${resgatesAsIncome.length === 0 ? '✅ Nenhum — correto' : `⚠️ ${resgatesAsIncome.length} resgates entrando como receita:`}`)
    // Even if type=income, includeInOperationalResult=false for redemption — but flag it
    if (resgatesMapped.length > 0) resgatesMapped.forEach(r => ln(r))

    const aportes = s.allTxns.filter(t => t.cls === 'investment')
    const aportesAsExpense = aportes.filter(t => t.type === 'expense')
    ln(`\n**Aportes classificados como despesa operacional:** ${aportesAsExpense.length === 0 ? '✅ Nenhum' : `⚠️ ${aportesAsExpense.length} aportes. Eles são neutros por includeInOperationalResult=false`}`)

    const transfers = s.allTxns.filter(t => t.cls === 'transfer')
    ln(`\n**Transferências internas detectadas:** ${transfers.length} — ${transfers.length > 0 ? '✅ marcadas como transfer (excluídas do resultado)' : 'Nenhuma'}`)
    transfers.slice(0,5).forEach(t => ln(`  - ${t.description} | ${brl(t.amount)}`))

    const faturas = s.allTxns.filter(t =>
      t.description.toUpperCase().includes('FATURA') || t.description.toUpperCase().includes('FAT.')
    )
    ln(`\n**Pagamentos de fatura detectados:** ${faturas.length}`)
    faturas.forEach(t => ln(`  - ${t.description} | ${brl(t.amount)} | cls=${t.cls}`))

    const parcelas = s.allTxns.filter(t => t.installment)
    ln(`\n**Parcelas detectadas:** ${parcelas.length}`)
    parcelas.slice(0,10).forEach(t => ln(`  - ${t.description} | ${brl(t.amount)} | parcela=${t.installment}`))

    const pending = s.allTxns.filter(t => t.status === 'pending')
    ln(`\n**Pendentes (compromisso futuro):** ${pending.length}`)
    pending.slice(0,10).forEach(t => ln(`  - ${t.description} | ${brl(t.amount)}`))

    h3('Por conta/cartão (top 10)')
    Object.entries(s.byConta)
      .sort((a,b) => b[1]-a[1])
      .slice(0,10)
      .forEach(([k,v]) => ln(`- ${k}: ${v}`))

    h3('Top 20 categorias (raw do arquivo)')
    Object.entries(s.byRawCategory)
      .sort((a,b) => b[1]-a[1])
      .slice(0,20)
      .forEach(([k,v]) => ln(`- ${k}: ${v}`))

    h3('Top 20 descrições por valor (despesas operacionais)')
    ln(`| Descrição | Valor | Classificação |`)
    ln(`|---|---|---|`)
    s.topByValue.forEach(t => ln(`| ${t.description} | ${brl(t.amount)} | ${CLS_LABELS[t.classification]||t.classification} |`))

    if (s.duplicateCandidates.length > 0) {
      h3('Possíveis duplicidades')
      ln(`| Descrição | Valor | Data | Ocorrências |`)
      ln(`|---|---|---|---|`)
      s.duplicateCandidates
        .sort((a,b) => b.occurrences - a.occurrences)
        .slice(0,20)
        .forEach(d => ln(`| ${d.description} | ${brl(d.amount)} | ${d.date||'?'} | ${d.occurrences}x |`))
    }

    if (s.dateErrors.length > 0) {
      h3('Linhas com erro de data (primeiras 20)')
      s.dateErrors.slice(0,20).forEach(e => ln(`- Linha ${e.row}: "${e.description}" | data bruta: "${e.raw}"`))
    }

    if (s.valueErrors.length > 0) {
      h3('Linhas com erro de valor (primeiras 20)')
      s.valueErrors.slice(0,20).forEach(e => ln(`- Linha ${e.row}: "${e.description}" | valor bruto: "${e.raw}"`))
    }

    if (s.noCategory.slice(0,20).length > 0) {
      h3('Linhas sem categoria (primeiras 20)')
      s.noCategory.slice(0,20).forEach(e => ln(`- Linha ${e.row}: "${e.description}" | ${brl(e.amount||0)}`))
    }

    // Financial health check
    h3('Resultado operacional simulado')
    const opIncome = s.allTxns
      .filter(t => t.type === 'income' && !NEUTRAL_TYPES.has(t.cls))
      .reduce((sum,t) => sum + t.amount, 0)
    const opExpense = s.allTxns
      .filter(t => t.type === 'expense' && !NEUTRAL_TYPES.has(t.cls))
      .reduce((sum,t) => sum + t.amount, 0)
    const neutral = s.allTxns
      .filter(t => NEUTRAL_TYPES.has(t.cls))
      .reduce((sum,t) => sum + t.amount, 0)
    const debt = s.allTxns
      .filter(t => t.cls === 'debt_cost')
      .reduce((sum,t) => sum + t.amount, 0)
    const redemptionTotal = s.allTxns
      .filter(t => t.cls === 'redemption')
      .reduce((sum,t) => sum + t.amount, 0)
    const investmentTotal = s.allTxns
      .filter(t => t.cls === 'investment')
      .reduce((sum,t) => sum + t.amount, 0)

    ln(`- Receita operacional (excl. neutros/resgates): **${brl(opIncome)}**`)
    ln(`- Despesa operacional (excl. neutros): **${brl(opExpense)}**`)
    ln(`- Resultado operacional: **${brl(opIncome - opExpense)}**`)
    ln(`- Total neutros (excluídos do resultado): ${brl(neutral)}`)
    ln(`- Total resgates (NÃO é receita op): ${brl(redemptionTotal)}`)
    ln(`- Total aportes/investimentos: ${brl(investmentTotal)}`)
    ln(`- Total dívidas/juros: ${brl(debt)}`)
  }

  // Cross-file dedup check
  if (allStats.length === 2) {
    h2('Duplicidades entre arquivos')
    const hashes0 = new Set(allStats[0].allTxns.map(t =>
      `${t.description.toUpperCase()}|${t.amount.toFixed(2)}|${t.date||''}`
    ))
    const crossDups = allStats[1].allTxns.filter(t =>
      hashes0.has(`${t.description.toUpperCase()}|${t.amount.toFixed(2)}|${t.date||''}`)
    )
    if (crossDups.length === 0) {
      ln('✅ Nenhuma duplicidade cruzada detectada entre os dois arquivos.')
    } else {
      ln(`⚠️ ${crossDups.length} transações aparecem nos dois arquivos:`)
      ln(`| Descrição | Valor | Data |`)
      ln(`|---|---|---|`)
      crossDups.slice(0,20).forEach(t => ln(`| ${t.description} | ${brl(t.amount)} | ${t.date||'?'} |`))
    }
  }

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const allStats = []
for (const f of FILES) {
  try {
    const s = analyzeFile(f)
    allStats.push(s)
    console.log(`  → ${s.validRows} valid rows, ${s.duplicateCandidates.length} possible duplicates`)
  } catch(e) {
    console.error(`Failed to read ${f}: ${e.message}`)
  }
}

const report = buildReport(allStats)
const outPath = '/Users/fcrismanis/FINFVC/IMPORT_VALIDATION_REPORT.md'
writeFileSync(outPath, report, 'utf-8')
console.log(`\nReport written to: ${outPath}`)

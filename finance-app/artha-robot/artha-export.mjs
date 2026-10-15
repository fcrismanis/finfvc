// Entra no Artha, exporta os lançamentos (mês atual + N meses anteriores) e salva em OUT_DIR.
// Credenciais SOMENTE por variável de ambiente (ARTHA_EMAIL / ARTHA_PASSWORD).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const { ARTHA_EMAIL, ARTHA_PASSWORD } = process.env
const BASE = process.env.ARTHA_URL ?? 'https://artha.ia.br'
const OUT_DIR = process.env.OUT_DIR ?? './out'
const MONTHS_BACK = Number(process.env.ARTHA_MONTHS_BACK ?? 1)
const DEBUG_DIR = join(OUT_DIR, 'debug')

if (!ARTHA_EMAIL || !ARTHA_PASSWORD) {
  console.error('Defina ARTHA_EMAIL e ARTHA_PASSWORD'); process.exit(2)
}
mkdirSync(OUT_DIR, { recursive: true })

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MES_RE = new RegExp(`^(${MESES.join('|')})\\s+(\\d{4})$`, 'i')

function monthLabel(text) {
  const m = text.trim().toLowerCase().match(MES_RE)
  if (!m) return null
  return `${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, '0')}`
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, locale: 'pt-BR' })
const page = await context.newPage()
page.setDefaultTimeout(30_000)

async function fail(step, err) {
  mkdirSync(DEBUG_DIR, { recursive: true })
  await page.screenshot({ path: join(DEBUG_DIR, `falha-${step}.png`), fullPage: true }).catch(() => {})
  writeFileSync(join(DEBUG_DIR, `falha-${step}.txt`),
    `URL: ${page.url()}\n\n${await page.locator('body').innerText().catch(() => '')}`)
  console.error(`FALHA em "${step}": ${err?.message ?? err}\nEvidência em ${DEBUG_DIR}`)
  await browser.close()
  process.exit(1)
}

try {
  // 1) Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=email]').fill(ARTHA_EMAIL)
  await page.locator('input[type=password]').fill(ARTHA_PASSWORD)
  await page.locator('button[type=submit]').click()
  await page.waitForURL(/\/app\//, { timeout: 45_000 })
} catch (e) { await fail('login', e) }

try {
  await page.goto(`${BASE}/app/lancamentos`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Exportar' }).waitFor()
} catch (e) { await fail('abrir-lancamentos', e) }

const saved = []
for (let i = 0; i <= MONTHS_BACK; i++) {
  let label = `mes-${i}`
  try {
    // botão do período, ex.: "outubro 2026"
    const period = page.getByRole('button', { name: MES_RE })
    if (i > 0) {
      await period.locator('xpath=preceding-sibling::button[1]').click()
      await page.waitForTimeout(1500)
    }
    label = monthLabel(await period.first().innerText()) ?? label
    // espera a lista do mês carregar antes de exportar (senão sai planilha vazia)
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForFunction(() => /Mostrando\s+\d/.test(document.body.innerText) || /Nenhum lançamento/i.test(document.body.innerText), null, { timeout: 20_000 }).catch(() => {})
    let dest = ''
    for (let attempt = 1; attempt <= 2; attempt++) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 45_000 }),
        page.getByRole('button', { name: 'Exportar' }).click(),
      ])
      const ext = extname(download.suggestedFilename()) || '.xlsx'
      dest = join(OUT_DIR, `artha-${label}${ext}`)
      await download.saveAs(dest)
      const kb = statSync(dest).size / 1024
      if (kb >= 20 || attempt === 2) { console.log(`OK ${label} -> ${dest} (${Math.round(kb)} KB, tentativa ${attempt})`); break }
      console.log(`AVISO ${label}: arquivo pequeno (${Math.round(kb)} KB), tentando de novo`)
      await page.waitForTimeout(5000)
    }
    copyFileSync(dest, join(OUT_DIR, i === 0 ? 'artha-atual.xlsx' : 'artha-anterior.xlsx'))
    saved.push(dest)
  } catch (e) { await fail(`exportar-${label}`, e) }
}

await browser.close()
console.log(`Concluído: ${saved.length} arquivo(s) em ${OUT_DIR}`)

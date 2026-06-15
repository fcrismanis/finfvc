#!/usr/bin/env node
/**
 * Captura payload sanitizado de transações Pluggy e grava em tmp/.
 *
 * Uso:
 *   node scripts/debug-pluggy-transactions.mjs \
 *     --accountId=<pluggy_account_id> \
 *     --from=2024-01-01 \
 *     --to=2026-06-15 \
 *     --limit=10
 *
 * Ou com itemId (busca todas as contas do item):
 *   node scripts/debug-pluggy-transactions.mjs --itemId=<pluggy_item_id>
 *
 * Requer o servidor backend rodando em http://localhost:8787
 * Grava: tmp/pluggy-transactions-sample.sanitized.json
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'tmp')
const OUT_FILE = join(OUT_DIR, 'pluggy-transactions-sample.sanitized.json')
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8787'

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=')
    args[k] = v
  }
  return args
}

async function main() {
  const { accountId, itemId, from = '2024-01-01', to = new Date().toISOString().slice(0, 10), limit = '10' } = parseArgs()

  if (!accountId && !itemId) {
    console.error('Erro: --accountId ou --itemId obrigatório')
    process.exit(1)
  }

  console.log(`Chamando ${BACKEND}/api/pluggy/debug-transactions ...`)

  const res = await fetch(`${BACKEND}/api/pluggy/debug-transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, itemId, from, to, limit: Number(limit) }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Erro HTTP ${res.status}:`, text.slice(0, 300))
    process.exit(1)
  }

  const data = await res.json()

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf-8')

  console.log(`\nPayload sanitizado gravado em: tmp/pluggy-transactions-sample.sanitized.json`)
  console.log(`Transações capturadas: ${data.count}`)
  console.log('\nTop-level keys:', data.fieldMap?.topLevelKeys?.join(', ') ?? '—')
  console.log('Category candidates:', data.fieldMap?.possibleCategoryFields?.join(', ') ?? '—')
  console.log('Merchant candidates:', data.fieldMap?.possibleMerchantFields?.join(', ') ?? '—')
  console.log('Status candidates:  ', data.fieldMap?.possibleStatusFields?.join(', ') ?? '—')
  console.log('\nAviso:', data.notice ?? '')
}

main().catch(err => { console.error(err); process.exit(1) })

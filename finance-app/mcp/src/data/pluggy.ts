import { existsSync, readFileSync } from 'node:fs'

/**
 * Cliente Pluggy server-side para o MCP "Economista FIN".
 * Credenciais SOMENTE via variáveis de ambiente — nunca em parâmetros de tool,
 * nunca devolvidas ao modelo.
 */

const API_BASE = () => process.env.PLUGGY_API_BASE_URL ?? 'https://api.pluggy.ai'

// apiKey da Pluggy vale 2h; renovamos antes disso.
let cached: { apiKey: string; expiresAt: number } | null = null

export function pluggyConfigured(): boolean {
  return !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
}

async function getApiKey(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.apiKey
  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Pluggy não configurado: defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no ambiente do MCP.')
  }
  const res = await fetch(`${API_BASE()}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!res.ok) throw new Error(`Autenticação Pluggy falhou (HTTP ${res.status}). Verifique credenciais/trial.`)
  const { apiKey } = (await res.json()) as { apiKey: string }
  cached = { apiKey, expiresAt: Date.now() + 110 * 60 * 1000 }
  return apiKey
}

async function pluggyGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const apiKey = await getApiKey()
  const url = new URL(`${API_BASE()}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } })
  if (res.status === 401 || res.status === 403) cached = null // força reauth na próxima
  if (!res.ok) throw new Error(`Pluggy GET ${path} falhou (HTTP ${res.status})`)
  return (await res.json()) as T
}

/** Item IDs conhecidos: PLUGGY_ITEM_IDS (csv) e/ou backup de conexões do FINFVC. */
export function knownItemIds(): string[] {
  const ids = new Set<string>()
  for (const id of (process.env.PLUGGY_ITEM_IDS ?? '').split(',')) {
    if (id.trim()) ids.add(id.trim())
  }
  const file = process.env.PLUGGY_CONNECTIONS_FILE
  if (file && existsSync(file)) {
    try {
      const conns = JSON.parse(readFileSync(file, 'utf-8')) as Array<{ itemId?: string }>
      for (const c of conns) if (c.itemId && !c.itemId.startsWith('itau_')) ids.add(c.itemId)
    } catch { /* arquivo inválido: ignora */ }
  }
  return [...ids]
}

interface Paged<T> { results?: T[] }

export async function fetchItem(itemId: string) {
  return pluggyGet<any>(`/items/${encodeURIComponent(itemId)}`)
}

export async function fetchAccounts(itemId: string) {
  const data = await pluggyGet<Paged<any>>('/accounts', { itemId })
  return data.results ?? []
}

export async function fetchTransactions(accountId: string, from: string, to: string) {
  const pageSize = 500
  const all: any[] = []
  for (let page = 1; page <= 20; page++) {
    const data = await pluggyGet<Paged<any>>('/transactions', { accountId, from, to, pageSize, page })
    const results = data.results ?? []
    all.push(...results)
    if (results.length < pageSize) break
  }
  return all
}

export async function fetchInvestments(itemId: string) {
  const pageSize = 500
  const all: any[] = []
  for (let page = 1; page <= 20; page++) {
    const data = await pluggyGet<Paged<any>>('/investments', { itemId, pageSize, page })
    const results = data.results ?? []
    all.push(...results)
    if (results.length < pageSize) break
  }
  return all
}

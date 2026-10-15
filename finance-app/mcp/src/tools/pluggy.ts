import {
  pluggyConfigured, knownItemIds,
  fetchItem, fetchAccounts, fetchTransactions, fetchInvestments,
} from '../data/pluggy.js'

/**
 * Tools Pluggy (Open Finance) — SOMENTE LEITURA.
 * Não gravam no ledger do FINFVC: servem para consultar o estado real dos bancos
 * (saldos, faturas, extrato) e comparar com o que está lançado.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertDate(label: string, v: string) {
  if (!DATE_RE.test(v)) throw new Error(`${label} deve estar no formato YYYY-MM-DD`)
}

export async function tool_pluggyStatus() {
  return {
    configured: pluggyConfigured(),
    item_ids_known: knownItemIds().length,
    hint: pluggyConfigured()
      ? undefined
      : 'Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no ambiente do servidor MCP.',
  }
}

export async function tool_pluggyGetItems() {
  const ids = knownItemIds()
  if (ids.length === 0) {
    return { items: [], hint: 'Nenhum item conhecido. Defina PLUGGY_ITEM_IDS (csv) ou PLUGGY_CONNECTIONS_FILE.' }
  }
  const items = await Promise.all(ids.map(async id => {
    try {
      const it = await fetchItem(id)
      return {
        item_id: it.id,
        connector: it.connector?.name ?? null,
        status: it.status,
        execution_status: it.executionStatus ?? null,
        last_updated_at: it.lastUpdatedAt ?? null,
        needs_attention: ['LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT'].includes(it.status),
      }
    } catch (e) {
      return { item_id: id, error: (e as Error).message }
    }
  }))
  return { items }
}

export async function tool_pluggyGetAccounts(input: { item_id?: string }) {
  const ids = input.item_id ? [input.item_id] : knownItemIds()
  if (ids.length === 0) return { accounts: [], hint: 'Informe item_id ou configure PLUGGY_ITEM_IDS.' }
  const accounts: any[] = []
  for (const id of ids) {
    const accs = await fetchAccounts(id)
    for (const a of accs) {
      accounts.push({
        account_id: a.id,
        item_id: a.itemId ?? id,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        balance: a.balance ?? null,
        currency: a.currencyCode ?? 'BRL',
        credit_limit: a.creditData?.creditLimit ?? null,
        available_credit_limit: a.creditData?.availableCreditLimit ?? null,
        bill_close_date: a.creditData?.balanceCloseDate ?? null,
        bill_due_date: a.creditData?.balanceDueDate ?? null,
      })
    }
  }
  return { accounts }
}

export interface PluggyTxInput {
  account_id?: string
  item_id?: string
  from: string
  to: string
  text?: string
  type?: 'DEBIT' | 'CREDIT' | 'any'
  limit?: number
}

export async function tool_pluggyGetTransactions(input: PluggyTxInput) {
  assertDate('from', input.from)
  assertDate('to', input.to)
  if (!input.account_id && !input.item_id) throw new Error('Informe account_id ou item_id')

  const accountIds = input.account_id
    ? [input.account_id]
    : (await fetchAccounts(input.item_id!)).map((a: any) => a.id as string)

  let txs: any[] = []
  for (const accId of accountIds) {
    const list = await fetchTransactions(accId, input.from, input.to)
    txs.push(...list.map(t => ({ ...t, _accountId: accId })))
  }

  if (input.type && input.type !== 'any') txs = txs.filter(t => t.type === input.type)
  if (input.text) {
    const needle = input.text.toLowerCase()
    txs = txs.filter(t => `${t.description ?? ''} ${t.descriptionRaw ?? ''}`.toLowerCase().includes(needle))
  }

  const sum = (type: string) =>
    Math.round(txs.filter(t => t.type === type).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0) * 100) / 100
  const limit = Math.min(input.limit ?? 200, 1000)

  return {
    period: { from: input.from, to: input.to },
    count: txs.length,
    total_credit: sum('CREDIT'),
    total_debit: sum('DEBIT'),
    truncated: txs.length > limit,
    transactions: txs
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        account_id: t._accountId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        status: t.status,
        category: typeof t.category === 'string' ? t.category : t.category?.description ?? null,
        installment: t.creditCardMetadata?.installmentNumber
          ? `${t.creditCardMetadata.installmentNumber}/${t.creditCardMetadata.totalInstallments}`
          : null,
      })),
  }
}

export async function tool_pluggyGetInvestments(input: { item_id?: string }) {
  const ids = input.item_id ? [input.item_id] : knownItemIds()
  if (ids.length === 0) return { investments: [], hint: 'Informe item_id ou configure PLUGGY_ITEM_IDS.' }
  const investments: any[] = []
  for (const id of ids) {
    for (const inv of await fetchInvestments(id)) {
      investments.push({
        id: inv.id,
        item_id: id,
        name: inv.name ?? inv.code ?? 'Investimento',
        type: inv.type ?? null,
        subtype: inv.subtype ?? null,
        balance: inv.balance ?? inv.value ?? 0,
        annual_rate: inv.annualRate ?? null,
        due_date: inv.dueDate ?? null,
        issuer: inv.issuer ?? null,
      })
    }
  }
  const total = Math.round(investments.reduce((s, i) => s + (i.balance ?? 0), 0) * 100) / 100
  return { total_balance: total, investments }
}

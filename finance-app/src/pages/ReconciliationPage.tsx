import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Landmark, RefreshCw, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { formatMonthLabel, prevMonth, nextMonth, formatFinancialDateBR } from '../utils/date'
import { getLocalConnections, withItauAnchor, fetchPluggyTransactions } from '../services/pluggy.service'
import { ITAU_ANCHOR, ITAU_ANCHOR_ID } from '../config/bankTruth'
import { getOpeningBalance, getBalanceAt } from '../services/openingBalance.service'
import type { Transaction } from '../types'
import {
  reconcileAccount,
  quickAccountSummary,
  normalizeBankTxns,
  type ReconPeriod,
  type ReconStatus,
  type ReconciliationReport,
} from '../services/bankReconciliation.service'

interface Props {
  selectedMonth: string
}

interface FlatAccount {
  id: string
  itemId: string
  name: string
  type: 'BANK' | 'CREDIT'
  balance: number | null
  lastSyncAt?: string | null
}

function monthToPeriod(month: string): ReconPeriod {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}`, label: formatMonthLabel(month) }
}

const STATUS_META: Record<ReconStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  reconciled: { label: 'Conciliado', color: '#067647', bg: '#ECFDF3', Icon: CheckCircle2 },
  warning:    { label: 'Atenção',    color: '#B54708', bg: '#FFFAEB', Icon: AlertCircle },
  critical:   { label: 'Crítico',    color: '#B42318', bg: '#FEF3F2', Icon: AlertTriangle },
}

function StatusPill({ status }: { status: ReconStatus }) {
  const m = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: m.bg, color: m.color, fontWeight: 700, fontSize: 12,
      padding: '3px 9px', borderRadius: 999,
    }}>
      <m.Icon size={13} /> {m.label}
    </span>
  )
}

export function ReconciliationPage({ selectedMonth }: Props) {
  const { transactions } = useData()
  const [month, setMonth] = useState(selectedMonth)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reports, setReports] = useState<Record<string, ReconciliationReport>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const period = useMemo(() => monthToPeriod(month), [month])

  const accounts = useMemo<FlatAccount[]>(() => {
    return withItauAnchor(getLocalConnections()).flatMap(conn =>
      conn.accounts.map(a => ({
        id: a.id,
        itemId: a.itemId,
        name: a.displayName ?? a.name,
        type: a.type,
        balance: a.balance ?? a.availableBalance ?? null,
        lastSyncAt: a.lastSyncAt ?? a.lastUpdatedAt,
      })),
    )
  }, [])

  const summaries = useMemo(
    () => accounts.map(a => {
      const opening = getOpeningBalance(a.id, period.from)
      // Saldo banco do mês = saldo conhecido no fim do período (checkpoint/cravado),
      // senão o saldo atual da conta.
      const bankBal = getBalanceAt(a.id, period.to)?.balance ?? a.balance
      return {
        account: a,
        opening,
        summary: quickAccountSummary(a.id, transactions, bankBal, period, opening?.balance ?? null),
      }
    }),
    [accounts, transactions, period],
  )

  const detail = useCallback(async (acc: FlatAccount) => {
    if (expanded === acc.id) { setExpanded(null); return }
    setExpanded(acc.id)
    if (reports[acc.id]) return
    // Anchor = extrato master; no per-transaction bank feed to reconcile against.
    if (acc.id === ITAU_ANCHOR_ID) {
      setErrors(e => ({
        ...e,
        [acc.id]: `Saldo master do extrato Itaú: ${ITAU_ANCHOR.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${ITAU_ANCHOR.asOf}). Conecte o Itaú real via Open Finance para reconciliar lançamento a lançamento.`,
      }))
      return
    }
    setBusy(acc.id)
    setErrors(e => { const n = { ...e }; delete n[acc.id]; return n })
    try {
      const raw = await fetchPluggyTransactions({ accountId: acc.id, from: period.from, to: period.to })
      const bankTxns = normalizeBankTxns(raw)
      const report = reconcileAccount({
        accountId: acc.id,
        period,
        bankTxns,
        finTxns: transactions,
        bankBalance: getBalanceAt(acc.id, period.to)?.balance ?? acc.balance,
        openingBalance: getOpeningBalance(acc.id, period.from)?.balance ?? null,
      })
      setReports(r => ({ ...r, [acc.id]: report }))
    } catch (err) {
      setErrors(e => ({ ...e, [acc.id]: err instanceof Error ? err.message : 'Falha ao buscar dados do banco.' }))
    } finally {
      setBusy(null)
    }
  }, [expanded, reports, period, transactions])

  // reset cached reports when month changes
  const monthKey = period.from
  useMemo(() => { setReports({}); setExpanded(null); setErrors({}) }, [monthKey])

  return (
    <main className="page-shell" style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink, #101828)', letterSpacing: '-0.02em' }}>
            Reconciliação Bancária
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft, #667085)', marginTop: 2 }}>
            Compara saldo do banco × saldo do FIN. Clique em Detalhar para ver entradas, saídas e faltantes.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setMonth(prevMonth(month))} className="icon-btn" aria-label="Mês anterior"
            style={{ border: '1px solid var(--border-card, #EAECF0)', borderRadius: 8, padding: 6, background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, minWidth: 120, textAlign: 'center' }}>{formatMonthLabel(month)}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="icon-btn" aria-label="Próximo mês"
            style={{ border: '1px solid var(--border-card, #EAECF0)', borderRadius: 8, padding: 6, background: '#fff', cursor: 'pointer' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {accounts.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--faint)', background: 'var(--well)', borderRadius: 12, border: '1px solid var(--line)' }}>
          <Landmark size={32} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>Nenhuma conta conectada</p>
          <p style={{ fontSize: 13, color: 'var(--faint)', maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.6 }}>
            A reconciliação compara os lançamentos do FIN com os dados reais do banco via Pluggy.
            Conecte suas contas em <strong>Sistema → Importação & Pluggy</strong> para ativar.
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', fontStyle: 'italic' }}>
            Apenas diagnóstico — nenhuma alteração nos dados.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {summaries.map(({ account, summary, opening }) => {
          const report = reports[account.id]
          const status = report?.status ?? summary.status
          const isOpen = expanded === account.id
          return (
            <div key={account.id} style={{ border: '1px solid var(--border-card, #EAECF0)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--well, #F2F4F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={17} color="#475467" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #101828)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--ink-soft, #98A2B3)' }}>{account.type === 'CREDIT' ? 'Cartão' : 'Conta'}{account.lastSyncAt ? ` · sync ${formatFinancialDateBR(account.lastSyncAt.slice(0, 10))}` : ''}</p>
                  </div>
                </div>

                <Metric
                  label="Abertura"
                  value={opening?.balance ?? null}
                  title={opening ? `Saldo em ${formatFinancialDateBR(opening.point.date)} (${opening.point.source})` : 'Sem saldo de abertura — sincronize ou importe um extrato de fim de mês'}
                />
                <Metric label="Saldo banco" value={summary.saldoBanco} />
                <Metric label="Saldo FIN" value={summary.saldoFIN} />
                <Metric label="Diferença" value={summary.diferenca} highlight />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <StatusPill status={status} />
                  <button onClick={() => detail(account)}
                    style={{ border: '1px solid var(--border-card, #EAECF0)', borderRadius: 8, padding: '6px 12px', background: isOpen ? 'var(--well, #F2F4F7)' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {busy === account.id ? <RefreshCw size={13} className="spin" /> : null}
                    {isOpen ? 'Ocultar' : 'Detalhar'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-card, #EAECF0)', padding: '14px 16px', background: 'var(--well, #FCFCFD)' }}>
                  {busy === account.id && <p style={{ fontSize: 13, color: 'var(--ink-soft, #667085)' }}>Buscando lançamentos do banco…</p>}
                  {errors[account.id] && (
                    <p style={{ fontSize: 13, color: '#B42318', background: '#FEF3F2', padding: 10, borderRadius: 8 }}>
                      {errors[account.id]}
                    </p>
                  )}
                  {report && <ReportDetail report={report} />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <CardInvoiceReconciliation transactions={transactions} accounts={accounts} period={period} />

      <p style={{ fontSize: 11, color: 'var(--ink-soft, #98A2B3)', marginTop: 18, lineHeight: 1.5 }}>
        Apenas diagnóstico — nenhuma alteração de dados é feita. <strong>Saldo FIN = abertura
        (último dia do mês anterior) + fluxo do período.</strong> A abertura vem dos relatórios
        (extrato ou saldo Pluggy de fim de mês) e é cravada quando obtida. Contas sem abertura
        conhecida caem no cálculo desde o zero e não batem com o banco.
      </p>
    </main>
  )
}

// ── Cartão: cruza fatura (gasto no cartão) × pagamento (Neutra > Pagamento de Cartão) ──
// Diagnóstico apenas. Pagamento e fatura podem cair em meses diferentes (você paga a
// fatura do mês anterior), por isso a divergência é informativa, não uma correção.
const PAG_CARTAO_SUBCAT = 'cat_pag_cartao'

function CardInvoiceReconciliation({ transactions, accounts, period }: {
  transactions: Transaction[]
  accounts: FlatAccount[]
  period: ReconPeriod
}) {
  const data = useMemo(() => {
    const inP = (t: Transaction) => {
      const d = (t.competenceDate || t.transactionDate || '').slice(0, 10)
      return d >= period.from && d <= period.to && t.status !== 'cancelled'
    }
    const cards = accounts.filter(a => a.type === 'CREDIT')
    const payments = transactions.filter(t =>
      inP(t) && (t.categoryId === PAG_CARTAO_SUBCAT || t.subCategoryId === PAG_CARTAO_SUBCAT)
    )
    const totalPayments = payments.reduce((s, t) => s + Math.abs(t.amount), 0)

    const perCard = cards.map(c => {
      const spend = transactions.filter(t =>
        inP(t) && t.accountId === c.id && t.type === 'expense' && t.classificationType !== 'neutral'
      )
      return { card: c, fatura: spend.reduce((s, t) => s + Math.abs(t.amount), 0), count: spend.length }
    })
    const totalFaturas = perCard.reduce((s, c) => s + c.fatura, 0)

    const warnings: string[] = []
    if (totalPayments > 1 && totalFaturas <= 1) warnings.push('Pagamento de cartão sem fatura correspondente no período.')
    if (totalFaturas > 1 && totalPayments <= 1) warnings.push('Fatura de cartão sem pagamento correspondente no período.')

    return { cards, payments, totalPayments, perCard, totalFaturas, diff: totalPayments - totalFaturas, warnings }
  }, [transactions, accounts, period])

  if (data.cards.length === 0 && data.payments.length === 0) return null

  return (
    <div style={{ marginTop: 22, border: '1px solid var(--border-card, #EAECF0)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-card, #EAECF0)' }}>
        <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #101828)' }}>Conciliação de cartões</p>
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft, #98A2B3)', marginTop: 2 }}>
          Fatura (gasto no cartão) × pagamento (Neutra › Pagamento de Cartão). Podem cair em meses diferentes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '14px 16px', flexWrap: 'wrap', borderBottom: data.perCard.length ? '1px solid var(--border-card, #F2F4F7)' : undefined }}>
        <Metric label="Faturas (gasto)" value={data.totalFaturas} />
        <Metric label="Pagamentos" value={data.totalPayments} />
        <Metric label="Divergência" value={data.diff} highlight />
      </div>

      {data.perCard.map(({ card, fatura, count }) => (
        <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 16px', fontSize: 12.5, borderBottom: '1px solid var(--border-card, #F2F4F7)' }}>
          <span style={{ color: 'var(--ink-soft, #667085)', fontWeight: 600 }}>{card.name} <span style={{ color: 'var(--ink-soft, #98A2B3)', fontWeight: 400 }}>· {count} lanç.</span></span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{formatBRL(fatura)}</span>
        </div>
      ))}

      {data.payments.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-card, #F2F4F7)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-soft, #98A2B3)', marginBottom: 6 }}>Pagamentos de cartão ({data.payments.length})</p>
          {data.payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', fontSize: 12.5 }}>
              <span style={{ color: 'var(--ink-soft, #667085)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(p.competenceDate || p.transactionDate || '').slice(0, 10)} · {p.description}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{formatBRL(Math.abs(p.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {data.warnings.length > 0 && (
        <div style={{ padding: '10px 16px' }}>
          {data.warnings.map((w, i) => (
            <p key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#B42318', background: '#FEF3F2', padding: '8px 10px', borderRadius: 8, marginTop: i ? 6 : 0 }}>
              <AlertTriangle size={14} /> {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, highlight, title }: { label: string; value: number | null; highlight?: boolean; title?: string }) {
  const txt = value === null ? '—' : formatBRL(value)
  const color = highlight && value !== null && Math.abs(value) > 1 ? '#B54708' : 'var(--ink, #101828)'
  return (
    <div style={{ flex: '0 0 auto', minWidth: 96 }} title={title}>
      <p style={{ fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft, #98A2B3)', fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{txt}</p>
    </div>
  )
}

function FlowRow({ label, banco, fin }: { label: string; banco: number; fin: number }) {
  const diff = banco - fin
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border-card, #F2F4F7)', fontSize: 13 }}>
      <span style={{ color: 'var(--ink-soft, #667085)', fontWeight: 600 }}>{label}</span>
      <span style={{ display: 'flex', gap: 18, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ minWidth: 100, textAlign: 'right' }}>{formatBRL(banco)}</span>
        <span style={{ minWidth: 100, textAlign: 'right' }}>{formatBRL(fin)}</span>
        <span style={{ minWidth: 100, textAlign: 'right', fontWeight: 700, color: Math.abs(diff) > 0.01 ? '#B42318' : '#067647' }}>{formatBRL(diff)}</span>
      </span>
    </div>
  )
}

function ReportDetail({ report }: { report: ReconciliationReport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft, #98A2B3)', paddingBottom: 4 }}>
          <span>Fluxo</span>
          <span style={{ display: 'flex', gap: 18 }}>
            <span style={{ minWidth: 100, textAlign: 'right' }}>Banco</span>
            <span style={{ minWidth: 100, textAlign: 'right' }}>FIN</span>
            <span style={{ minWidth: 100, textAlign: 'right' }}>Diferença</span>
          </span>
        </div>
        <FlowRow label="Entradas" banco={report.entradasBanco} fin={report.entradasFIN} />
        <FlowRow label="Saídas" banco={report.saidasBanco} fin={report.saidasFIN} />
      </div>

      {report.notes.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-soft, #475467)', lineHeight: 1.6 }}>
          {report.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}

      <DetailGroup title="Faltantes (no banco, ausentes no FIN)" count={report.missing.length}>
        {report.missing.map(b => (
          <Line key={b.id} date={b.date} desc={b.description} amount={(b.direction === 'in' ? 1 : -1) * b.amountAbs} tag={b.status === 'pending' ? 'pendente' : undefined} />
        ))}
      </DetailGroup>

      <DetailGroup title="Extras (no FIN, sem correspondência no banco)" count={report.extra.length}>
        {report.extra.map(t => (
          <Line key={t.id} date={(t.transactionDate || t.competenceDate).slice(0, 10)} desc={t.description} amount={(t.type === 'income' ? 1 : -1) * t.amount} />
        ))}
      </DetailGroup>

      <DetailGroup title="Data divergente" count={report.dateMismatches.length}>
        {report.dateMismatches.map(p => (
          <Line key={p.fin.id} date={p.bank.date} desc={p.bank.description}
            amount={(p.bank.direction === 'in' ? 1 : -1) * p.bank.amountAbs}
            tag={`FIN: ${(p.fin.transactionDate || p.fin.competenceDate).slice(0, 10)} (${p.dateDiffDays}d)`} />
        ))}
      </DetailGroup>

      <DetailGroup title="Prováveis duplicados no FIN" count={report.probableDuplicates.length}>
        {report.probableDuplicates.map(t => (
          <Line key={t.id} date={(t.transactionDate || t.competenceDate).slice(0, 10)} desc={t.description} amount={(t.type === 'income' ? 1 : -1) * t.amount} />
        ))}
      </DetailGroup>
    </div>
  )
}

function DetailGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink, #344054)', marginBottom: 4 }}>
        {title} <span style={{ color: count > 0 ? '#B42318' : '#067647' }}>({count})</span>
      </p>
      {count > 0 && <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>}
    </div>
  )
}

function Line({ date, desc, amount, tag }: { date: string; desc: string; amount: number; tag?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12.5, borderBottom: '1px solid var(--border-card, #F2F4F7)' }}>
      <span style={{ color: 'var(--ink-soft, #98A2B3)', minWidth: 78, fontVariantNumeric: 'tabular-nums' }}>{formatFinancialDateBR(date)}</span>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</span>
      {tag && <span style={{ fontSize: 10, fontWeight: 700, color: '#B54708', background: '#FFFAEB', padding: '1px 6px', borderRadius: 4 }}>{tag}</span>}
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: amount < 0 ? '#B42318' : '#067647', minWidth: 96, textAlign: 'right' }}>{formatBRL(amount)}</span>
    </div>
  )
}

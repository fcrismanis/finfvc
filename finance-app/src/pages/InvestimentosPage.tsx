import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { getLocalConnections } from '../services/pluggy.service'
import { fetchPluggyInvestments, type PluggyInvestment } from '../services/pluggy.service'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth, formatFinancialDateBR } from '../utils/date'
import { ICON_MAP } from '../utils/categoryIcons'

function fmtPct(v: number | null) {
  if (v == null) return '—'
  return (v * 100).toFixed(2).replace('.', ',') + '%'
}

const TYPE_LABEL: Record<string, string> = {
  MUTUAL_FUND:      'Fundo de Investimento',
  SECURITY:         'Título',
  EQUITY:           'Ações',
  FIXED_INCOME:     'Renda Fixa',
  ETF:              'ETF',
  COE:              'COE',
  REAL_ESTATE:      'FII',
  TREASURE:         'Tesouro Direto',
  OTHER:            'Outro',
}

export function InvestimentosPage() {
  const { transactions } = useData()
  const allMacros = useMemo(() => getAllMacroCategories(), [])

  // ── Pluggy assets ──────────────────────────────────────────────────────────
  const connections = useMemo(() => getLocalConnections(), [])
  const [pluggyInvestments, setPluggyInvestments] = useState<PluggyInvestment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  async function loadInvestments() {
    if (connections.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(connections.map(c => fetchPluggyInvestments(c.itemId)))
      setPluggyInvestments(results.flat())
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar investimentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInvestments() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPluggyBalance = pluggyInvestments.reduce((s, i) => s + (i.balance ?? 0), 0)
  const totalPluggyProfit  = pluggyInvestments.reduce((s, i) => s + (i.amountProfit ?? 0), 0)

  // group by type
  const byType = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>()
    for (const inv of pluggyInvestments) {
      const key = inv.type ?? 'OTHER'
      const label = TYPE_LABEL[key] ?? key
      if (!map.has(key)) map.set(key, { label, total: 0, count: 0 })
      const entry = map.get(key)!
      entry.total += inv.balance ?? 0
      entry.count++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [pluggyInvestments])

  // ── Transactions (aportes/resgates) ────────────────────────────────────────
  const investTxs = useMemo(() =>
    transactions
      .filter(tx => tx.classificationType === 'investment' && tx.status !== 'cancelled')
      .sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)),
    [transactions]
  )

  const redemptionTxs = useMemo(() =>
    transactions
      .filter(tx => tx.classificationType === 'redemption' && tx.status !== 'cancelled')
      .sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)),
    [transactions]
  )

  const totalInvested  = investTxs.reduce((s, tx) => s + tx.amount, 0)
  const totalRedeemed  = redemptionTxs.reduce((s, tx) => s + tx.amount, 0)
  const netInvested    = totalInvested - totalRedeemed

  const byMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of investTxs) {
      const m = getCompetenceMonth(tx.competenceDate)
      map.set(m, (map.get(m) ?? 0) + tx.amount)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  }, [investTxs])

  const byMacro = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string; total: number }>()
    for (const tx of investTxs) {
      const macro = allMacros.find(m => m.id === tx.macroCategoryId)
      const key = tx.macroCategoryId ?? '__none'
      if (!map.has(key)) {
        map.set(key, { name: macro?.name ?? 'Sem categoria', color: macro?.color ?? '#9CA3AF', icon: macro?.icon ?? '', total: 0 })
      }
      map.get(key)!.total += tx.amount
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [investTxs, allMacros])

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Investimentos</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Carteira via Pluggy · aportes e resgates nos lançamentos
            </div>
          </div>
          {connections.length > 0 && (
            <button
              onClick={loadInvestments}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          )}
        </div>

        {/* ── Pluggy assets section ── */}
        {connections.length === 0 ? (
          <div className="card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, color: 'var(--faint)' }}>
            <TrendingUp size={18} style={{ flexShrink: 0, opacity: 0.4 }} />
            Nenhum banco conectado via Pluggy. Conecte em <strong style={{ color: 'var(--accent)', cursor: 'pointer' }}>Pluggy</strong> para ver sua carteira automaticamente.
          </div>
        ) : error ? (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--crit-soft)', border: '1px solid var(--crit)', fontSize: 12.5, color: 'var(--crit)' }}>
            {error}
          </div>
        ) : (
          <>
            {/* KPIs pluggy */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <KpiCard label="Saldo total" value={totalPluggyBalance} color="var(--pos)" loading={loading} />
              <KpiCard label="Rendimento" value={totalPluggyProfit} color={totalPluggyProfit >= 0 ? 'var(--pos)' : 'var(--crit)'} loading={loading} />
              <div className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Ativos</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>
                  {loading ? '…' : pluggyInvestments.length}
                </p>
                {lastFetched && (
                  <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>
                    atualizado {lastFetched.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>

            {pluggyInvestments.length === 0 && !loading ? (
              <div className="card" style={{ padding: '28px 22px', textAlign: 'center', color: 'var(--faint)', fontSize: 12.5 }}>
                Nenhum ativo de investimento encontrado nas conexões Pluggy.
              </div>
            ) : (
              <>
                {/* By type breakdown */}
                {byType.length > 0 && (
                  <div className="card" style={{ padding: '18px 22px' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Por tipo</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {byType.map(t => {
                        const pct = totalPluggyBalance > 0 ? (t.total / totalPluggyBalance) * 100 : 0
                        return (
                          <div key={t.label}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                                {t.label} <span style={{ fontWeight: 400, color: 'var(--faint)', fontSize: 11 }}>({t.count})</span>
                              </span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatBRL(t.total)}
                              </span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: 'var(--well)' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: 'var(--accent)' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Assets table */}
                <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Carteira Pluggy</h3>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: 'var(--well)' }}>
                        <th className="table-th">Ativo</th>
                        <th className="table-th">Tipo</th>
                        <th className="table-th" style={{ textAlign: 'right' }}>Saldo</th>
                        <th className="table-th" style={{ textAlign: 'right' }}>Rendimento</th>
                        <th className="table-th" style={{ textAlign: 'right' }}>12 meses</th>
                        <th className="table-th">Venc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pluggyInvestments.map(inv => (
                        <tr key={inv.id} className="table-row">
                          <td className="table-td">
                            <p style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{inv.name}</p>
                            {inv.code && inv.code !== inv.name && (
                              <p style={{ fontSize: 10, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>{inv.code}</p>
                            )}
                            {inv.issuer && (
                              <p style={{ fontSize: 10, color: 'var(--faint)' }}>{inv.issuer}</p>
                            )}
                          </td>
                          <td className="table-td">
                            {inv.type && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--well)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                                {TYPE_LABEL[inv.type] ?? inv.type}
                              </span>
                            )}
                          </td>
                          <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13, color: 'var(--pos)' }}>
                            {formatBRL(inv.balance)}
                          </td>
                          <td className="table-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: (inv.amountProfit ?? 0) >= 0 ? 'var(--pos)' : 'var(--crit)' }}>
                            {inv.amountProfit != null ? formatBRL(inv.amountProfit) : '—'}
                          </td>
                          <td className="table-td" style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-2)' }}>
                            {fmtPct(inv.lastTwelveMonthsRate)}
                          </td>
                          <td className="table-td" style={{ fontSize: 11, color: 'var(--faint)' }}>
                            {inv.dueDate ? formatFinancialDateBR(inv.dueDate) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Aportes / Resgates (transactions) ── */}
        <div style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', marginBottom: 12 }}>Aportes & Resgates</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KpiCard label="Total aportado" value={totalInvested} color="var(--ink)" />
            <KpiCard label="Total resgatado" value={totalRedeemed} color="var(--warn)" />
            <KpiCard label="Aporte líquido" value={netInvested} color="var(--pos)" />
          </div>

          {investTxs.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--faint)', fontSize: 12.5 }}>
              Nenhum lançamento de investimento registrado.
            </div>
          ) : (
            <>
              {byMacro.length > 0 && (
                <div className="card" style={{ padding: '18px 22px', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Por categoria</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {byMacro.map(cat => {
                      const Ic = cat.icon ? (ICON_MAP[cat.icon] ?? null) : null
                      const pct = totalInvested > 0 ? (cat.total / totalInvested) * 100 : 0
                      return (
                        <div key={cat.name}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                              {Ic && <Ic size={13} color={cat.color} strokeWidth={2} />}
                              {cat.name}
                            </span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                              {formatBRL(cat.total)}
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--well)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: cat.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {byMonth.length > 0 && (
                <div className="card" style={{ padding: '18px 22px', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Aportes mensais</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {byMonth.map(([m, total]) => (
                      <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{m}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Lançamentos de investimento</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--well)' }}>
                      <th className="table-th">Descrição</th>
                      <th className="table-th">Competência</th>
                      <th className="table-th" style={{ textAlign: 'right' }}>Valor</th>
                      <th className="table-th">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investTxs.slice(0, 50).map(tx => (
                      <tr key={tx.id} className="table-row">
                        <td className="table-td" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{tx.description}</td>
                        <td className="table-td" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{formatFinancialDateBR(tx.competenceDate)}</td>
                        <td className="table-td" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--pos)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatBRL(tx.amount)}
                        </td>
                        <td className="table-td">
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--pos-soft)', color: 'var(--pos)' }}>
                            aporte
                          </span>
                        </td>
                      </tr>
                    ))}
                    {redemptionTxs.slice(0, 20).map(tx => (
                      <tr key={tx.id} className="table-row">
                        <td className="table-td" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{tx.description}</td>
                        <td className="table-td" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{formatFinancialDateBR(tx.competenceDate)}</td>
                        <td className="table-td" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatBRL(tx.amount)}
                        </td>
                        <td className="table-td">
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--warn-soft, #fef3c7)', color: 'var(--warn)' }}>
                            resgate
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  )
}

function KpiCard({ label, value, color, loading }: { label: string; value: number; color: string; loading?: boolean }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '…' : formatBRL(value)}
      </p>
    </div>
  )
}

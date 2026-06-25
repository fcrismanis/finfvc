import { useMemo, useState, useEffect } from 'react'
import { CreditCard, Plus, Pencil, Trash2, CircleDollarSign } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { getCompetenceMonth, currentYearMonth, formatFinancialDateBR } from '../utils/date'
import {
  getFinanciamentos, addFinanciamento, updateFinanciamento, deleteFinanciamento,
  saldoRestante, STATUS_LABEL, STATUS_COLOR,
  type Financiamento, type FinanciamentoStatus,
} from '../services/financiamentos.service'

export function DividasPage() {
  const { transactions } = useData()

  // ── Financiamentos geridos manualmente ─────────────────────────────────────
  const [financiamentos, setFinanciamentos] = useState<Financiamento[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyFinForm())

  useEffect(() => { setFinanciamentos(getFinanciamentos()) }, [])

  function openNew() { setEditingId(null); setForm(emptyFinForm()); setModalOpen(true) }
  function openEdit(f: Financiamento) {
    setEditingId(f.id)
    setForm({
      nome: f.nome, credor: f.credor ?? '',
      valorTotal: f.valorTotal, valorPago: f.valorPago,
      parcelasTotal: f.parcelasTotal, parcelasPagas: f.parcelasPagas,
      parcelaValor: f.parcelaValor ?? 0,
      diaVencimento: f.diaVencimento != null ? String(f.diaVencimento) : '',
      taxaJuros: f.taxaJuros != null ? String(f.taxaJuros) : '',
      recorrente: f.recorrente, status: f.status, descricao: f.descricao ?? '',
    })
    setModalOpen(true)
  }

  function handleSaveFin() {
    if (!form.nome.trim()) return
    const payload = {
      nome: form.nome.trim(),
      credor: form.credor.trim() || undefined,
      valorTotal: form.valorTotal,
      valorPago: form.valorPago,
      parcelasTotal: form.parcelasTotal,
      parcelasPagas: form.parcelasPagas,
      parcelaValor: form.parcelaValor || undefined,
      diaVencimento: form.diaVencimento ? Number(form.diaVencimento) : undefined,
      taxaJuros: form.taxaJuros ? Number(form.taxaJuros) : undefined,
      recorrente: form.recorrente,
      status: form.status,
      descricao: form.descricao.trim() || undefined,
    }
    if (editingId) {
      updateFinanciamento(editingId, payload)
      setFinanciamentos(prev => prev.map(f => (f.id === editingId ? { ...f, ...payload } : f)))
    } else {
      const novo = addFinanciamento(payload)
      setFinanciamentos(prev => [...prev, novo])
    }
    setModalOpen(false); setEditingId(null)
  }

  function handleDeleteFin(id: string) {
    deleteFinanciamento(id)
    setFinanciamentos(prev => prev.filter(f => f.id !== id))
  }

  // Registrar pagamento de 1 parcela: soma ao valor pago e avança a parcela.
  function registrarPagamento(f: Financiamento) {
    const inc = f.parcelaValor ?? 0
    const valorPago = Math.min(f.valorTotal, f.valorPago + inc)
    const parcelasPagas = Math.min(f.parcelasTotal || Infinity, f.parcelasPagas + 1)
    const quitado = (f.parcelasTotal > 0 && parcelasPagas >= f.parcelasTotal) || valorPago >= f.valorTotal
    const status: FinanciamentoStatus = quitado ? 'quitado' : f.status
    const patch = { valorPago, parcelasPagas, status }
    updateFinanciamento(f.id, patch)
    setFinanciamentos(prev => prev.map(x => (x.id === f.id ? { ...x, ...patch } : x)))
  }

  function setFinField<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const totalFinSaldo = financiamentos.filter(f => f.status !== 'quitado').reduce((s, f) => s + saldoRestante(f), 0)

  const debtTxs = useMemo(() =>
    transactions
      .filter(tx => tx.classificationType === 'debt_cost' && tx.status !== 'cancelled')
      .sort((a, b) => b.competenceDate.localeCompare(a.competenceDate)),
    [transactions]
  )

  const currentMonth = currentYearMonth()
  const thisMonth = debtTxs.filter(tx => getCompetenceMonth(tx.competenceDate) === currentMonth)
  const pendingTxs = debtTxs.filter(tx => tx.status === 'pending')
  const totalDebt = debtTxs.reduce((s, tx) => s + tx.amount, 0)
  const totalPending = pendingTxs.reduce((s, tx) => s + tx.amount, 0)
  const totalThisMonth = thisMonth.reduce((s, tx) => s + tx.amount, 0)

  // Group installments by description stem
  const installmentGroups = useMemo(() => {
    const pending = debtTxs.filter(tx => tx.installmentTotal && tx.installmentTotal > 1)
    const map = new Map<string, typeof pending>()
    for (const tx of pending) {
      const key = tx.description.replace(/\s*\d+\/\d+\s*$/, '').trim()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    }
    return Array.from(map.entries())
      .map(([name, txs]) => ({
        name,
        txs: txs.sort((a, b) => (a.installmentCurrent ?? 0) - (b.installmentCurrent ?? 0)),
        total: txs.reduce((s, t) => s + t.amount, 0),
        maxInstallment: Math.max(...txs.map(t => t.installmentTotal ?? 1)),
      }))
      .filter(g => g.txs.length > 0)
      .sort((a, b) => b.total - a.total)
  }, [debtTxs])

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Financiamentos / Dívidas</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Financiamentos cadastrados + custo de dívida nos lançamentos</div>
          </div>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '8px 14px' }} onClick={openNew}>
            <Plus size={14} /> Novo financiamento
          </button>
        </div>

        {/* ── Financiamentos geridos ── */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: financiamentos.length ? 14 : 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>
              Financiamentos
              {financiamentos.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--faint)', marginLeft: 8 }}>
                  · saldo restante {formatBRL(totalFinSaldo)}
                </span>
              )}
            </h3>
          </div>
          {financiamentos.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '14px 0' }}>
              Nenhum financiamento cadastrado. Use "Novo financiamento" para registrar valor total, parcelas e vencimento.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {financiamentos.map(f => (
                <FinanciamentoCard key={f.id} fin={f} onEdit={openEdit} onDelete={handleDeleteFin} onPay={registrarPagamento} />
              ))}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="card" style={{ padding: '16px 18px', border: totalThisMonth > 0 ? '1px solid var(--crit)40' : undefined }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Este mês</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: totalThisMonth > 0 ? 'var(--crit)' : 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalThisMonth)}
            </p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Pendente</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: totalPending > 0 ? 'var(--warn)' : 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalPending)}
            </p>
          </div>
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Total histórico</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {formatBRL(totalDebt)}
            </p>
          </div>
        </div>

        {debtTxs.length === 0 ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <CreditCard size={32} style={{ margin: '0 auto 12px', color: 'var(--pos)' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Sem dívidas registradas</p>
            <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 280, margin: '0 auto' }}>
              Lançamentos classificados como "Custo de dívida" aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Installment groups */}
            {installmentGroups.length > 0 && (
              <div className="card" style={{ padding: '18px 22px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Parcelamentos ativos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {installmentGroups.map(group => {
                    const lastTx = group.txs[group.txs.length - 1]
                    const current = lastTx?.installmentCurrent ?? 0
                    const total = group.maxInstallment
                    const pct = total > 0 ? (current / total) * 100 : 0
                    return (
                      <div key={group.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{group.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>{current}/{total} parcelas</span>
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                            {formatBRL(lastTx?.amount ?? 0)}/mês
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

            {/* Pending debts */}
            {pendingTxs.length > 0 && (
              <div className="card" style={{ padding: '18px 22px', border: '1px solid var(--warn)30' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Pendentes a pagar</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingTxs.map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{tx.description}</span>
                        <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 8 }}>{formatFinancialDateBR(tx.competenceDate)}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatBRL(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Histórico de dívidas</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--well)' }}>
                    <th className="table-th">Descrição</th>
                    <th className="table-th">Data</th>
                    <th className="table-th" style={{ textAlign: 'right' }}>Valor</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {debtTxs.slice(0, 50).map(tx => (
                    <tr key={tx.id} className="table-row">
                      <td className="table-td" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                        {tx.description}
                        {tx.installmentCurrent && tx.installmentTotal && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {tx.installmentCurrent}/{tx.installmentTotal}
                          </span>
                        )}
                      </td>
                      <td className="table-td" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{formatFinancialDateBR(tx.competenceDate)}</td>
                      <td className="table-td" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatBRL(tx.amount)}
                      </td>
                      <td className="table-td">
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: tx.status === 'pending' ? 'var(--warn-soft, #fef3c7)' : 'var(--well)',
                          color: tx.status === 'pending' ? 'var(--warn)' : 'var(--faint)',
                        }}>
                          {tx.status === 'pending' ? 'pendente' : 'pago'}
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

      {/* Modal financiamento */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setModalOpen(false); setEditingId(null) } }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: '26px 26px 22px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>
              {editingId ? 'Editar financiamento' : 'Novo financiamento'}
            </h2>

            <FinField label="Nome">
              <input className="input" placeholder="Ex: Financiamento do carro" value={form.nome} onChange={e => setFinField('nome', e.target.value)} />
            </FinField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FinField label="Credor (opcional)">
                <input className="input" placeholder="Ex: Banco Itaú" value={form.credor} onChange={e => setFinField('credor', e.target.value)} />
              </FinField>
              <FinField label="Status">
                <select className="input" value={form.status} onChange={e => setFinField('status', e.target.value as FinanciamentoStatus)}>
                  {(Object.keys(STATUS_LABEL) as FinanciamentoStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </FinField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FinField label="Valor total">
                <input className="input" type="number" min={0} value={form.valorTotal} onChange={e => setFinField('valorTotal', parseFloat(e.target.value) || 0)} />
              </FinField>
              <FinField label="Valor pago">
                <input className="input" type="number" min={0} value={form.valorPago} onChange={e => setFinField('valorPago', parseFloat(e.target.value) || 0)} />
              </FinField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FinField label="Parcelas (total)">
                <input className="input" type="number" min={0} value={form.parcelasTotal} onChange={e => setFinField('parcelasTotal', parseInt(e.target.value) || 0)} />
              </FinField>
              <FinField label="Parcelas pagas">
                <input className="input" type="number" min={0} value={form.parcelasPagas} onChange={e => setFinField('parcelasPagas', parseInt(e.target.value) || 0)} />
              </FinField>
              <FinField label="Valor parcela">
                <input className="input" type="number" min={0} value={form.parcelaValor} onChange={e => setFinField('parcelaValor', parseFloat(e.target.value) || 0)} />
              </FinField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FinField label="Dia de vencimento">
                <input className="input" type="number" min={1} max={31} placeholder="1–31" value={form.diaVencimento} onChange={e => setFinField('diaVencimento', e.target.value)} />
              </FinField>
              <FinField label="Taxa de juros (% a.m.)">
                <input className="input" type="number" min={0} step="0.01" placeholder="opcional" value={form.taxaJuros} onChange={e => setFinField('taxaJuros', e.target.value)} />
              </FinField>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.recorrente} onChange={e => setFinField('recorrente', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              Débito recorrente mensal
            </label>

            <FinField label="Descrição (opcional)">
              <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.descricao} onChange={e => setFinField('descricao', e.target.value)} />
            </FinField>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
              <button className="btn-ghost" onClick={() => { setModalOpen(false); setEditingId(null) }}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveFin} disabled={!form.nome.trim()}>
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function emptyFinForm() {
  return {
    nome: '', credor: '',
    valorTotal: 0, valorPago: 0,
    parcelasTotal: 0, parcelasPagas: 0, parcelaValor: 0,
    diaVencimento: '', taxaJuros: '',
    recorrente: true, status: 'ativo' as FinanciamentoStatus, descricao: '',
  }
}

function FinField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--faint)' }}>{label}</label>
      {children}
    </div>
  )
}

function FinanciamentoCard({ fin, onEdit, onDelete, onPay }: {
  fin: Financiamento
  onEdit: (f: Financiamento) => void
  onDelete: (id: string) => void
  onPay: (f: Financiamento) => void
}) {
  const saldo = saldoRestante(fin)
  const pct = fin.valorTotal > 0 ? Math.min(100, (fin.valorPago / fin.valorTotal) * 100) : 0
  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4, flexShrink: 0, borderRadius: 6 } as const
  const quitado = fin.status === 'quitado'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', opacity: quitado ? 0.7 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fin.nome}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: STATUS_COLOR[fin.status], padding: '1px 7px', borderRadius: 99 }}>
              {STATUS_LABEL[fin.status]}
            </span>
            {fin.recorrente && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', background: 'var(--subtle)', padding: '1px 7px', borderRadius: 99 }}>recorrente</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
            {fin.credor ? `${fin.credor} · ` : ''}
            {fin.parcelasTotal > 0 ? `${fin.parcelasPagas}/${fin.parcelasTotal} parcelas` : 'sem parcelamento'}
            {fin.diaVencimento ? ` · vence dia ${fin.diaVencimento}` : ''}
            {fin.taxaJuros ? ` · ${fin.taxaJuros}% a.m.` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {!quitado && (
            <button onClick={() => onPay(fin)} style={iconBtn} title="Registrar pagamento de parcela"><CircleDollarSign size={15} /></button>
          )}
          <button onClick={() => onEdit(fin)} style={iconBtn} title="Editar"><Pencil size={15} /></button>
          <button onClick={() => onDelete(fin.id)} style={iconBtn} title="Excluir"><Trash2 size={15} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 22px', marginTop: 10 }}>
        <FinInfo label="Valor total" value={formatBRL(fin.valorTotal)} />
        <FinInfo label="Pago" value={formatBRL(fin.valorPago)} color="var(--pos)" />
        <FinInfo label="Saldo restante" value={formatBRL(saldo)} color={saldo > 0 ? 'var(--crit)' : 'var(--pos)'} bold />
      </div>

      <div style={{ height: 4, borderRadius: 2, background: 'var(--well)', marginTop: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: quitado ? 'var(--pos)' : 'var(--accent)' }} />
      </div>

      {fin.descricao && <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '8px 0 0' }}>{fin.descricao}</p>}
    </div>
  )
}

function FinInfo({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: color ?? 'var(--ink)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

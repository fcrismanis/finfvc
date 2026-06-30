import { useMemo, useEffect, useState } from 'react'
import { Home, Plus, Trash2, Car, Building2, Pencil, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { getLocalConnections, withItauAnchor, fetchPluggyInvestments } from '../services/pluggy.service'
import { ITAU_ANCHOR_ID } from '../config/bankTruth'
import { loadExcludedInvestments } from '../services/investmentPrefs'
import type { PluggyLocalConnection, PluggyLocalAccount, PluggyInvestment } from '../services/pluggy.service'
import {
  getBens, addBem, deleteBem, updateBem, isBemAtivo,
  FINALIDADE_LABEL, CATEGORIAS_POR_TIPO, STATUS_LABEL,
  type BemPatrimonial, type BemTipo, type BemFinalidade, type BemStatus,
} from '../services/patrimonio.service'

const TYPE_LABEL: Record<string, string> = {
  MUTUAL_FUND:  'Fundo de Investimento',
  SECURITY:     'Título',
  EQUITY:       'Ações',
  FIXED_INCOME: 'Renda Fixa',
  ETF:          'ETF',
  COE:          'COE',
  REAL_ESTATE:  'FII',
  TREASURE:     'Tesouro Direto',
  OTHER:        'Outro',
}

const TIPO_OPTIONS: { value: BemTipo; label: string }[] = [
  { value: 'movel',  label: 'Bem Móvel' },
  { value: 'imovel', label: 'Bem Imóvel' },
  { value: 'outro',  label: 'Outro' },
]

const FINALIDADE_OPTIONS: { value: BemFinalidade; label: string }[] = [
  { value: 'uso_proprio',  label: 'Uso Próprio' },
  { value: 'aluguel',      label: 'Aluguel' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'outro',        label: 'Outro' },
]

function emptyForm() {
  return {
    nome: '',
    tipo: 'movel' as BemTipo,
    categoria: '',
    finalidade: 'uso_proprio' as BemFinalidade,
    valorMercado: 0,
    saldoDevedor: 0,
    descricao: '',
    data: '',
    status: 'ativo' as BemStatus,
  }
}

export function PatrimonioPage() {
  const { transactions } = useData()
  const [connections, setConnections] = useState<PluggyLocalConnection[]>([])
  const [investments, setInvestments] = useState<PluggyInvestment[]>([])
  const [loadingInvest, setLoadingInvest] = useState(false)
  const [investError, setInvestError] = useState<string | null>(null)

  const [bens, setBens] = useState<BemPatrimonial[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    setBens(getBens())
    const conns = withItauAnchor(getLocalConnections())
    setConnections(conns)
    if (conns.length > 0) loadInvestments(conns)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInvestments(conns = connections) {
    if (conns.length === 0) return
    setLoadingInvest(true)
    setInvestError(null)
    try {
      const results = await Promise.all(
        conns.filter(c => c.itemId !== ITAU_ANCHOR_ID).map(c => fetchPluggyInvestments(c.itemId)),
      )
      setInvestments(results.flat())
    } catch (err) {
      setInvestError(err instanceof Error ? err.message : 'Erro ao buscar investimentos')
    } finally {
      setLoadingInvest(false)
    }
  }

  const bankAccounts = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'BANK')
      .map(a => ({ ...a, connectorName: c.displayName ?? c.connectorName, connectorImageUrl: c.connectorImageUrl ?? null }))
  )

  const creditCards = connections.flatMap(c =>
    c.accounts
      .filter(a => a.type === 'CREDIT')
      .map(a => ({ ...a, connectorName: c.displayName ?? c.connectorName, connectorImageUrl: c.connectorImageUrl ?? null }))
  )

  const investTxTotal = useMemo(() => {
    const invested = transactions.filter(tx => tx.classificationType === 'investment' && tx.status !== 'cancelled').reduce((s, tx) => s + tx.amount, 0)
    const redeemed = transactions.filter(tx => tx.classificationType === 'redemption' && tx.status !== 'cancelled').reduce((s, tx) => s + tx.amount, 0)
    return invested - redeemed
  }, [transactions])

  // Respect the user's per-investment exclusions from the Investimentos page.
  const excludedInvestments = loadExcludedInvestments()
  const activeInvestments = investments.filter(
    i => i.status !== 'SOLD' && i.status !== 'CLOSED' && !excludedInvestments.has(i.id)
  )
  const pluggyInvestTotal = activeInvestments.reduce((s, i) => s + (i.balance ?? 0), 0)
  const hasPluggyInvestments = activeInvestments.length > 0

  const totalBankBalance   = bankAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalInvestBalance = hasPluggyInvestments ? pluggyInvestTotal : investTxTotal
  const totalCreditBalance = creditCards.reduce((s, a) => s + (a.balance ?? 0), 0)

  const bensMoveis  = bens.filter(b => b.tipo === 'movel')
  const bensImoveis = bens.filter(b => b.tipo === 'imovel')
  const bensOutros  = bens.filter(b => b.tipo === 'outro')

  // Bens inativos não entram nos totais de patrimônio.
  const totalBensLiquido  = bens.filter(isBemAtivo).reduce((s, b) => s + b.valorMercado - b.saldoDevedor, 0)
  const totalSaldoDevedor = bens.filter(isBemAtivo).reduce((s, b) => s + b.saldoDevedor, 0)

  const hasPluggyData = bankAccounts.length > 0 || totalInvestBalance > 0

  function openModal() {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(bem: BemPatrimonial) {
    setEditingId(bem.id)
    setForm({
      nome: bem.nome,
      tipo: bem.tipo,
      categoria: bem.categoria,
      finalidade: bem.finalidade,
      valorMercado: bem.valorMercado,
      saldoDevedor: bem.saldoDevedor,
      descricao: bem.descricao ?? '',
      data: bem.data ?? '',
      status: bem.status ?? 'ativo',
    })
    setModalOpen(true)
  }

  function handleSave() {
    if (!form.nome.trim() || !form.categoria) return
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      categoria: form.categoria,
      finalidade: form.finalidade,
      valorMercado: form.valorMercado,
      saldoDevedor: form.saldoDevedor,
      descricao: form.descricao || undefined,
      data: form.data || undefined,
      status: form.status,
    }
    if (editingId) {
      updateBem(editingId, payload)
      setBens(prev => prev.map(b => (b.id === editingId ? { ...b, ...payload } : b)))
    } else {
      const novo = addBem(payload)
      setBens(prev => [...prev, novo])
    }
    setModalOpen(false)
    setEditingId(null)
  }

  function handleDelete(id: string) {
    deleteBem(id)
    setBens(prev => prev.filter(b => b.id !== id))
  }

  function toggleStatus(bem: BemPatrimonial) {
    const next: BemStatus = isBemAtivo(bem) ? 'inativo' : 'ativo'
    updateBem(bem.id, { status: next })
    setBens(prev => prev.map(b => (b.id === bem.id ? { ...b, status: next } : b)))
  }

  function setField<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'tipo') next.categoria = ''
      return next
    })
  }

  const categorias = CATEGORIAS_POR_TIPO[form.tipo]

  // suppress unused import warnings
  void TYPE_LABEL
  void loadingInvest
  void investError

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Patrimônio</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Visão consolidada de bens e patrimônio líquido</div>
        </div>

        {/* Bens Móveis */}
        <BensSection
          title="Bens Móveis"
          icon={<Car size={16} style={{ color: 'var(--faint)' }} />}
          bens={bensMoveis}
          onAdd={openModal}
          onDelete={handleDelete}
          onEdit={openEdit}
          onToggleStatus={toggleStatus}
        />

        {/* Bens Imóveis */}
        <BensSection
          title="Bens Imóveis"
          icon={<Building2 size={16} style={{ color: 'var(--faint)' }} />}
          bens={bensImoveis}
          onAdd={openModal}
          onDelete={handleDelete}
          onEdit={openEdit}
          onToggleStatus={toggleStatus}
        />

        {/* Outros bens */}
        {bensOutros.length > 0 && (
          <BensSection
            title="Outros Bens"
            icon={<Home size={16} style={{ color: 'var(--faint)' }} />}
            bens={bensOutros}
            onAdd={openModal}
            onDelete={handleDelete}
            onEdit={openEdit}
            onToggleStatus={toggleStatus}
          />
        )}

        {/* Patrimônio líquido summary */}
        {bens.length > 0 && (
          <div className="card" style={{ padding: '22px 26px', background: 'var(--ink)', color: 'white' }}>
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Patrimônio Líquido Total</p>
            <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalBensLiquido)}</p>
            {totalSaldoDevedor > 0 && (
              <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6 }}>
                Saldo devedor consolidado: {formatBRL(totalSaldoDevedor)}
              </p>
            )}
          </div>
        )}

        {/* Pluggy financial accounts */}
        {!hasPluggyData ? (
          <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Home size={32} style={{ margin: '0 auto 12px', color: 'var(--faint)' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Conecte suas contas</p>
            <p style={{ fontSize: 12.5, color: 'var(--faint)', maxWidth: 280, margin: '0 auto' }}>
              Saldos de contas e investimentos via Pluggy aparecerão aqui.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Contas bancárias</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--pos)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalBankBalance)}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{bankAccounts.length} conta{bankAccounts.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Investimentos</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--pos)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(totalInvestBalance)}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>aportado líquido via lançamentos</p>
              </div>
              {totalCreditBalance > 0 && (
                <div className="card" style={{ padding: '16px 18px', border: '1px solid var(--crit)30' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Cartões (fatura)</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--crit)', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>−{formatBRL(totalCreditBalance)}</p>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{creditCards.length} cartão{creditCards.length !== 1 ? 'ões' : ''}</p>
                </div>
              )}
            </div>
            {bankAccounts.length > 0 && (
              <AccountList title="Contas bancárias" accounts={bankAccounts} valueColor="var(--pos)" />
            )}
            {creditCards.length > 0 && (
              <AccountList title="Cartões de crédito" accounts={creditCards} valueColor="var(--crit)" negated />
            )}
          </>
        )}

      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>
              {editingId ? 'Editar Bem Patrimonial' : 'Novo Bem Patrimonial'}
            </h2>

            <Field label="Nome">
              <input
                className="input"
                placeholder="Ex: Corolla 2020, Apartamento Centro"
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tipo">
                <select className="input" value={form.tipo} onChange={e => setField('tipo', e.target.value as BemTipo)}>
                  {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Categoria">
                <select className="input" value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
                  <option value="">Selecione</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Finalidade">
              <select className="input" value={form.finalidade} onChange={e => setField('finalidade', e.target.value as BemFinalidade)}>
                {FINALIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Valor de Mercado">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.valorMercado}
                  onChange={e => setField('valorMercado', parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="Saldo Devedor">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.saldoDevedor}
                  onChange={e => setField('saldoDevedor', parseFloat(e.target.value) || 0)}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Data de aquisição (opcional)">
                <input
                  className="input"
                  type="date"
                  value={form.data}
                  onChange={e => setField('data', e.target.value)}
                />
              </Field>
              <Field label="Status">
                <select className="input" value={form.status} onChange={e => setField('status', e.target.value as BemStatus)}>
                  {(Object.keys(STATUS_LABEL) as BemStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Descrição (opcional)">
              <textarea
                className="input"
                placeholder="Detalhes, localização, observações..."
                value={form.descricao}
                onChange={e => setField('descricao', e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-secondary" onClick={() => { setModalOpen(false); setEditingId(null) }}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!form.nome.trim() || !form.categoria}
              >
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 650, color: 'var(--faint)' }}>{label}</label>
      {children}
    </div>
  )
}

function BensSection({
  title, icon, bens, onAdd, onDelete, onEdit, onToggleStatus,
}: {
  title: string
  icon: React.ReactNode
  bens: BemPatrimonial[]
  onAdd: () => void
  onDelete: (id: string) => void
  onEdit: (bem: BemPatrimonial) => void
  onToggleStatus: (bem: BemPatrimonial) => void
}) {
  const total = bens.filter(isBemAtivo).reduce((s, b) => s + b.valorMercado - b.saldoDevedor, 0)

  return (
    <div className="card" style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--ink)', margin: 0 }}>
            {title}
            {bens.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--faint)', marginLeft: 8 }}>
                ({formatBRL(total)})
              </span>
            )}
          </h3>
        </div>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 12px' }}
          onClick={onAdd}
        >
          <Plus size={14} />
          Adicionar
        </button>
      </div>

      {bens.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--faint)', textAlign: 'center', padding: '16px 0' }}>
          Nenhum bem cadastrado
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bens.map(b => <BemCard key={b.id} bem={b} onDelete={onDelete} onEdit={onEdit} onToggleStatus={onToggleStatus} />)}
        </div>
      )}
    </div>
  )
}

function BemCard({ bem, onDelete, onEdit, onToggleStatus }: {
  bem: BemPatrimonial
  onDelete: (id: string) => void
  onEdit: (bem: BemPatrimonial) => void
  onToggleStatus: (bem: BemPatrimonial) => void
}) {
  const patrimonioLiquido = bem.valorMercado - bem.saldoDevedor
  const ativo = isBemAtivo(bem)
  const iconBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--faint)', padding: 4, flexShrink: 0, borderRadius: 6,
  } as const

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      opacity: ativo ? 1 : 0.55,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: 0, textDecoration: ativo ? 'none' : 'line-through' }}>{bem.nome}</p>
          <span style={{ fontSize: 11, color: 'var(--faint)', background: 'var(--subtle)', padding: '1px 7px', borderRadius: 99 }}>
            {bem.categoria}
          </span>
          {!ativo && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', background: 'var(--subtle)', padding: '1px 7px', borderRadius: 99 }}>
              Inativo
            </span>
          )}
          {bem.data && (
            <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>· {bem.data}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 6 }}>
          <InfoRow label="Valor de Mercado" value={formatBRL(bem.valorMercado)} />
          {bem.saldoDevedor > 0 && (
            <InfoRow label="Saldo Devedor" value={`−${formatBRL(bem.saldoDevedor)}`} valueColor="var(--crit)" />
          )}
          <InfoRow
            label="Patrimônio Líquido"
            value={formatBRL(patrimonioLiquido)}
            valueColor={patrimonioLiquido >= 0 ? 'var(--pos)' : 'var(--crit)'}
            bold
          />
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{
            fontSize: 11, color: 'var(--faint)', background: 'var(--subtle)',
            padding: '2px 8px', borderRadius: 99, display: 'inline-block',
          }}>
            {FINALIDADE_LABEL[bem.finalidade]}
          </span>
        </div>
        {bem.descricao && (
          <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '6px 0 0' }}>{bem.descricao}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button onClick={() => onToggleStatus(bem)} style={iconBtn} title={ativo ? 'Desativar' : 'Ativar'}>
          {ativo ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button onClick={() => onEdit(bem)} style={iconBtn} title="Editar bem">
          <Pencil size={15} />
        </button>
        <button onClick={() => onDelete(bem.id)} style={iconBtn} title="Remover bem">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: valueColor ?? 'var(--ink)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

function AccountList({
  title, accounts, valueColor, negated = false,
}: {
  title: string
  accounts: (PluggyLocalAccount & { connectorName: string; connectorImageUrl: string | null })[]
  valueColor: string
  negated?: boolean
}) {
  const [open, setOpen] = useState(false)
  const total = accounts.reduce((s, a) => s + (a.balance ?? 0), 0)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronDown size={14} color="var(--faint)" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
          <span style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 400 }}>{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums' }}>
          {negated ? '−' : ''}{formatBRL(total)}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '10px 20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {acc.connectorImageUrl && (
                  <img src={acc.connectorImageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--faint)' }}>{acc.connectorName}</p>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {negated ? '−' : ''}{formatBRL(acc.balance ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, Bell, CreditCard, FileText, Zap, RefreshCw, MoreHorizontal } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { getLocalConnections } from '../services/pluggy.service'
import { currentYearMonth, getCompetenceMonth } from '../utils/date'

// ─── Types ────────────────────────────────────────────────────────────────────

type LembreteType = 'cartao' | 'boleto' | 'conta' | 'recorrencia' | 'outro'

interface Lembrete {
  id: string
  type: LembreteType
  name: string
  amount?: number
  dueDay?: number
  active: boolean
  notes?: string
  createdAt: string
  pluggyAccountId?: string  // links to Pluggy card for overrides
}

const STORAGE_KEY = 'fin_lembretes'

function loadLembretes(): Lembrete[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Lembrete[] } catch { return [] }
}

function saveLembretes(items: Lembrete[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

const TYPE_META: Record<LembreteType, { label: string; icon: React.ComponentType<{ size?: number; color?: string }> ; color: string }> = {
  cartao:      { label: 'Cartões',      icon: CreditCard,     color: '#DC2626' },
  boleto:      { label: 'Boletos',      icon: FileText,       color: '#D97706' },
  conta:       { label: 'Contas fixas', icon: Zap,            color: '#7C3AED' },
  recorrencia: { label: 'Recorrências', icon: RefreshCw,      color: '#0891B2' },
  outro:       { label: 'Outros',       icon: MoreHorizontal, color: '#6B7280' },
}

const BLANK: Omit<Lembrete, 'id' | 'createdAt'> = {
  type: 'boleto', name: '', amount: undefined, dueDay: undefined, active: true, notes: '',
}

const BLANK_CARD: Omit<Lembrete, 'id' | 'createdAt'> = {
  type: 'cartao', name: '', amount: undefined, dueDay: undefined, active: true, notes: '',
}

function fmtDate(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LembretesPage() {
  const { transactions, updateTransaction } = useData()
  const currentMonth = currentYearMonth()

  const [items, setItems] = useState<Lembrete[]>(loadLembretes)
  const [editing, setEditing] = useState<Lembrete | null>(null)
  const [isNew, setIsNew] = useState(false)
  // editingPluggy: override notes/dueDay for a Pluggy card
  const [editingPluggy, setEditingPluggy] = useState<{ id: string; name: string; notes: string; dueDayOverride: string } | null>(null)

  const pluggyCards = useMemo(() => {
    return getLocalConnections().flatMap(c =>
      c.accounts
        .filter(a => a.type === 'CREDIT')
        .map(a => ({
          id: a.id,
          name: a.displayName ?? a.name,
          dueDate: a.dueDate,
          balance: a.balance,
          connectorName: c.connectorName,
          logoUrl: c.connectorImageUrl,
        }))
    ).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  }, [])

  // Pluggy overrides stored as lembretes with pluggyAccountId
  const pluggyOverrides = useMemo(() =>
    new Map(items.filter(i => i.pluggyAccountId).map(i => [i.pluggyAccountId!, i])),
    [items]
  )

  const pendingTxs = useMemo(() =>
    transactions
      .filter(tx => tx.status === 'pending' && getCompetenceMonth(tx.competenceDate) === currentMonth)
      .sort((a, b) => a.competenceDate.localeCompare(b.competenceDate)),
    [transactions, currentMonth]
  )

  function persist(next: Lembrete[]) {
    setItems(next)
    saveLembretes(next)
  }

  function openNew(type: LembreteType = 'boleto') {
    setEditing({ ...BLANK, type, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    setIsNew(true)
  }

  function openNewCard() {
    setEditing({ ...BLANK_CARD, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
    setIsNew(true)
  }

  function openEdit(item: Lembrete) {
    setEditing({ ...item })
    setIsNew(false)
  }

  function openEditPluggy(cardId: string, cardName: string) {
    const existing = pluggyOverrides.get(cardId)
    setEditingPluggy({
      id: cardId,
      name: cardName,
      notes: existing?.notes ?? '',
      dueDayOverride: existing?.dueDay?.toString() ?? '',
    })
  }

  function savePluggyOverride() {
    if (!editingPluggy) return
    const existing = pluggyOverrides.get(editingPluggy.id)
    const dueDay = editingPluggy.dueDayOverride ? parseInt(editingPluggy.dueDayOverride) : undefined
    if (existing) {
      persist(items.map(i => i.id === existing.id
        ? { ...i, notes: editingPluggy.notes, dueDay }
        : i
      ))
    } else {
      const newItem: Lembrete = {
        id: crypto.randomUUID(),
        type: 'cartao',
        name: editingPluggy.name,
        pluggyAccountId: editingPluggy.id,
        notes: editingPluggy.notes,
        dueDay,
        active: true,
        createdAt: new Date().toISOString(),
      }
      persist([...items, newItem])
    }
    setEditingPluggy(null)
  }

  function save() {
    if (!editing || !editing.name.trim()) return
    if (isNew) persist([...items, editing])
    else persist(items.map(i => i.id === editing.id ? editing : i))
    setEditing(null)
  }

  function remove(id: string) {
    if (!confirm('Remover lembrete?')) return
    persist(items.filter(i => i.id !== id))
  }

  function removePluggyOverride(cardId: string) {
    persist(items.filter(i => i.pluggyAccountId !== cardId))
  }

  function toggle(id: string) {
    persist(items.map(i => i.id === id ? { ...i, active: !i.active } : i))
  }

  // Manual cartao items (no pluggyAccountId)
  const manualCards = items.filter(i => i.type === 'cartao' && !i.pluggyAccountId)
    .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))

  const sections = (Object.keys(TYPE_META) as LembreteType[])
    .filter(t => t !== 'cartao')
    .map(t => ({ type: t, items: items.filter(i => i.type === t).sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)) }))

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Lembretes</h1>
            <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Vencimentos, contas fixas e recorrências</p>
          </div>
          <button
            onClick={() => openNew()}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <Plus size={14} /> Novo lembrete
          </button>
        </div>

        {/* Cartões — Pluggy + manuais */}
        <Section
          color={TYPE_META.cartao.color}
          icon={<CreditCard size={14} />}
          title="Cartões — vencimentos"
          action={
            <button
              onClick={openNewCard}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: TYPE_META.cartao.color, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
            >
              <Plus size={11} /> Adicionar
            </button>
          }
        >
          {/* Pluggy cards */}
          {pluggyCards.map(card => {
            const override = pluggyOverrides.get(card.id)
            const dueDateStr = card.dueDate
            const due = dueDateStr ? new Date(dueDateStr + 'T12:00:00') : null
            const today = new Date()
            const daysLeft = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null
            const overdue = daysLeft !== null && daysLeft < 0
            const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5
            return (
              <Row key={card.id}
                left={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {card.logoUrl
                      ? <img src={card.logoUrl} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain', flexShrink: 0 }} />
                      : <CreditCard size={16} color={TYPE_META.cartao.color} />
                    }
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{card.name}</p>
                      {override?.notes
                        ? <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>{override.notes}</p>
                        : <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>{card.connectorName}</p>
                      }
                    </div>
                  </div>
                }
                center={
                  dueDateStr ? (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: overdue ? 'var(--crit-soft,#fef2f2)' : soon ? 'var(--warn-soft,#fef3c7)' : 'var(--well)',
                      color: overdue ? 'var(--crit)' : soon ? 'var(--warn)' : 'var(--faint)',
                    }}>
                      Venc. {fmtDate(dueDateStr)}{overdue ? ' · VENCIDO' : daysLeft !== null && daysLeft <= 30 ? ` · ${daysLeft}d` : ''}
                    </span>
                  ) : null
                }
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {card.balance != null && card.balance !== 0 && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(card.balance)}</span>
                    )}
                    <button
                      onClick={() => openEditPluggy(card.id, card.name)}
                      title="Editar notas / vencimento"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}
                    >
                      <Pencil size={12} />
                    </button>
                    {override && (
                      <button
                        onClick={() => removePluggyOverride(card.id)}
                        title="Remover personalização"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                }
              />
            )
          })}

          {/* Manual card entries */}
          {manualCards.map(item => (
            <Row key={item.id}
              dimmed={!item.active}
              left={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={16} color={item.active ? TYPE_META.cartao.color : 'var(--faint)'} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: item.active ? 'var(--ink)' : 'var(--faint)', textDecoration: item.active ? 'none' : 'line-through' }}>{item.name}</p>
                    {item.notes && <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>{item.notes}</p>}
                  </div>
                </div>
              }
              center={
                item.dueDay
                  ? <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--well)', color: 'var(--ink-2)' }}>
                      Dia {item.dueDay}
                    </span>
                  : null
              }
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.amount != null && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(item.amount)}</span>
                  )}
                  <button onClick={() => toggle(item.id)} title={item.active ? 'Desativar' : 'Ativar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.active ? 'var(--pos)' : 'var(--faint)', padding: 3, display: 'flex' }}>
                    <Check size={13} />
                  </button>
                  <button onClick={() => openEdit(item)} title="Editar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => remove(item.id)} title="Remover"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              }
            />
          ))}

          {pluggyCards.length === 0 && manualCards.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--faint)', padding: '8px 0' }}>
              Nenhum cartão. Conecte via Pluggy ou clique em Adicionar.
            </p>
          )}
        </Section>

        {/* Manual sections */}
        {sections.map(({ type, items: sItems }) => {
          const meta = TYPE_META[type]
          return (
            <Section
              key={type}
              color={meta.color}
              icon={<meta.icon size={14} />}
              title={meta.label}
              action={
                <button
                  onClick={() => openNew(type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: meta.color, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                >
                  <Plus size={11} /> Adicionar
                </button>
              }
            >
              {sItems.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--faint)', padding: '8px 0' }}>Nenhum lembrete. Clique em Adicionar.</p>
              ) : (
                sItems.map(item => (
                  <Row key={item.id}
                    dimmed={!item.active}
                    left={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <meta.icon size={14} color={item.active ? meta.color : 'var(--faint)'} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: item.active ? 'var(--ink)' : 'var(--faint)', textDecoration: item.active ? 'none' : 'line-through' }}>{item.name}</p>
                          {item.notes && <p style={{ fontSize: 10.5, color: 'var(--faint)' }}>{item.notes}</p>}
                        </div>
                      </div>
                    }
                    center={
                      item.dueDay
                        ? <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--well)', color: 'var(--ink-2)' }}>
                            Dia {item.dueDay}
                          </span>
                        : null
                    }
                    right={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.amount != null && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(item.amount)}</span>
                        )}
                        <button onClick={() => toggle(item.id)} title={item.active ? 'Desativar' : 'Ativar'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.active ? 'var(--pos)' : 'var(--faint)', padding: 3, display: 'flex' }}>
                          <Check size={13} />
                        </button>
                        <button onClick={() => openEdit(item)} title="Editar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => remove(item.id)} title="Remover"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 3, display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    }
                  />
                ))
              )}
            </Section>
          )
        })}

        {/* Pending transactions this month */}
        {pendingTxs.length > 0 && (
          <Section color="var(--warn)" icon={<Bell size={14} />} title={`Pendentes deste mês (${pendingTxs.length})`}>
            {pendingTxs.map(tx => (
              <Row key={tx.id}
                left={<p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{tx.description}</p>}
                center={<span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fmtDate(tx.competenceDate)}</span>}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--crit)', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(tx.amount)}</span>
                    <button
                      onClick={() => updateTransaction(tx.id, { status: 'paid' })}
                      title="Marcar como pago"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--faint)' }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                }
              />
            ))}
          </Section>
        )}

      </div>

      {/* Modal: editar cartão Pluggy */}
      {editingPluggy && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setEditingPluggy(null)}
        >
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{editingPluggy.name}</h2>
              <button onClick={() => setEditingPluggy(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: -8 }}>Vencimento e notas vêm do Pluggy. Aqui você pode personalizar.</p>

            <MF label="Dia de vencimento (override)">
              <input
                type="number" min="1" max="31"
                value={editingPluggy.dueDayOverride}
                onChange={e => setEditingPluggy(v => v ? { ...v, dueDayOverride: e.target.value } : v)}
                placeholder="Ex: 10 (opcional)"
                className="login-field"
                style={{ fontSize: 13 }}
              />
            </MF>

            <MF label="Observações">
              <input
                autoFocus
                value={editingPluggy.notes}
                onChange={e => setEditingPluggy(v => v ? { ...v, notes: e.target.value } : v)}
                onKeyDown={e => e.key === 'Enter' && savePluggyOverride()}
                placeholder="Ex: Pagar via débito automático"
                className="login-field"
                style={{ fontSize: 13 }}
              />
            </MF>

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-primary" onClick={savePluggyOverride}>Salvar</button>
              <button className="btn btn-secondary" onClick={() => setEditingPluggy(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo/editar lembrete manual */}
      {editing && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setEditing(null)}
        >
          <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{isNew ? 'Novo lembrete' : 'Editar lembrete'}</h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={16} /></button>
            </div>

            <MF label="Tipo">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(TYPE_META) as LembreteType[]).map(t => {
                  const m = TYPE_META[t]
                  return (
                    <button key={t} onClick={() => setEditing(e => e ? { ...e, type: t } : e)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--ui)',
                        background: editing.type === t ? `${m.color}18` : 'var(--well)',
                        border: `1px solid ${editing.type === t ? m.color : 'var(--line)'}`,
                        color: editing.type === t ? m.color : 'var(--faint)',
                      }}>
                      <m.icon size={11} />{m.label}
                    </button>
                  )
                })}
              </div>
            </MF>

            <MF label="Nome">
              <input
                autoFocus
                value={editing.name}
                onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="Ex: Aluguel, Netflix, Cartão Itaú..."
                className="login-field"
                style={{ fontSize: 13 }}
              />
            </MF>

            <div style={{ display: 'flex', gap: 10 }}>
              <MF label="Valor (R$)" style={{ flex: 1 }}>
                <input
                  type="number" min="0" step="0.01"
                  value={editing.amount ?? ''}
                  onChange={e => setEditing(v => v ? { ...v, amount: e.target.value ? parseFloat(e.target.value) : undefined } : v)}
                  placeholder="0,00"
                  className="login-field"
                  style={{ fontSize: 13 }}
                />
              </MF>
              <MF label="Dia do mês" style={{ flex: 1 }}>
                <input
                  type="number" min="1" max="31"
                  value={editing.dueDay ?? ''}
                  onChange={e => setEditing(v => v ? { ...v, dueDay: e.target.value ? parseInt(e.target.value) : undefined } : v)}
                  placeholder="Ex: 10"
                  className="login-field"
                  style={{ fontSize: 13 }}
                />
              </MF>
            </div>

            <MF label="Observações">
              <input
                value={editing.notes ?? ''}
                onChange={e => setEditing(v => v ? { ...v, notes: e.target.value } : v)}
                placeholder="Opcional"
                className="login-field"
                style={{ fontSize: 13 }}
              />
            </MF>

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, icon, color, children, action }: {
  title: string; icon: React.ReactNode; color: string
  children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>
          {icon} {title}
        </h3>
        {action}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ left, center, right, dimmed }: {
  left: React.ReactNode; center?: React.ReactNode | null; right: React.ReactNode; dimmed?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 10px', borderRadius: 8,
      background: 'var(--well)', opacity: dimmed ? 0.5 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>
      {center && <div style={{ flexShrink: 0 }}>{center}</div>}
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  )
}

function MF({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
      {children}
    </div>
  )
}

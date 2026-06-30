import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, CalendarClock, PiggyBank } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatBRL } from '../utils/currency'
import { MACRO_CATEGORIES } from '../config/categories'
import { newProvisionId } from '../services/provision.service'
import type { Provision, ProvisionRecurrence } from '../types'

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const RECURRENCE_LABEL: Record<ProvisionRecurrence, string> = {
  annual: 'Anual',
  semiannual: 'Semestral',
  quarterly: 'Trimestral',
}

const BLANK: Omit<Provision, 'id' | 'createdAt'> = {
  label: '',
  macroCategoryId: undefined,
  annualAmount: 0,
  recurrence: 'annual',
  dueMonth: 1,
  active: true,
  notes: '',
}

function macroName(id?: string): string {
  return MACRO_CATEGORIES.find(m => m.id === id)?.name ?? '—'
}

/** Meses até o vencimento (0 = vence neste mês). */
function monthsUntil(dueMonth: number): number {
  const cur = new Date().getMonth() + 1
  return (dueMonth - cur + 12) % 12
}

export function FuturoPage() {
  const { provisions, saveProvision, deleteProvision } = useData()

  const [editing, setEditing] = useState<Provision | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [draft, setDraft] = useState<Omit<Provision, 'id' | 'createdAt'>>(BLANK)

  const active = useMemo(() => provisions.filter(p => p.active), [provisions])

  const monthlyReserve = useMemo(
    () => active.reduce((sum, p) => sum + p.annualAmount / 12, 0),
    [active],
  )
  const annualTotal = useMemo(
    () => active.reduce((sum, p) => sum + p.annualAmount, 0),
    [active],
  )

  // Próximos vencimentos, ordenados por proximidade
  const upcoming = useMemo(
    () => [...active].sort((a, b) => monthsUntil(a.dueMonth) - monthsUntil(b.dueMonth)),
    [active],
  )

  function startNew() {
    setDraft(BLANK)
    setIsNew(true)
    setEditing(null)
  }

  function startEdit(p: Provision) {
    setDraft({ ...p })
    setEditing(p)
    setIsNew(false)
  }

  function cancel() {
    setEditing(null)
    setIsNew(false)
  }

  async function save() {
    if (!draft.label.trim() || draft.annualAmount <= 0) return
    const prov: Provision = isNew
      ? { ...draft, id: newProvisionId(), createdAt: new Date().toISOString() }
      : { ...editing!, ...draft }
    await saveProvision(prov)
    cancel()
  }

  const showForm = isNew || editing !== null

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Futuro</h1>
        <button
          onClick={startNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
        >
          <Plus size={16} /> Nova provisão
        </button>
      </div>
      <p style={{ color: '#6B7280', marginTop: 0, marginBottom: 20 }}>
        Provisionamento de despesas não-mensais (IPVA, IPTU, seguros, matrícula). Reserve por mês para não levar susto no vencimento.
      </p>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803D', fontSize: 13, fontWeight: 600 }}>
            <PiggyBank size={16} /> Reserva mensal recomendada
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{formatBRL(monthlyReserve)}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Total anual provisionado: {formatBRL(annualTotal)}</div>
        </div>
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C2410C', fontSize: 13, fontWeight: 600 }}>
            <CalendarClock size={16} /> Próximo vencimento
          </div>
          {upcoming[0] ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{upcoming[0].label}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                {MONTH_NAMES[upcoming[0].dueMonth]} · {formatBRL(upcoming[0].annualAmount)} · em {monthsUntil(upcoming[0].dueMonth)} mês(es)
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: '#9CA3AF', marginTop: 6 }}>Nenhuma provisão ativa</div>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Nome
              <input
                value={draft.label}
                onChange={e => setDraft({ ...draft, label: e.target.value })}
                placeholder="Ex.: IPVA do carro"
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Valor anual (R$)
              <input
                type="number"
                value={draft.annualAmount || ''}
                onChange={e => setDraft({ ...draft, annualAmount: Number(e.target.value) })}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Categoria
              <select
                value={draft.macroCategoryId ?? ''}
                onChange={e => setDraft({ ...draft, macroCategoryId: e.target.value || undefined })}
                style={inputStyle}
              >
                <option value="">—</option>
                {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Recorrência
              <select
                value={draft.recurrence}
                onChange={e => setDraft({ ...draft, recurrence: e.target.value as ProvisionRecurrence })}
                style={inputStyle}
              >
                {(Object.keys(RECURRENCE_LABEL) as ProvisionRecurrence[]).map(r => (
                  <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Mês de vencimento
              <select
                value={draft.dueMonth}
                onChange={e => setDraft({ ...draft, dueMonth: Number(e.target.value) })}
                style={inputStyle}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#374151' }}>
              Notas
              <input
                value={draft.notes ?? ''}
                onChange={e => setDraft({ ...draft, notes: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Check size={16} /> Salvar
            </button>
            <button onClick={cancel} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer' }}>
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {upcoming.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0' }}>
          Nenhuma provisão ainda. Crie a primeira para começar a reservar.
        </div>
      )}
      {upcoming.map(p => {
        const due = monthsUntil(p.dueMonth)
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {macroName(p.macroCategoryId)} · {RECURRENCE_LABEL[p.recurrence]} · vence em {MONTH_NAMES[p.dueMonth]}
                {due === 0 ? ' (este mês!)' : ` (${due} mês(es))`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{formatBRL(p.annualAmount)}</div>
                <div style={{ fontSize: 12, color: '#16A34A' }}>{formatBRL(p.annualAmount / 12)}/mês</div>
              </div>
              <button onClick={() => startEdit(p)} style={iconBtn}><Pencil size={16} /></button>
              <button onClick={() => void deleteProvision(p.id)} style={iconBtn}><Trash2 size={16} color="#DC2626" /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
  border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
}

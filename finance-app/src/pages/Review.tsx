import { useState, useMemo } from 'react'
import { AlertTriangle, Tag, Clock, CreditCard, Zap, X, ArrowLeft, Sparkles } from 'lucide-react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES, CATEGORIES } from '../config/categories'
import { formatBRL } from '../utils/currency'
import { getReviewItems } from '../utils/reviewItems'
import type { ReviewReason } from '../utils/reviewItems'
import type { Transaction, ClassificationType } from '../types'
import { suggestCategories, buildClipboardPrompt } from '../services/categorize.service'

interface Props {
  onNavigate?: (route: string) => void
}

type ActivePanel = ReviewReason | 'all' | 'import_api' | null

const CLS_LABELS: Record<ClassificationType, string> = {
  operational_income: 'Receita Op.', extraordinary_income: 'Rec. Eventual',
  operational_expense: 'Desp. Op.', debt_cost: 'Dívida',
  investment: 'Investimento', redemption: 'Resgate',
  transfer: 'Transferência', reimbursement: 'Reembolso',
  adjustment: 'Ajuste', neutral: 'Neutro',
}

export function Review({ onNavigate: _onNavigate }: Props) {
  const { transactions, updateTransaction } = useData()
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [modalTx, setModalTx] = useState<Transaction | null>(null)
  const [modalPatch, setModalPatch] = useState<Partial<Transaction>>({})
  const [applyingAll, setApplyingAll] = useState(false)

  const reviewItems = useMemo(() => getReviewItems(transactions), [transactions])

  const pluggyItems = useMemo(() =>
    transactions.filter(t => t.origin === 'import_api'),
    [transactions]
  )

  const suggestions = useMemo(() =>
    suggestCategories(pluggyItems.filter(t => !t.macroCategoryId)),
    [pluggyItems]
  )

  const counts = useMemo(() => ({
    all:          reviewItems.length,
    no_category:  reviewItems.filter(i => i.tags.includes('no_category')).length,
    pending:      reviewItems.filter(i => i.tags.includes('pending')).length,
    transfer:     reviewItems.filter(i => i.tags.includes('transfer')).length,
    high_value:   reviewItems.filter(i => i.tags.includes('high_value')).length,
    needs_review: reviewItems.filter(i => i.tags.includes('needs_review')).length,
    import_api:   pluggyItems.length,
  }), [reviewItems, pluggyItems])

  const panelItems = useMemo(() => {
    if (!activePanel) return []
    if (activePanel === 'all') return reviewItems
    if (activePanel === 'import_api') return []  // handled separately
    return reviewItems.filter(i => i.tags.includes(activePanel as ReviewReason))
  }, [reviewItems, activePanel])

  function applySuggestion(tx: Transaction) {
    const s = suggestions.get(tx.id)
    if (!s) return
    updateTransaction(tx.id, {
      macroCategoryId:    s.macroCategoryId,
      categoryId:         s.categoryId,
      classificationType: s.classificationType,
    })
  }

  function applyAllSuggestions() {
    setApplyingAll(true)
    for (const [txId, s] of suggestions) {
      if (s.confidence === 'high') {
        updateTransaction(txId, {
          macroCategoryId:    s.macroCategoryId,
          categoryId:         s.categoryId,
          classificationType: s.classificationType,
        })
      }
    }
    setApplyingAll(false)
  }

  function copyPendingToClipboard() {
    const uncategorized = pluggyItems.filter(t => !t.macroCategoryId)
    const prompt = buildClipboardPrompt(uncategorized)
    navigator.clipboard.writeText(prompt).catch(() => {/* ignore */})
  }

  function openModal(tx: Transaction) {
    setModalTx(tx)
    setModalPatch({
      description: tx.description,
      status: tx.status,
      classificationType: tx.classificationType,
      macroCategoryId: tx.macroCategoryId,
      notes: tx.notes ?? '',
      competenceDate: tx.competenceDate,
    })
  }

  function saveModal() {
    if (!modalTx) return
    updateTransaction(modalTx.id, modalPatch)
    setModalTx(null)
  }

  const TRIAGE_CARDS: Array<{
    key: ActivePanel
    label: string
    description: string
    icon: React.ReactNode
    color: string
    count: number
  }> = [
    {
      key: 'no_category',
      label: 'Sem categoria',
      description: 'Lançamentos sem macro categoria definida',
      icon: <Tag size={18} />,
      color: 'var(--warn)',
      count: counts.no_category,
    },
    {
      key: 'pending',
      label: 'Pendentes',
      description: 'Compromissos futuros não confirmados',
      icon: <Clock size={18} />,
      color: 'var(--ink-2)',
      count: counts.pending,
    },
    {
      key: 'transfer',
      label: 'Possíveis transferências',
      description: 'Movimentações internas que podem duplicar despesas',
      icon: <CreditCard size={18} />,
      color: 'var(--faint)',
      count: counts.transfer,
    },
    {
      key: 'high_value',
      label: 'Alto valor',
      description: 'Despesas acima da média × 4 ou acima de R$ 2.000',
      icon: <AlertTriangle size={18} />,
      color: 'var(--crit)',
      count: counts.high_value,
    },
    {
      key: 'needs_review',
      label: 'Precisa revisar',
      description: 'Classificações atípicas que merecem atenção',
      icon: <Zap size={18} />,
      color: 'var(--accent)',
      count: counts.needs_review,
    },
    {
      key: 'import_api' as ActivePanel,
      label: 'Importadas via Pluggy',
      description: `${suggestions.size} com sugestão de categoria automática`,
      icon: <Sparkles size={18} />,
      color: 'var(--pos)',
      count: counts.import_api,
    },
  ]

  return (
    <main className="page-shell">
      <div className="page-content section-gap">

        {/* ── Header ── */}
        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Revisão</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Central de triagem — {counts.all} {counts.all === 1 ? 'item precisa' : 'itens precisam'} de atenção
          </div>
        </div>

        {/* ── Triage cards ── */}
        {!activePanel && (
          <>
            <div className="stats-grid-3" style={{ gap: 12 }}>
              {TRIAGE_CARDS.map(card => (
                <button
                  key={card.key as string}
                  onClick={() => card.count > 0 && setActivePanel(card.key)}
                  disabled={card.count === 0}
                  style={{
                    textAlign: 'left', background: 'var(--card-bg)',
                    border: `1px solid ${card.count > 0 ? card.color + '55' : 'var(--line)'}`,
                    borderRadius: 12, padding: '16px 18px', cursor: card.count > 0 ? 'pointer' : 'default',
                    opacity: card.count === 0 ? 0.4 : 1,
                    transition: 'border-color .15s, box-shadow .15s',
                    fontFamily: 'var(--ui)',
                  }}
                  onMouseEnter={e => { if (card.count > 0) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(0,0,0,.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: card.color }}>{card.icon}</span>
                    <span style={{
                      fontSize: 18, fontWeight: 800, color: card.count > 0 ? card.color : 'var(--faint)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {card.count}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{card.label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>{card.description}</p>
                </button>
              ))}

              {/* All items card */}
              <button
                onClick={() => setActivePanel('all')}
                disabled={counts.all === 0}
                style={{
                  textAlign: 'left', background: counts.all > 0 ? 'var(--accent-soft)' : 'var(--card-bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 12, padding: '16px 18px', cursor: counts.all > 0 ? 'pointer' : 'default',
                  opacity: counts.all === 0 ? 0.4 : 1,
                  fontFamily: 'var(--ui)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-2)', fontSize: 18 }}>⚡</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {counts.all}
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Todos os itens</p>
                <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Ver tudo que precisa de revisão</p>
              </button>
            </div>

            {counts.all === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pos)', marginBottom: 8 }}>Tudo revisado!</h3>
                <p style={{ fontSize: 13, color: 'var(--faint)' }}>Nenhum lançamento precisa de atenção no momento.</p>
              </div>
            )}
          </>
        )}

        {/* ── Active panel: list ── */}
        {activePanel && (
          <>
            {/* Back to triage cards */}
            <button
              onClick={() => setActivePanel(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                background: 'var(--well)', border: '1px solid var(--line)',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                fontFamily: 'var(--ui)', alignSelf: 'flex-start',
              }}
            >
              <ArrowLeft size={13} />
              Voltar para Revisão
            </button>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {activePanel === 'import_api' ? pluggyItems.length : panelItems.length}&nbsp;
              {(activePanel === 'import_api' ? pluggyItems.length : panelItems.length) === 1 ? 'item' : 'itens'} · {
                activePanel === 'all' ? 'Todos os itens' :
                activePanel === 'import_api' ? 'Importadas via Pluggy' :
                TRIAGE_CARDS.find(c => c.key === activePanel)?.label ?? activePanel
              }
            </div>

            {/* ── Pluggy import panel ── */}
            {activePanel === 'import_api' && (
              <>
                {suggestions.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      {suggestions.size} com sugestão automática
                    </span>
                    <button
                      onClick={applyAllSuggestions}
                      disabled={applyingAll}
                      style={{
                        fontSize: 11.5, fontWeight: 700, color: '#fff',
                        background: 'var(--pos)', border: 'none', borderRadius: 7,
                        padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--ui)',
                      }}
                    >
                      {applyingAll ? 'Aplicando…' : 'Aplicar de alta confiança'}
                    </button>
                    {pluggyItems.filter(t => !t.macroCategoryId).length > 0 && (
                      <button
                        onClick={copyPendingToClipboard}
                        style={{
                          fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)',
                          background: 'var(--well)', border: '1px solid var(--line)', borderRadius: 7,
                          padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--ui)',
                        }}
                      >
                        Copiar pendências para ChatGPT
                      </button>
                    )}
                  </div>
                )}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                      <thead>
                        <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                          <th className="table-th">Data</th>
                          <th className="table-th">Descrição</th>
                          <th className="table-th table-th-right">Valor</th>
                          <th className="table-th">Cat. Pluggy</th>
                          <th className="table-th">Categoria atual</th>
                          <th className="table-th">Sugestão</th>
                          <th style={{ width: 100 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {pluggyItems.map(tx => {
                          const macro   = MACRO_CATEGORIES.find(m => m.id === tx.macroCategoryId)
                          const sugg    = suggestions.get(tx.id)
                          const suggMacro = sugg ? MACRO_CATEGORIES.find(m => m.id === sugg.macroCategoryId) : null
                          const suggCat   = sugg ? CATEGORIES.find(c => c.id === sugg.categoryId) : null
                          return (
                            <tr key={tx.id} className="table-row">
                              <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                                {new Date(tx.competenceDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </td>
                              <td className="table-td" style={{ maxWidth: 200 }}>
                                <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                                  {tx.description}
                                </p>
                                {tx.pluggyInstitutionName && (
                                  <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{tx.pluggyInstitutionName}</p>
                                )}
                              </td>
                              <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                                {(tx.pluggyCategory || tx.pluggyCategoryId) ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {tx.pluggyCategory && (
                                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--well)', color: 'var(--ink-2)', fontWeight: 500, border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                                        {tx.pluggyCategory}
                                      </span>
                                    )}
                                    {tx.pluggyCategoryId && (
                                      <span style={{ fontSize: 9, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>
                                        {tx.pluggyCategoryId}
                                      </span>
                                    )}
                                  </div>
                                ) : <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>}
                              </td>
                              <td className="table-td table-th-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: tx.type === 'income' ? 'var(--pos)' : 'var(--crit)' }}>
                                {tx.type === 'expense' ? '−' : '+'}{formatBRL(tx.amount)}
                              </td>
                              <td className="table-td">
                                {macro ? (
                                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                                    {macro.name}
                                  </span>
                                ) : <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>Sem categoria</span>}
                              </td>
                              <td className="table-td">
                                {sugg && suggMacro ? (
                                  <div>
                                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${suggMacro.color}50`, color: suggMacro.color, fontWeight: 600, background: `${suggMacro.color}12` }}>
                                      {suggCat?.name ?? suggMacro.name}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>
                                      {sugg.reason} · {sugg.confidence === 'high' ? 'alta confiança' : 'média'}
                                    </span>
                                  </div>
                                ) : <span style={{ fontSize: 10, color: 'var(--faint)' }}>—</span>}
                              </td>
                              <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {sugg && !tx.macroCategoryId && (
                                    <button
                                      onClick={() => applySuggestion(tx)}
                                      style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--pos)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                                    >
                                      Aplicar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openModal(tx)}
                                    style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                                  >
                                    Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {pluggyItems.length === 0 && (
                          <tr><td colSpan={7}><div className="empty-state"><h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Nenhuma transação importada via Pluggy</h4></div></td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── Standard review panel ── */}
            {activePanel !== 'import_api' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                  <thead>
                    <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                      <th className="table-th">Data</th>
                      <th className="table-th">Descrição</th>
                      <th className="table-th table-th-right">Valor</th>
                      <th className="table-th">Categoria</th>
                      <th className="table-th">Atenção</th>
                      <th style={{ width: 64 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {panelItems.map(item => {
                      const macro = MACRO_CATEGORIES.find(m => m.id === item.tx.macroCategoryId)
                      return (
                        <tr key={item.tx.id} className="table-row" style={{ opacity: item.tx.status === 'pending' ? 0.7 : 1 }}>
                          <td className="table-td" style={{ color: 'var(--faint)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
                            {item.tx.competenceDate}
                          </td>
                          <td className="table-td" style={{ maxWidth: 240 }}>
                            <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>
                              {item.tx.description}
                            </p>
                            <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>
                              {CLS_LABELS[item.tx.classificationType] ?? item.tx.classificationType}
                            </p>
                          </td>
                          <td className="table-td table-th-right" style={{
                            fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: 13,
                            color: item.tx.type === 'income' ? 'var(--pos)' : 'var(--crit)',
                          }}>
                            {item.tx.type === 'expense' ? '−' : '+'}{formatBRL(item.tx.amount)}
                          </td>
                          <td className="table-td">
                            {macro ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, padding: '2px 7px', borderRadius: 4,
                                border: `1px solid ${macro.color}50`, color: macro.color,
                                fontWeight: 600, background: `${macro.color}12`,
                              }}>
                                {macro.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>Sem categoria</span>
                            )}
                          </td>
                          <td className="table-td" style={{ maxWidth: 200 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {item.reasons.map((r, i) => (
                                <span key={i} className="review-note" style={{ fontSize: 10.5 }}>{r}</span>
                              ))}
                            </div>
                          </td>
                          <td className="table-td" style={{ whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => openModal(item.tx)}
                              style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {panelItems.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-state">
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Nenhum item nesta categoria</h4>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            <div style={{ paddingBottom: 8 }}>
              <button
                onClick={() => setActivePanel(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                  background: 'var(--well)', border: '1px solid var(--line)',
                  borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                  fontFamily: 'var(--ui)',
                }}
              >
                <ArrowLeft size={13} />
                Voltar para Revisão
              </button>
            </div>
          </>
        )}

      </div>

      {/* ── Edit modal ── */}
      {modalTx && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(16,15,10,.45)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setModalTx(null)}
        >
          <div style={{
            background: 'var(--card-bg)', borderRadius: 14, padding: '24px 28px',
            width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,.18)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>Editar lançamento</h2>
              <button onClick={() => setModalTx(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ModalField label="Descrição">
                <input
                  value={modalPatch.description ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, description: e.target.value }))}
                  className="login-field"
                  style={{ fontSize: 13 }}
                />
              </ModalField>

              <div style={{ display: 'flex', gap: 12 }}>
                <ModalField label="Classificação" style={{ flex: 1 }}>
                  <select
                    value={modalPatch.classificationType as string ?? ''}
                    onChange={e => setModalPatch(p => ({ ...p, classificationType: e.target.value as ClassificationType }))}
                    className="ledger-select"
                    style={{ width: '100%', fontSize: 12 }}
                  >
                    {Object.entries(CLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </ModalField>

                <ModalField label="Status" style={{ flex: 1 }}>
                  <select
                    value={modalPatch.status ?? ''}
                    onChange={e => setModalPatch(p => ({ ...p, status: e.target.value as Transaction['status'] }))}
                    className="ledger-select"
                    style={{ width: '100%', fontSize: 12 }}
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </ModalField>
              </div>

              <ModalField label="Categoria">
                <select
                  value={modalPatch.macroCategoryId ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, macroCategoryId: e.target.value || undefined }))}
                  className="ledger-select"
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="">Sem categoria</option>
                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </ModalField>

              <ModalField label="Observações">
                <textarea
                  value={modalPatch.notes ?? ''}
                  onChange={e => setModalPatch(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Notas opcionais…"
                  style={{
                    width: '100%', fontSize: 12.5, lineHeight: 1.5,
                    border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
                    resize: 'none', outline: 'none', background: 'var(--paper)',
                    fontFamily: 'var(--ui)', boxSizing: 'border-box', color: 'var(--ink)',
                  } as React.CSSProperties}
                />
              </ModalField>
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button className="btn btn-primary" onClick={saveModal}>Salvar</button>
              <button className="btn btn-secondary" onClick={() => setModalTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function ModalField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

import { useState, useRef, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { newSubCategoryId, ESSENTIALITY_LABELS } from '../services/subcategory.service'
import type { SubCategory, SubCategoryEssentiality } from '../types'

export function SubcategoriesPage() {
  const { subCategories, saveSubCategory, deleteSubCategory } = useData()
  const [editingSub, setEditingSub] = useState<Partial<SubCategory> | null>(null)
  const [subMacroFilter, setSubMacroFilter] = useState('')
  const [subSaveStatus, setSubSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSaveSub = useCallback(async (draft: Partial<SubCategory>) => {
    if (!draft.name?.trim() || !draft.macroCategoryId) return
    const sub: SubCategory = {
      id: draft.id ?? newSubCategoryId(),
      name: draft.name.trim(),
      macroCategoryId: draft.macroCategoryId,
      essentiality: (draft.essentiality ?? 'inherit') as SubCategoryEssentiality,
      active: true,
      createdAt: draft.createdAt ?? new Date().toISOString(),
    }
    await saveSubCategory(sub)
  }, [saveSubCategory])

  async function saveSub() {
    if (!editingSub) return
    try {
      await doSaveSub(editingSub)
      setEditingSub(null)
    } catch {
      // error surfaced by DataContext
    }
  }

  function handleSubFieldChange(patch: Partial<SubCategory>) {
    const updated = { ...editingSub, ...patch }
    setEditingSub(updated)
    if (!updated.id) return
    if (!updated.name?.trim() || !updated.macroCategoryId) return
    setSubSaveStatus('saving')
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(async () => {
      try {
        await doSaveSub(updated)
        setSubSaveStatus('saved')
        setTimeout(() => setSubSaveStatus('idle'), 2000)
      } catch {
        setSubSaveStatus('error')
      }
    }, 600)
  }

  async function removeSub(id: string) {
    if (!confirm('Remover subcategoria? Os lançamentos com ela não serão afetados.')) return
    await deleteSubCategory(id)
  }

  const filteredSubs = subMacroFilter
    ? subCategories.filter(s => s.macroCategoryId === subMacroFilter)
    : subCategories

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Subcategorias</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            {subCategories.length} subcategorias cadastradas
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Suas subcategorias</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={subMacroFilter}
                onChange={e => setSubMacroFilter(e.target.value)}
                className="ledger-select"
                style={{ fontSize: 11 }}
              >
                <option value="">Todas as macros</option>
                {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingSub({ macroCategoryId: subMacroFilter || MACRO_CATEGORIES[0]?.id, essentiality: 'inherit' })}
              >
                + Nova
              </button>
            </div>
          </div>

          {editingSub && (
            <div style={{ padding: '14px 20px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>
                  {editingSub.id ? 'Editar subcategoria' : 'Nova subcategoria'}
                </p>
                {editingSub.id && subSaveStatus !== 'idle' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: subSaveStatus === 'saved' ? 'var(--pos)' : subSaveStatus === 'error' ? 'var(--crit)' : 'var(--faint)',
                  }}>
                    {subSaveStatus === 'saving' ? 'Salvando…' : subSaveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  value={editingSub.name ?? ''}
                  onChange={e => handleSubFieldChange({ name: e.target.value })}
                  placeholder="Nome da subcategoria"
                  className="login-field"
                  style={{ fontSize: 12, flex: '1 1 160px' }}
                />
                <select
                  value={editingSub.macroCategoryId ?? ''}
                  onChange={e => handleSubFieldChange({ macroCategoryId: e.target.value })}
                  className="ledger-select"
                  style={{ fontSize: 12, flex: '1 1 140px' }}
                >
                  {MACRO_CATEGORIES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select
                  value={editingSub.essentiality ?? 'inherit'}
                  onChange={e => handleSubFieldChange({ essentiality: e.target.value as SubCategoryEssentiality })}
                  className="ledger-select"
                  style={{ fontSize: 12, flex: '1 1 160px' }}
                >
                  {(Object.entries(ESSENTIALITY_LABELS) as [SubCategoryEssentiality, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!editingSub.id && (
                  <button className="btn btn-primary btn-sm" onClick={saveSub}>Adicionar</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSub(null); setSubSaveStatus('idle') }}>
                  {editingSub.id ? 'Fechar' : 'Cancelar'}
                </button>
              </div>
            </div>
          )}

          {filteredSubs.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 12.5 }}>
              Nenhuma subcategoria cadastrada. Clique em "+ Nova" para criar.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--line)' }}>
                    <th className="table-th">Nome</th>
                    <th className="table-th">Macro</th>
                    <th className="table-th">Essencialidade</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map(sub => {
                    const macro = MACRO_CATEGORIES.find(m => m.id === sub.macroCategoryId)
                    return (
                      <tr key={sub.id} className="table-row">
                        <td className="table-td">
                          <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{sub.name}</span>
                        </td>
                        <td className="table-td">
                          {macro && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 4, border: `1px solid ${macro.color}50`, color: macro.color, fontWeight: 600, background: `${macro.color}12` }}>
                              {macro.name}
                            </span>
                          )}
                        </td>
                        <td className="table-td">
                          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                            {ESSENTIALITY_LABELS[sub.essentiality]}
                          </span>
                        </td>
                        <td className="table-td" style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setEditingSub({ ...sub })}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => removeSub(sub.id)}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--crit)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}

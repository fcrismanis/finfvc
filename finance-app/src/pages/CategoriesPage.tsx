import { useState } from 'react'
import { useData } from '../context/DataContext'
import { MACRO_CATEGORIES } from '../config/categories'
import { ESSENTIALITY_LABELS } from '../services/subcategory.service'

interface Props {
  onNavigate: (route: string) => void
}

export function CategoriesPage({ onNavigate }: Props) {
  const { subCategories } = useData()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Categorias</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              {MACRO_CATEGORIES.length} macro categorias · {subCategories.length} subcategorias
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('/subcategorias')}
          >
            Gerenciar subcategorias
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MACRO_CATEGORIES.map(macro => {
            const subs = subCategories.filter(s => s.macroCategoryId === macro.id)
            const expanded = expandedId === macro.id

            return (
              <div key={macro.id} className="card" style={{ overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedId(expanded ? null : macro.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 18px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--ui)',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: macro.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{macro.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--faint)', marginRight: 8 }}>{macro.classificationType}</span>
                  {subs.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: `${macro.color}18`, color: macro.color,
                      border: `1px solid ${macro.color}40`,
                    }}>
                      {subs.length}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 4 }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </button>

                {expanded && (
                  <div style={{ borderTop: '1px solid var(--line)', background: 'var(--well)' }}>
                    {subs.length === 0 ? (
                      <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--faint)' }}>
                        Nenhuma subcategoria.{' '}
                        <button
                          onClick={() => onNavigate('/subcategorias')}
                          style={{ color: 'var(--ink-2)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)', fontSize: 12, textDecoration: 'underline' }}
                        >
                          Adicionar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {subs.map((sub, i) => (
                          <div
                            key={sub.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 18px 10px 40px',
                              borderBottom: i < subs.length - 1 ? '1px solid var(--line)' : 'none',
                            }}
                          >
                            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>{sub.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                              {ESSENTIALITY_LABELS[sub.essentiality]}
                            </span>
                          </div>
                        ))}
                        <div style={{ padding: '10px 18px 10px 40px', borderTop: '1px solid var(--line)' }}>
                          <button
                            onClick={() => onNavigate('/subcategorias')}
                            style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui)' }}
                          >
                            + Adicionar subcategoria
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}

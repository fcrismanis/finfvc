import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'

interface Props {
  onNavigate: (route: string) => void
}

export function Settings({ onNavigate }: Props) {
  const { transactions, budgets, closings, subCategories } = useData()

  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Configurações</h1>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Informações do sistema e preferências gerais
          </div>
        </div>

        {/* Storage info */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 12 }}>Armazenamento</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: DATA_PROVIDER === 'supabase' ? 'var(--pos)' : 'var(--warn)', flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-2)' }}>
              Provider: <strong style={{ color: 'var(--ink)' }}>{DATA_PROVIDER === 'supabase' ? 'Supabase (nuvem)' : 'Local (localStorage)'}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--faint)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--ink-2)' }}>{transactions.length}</strong> lançamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{budgets.length}</strong> orçamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{closings.length}</strong> fechamentos</span>
            <span><strong style={{ color: 'var(--ink-2)' }}>{subCategories.length}</strong> subcategorias</span>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Categorias', description: 'Visualizar macro e subcategorias', route: '/categorias' },
            { label: 'Subcategorias', description: 'Criar, editar e remover subcategorias', route: '/subcategorias' },
            { label: 'Backup', description: 'Exportar e importar dados JSON', route: '/backup' },
            { label: 'Zona de Perigo', description: 'Limpar meses ou todos os dados', route: '/zona-perigo', danger: true },
          ].map(link => (
            <button
              key={link.route}
              onClick={() => onNavigate(link.route)}
              className="card"
              style={{
                padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
                border: link.danger ? '1px solid var(--crit)' : '1px solid var(--line)',
                background: 'none', fontFamily: 'var(--ui)',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: link.danger ? 'var(--crit)' : 'var(--ink)', marginBottom: 4 }}>
                {link.label}
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>
                {link.description}
              </p>
            </button>
          ))}
        </div>

      </div>
    </main>
  )
}

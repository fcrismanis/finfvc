import { useState } from 'react'
import { useData } from '../context/DataContext'
import { DATA_PROVIDER } from '../config/env'

const PAGE_SIZE_OPTIONS = [
  { value: '100', label: '100 por página' },
  { value: '250', label: '250 por página' },
  { value: '500', label: '500 por página (padrão)' },
  { value: '1000', label: '1000 por página' },
]

const ALERT_SETTINGS_KEY = 'fin_alert_settings'

interface AlertSettings {
  categoryAlert50: boolean
  categoryAlert75: boolean
  categoryAlert100: boolean
  globalAlert90: boolean
  globalAlert100: boolean
}

function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(ALERT_SETTINGS_KEY)
    return raw ? JSON.parse(raw) : {
      categoryAlert50: false,
      categoryAlert75: true,
      categoryAlert100: true,
      globalAlert90: true,
      globalAlert100: true,
    }
  } catch {
    return { categoryAlert50: false, categoryAlert75: true, categoryAlert100: true, globalAlert90: true, globalAlert100: true }
  }
}

function saveAlertSettings(s: AlertSettings) {
  localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(s))
}

interface Props {
  onNavigate: (route: string) => void
}

export function Settings({ onNavigate }: Props) {
  const { transactions, budgets, closings, subCategories } = useData()
  const [pageSize, setPageSize] = useState(
    () => localStorage.getItem('fin_transactions_page_size') ?? '500'
  )
  const [alerts, setAlerts] = useState<AlertSettings>(loadAlertSettings)

  function toggleAlert(key: keyof AlertSettings) {
    setAlerts(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveAlertSettings(next)
      return next
    })
  }

  function handlePageSizeChange(value: string) {
    setPageSize(value)
    localStorage.setItem('fin_transactions_page_size', value)
  }

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

        {/* Display preferences */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 14 }}>Preferências de exibição</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Lançamentos por página</p>
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                Quantidade exibida no ledger. Valores maiores podem ser mais lentos.
              </p>
            </div>
            <select
              value={pageSize}
              onChange={e => handlePageSizeChange(e.target.value)}
              className="ledger-select"
              style={{ fontSize: 12, minWidth: 160, flexShrink: 0 }}
            >
              {PAGE_SIZE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Alert preferences */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)', marginBottom: 4 }}>Alertas de orçamento</h3>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 16 }}>
            Controla quando o sistema gera alertas no Dashboard ao cruzar percentuais do orçamento.
          </p>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Por categoria</p>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10 }}>
              Alertar quando o gasto cruza 50%, 75% ou 100% da meta de cada categoria.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { key: 'categoryAlert50' as const, label: '50%' },
                { key: 'categoryAlert75' as const, label: '75%' },
                { key: 'categoryAlert100' as const, label: '100%' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleAlert(key)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--ui)', transition: 'all .15s',
                    background: alerts[key] ? 'var(--ink)' : 'var(--well)',
                    color: alerts[key] ? 'white' : 'var(--faint)',
                    border: `1px solid ${alerts[key] ? 'var(--ink)' : 'var(--line)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Orçamento geral</p>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10 }}>
              Alertar quando o total gasto no mês cruza 90% ou 100% da soma de todas as metas.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { key: 'globalAlert90' as const, label: '90%' },
                { key: 'globalAlert100' as const, label: '100%' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleAlert(key)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--ui)', transition: 'all .15s',
                    background: alerts[key] ? 'var(--ink)' : 'var(--well)',
                    color: alerts[key] ? 'white' : 'var(--faint)',
                    border: `1px solid ${alerts[key] ? 'var(--ink)' : 'var(--line)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
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

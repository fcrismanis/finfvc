import { useState } from 'react'
import { TrendingUp, Home } from 'lucide-react'
import { PatrimonioPage } from './PatrimonioPage'
import { InvestimentosPage } from './InvestimentosPage'

const TABS = [
  { id: 'investimentos', label: 'Investimentos', icon: TrendingUp },
  { id: 'patrimonio',    label: 'Patrimônio',    icon: Home },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  initialTab?: Tab
}

export function PatrimonioInvestimentosPage({ initialTab = 'investimentos' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--line)',
        background: 'var(--card-bg)', padding: '0 28px', flexShrink: 0,
      }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '14px 18px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'var(--ui)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--ink)' : 'var(--faint)',
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'investimentos' ? <InvestimentosPage /> : <PatrimonioPage />}
      </div>
    </div>
  )
}

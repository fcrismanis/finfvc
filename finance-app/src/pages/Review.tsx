import { useEffect } from 'react'
import type { NavFilter } from '../App'

interface Props {
  onNavigate: (route: string, filter?: NavFilter) => void
}

export function Review({ onNavigate }: Props) {
  useEffect(() => {
    onNavigate('/lancamentos', { smartFilter: 'review', filterLabel: 'Revisão' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 320 }}>
        <p style={{ fontSize: 13, color: 'var(--faint)' }}>Abrindo Revisão em Lançamentos…</p>
      </div>
    </main>
  )
}

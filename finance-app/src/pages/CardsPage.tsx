interface Props {
  onNavigate: (route: string) => void
}

export function CardsPage({ onNavigate }: Props) {
  return (
    <main className="page-shell">
      <div style={{ margin: '0 auto', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--ink)' }}>Cartões</h1>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>Limites, faturas e gastos por cartão</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
            + Conectar cartão
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Limite Total', value: '—', note: 'Aguardando conexão' },
            { label: 'Fatura Atual', value: '—', note: 'Aguardando conexão' },
            { label: 'Cartões Ativos', value: '0', note: 'Nenhum conectado' },
          ].map(c => (
            <div key={c.label} className="card" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{c.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.03em' }}>{c.value}</p>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{c.note}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        <div className="card" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 750, color: 'var(--ink)' }}>Seus cartões</h3>
          </div>
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--faint)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }}>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <p style={{ fontSize: 12.5 }}>Nenhum cartão conectado</p>
            <p style={{ fontSize: 11.5, marginTop: 4, opacity: 0.7, marginBottom: 16 }}>
              Conecte seus cartões de crédito via Open Finance para acompanhar faturas e limites
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('/pluggy')}>
              Conectar via Pluggy
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--well)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink-2)' }}>Fase 2:</strong> Gestão de faturas, alertas de vencimento e análise de gastos por cartão disponíveis na próxima versão.
        </div>

      </div>
    </main>
  )
}

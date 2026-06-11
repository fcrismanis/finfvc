interface Props {
  message?: string
  fullPage?: boolean
}

export function LoadingState({ message = 'Carregando dados…', fullPage = false }: Props) {
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="spinner" />
      <p style={{ fontSize: 13, color: '#98A2B3', fontWeight: 500 }}>{message}</p>
    </div>
  )

  if (fullPage) {
    return (
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-page)',
        }}
      >
        {inner}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
      {inner}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-page)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Erro ao carregar dados
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16, lineHeight: 1.5 }}>
          {message}
        </p>
        {onRetry && (
          <button className="btn btn-secondary" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}

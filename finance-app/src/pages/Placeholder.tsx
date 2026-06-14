interface Props {
  title: string
  description: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <main className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: 360 }}>
        <div className="empty-glyph" style={{ margin: '0 auto 18px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-.02em' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--faint)', lineHeight: 1.6, marginBottom: 22 }}>
          {description}
        </p>
        <span style={{
          display: 'inline-block', fontFamily: 'var(--mono)',
          fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
          padding: '4px 11px', borderRadius: 5,
          color: 'var(--ink-2)', background: 'var(--well)',
          border: '1px solid var(--line)',
        }}>
          EM BREVE — FASE 2
        </span>
      </div>
    </main>
  )
}

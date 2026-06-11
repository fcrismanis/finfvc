import { Construction } from 'lucide-react'

interface Props {
  title: string
  description: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'var(--accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Construction size={24} color="var(--accent)" />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#101828', marginBottom: 6 }}>{title}</h2>
        <p style={{ fontSize: 13, color: '#98A2B3', lineHeight: 1.6, marginBottom: 20 }}>{description}</p>
        <span style={{
          display: 'inline-block', fontSize: 11, fontWeight: 600,
          padding: '3px 10px', borderRadius: 6,
          color: 'var(--accent)', background: 'var(--accent-soft)',
        }}>
          Em breve — Fase 2
        </span>
      </div>
    </div>
  )
}

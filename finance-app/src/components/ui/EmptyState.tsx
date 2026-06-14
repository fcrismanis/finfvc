import type { LucideIcon } from 'lucide-react'

interface Props {
  icon?: LucideIcon | string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, compact = false }: Props) {
  const padding = compact ? '20px 0' : '40px 0'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center', padding, gap: 10,
    }}>
      {Icon && (
        <div style={{
          width: compact ? 36 : 44, height: compact ? 36 : 44,
          borderRadius: 12, background: 'var(--accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 2,
        }}>
          {typeof Icon === 'string'
            ? <span style={{ fontSize: compact ? 18 : 22 }}>{Icon}</span>
            : <Icon size={compact ? 18 : 22} color="var(--accent)" />
          }
        </div>
      )}
      <p style={{ fontSize: compact ? 12.5 : 13, fontWeight: 600, color: '#374151' }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 280, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {action && (
        <button
          className="btn btn-primary btn-sm"
          style={{ marginTop: 4 }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

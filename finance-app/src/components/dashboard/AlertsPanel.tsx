import { AlertTriangle, Info, TrendingDown, CheckCircle } from 'lucide-react'
import type { AlertItem, AlertLevel } from '../../types'

interface Props {
  alerts: AlertItem[]
}

const levelConfig: Record<AlertLevel, { bg: string; border: string; icon: React.ComponentType<{size?:number;color?:string}>, iconColor: string }> = {
  critical: { bg: '#FEF2F2', border: '#DC2626', icon: AlertTriangle, iconColor: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#D97706', icon: AlertTriangle, iconColor: '#D97706' },
  info: { bg: '#EFF6FF', border: '#2563EB', icon: Info, iconColor: '#2563EB' },
  distortion: { bg: '#F9FAFB', border: '#9CA3AF', icon: TrendingDown, iconColor: '#6B7280' },
}

export function AlertsPanel({ alerts }: Props) {
  const sorted = [...alerts].sort((a, b) => {
    const order: AlertLevel[] = ['critical', 'warning', 'info', 'distortion']
    return order.indexOf(a.level) - order.indexOf(b.level)
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-800">Alertas do mês</p>
        {alerts.length > 0 && (
          <span className="text-xs bg-red-50 text-red-700 rounded-full px-2 py-0.5 font-medium">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <CheckCircle size={16} color="#16A34A" />
          <p className="text-sm text-green-700">Nenhum alerta este mês</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(alert => {
            const config = levelConfig[alert.level]
            const Icon = config.icon
            return (
              <div
                key={alert.id}
                className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: config.bg, borderLeft: `3px solid ${config.border}` }}
              >
                <Icon size={14} color={config.iconColor} />
                <p className="text-gray-800 leading-snug">{alert.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { CheckCircle } from 'lucide-react'
import type { AlertItem, AlertLevel } from '../../types'

interface Props {
  alerts: AlertItem[]
}

const levelDot: Record<AlertLevel, string> = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#3B82F6',
  distortion: '#9CA3AF',
}

const levelLabel: Record<AlertLevel, string> = {
  critical: 'Crítico',
  warning: 'Atenção',
  info: 'Info',
  distortion: 'Distorção',
}

export function AlertsPanel({ alerts }: Props) {
  const sorted = [...alerts].sort((a, b) => {
    const order: AlertLevel[] = ['critical', 'warning', 'info', 'distortion']
    return order.indexOf(a.level) - order.indexOf(b.level)
  })

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount = alerts.filter(a => a.level === 'warning').length

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-800">Alertas do mês</p>
        {criticalCount > 0 && (
          <span className="text-[10px] font-semibold bg-red-50 text-red-700 rounded-full px-2 py-0.5">
            {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
            {warningCount} atenção
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 py-1">
          <CheckCircle size={14} color="#16A34A" />
          <p className="text-sm text-green-700">Nenhum alerta este mês</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sorted.map(alert => (
            <div key={alert.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]"
                style={{ background: levelDot[alert.level] }}
              />
              <p className="text-xs text-gray-700 leading-relaxed flex-1">{alert.message}</p>
              <span
                className="text-[9px] font-semibold rounded px-1.5 py-0.5 flex-shrink-0 mt-px"
                style={{ color: levelDot[alert.level], background: levelDot[alert.level] + '18' }}
              >
                {levelLabel[alert.level]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { List, Lock, Tag, Upload, ChevronRight } from 'lucide-react'

interface Props {
  totalTransactions: number
  monthIsClosed: boolean
  pendingReviewCount: number
  lastImportDate?: string
  onNavigate: (route: string) => void
}

export function QuickActions({ totalTransactions, pendingReviewCount, lastImportDate, onNavigate }: Props) {
  const actions = [
    {
      icon: List,
      title: 'Ver todos os lançamentos',
      sub: `${totalTransactions} lançamentos em 2026`,
      route: '/lancamentos',
      badge: null,
    },
    {
      icon: Lock,
      title: 'Fechar mês',
      sub: 'Mês atual ainda aberto',
      route: '/fechamento',
      badge: null,
    },
    {
      icon: Tag,
      title: 'Revisar lançamentos',
      sub: `${pendingReviewCount} sem categoria`,
      route: '/lancamentos',
      badge: pendingReviewCount > 0 ? pendingReviewCount : null,
      urgent: pendingReviewCount > 0,
    },
    {
      icon: Upload,
      title: 'Importar dados',
      sub: lastImportDate ? `Último: ${lastImportDate}` : 'Nenhum import ainda',
      route: '/conectar',
      badge: null,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-800 mb-3">Ações rápidas</p>
      <div className="divide-y divide-gray-100">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onNavigate(action.route)}
            className="w-full flex items-center gap-2.5 py-2.5 hover:bg-gray-50 transition-colors rounded text-left"
          >
            <action.icon
              size={15}
              color={action.urgent ? '#DC2626' : 'var(--sidebar-active)'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800">{action.title}</p>
              <p className="text-[10px] text-gray-400">{action.sub}</p>
            </div>
            {action.badge !== null && (
              <span className="text-xs bg-red-50 text-red-700 rounded-full px-1.5 py-0.5 font-medium">
                {action.badge}
              </span>
            )}
            <ChevronRight size={13} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  )
}

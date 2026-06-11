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
      urgent: false,
    },
    {
      icon: Lock,
      title: 'Fechar mês',
      sub: 'Mês atual ainda aberto',
      route: '/fechamento',
      urgent: false,
    },
    {
      icon: Tag,
      title: 'Revisar lançamentos',
      sub: pendingReviewCount > 0 ? `${pendingReviewCount} sem categoria` : 'Tudo em dia',
      route: '/revisao',
      urgent: pendingReviewCount > 0,
    },
    {
      icon: Upload,
      title: 'Importar dados',
      sub: lastImportDate ? `Último: ${lastImportDate}` : 'Nenhum import ainda',
      route: '/conectar',
      urgent: false,
    },
  ]

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-gray-800 mb-3">Ações rápidas</p>
      <div className="divide-y divide-gray-50">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onNavigate(action.route)}
            className="w-full flex items-center gap-3 py-2.5 hover:bg-gray-50 transition-colors rounded-lg text-left px-1 -mx-1"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: action.urgent ? '#FEE2E2' : '#EEF2FF' }}
            >
              <action.icon size={14} color={action.urgent ? '#DC2626' : 'var(--sidebar-active)'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800">{action.title}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{action.sub}</p>
            </div>
            <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

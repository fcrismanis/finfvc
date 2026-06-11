import {
  LayoutDashboard, List, Target, Flag, Lock,
  Plug, Calculator, Bot, Settings, TrendingUp, ClipboardCheck,
} from 'lucide-react'

interface SidebarProps {
  activeRoute: string
  onNavigate: (route: string) => void
}

const primary = [
  { route: '/', label: 'Visão geral', icon: LayoutDashboard },
  { route: '/lancamentos', label: 'Lançamentos', icon: List },
  { route: '/orcamento', label: 'Orçamento', icon: Target },
  { route: '/revisao', label: 'Revisão', icon: ClipboardCheck },
  { route: '/metas', label: 'Metas', icon: Flag },
  { route: '/fechamento', label: 'Fechamento', icon: Lock },
]

const tools = [
  { route: '/conectar', label: 'Conectar dados', icon: Plug },
  { route: '/simulacoes', label: 'Simulações', icon: Calculator },
  { route: '/consultor', label: 'Consultor IA', icon: Bot },
  { route: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  return (
    <aside
      className="flex flex-col w-[220px] min-w-[220px] h-full"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-[17px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--sidebar-active)' }}
        >
          <TrendingUp size={14} color="white" />
        </div>
        <div>
          <p className="text-white font-semibold text-[14px] tracking-tight leading-none">Finance</p>
          <p className="text-[10px] leading-none mt-[3px]" style={{ color: 'var(--sidebar-text)', opacity: 0.65 }}>
            Família
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <GroupLabel label="Principal" />
        {primary.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
        <GroupLabel label="Ferramentas" />
        {tools.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* User */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
          style={{ background: 'var(--sidebar-active)' }}
        >
          FC
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-white font-medium leading-none truncate">Fabio C.</p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--sidebar-text)' }}>Personal</p>
        </div>
      </div>
    </aside>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="px-[18px] pt-4 pb-1 text-[10px] font-semibold uppercase"
      style={{ color: 'var(--sidebar-text)', opacity: 0.45, letterSpacing: '0.07em' }}
    >
      {label}
    </p>
  )
}

function NavItem({ route, label, icon: Icon, active, onNavigate }: {
  route: string
  label: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  active: boolean
  onNavigate: (r: string) => void
}) {
  return (
    <button onClick={() => onNavigate(route)} className={`nav-item${active ? ' active' : ''}`}>
      <Icon size={15} />
      {label}
    </button>
  )
}

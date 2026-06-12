import {
  LayoutDashboard, List, Target, Flag, Lock,
  Plug, Calculator, Bot, Settings, ClipboardCheck,
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

const DARK = '#151C2E'
const DARK_BORDER = 'rgba(255,255,255,0.08)'

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  return (
    <aside
      className="flex flex-col w-[220px] min-w-[220px] h-full"
      style={{ background: DARK }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-[17px]"
        style={{ borderBottom: `1px solid ${DARK_BORDER}` }}
      >
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-shrink-0 font-extrabold text-base text-white"
          style={{ background: 'var(--sidebar-active)' }}
        >
          F
        </div>
        <div>
          <p className="font-extrabold text-[17px] tracking-tight leading-none text-white" style={{ letterSpacing: '-0.02em' }}>FIN</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-dark flex-1 py-2 overflow-y-auto">
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
        className="mx-3 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.05)', borderTop: 'none' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 text-white"
          style={{ background: 'rgba(29,95,224,0.5)' }}
        >
          FC
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-none truncate text-white">Fabio C.</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>Conta pessoal</p>
        </div>
      </div>
    </aside>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="px-[18px] pt-4 pb-1 text-[11px] font-bold uppercase"
      style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}
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

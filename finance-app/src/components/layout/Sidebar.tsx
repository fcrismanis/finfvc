import {
  LayoutDashboard, List, Target, Lock,
  Link2, Bot, Settings, ClipboardCheck, X,
} from 'lucide-react'

interface SidebarProps {
  activeRoute: string
  onNavigate: (route: string) => void
  onClose?: () => void
}

const primary = [
  { route: '/', label: 'Visão geral', icon: LayoutDashboard },
  { route: '/lancamentos', label: 'Lançamentos', icon: List },
  { route: '/revisao', label: 'Revisão', icon: ClipboardCheck },
  { route: '/orcamento', label: 'Orçamento', icon: Target },
  { route: '/fechamento', label: 'Fechamento', icon: Lock },
  { route: '/conectar', label: 'Importação', icon: Link2 },
]

const tools = [
  { route: '/consultor', label: 'Consultor IA', icon: Bot },
  { route: '/configuracoes', label: 'Configurações', icon: Settings },
]

const DARK = '#211F1B'
const DARK_BORDER = 'rgba(255,255,255,.08)'

export function Sidebar({ activeRoute, onNavigate, onClose }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full"
      style={{ width: 230, minWidth: 230, background: DARK }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-[11px] px-5 py-[17px]"
        style={{ borderBottom: `1px solid ${DARK_BORDER}` }}
      >
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-shrink-0 font-extrabold text-base"
          style={{
            background: '#11100D',
            border: '1px solid rgba(255,255,255,.12)',
            color: '#F2F0E9',
          }}
        >
          F
        </div>
        <div>
          <p className="font-extrabold text-[17px] tracking-tight leading-none text-white" style={{ letterSpacing: '-0.02em' }}>FIN</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden ml-auto w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'rgba(255,255,255,.5)' }}
            aria-label="Fechar menu"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-[14px] overflow-y-auto">
        {primary.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}

        {/* Separador FERRAMENTAS */}
        <div
          style={{
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '.16em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,.32)',
            padding: '6px 20px',
            marginTop: 8,
          }}
        >
          Ferramentas
        </div>

        {tools.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* User */}
      <div
        className="mx-3 mb-[14px] flex items-center gap-[10px] px-3 py-[10px] rounded-xl"
        style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
          style={{ background: '#3a362c', color: '#E9E2CF' }}
        >
          FC
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-none truncate text-white">Família Crivo</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,.45)' }}>Plano familiar</p>
        </div>
      </div>
    </aside>
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
      <Icon size={16} />
      {label}
    </button>
  )
}

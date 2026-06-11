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
      <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--sidebar-active)' }}
        >
          <TrendingUp size={14} color="white" />
        </div>
        <span className="text-white font-semibold text-[15px] tracking-tight">Finance</span>
      </div>

      <nav className="flex-1 py-3">
        <GroupLabel label="Principal" />
        {primary.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
        <GroupLabel label="Ferramentas" />
        {tools.map(item => (
          <NavItem key={item.route} {...item} active={activeRoute === item.route} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
          style={{ background: 'var(--sidebar-active)' }}
        >
          FC
        </div>
        <span className="text-sm" style={{ color: 'var(--sidebar-text)' }}>Fabio C.</span>
      </div>
    </aside>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-widest"
      style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>
      {label}
    </p>
  )
}

function NavItem({ route, label, icon: Icon, active, onNavigate }: {
  route: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }>;
  active: boolean; onNavigate: (r: string) => void
}) {
  return (
    <button
      onClick={() => onNavigate(route)}
      className={`w-full flex items-center gap-2.5 text-sm text-left transition-colors ${
        active ? 'text-white mx-2 px-2 rounded-lg' : 'px-4 hover:opacity-80'
      }`}
      style={{
        padding: active ? '7px 8px' : '7px 16px',
        background: active ? 'var(--sidebar-active)' : 'transparent',
        color: active ? 'white' : 'var(--sidebar-text)',
        width: active ? 'calc(100% - 16px)' : '100%',
        margin: active ? '0 8px' : '0',
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

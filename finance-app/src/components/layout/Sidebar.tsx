import {
  LayoutDashboard, BarChart2, List, Target, ClipboardCheck, Lock,
  Calendar, TrendingUp, Home, Bell, Landmark, CreditCard,
  Tag, Upload, Link2, Bot, Settings,
  Archive, AlertTriangle, LogOut, X, Wand2, FileBarChart,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { DATA_PROVIDER } from '../../config/env'

interface SidebarProps {
  activeRoute: string
  onNavigate: (route: string) => void
  onClose?: () => void
}

type NavEntry = {
  route: string
  label: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  phase2?: true
}

const PRINCIPAL: NavEntry[] = [
  { route: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { route: '/clareza', label: 'Clareza Financeira', icon: BarChart2, phase2: true },
]

const GESTAO: NavEntry[] = [
  { route: '/lancamentos', label: 'Lançamentos', icon: List },
  { route: '/orcamento', label: 'Orçamento', icon: Target },
  { route: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { route: '/revisao', label: 'Revisão', icon: ClipboardCheck },
  { route: '/fechamento', label: 'Fechamento', icon: Lock },
  { route: '/investimentos', label: 'Investimentos', icon: TrendingUp },
  { route: '/patrimonio', label: 'Patrimônio', icon: Home },
  { route: '/dividas', label: 'Dívidas', icon: CreditCard },
  { route: '/lembretes', label: 'Lembretes', icon: Bell },
  { route: '/futuro', label: 'Futuro', icon: Calendar, phase2: true },
]

const CADASTROS: NavEntry[] = [
  { route: '/contas', label: 'Contas', icon: Landmark },
  { route: '/cartoes', label: 'Cartões', icon: CreditCard },
  { route: '/categorias', label: 'Categorias', icon: Tag },
  { route: '/regras', label: 'Regras de categoria', icon: Wand2 },
]

const INTEGRACOES: NavEntry[] = [
  { route: '/conectar', label: 'Importação', icon: Upload },
  { route: '/pluggy', label: 'Pluggy', icon: Link2 },
  { route: '/consultor', label: 'Consultor IA', icon: Bot },
  { route: '/assistente', label: 'Assistente', icon: Wand2 },
]

const SISTEMA: NavEntry[] = [
  { route: '/configuracoes', label: 'Configurações', icon: Settings },
  { route: '/backup', label: 'Backup', icon: Archive },
  { route: '/zona-perigo', label: 'Zona de Perigo', icon: AlertTriangle },
]

const GROUPS = [
  { label: 'Principal', items: PRINCIPAL },
  { label: 'Gestão', items: GESTAO },
  { label: 'Cadastros', items: CADASTROS },
  { label: 'Integrações', items: INTEGRACOES },
  { label: 'Sistema', items: SISTEMA },
]

const DARK = '#211F1B'
const DARK_BORDER = 'rgba(255,255,255,.08)'

export function Sidebar({ activeRoute, onNavigate, onClose }: SidebarProps) {
  const { signOut } = useAuth()

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
      <nav className="flex-1 py-2 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            <div style={{
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.32)', padding: '8px 20px 3px',
            }}>
              {group.label}
            </div>
            {group.items.map(item => (
              <NavItem
                key={item.route}
                {...item}
                active={activeRoute === item.route}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}

        {DATA_PROVIDER === 'supabase' && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={signOut}
              className="nav-item"
              style={{ opacity: 0.65 }}
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        )}
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

function NavItem({ route, label, icon: Icon, active, phase2, onNavigate }: NavEntry & {
  active: boolean
  onNavigate: (r: string) => void
}) {
  return (
    <button
      onClick={() => onNavigate(route)}
      className={`nav-item${active ? ' active' : ''}`}
      style={phase2 ? { opacity: 0.45 } : undefined}
    >
      <Icon size={16} />
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {phase2 && (
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '.06em',
          padding: '1px 4px', borderRadius: 3,
          background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.5)',
        }}>F2</span>
      )}
    </button>
  )
}

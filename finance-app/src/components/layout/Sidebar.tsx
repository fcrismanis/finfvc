import { useState } from 'react'
import {
  LayoutDashboard, List, Target, ClipboardCheck,
  Calendar, TrendingUp, Bell, Landmark, CreditCard,
  Tag, Link2, Bot, Settings, Settings2, Scale,
  LogOut, X, Wand2, FileBarChart, ChevronDown,
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
]

const GESTAO: NavEntry[] = [
  { route: '/lancamentos', label: 'Lançamentos', icon: List },
  { route: '/orcamento', label: 'Orçamento', icon: Target },
  { route: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { route: '/revisao', label: 'Revisão', icon: ClipboardCheck },
  { route: '/reconciliacao', label: 'Reconciliação', icon: Scale },
  { route: '/patrimonio', label: 'Patrimônio & Invest.', icon: TrendingUp },
  { route: '/dividas', label: 'Financiamentos / Dívidas', icon: CreditCard },
  { route: '/lembretes', label: 'Lembretes', icon: Bell },
  { route: '/futuro', label: 'Futuro', icon: Calendar, phase2: true },
]

const CADASTROS: NavEntry[] = [
  { route: '/contas', label: 'Contas', icon: Landmark },
  { route: '/cartoes', label: 'Cartões', icon: CreditCard },
  { route: '/categorias', label: 'Categorias', icon: Tag },
]

const SISTEMA: NavEntry[] = [
  { route: '/configuracoes', label: 'Configurações', icon: Settings },
  { route: '/engine', label: 'Engine Financeira', icon: Settings2 },
  { route: '/regras', label: 'Regras de categoria', icon: Wand2 },
  { route: '/pluggy', label: 'Importação & Pluggy', icon: Link2 },
  { route: '/economista', label: 'Economista FIN', icon: Bot },
]

const GROUPS = [
  { label: 'Principal', items: PRINCIPAL, defaultOpen: true },
  { label: 'Gestão', items: GESTAO, defaultOpen: true },
  { label: 'Cadastros', items: CADASTROS, defaultOpen: false },
  { label: 'Sistema', items: SISTEMA, defaultOpen: false },
]

const DARK = '#211F1B'
const DARK_BORDER = 'rgba(255,255,255,.08)'

export function Sidebar({ activeRoute, onNavigate, onClose }: SidebarProps) {
  const { signOut } = useAuth()

  const initialOpen = () => {
    const state: Record<string, boolean> = {}
    for (const g of GROUPS) {
      const hasActive = g.items.some(i => i.route === activeRoute)
      state[g.label] = g.defaultOpen || hasActive
    }
    return state
  }

  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen)

  function toggle(label: string) {
    setOpen(s => ({ ...s, [label]: !s[label] }))
  }

  // Auto-open group when active route changes
  for (const g of GROUPS) {
    if (g.items.some(i => i.route === activeRoute) && !open[g.label]) {
      setOpen(s => ({ ...s, [g.label]: true }))
    }
  }

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
        {GROUPS.map(group => {
          const isOpen = open[group.label] ?? false
          return (
            <div key={group.label} style={{ marginBottom: 2 }}>
              <button
                onClick={() => toggle(group.label)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '6px 20px 3px',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: "'Geist Mono', ui-monospace, monospace",
                  fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.32)',
                }}>
                  {group.label}
                </span>
                <ChevronDown
                  size={11}
                  color="rgba(255,255,255,.28)"
                  style={{
                    transition: 'transform 180ms ease',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    flexShrink: 0,
                  }}
                />
              </button>

              <div style={{
                overflow: 'hidden',
                maxHeight: isOpen ? `${group.items.length * 48}px` : '0px',
                transition: 'max-height 200ms ease',
              }}>
                {group.items.map(item => (
                  <NavItem
                    key={item.route}
                    {...item}
                    active={activeRoute === item.route}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          )
        })}

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

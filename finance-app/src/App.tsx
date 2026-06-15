import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react'

export interface NavFilter {
  macroCategoryIds?: string[]
  categoryIds?: string[]
  filterLabel?: string
  smartFilter?: string
  sourcePage?: 'dashboard' | 'budget' | 'closing' | 'review'
  sourceLabel?: string
}
import { MigrationPage } from './pages/MigrationPage'
import { Menu } from 'lucide-react'
import './index.css'
import { DataProvider, useData } from './context/DataContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar } from './components/layout/Sidebar'
import { LoadingState, ErrorState } from './components/ui/LoadingState'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'
import { currentYearMonth } from './utils/date'
import { DATA_PROVIDER } from './config/env'

// Lazy-loaded routes — each page is a separate chunk
const Dashboard        = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Import           = lazy(() => import('./pages/Import').then(m => ({ default: m.Import })))
const Transactions     = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })))
const Budget           = lazy(() => import('./pages/Budget').then(m => ({ default: m.Budget })))
const Review           = lazy(() => import('./pages/Review').then(m => ({ default: m.Review })))
const Closing          = lazy(() => import('./pages/Closing').then(m => ({ default: m.Closing })))
const Advisor          = lazy(() => import('./pages/Advisor').then(m => ({ default: m.Advisor })))
const Settings         = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const CategoriesPage   = lazy(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })))
const SubcategoriesPage = lazy(() => import('./pages/SubcategoriesPage').then(m => ({ default: m.SubcategoriesPage })))
const AccountsPage     = lazy(() => import('./pages/AccountsPage').then(m => ({ default: m.AccountsPage })))
const CardsPage        = lazy(() => import('./pages/CardsPage').then(m => ({ default: m.CardsPage })))
const PluggyPage       = lazy(() => import('./pages/PluggyPage').then(m => ({ default: m.PluggyPage })))
const BackupPage       = lazy(() => import('./pages/BackupPage').then(m => ({ default: m.BackupPage })))
const DangerZonePage   = lazy(() => import('./pages/DangerZonePage').then(m => ({ default: m.DangerZonePage })))

const MIGRATION_BANNER_DISMISSED_KEY = 'finance_migration_banner_dismissed'

function MigrationBanner({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { familyId } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (DATA_PROVIDER !== 'supabase' || !familyId) return
    if (localStorage.getItem(MIGRATION_BANNER_DISMISSED_KEY)) return
    const raw = localStorage.getItem('finance_transactions')
    setShow(!!raw && raw !== '[]' && raw !== 'null')
  }, [familyId])

  function dismiss() {
    localStorage.setItem(MIGRATION_BANNER_DISMISSED_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      background: '#fffbeb', borderBottom: '1px solid #fde68a',
      padding: '0.5rem 1rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0, gap: '0.5rem',
    }}>
      <span style={{ fontSize: '0.83rem', color: '#92400e' }}>
        Dados locais detectados no navegador.
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={() => onNavigate('/migrar')}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '0.3rem 0.85rem',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Migrar →
        </button>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          style={{
            background: 'transparent', color: '#92400e', border: '1px solid #fde68a',
            borderRadius: 6, padding: '0.3rem 0.6rem',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function AppShell() {
  const [activeRoute, setActiveRoute] = useState('/')
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navFilter, setNavFilter] = useState<NavFilter | null>(null)
  const { loading, error, reload, transactions } = useData()
  const didInitMonth = useRef(false)

  useEffect(() => {
    if (didInitMonth.current || transactions.length === 0) return
    const months = transactions.map(t => t.competenceDate.slice(0, 7)).filter(Boolean)
    if (months.length === 0) return
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(months.sort()[months.length - 1])
    }
    didInitMonth.current = true
  }, [transactions, selectedMonth])

  function navigate(route: string, filter?: NavFilter) {
    setActiveRoute(route)
    setNavFilter(filter ?? null)
    setSidebarOpen(false)
  }

  function renderPage() {
    switch (activeRoute) {
      case '/':              return <Dashboard selectedMonth={selectedMonth} onNavigate={navigate} onMonthChange={setSelectedMonth} />
      case '/conectar':      return <Import onNavigate={navigate} />
      case '/lancamentos':   return <Transactions selectedMonth={selectedMonth} onNavigate={navigate} navFilter={navFilter} onClearFilter={() => setNavFilter(null)} />
      case '/orcamento':     return <Budget selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/revisao':       return <Review onNavigate={navigate} />
      case '/fechamento':    return <Closing selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/migrar':        return <MigrationPage />
      case '/consultor':     return <Advisor selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/configuracoes': return <Settings onNavigate={navigate} />
      case '/categorias':    return <CategoriesPage onNavigate={navigate} />
      case '/subcategorias': return <SubcategoriesPage />
      case '/contas':        return <AccountsPage onNavigate={navigate} />
      case '/cartoes':       return <CardsPage onNavigate={navigate} />
      case '/pluggy':        return <PluggyPage />
      case '/backup':        return <BackupPage />
      case '/zona-perigo':   return <DangerZonePage />
      // Phase 2 placeholders
      case '/clareza':       return <Placeholder title="Clareza Financeira" description="Visualização avançada do fluxo financeiro da família." />
      case '/futuro':        return <Placeholder title="Futuro" description="Projeção de fluxo de caixa e planejamento de metas." />
      case '/investimentos': return <Placeholder title="Investimentos" description="Carteira de investimentos e acompanhamento de rentabilidade." />
      case '/patrimonio':    return <Placeholder title="Patrimônio" description="Visão consolidada do patrimônio líquido da família." />
      case '/dividas':       return <Placeholder title="Dívidas" description="Gestão de dívidas, parcelas e calendário de pagamento." />
      case '/lembretes':     return <Placeholder title="Lembretes" description="Alertas de vencimento, metas e eventos financeiros." />
      default:               return null
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`sidebar-shell${sidebarOpen ? ' open' : ''}`}>
        <Sidebar
          activeRoute={activeRoute}
          onNavigate={navigate}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-card)' }}
        >
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
          <span className="font-extrabold text-[15px]" style={{ color: '#101828' }}>FIN</span>
        </div>

        <MigrationBanner onNavigate={navigate} />

        <Suspense fallback={<LoadingState fullPage message="Carregando…" />}>
          {loading
            ? <LoadingState fullPage message="Carregando dados financeiros…" />
            : error
            ? <ErrorState message={error} onRetry={reload} />
            : renderPage()
          }
        </Suspense>
      </div>
    </div>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (DATA_PROVIDER !== 'supabase') return <>{children}</>
  if (loading) return <LoadingState fullPage message="Verificando autenticação…" />
  if (!user) return <Login />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <DataProvider>
          <AppShell />
        </DataProvider>
      </AuthGate>
    </AuthProvider>
  )
}

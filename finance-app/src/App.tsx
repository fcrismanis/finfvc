import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from 'react'
import { MigrationPage } from './pages/MigrationPage'
import { Menu } from 'lucide-react'
import './index.css'
import { DataProvider, useData } from './context/DataContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar } from './components/layout/Sidebar'
import { LoadingState, ErrorState } from './components/ui/LoadingState'
import { Login } from './pages/Login'
import { currentYearMonth } from './utils/date'
import { DATA_PROVIDER } from './config/env'

// Lazy-loaded routes — each page is a separate chunk
const Dashboard    = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Import       = lazy(() => import('./pages/Import').then(m => ({ default: m.Import })))
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })))
const Budget       = lazy(() => import('./pages/Budget').then(m => ({ default: m.Budget })))
const Review       = lazy(() => import('./pages/Review').then(m => ({ default: m.Review })))
const Closing      = lazy(() => import('./pages/Closing').then(m => ({ default: m.Closing })))
const Placeholder  = lazy(() => import('./pages/Placeholder').then(m => ({ default: m.Placeholder })))

const PLACEHOLDER_PAGES: Record<string, { title: string; description: string }> = {
  '/consultor':     { title: 'Consultor IA',  description: 'Análise inteligente das suas finanças com recomendações personalizadas.' },
  '/configuracoes': { title: 'Configurações', description: 'Gerencie contas, categorias, orçamento padrão e preferências.' },
}

function MigrationBanner({ onNavigate }: { onNavigate: (route: string) => void }) {
  const { familyId } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (DATA_PROVIDER !== 'supabase' || !familyId) return
    const raw = localStorage.getItem('finance_transactions')
    setShow(!!raw && raw !== '[]' && raw !== 'null')
  }, [familyId])

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
      <button
        onClick={() => onNavigate('/migrar')}
        style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          borderRadius: 6, padding: '0.3rem 0.85rem',
          fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}
      >
        Migrar →
      </button>
    </div>
  )
}

function AppShell() {
  const [activeRoute, setActiveRoute] = useState('/')
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error, reload, transactions } = useData()
  const didInitMonth = useRef(false)

  // On first data load, land on the latest month that actually has data
  // (mock/demo runs jan–mai; today's month is empty → avoids blank screen)
  useEffect(() => {
    if (didInitMonth.current || transactions.length === 0) return
    const months = transactions.map(t => t.competenceDate.slice(0, 7)).filter(Boolean)
    if (months.length === 0) return
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(months.sort()[months.length - 1])
    }
    didInitMonth.current = true
  }, [transactions, selectedMonth])

  const placeholder = PLACEHOLDER_PAGES[activeRoute]

  function navigate(route: string) {
    setActiveRoute(route)
    setSidebarOpen(false) // close mobile sidebar on nav
  }

  function renderPage() {
    switch (activeRoute) {
      case '/':            return <Dashboard selectedMonth={selectedMonth} onNavigate={navigate} onMonthChange={setSelectedMonth} />
      case '/conectar':    return <Import onNavigate={navigate} />
      case '/lancamentos': return <Transactions selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/orcamento':   return <Budget selectedMonth={selectedMonth} />
      case '/revisao':     return <Review onNavigate={navigate} />
      case '/fechamento':  return <Closing selectedMonth={selectedMonth} />
      case '/migrar':      return <MigrationPage />
      default:             return placeholder ? <Placeholder title={placeholder.title} description={placeholder.description} /> : null
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div className={`sidebar-shell${sidebarOpen ? ' open' : ''}`}>
        <Sidebar
          activeRoute={activeRoute}
          onNavigate={navigate}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile/tablet top bar with hamburger — shown below 1024px */}
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

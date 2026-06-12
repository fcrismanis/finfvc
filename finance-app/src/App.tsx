import { useState, lazy, Suspense } from 'react'
import './index.css'
import { DataProvider, useData } from './context/DataContext'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { LoadingState, ErrorState } from './components/ui/LoadingState'
import { currentYearMonth } from './utils/date'
import type { ViewMode } from './types'

// Lazy-loaded routes — each page is a separate chunk
const Dashboard    = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Import       = lazy(() => import('./pages/Import').then(m => ({ default: m.Import })))
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })))
const Budget       = lazy(() => import('./pages/Budget').then(m => ({ default: m.Budget })))
const Review       = lazy(() => import('./pages/Review').then(m => ({ default: m.Review })))
const Closing      = lazy(() => import('./pages/Closing').then(m => ({ default: m.Closing })))
const Placeholder  = lazy(() => import('./pages/Placeholder').then(m => ({ default: m.Placeholder })))

const PLACEHOLDER_PAGES: Record<string, { title: string; description: string }> = {
  '/metas':         { title: 'Metas financeiras',  description: 'Defina e acompanhe objetivos de longo prazo.' },
  '/simulacoes':    { title: 'Simulações',          description: 'Simule cenários de gastos, poupança e investimento.' },
  '/consultor':     { title: 'Consultor IA',        description: 'Análise inteligente das suas finanças com recomendações personalizadas.' },
  '/configuracoes': { title: 'Configurações',       description: 'Gerencie contas, categorias, orçamento padrão e preferências.' },
}

function AppShell() {
  const [activeRoute, setActiveRoute] = useState('/')
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [activeView, setActiveView] = useState<ViewMode>('operational')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error, reload } = useData()

  const placeholder = PLACEHOLDER_PAGES[activeRoute]

  function navigate(route: string) {
    setActiveRoute(route)
    setSidebarOpen(false) // close mobile sidebar on nav
  }

  function renderPage() {
    switch (activeRoute) {
      case '/':            return <Dashboard selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/conectar':    return <Import onNavigate={navigate} />
      case '/lancamentos': return <Transactions selectedMonth={selectedMonth} onNavigate={navigate} />
      case '/orcamento':   return <Budget selectedMonth={selectedMonth} />
      case '/revisao':     return <Review onNavigate={navigate} />
      case '/fechamento':  return <Closing selectedMonth={selectedMonth} />
      default:             return placeholder ? <Placeholder title={placeholder.title} description={placeholder.description} /> : null
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
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
        <Header
          selectedMonth={selectedMonth}
          activeView={activeView}
          onMonthChange={setSelectedMonth}
          onViewChange={setActiveView}
          onNavigate={navigate}
          onMenuToggle={() => setSidebarOpen(o => !o)}
        />
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

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  )
}

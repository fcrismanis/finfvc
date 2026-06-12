import { useState } from 'react'
import './index.css'
import { DataProvider, useData } from './context/DataContext'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Import } from './pages/Import'
import { Transactions } from './pages/Transactions'
import { Budget } from './pages/Budget'
import { Review } from './pages/Review'
import { Closing } from './pages/Closing'
import { Placeholder } from './pages/Placeholder'
import { LoadingState, ErrorState } from './components/ui/LoadingState'
import { currentYearMonth } from './utils/date'
import type { ViewMode } from './types'

const PLACEHOLDER_PAGES: Record<string, { title: string; description: string }> = {
  '/metas': { title: 'Metas financeiras', description: 'Defina e acompanhe objetivos de longo prazo.' },
  '/simulacoes': { title: 'Simulações', description: 'Simule cenários de gastos, poupança e investimento.' },
  '/consultor': { title: 'Consultor IA', description: 'Análise inteligente das suas finanças com recomendações personalizadas.' },
  '/configuracoes': { title: 'Configurações', description: 'Gerencie contas, categorias, orçamento padrão e preferências.' },
}

// Inner shell — runs inside DataProvider so it can read loading/error from context
function AppShell() {
  const [activeRoute, setActiveRoute] = useState('/')
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth())
  const [activeView, setActiveView] = useState<ViewMode>('operational')
  const { loading, error, reload } = useData()

  const placeholder = PLACEHOLDER_PAGES[activeRoute]

  function renderPage() {
    switch (activeRoute) {
      case '/':            return <Dashboard selectedMonth={selectedMonth} onNavigate={setActiveRoute} />
      case '/conectar':    return <Import onNavigate={setActiveRoute} />
      case '/lancamentos': return <Transactions selectedMonth={selectedMonth} onNavigate={setActiveRoute} />
      case '/orcamento':   return <Budget selectedMonth={selectedMonth} />
      case '/revisao':     return <Review onNavigate={setActiveRoute} />
      case '/fechamento':  return <Closing selectedMonth={selectedMonth} />
      default:             return placeholder ? <Placeholder title={placeholder.title} description={placeholder.description} /> : null
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          selectedMonth={selectedMonth}
          activeView={activeView}
          onMonthChange={setSelectedMonth}
          onViewChange={setActiveView}
          onNavigate={setActiveRoute}
        />
        {loading
          ? <LoadingState fullPage message="Carregando dados financeiros…" />
          : error
          ? <ErrorState message={error} onRetry={reload} />
          : renderPage()
        }
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

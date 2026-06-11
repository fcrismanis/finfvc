import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Transaction, Budget } from '../types'
import { dataProvider } from '../adapters/adapter.factory'

interface DataContextValue {
  transactions: Transaction[]
  budgets: Budget[]
  isDemo: boolean
  loading: boolean
  error: string | null
  reload: () => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  saveBudget: (budget: Budget) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await dataProvider.load()
      setTransactions(result.transactions)
      setBudgets(result.budgets)
      setIsDemo(result.isDemo)
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load on mount
  useEffect(() => { void loadData() }, [loadData])

  const reload = useCallback(() => { void loadData() }, [loadData])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    void dataProvider.updateTransaction(id, patch).then(() => loadData())
  }, [loadData])

  const saveBudget = useCallback((budget: Budget) => {
    void dataProvider.saveBudget(budget).then(() => loadData())
  }, [loadData])

  return (
    <DataContext.Provider value={{
      transactions, budgets, isDemo, loading, error,
      reload, updateTransaction, saveBudget,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

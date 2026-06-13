import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Transaction, Budget } from '../types'
import { useAuth } from './AuthContext'
import { createDataProvider } from '../adapters/adapter.factory'

interface DataContextValue {
  transactions: Transaction[]
  budgets: Budget[]
  isDemo: boolean
  loading: boolean
  error: string | null
  reload: () => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  saveBudget: (budget: Budget) => void
  appendTransactions: (txns: Transaction[]) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { familyId } = useAuth()

  // Provider instance recreated when familyId changes (login/logout in supabase mode)
  const provider = useMemo(() => createDataProvider(familyId ?? undefined), [familyId])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (showLoadingUI = true) => {
    if (showLoadingUI) setLoading(true)
    setError(null)
    try {
      const result = await provider.load()
      setTransactions(result.transactions)
      setBudgets(result.budgets)
      setIsDemo(result.isDemo)
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar dados')
    } finally {
      if (showLoadingUI) setLoading(false)
    }
  }, [provider])

  // Re-load whenever provider changes (covers initial mount + familyId resolution)
  useEffect(() => { void loadData() }, [loadData])

  const reload = useCallback(() => { void loadData() }, [loadData])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    void provider.updateTransaction(id, patch).then(() => loadData())
  }, [provider, loadData])

  const saveBudget = useCallback((budget: Budget) => {
    void provider.saveBudget(budget).then(() => loadData())
  }, [provider, loadData])

  const appendTransactions = useCallback(async (txns: Transaction[]) => {
    await provider.appendTransactions(txns)
    await loadData(false)  // silent reload — don't unmount the migration page mid-flight
  }, [provider, loadData])

  return (
    <DataContext.Provider value={{
      transactions, budgets, isDemo, loading, error,
      reload, updateTransaction, saveBudget, appendTransactions,
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

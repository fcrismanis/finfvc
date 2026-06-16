import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Transaction, Budget, MonthClosing, SubCategory } from '../types'
import { useAuth } from './AuthContext'
import { createDataProvider } from '../adapters/adapter.factory'

interface DataContextValue {
  transactions: Transaction[]
  budgets: Budget[]
  closings: MonthClosing[]
  subCategories: SubCategory[]
  isDemo: boolean
  loading: boolean
  error: string | null
  reload: () => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  updateTransactions: (items: Array<{ id: string; patch: Partial<Transaction> }>, opts?: { markManual?: boolean }) => Promise<void>
  saveBudget: (budget: Budget) => void
  saveClosing: (closing: MonthClosing) => void
  appendTransactions: (txns: Transaction[]) => Promise<void>
  saveSubCategory: (sub: SubCategory) => Promise<void>
  deleteSubCategory: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { familyId } = useAuth()

  // Provider instance recreated when familyId changes (login/logout in supabase mode)
  const provider = useMemo(() => createDataProvider(familyId ?? undefined), [familyId])

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [closings, setClosings] = useState<MonthClosing[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
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
      const [cl, subs] = await Promise.all([
        provider.getMonthlyClosings(),
        provider.loadSubCategories(),
      ])
      setClosings(cl)
      setSubCategories(subs)
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
    void provider.updateTransaction(id, patch).then(() => loadData(false))
  }, [provider, loadData])

  const updateTransactions = useCallback(async (
    items: Array<{ id: string; patch: Partial<Transaction> }>,
    opts?: { markManual?: boolean },
  ) => {
    await provider.updateTransactions(items, opts)
    await loadData(false)  // single silent reload after the whole batch
  }, [provider, loadData])

  const saveBudget = useCallback((budget: Budget) => {
    void provider.saveBudget(budget).then(() => loadData(false))
  }, [provider, loadData])

  const saveClosing = useCallback((closing: MonthClosing) => {
    void provider.saveMonthlyClosing(closing).then(() => loadData(false))
  }, [provider, loadData])

  const appendTransactions = useCallback(async (txns: Transaction[]) => {
    await provider.appendTransactions(txns)
    await loadData(false)  // silent reload — don't unmount the migration page mid-flight
  }, [provider, loadData])

  const saveSubCategory = useCallback(async (sub: SubCategory) => {
    await provider.saveSubCategory(sub)
    const updated = await provider.loadSubCategories()
    setSubCategories(updated)
  }, [provider])

  const deleteSubCategory = useCallback(async (id: string) => {
    await provider.deleteSubCategory(id)
    const updated = await provider.loadSubCategories()
    setSubCategories(updated)
  }, [provider])

  return (
    <DataContext.Provider value={{
      transactions, budgets, closings, subCategories, isDemo, loading, error,
      reload, updateTransaction, updateTransactions, saveBudget, saveClosing, appendTransactions,
      saveSubCategory, deleteSubCategory,
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

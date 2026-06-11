import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Transaction, Budget } from '../types'
import { getTransactionsOrMock, updateTransaction as svcUpdate } from '../services/transactions.service'
import { getBudgetsOrMock, saveBudget as svcSaveBudget } from '../services/budget.service'

interface DataContextValue {
  transactions: Transaction[]
  budgets: Budget[]
  isDemo: boolean
  reload: () => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  saveBudget: (budget: Budget) => void
}

const DataContext = createContext<DataContextValue | null>(null)

function loadData() {
  const { transactions, isDemo: txDemo } = getTransactionsOrMock()
  const { budgets, isDemo: budDemo } = getBudgetsOrMock()
  return { transactions, budgets, isDemo: txDemo && budDemo }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => loadData())

  const reload = useCallback(() => {
    setState(loadData())
  }, [])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    svcUpdate(id, patch)
    setState(loadData())
  }, [])

  const saveBudget = useCallback((budget: Budget) => {
    svcSaveBudget(budget)
    setState(loadData())
  }, [])

  return (
    <DataContext.Provider value={{ ...state, reload, updateTransaction, saveBudget }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

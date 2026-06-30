import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Transaction, Budget, MonthClosing, SubCategory, Provision } from '../types'
import { useAuth } from './AuthContext'
import { createDataProvider } from '../adapters/adapter.factory'
import { dedupeIncomingBatch } from '../utils/transactionDedupe'
import { loadRules, suggestFromRules, canAutoCategorize } from '../services/categoryRules.service'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { loadEngineConfigAsync, setEngineFamily, invalidateEngineCache } from '../services/financeEngine.service'

interface DataContextValue {
  transactions: Transaction[]
  budgets: Budget[]
  closings: MonthClosing[]
  subCategories: SubCategory[]
  provisions: Provision[]
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
  saveProvision: (prov: Provision) => Promise<void>
  deleteProvision: (id: string) => Promise<void>
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
  const [provisions, setProvisions] = useState<Provision[]>([])
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
      const [cl, subs, provs] = await Promise.all([
        provider.getMonthlyClosings(),
        provider.loadSubCategories(),
        provider.loadProvisions(),
      ])
      setClosings(cl)
      setSubCategories(subs)
      setProvisions(provs)
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar dados')
    } finally {
      if (showLoadingUI) setLoading(false)
    }
  }, [provider])

  // Re-load whenever provider + familyId change. Also bootstraps engine config from Supabase.
  useEffect(() => {
    void loadData()
    if (familyId) {
      setEngineFamily(familyId)
      invalidateEngineCache()
      void loadEngineConfigAsync(familyId)
    }
  }, [loadData, familyId])

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
    const { unique } = dedupeIncomingBatch(txns, transactions)
    // Auto-apply category rules to incoming transactions that are not manually classified
    const activeRules = loadRules().filter(r => r.active)
    const allMacros = getAllMacroCategories()
    const withRules = unique.map(tx => {
      if (!canAutoCategorize(tx) || tx.manualCategoryOverride) return tx
      const match = suggestFromRules(tx, activeRules)
      if (!match) return tx
      const macro = allMacros.find(m => m.id === match.macroCategoryId)
      return {
        ...tx,
        macroCategoryId: match.macroCategoryId,
        subCategoryId: match.subCategoryId ?? tx.subCategoryId,
        classificationType: macro?.classificationType ?? tx.classificationType,
        includeInOperationalResult: macro ? macro.displayInResult : tx.includeInOperationalResult,
        includeInCashflow: macro ? macro.displayInCashflow : tx.includeInCashflow,
        includeInBudget: macro ? macro.displayInBudget : tx.includeInBudget,
        categorySuggestionSource: 'rule' as const,
        categoryConfidence: match.confidence,
        needsReview: false,
      }
    })
    await provider.appendTransactions(withRules)
    await loadData(false)
  }, [provider, loadData, transactions])

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

  const saveProvision = useCallback(async (prov: Provision) => {
    await provider.saveProvision(prov)
    setProvisions(await provider.loadProvisions())
  }, [provider])

  const deleteProvision = useCallback(async (id: string) => {
    await provider.deleteProvision(id)
    setProvisions(await provider.loadProvisions())
  }, [provider])

  return (
    <DataContext.Provider value={{
      transactions, budgets, closings, subCategories, provisions, isDemo, loading, error,
      reload, updateTransaction, updateTransactions, saveBudget, saveClosing, appendTransactions,
      saveSubCategory, deleteSubCategory, saveProvision, deleteProvision,
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

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import type { Transaction, Budget, MonthClosing, SubCategory, Provision } from '../types'
import { useAuth } from './AuthContext'
import { createDataProvider } from '../adapters/adapter.factory'
import { dedupeIncomingBatch } from '../utils/transactionDedupe'
import { loadRules, suggestFromRules, canAutoCategorize } from '../services/categoryRules.service'
import { getAllMacroCategories } from '../services/financeParentCategories.service'
import { loadEngineConfigAsync, setEngineFamily, invalidateEngineCache } from '../services/financeEngine.service'
import { syncCategoryOverridesFromSupabase, setCategoryOverrideFamily } from '../services/categoryOverrideSync'
import { pushUndo } from '../services/undoStack'

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
      // Popula o cache de overrides de categoria/macro antes do primeiro paint,
      // para que getAllCategories/getAllMacroCategories já reflitam o Supabase.
      if (familyId) await syncCategoryOverridesFromSupabase(familyId)
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
  }, [provider, familyId])

  // Re-load whenever provider + familyId change. Also bootstraps engine config from Supabase.
  useEffect(() => {
    void loadData()
    setCategoryOverrideFamily(familyId ?? null)
    if (familyId) {
      setEngineFamily(familyId)
      invalidateEngineCache()
      void loadEngineConfigAsync(familyId)
    }
  }, [loadData, familyId])

  const reload = useCallback(() => { void loadData() }, [loadData])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    const prevTx = transactions.find(t => t.id === id)
    void provider.updateTransaction(id, patch).then(() => loadData(false))
    if (prevTx) {
      const revertPatch = Object.fromEntries(
        Object.keys(patch).map(k => [k, (prevTx as unknown as Record<string, unknown>)[k]]),
      ) as Partial<Transaction>
      pushUndo({
        label: 'Edição de lançamento',
        undo: async () => { await provider.updateTransaction(id, revertPatch); await loadData(false) },
      })
    }
  }, [provider, loadData, transactions])

  const updateTransactions = useCallback(async (
    items: Array<{ id: string; patch: Partial<Transaction> }>,
    opts?: { markManual?: boolean },
  ) => {
    const revertItems = items
      .map(({ id, patch }) => {
        const prevTx = transactions.find(t => t.id === id)
        if (!prevTx) return null
        const revertPatch = Object.fromEntries(
          Object.keys(patch).map(k => [k, (prevTx as unknown as Record<string, unknown>)[k]]),
        ) as Partial<Transaction>
        return { id, patch: revertPatch }
      })
      .filter((i): i is { id: string; patch: Partial<Transaction> } => i !== null)
    await provider.updateTransactions(items, opts)
    await loadData(false)  // single silent reload after the whole batch
    if (revertItems.length > 0) {
      pushUndo({
        label: `Edição em lote (${revertItems.length})`,
        undo: async () => { await provider.updateTransactions(revertItems); await loadData(false) },
      })
    }
  }, [provider, loadData, transactions])

  const saveBudget = useCallback((budget: Budget) => {
    const prevBudget = budgets.find(b => b.id === budget.id)
    void provider.saveBudget(budget).then(() => loadData(false))
    if (prevBudget) {
      pushUndo({
        label: 'Edição de orçamento',
        undo: async () => { await provider.saveBudget(prevBudget); await loadData(false) },
      })
    }
  }, [provider, loadData, budgets])

  const saveClosing = useCallback((closing: MonthClosing) => {
    const prevClosing = closings.find(c => c.month === closing.month)
    void provider.saveMonthlyClosing(closing).then(() => loadData(false))
    if (prevClosing) {
      pushUndo({
        label: 'Edição de fechamento',
        undo: async () => { await provider.saveMonthlyClosing(prevClosing); await loadData(false) },
      })
    }
  }, [provider, loadData, closings])

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
    const prevSub = subCategories.find(s => s.id === sub.id)
    await provider.saveSubCategory(sub)
    const updated = await provider.loadSubCategories()
    setSubCategories(updated)
    pushUndo({
      label: 'Edição de subcategoria',
      undo: async () => {
        if (prevSub) await provider.saveSubCategory(prevSub)
        else await provider.deleteSubCategory(sub.id)
        setSubCategories(await provider.loadSubCategories())
      },
    })
  }, [provider, subCategories])

  const deleteSubCategory = useCallback(async (id: string) => {
    const prevSub = subCategories.find(s => s.id === id)
    await provider.deleteSubCategory(id)
    const updated = await provider.loadSubCategories()
    setSubCategories(updated)
    if (prevSub) {
      pushUndo({
        label: 'Exclusão de subcategoria',
        undo: async () => { await provider.saveSubCategory(prevSub); setSubCategories(await provider.loadSubCategories()) },
      })
    }
  }, [provider, subCategories])

  const saveProvision = useCallback(async (prov: Provision) => {
    const prevProv = provisions.find(p => p.id === prov.id)
    await provider.saveProvision(prov)
    setProvisions(await provider.loadProvisions())
    pushUndo({
      label: 'Edição de provisão',
      undo: async () => {
        if (prevProv) await provider.saveProvision(prevProv)
        else await provider.deleteProvision(prov.id)
        setProvisions(await provider.loadProvisions())
      },
    })
  }, [provider, provisions])

  const deleteProvision = useCallback(async (id: string) => {
    const prevProv = provisions.find(p => p.id === id)
    await provider.deleteProvision(id)
    setProvisions(await provider.loadProvisions())
    if (prevProv) {
      pushUndo({
        label: 'Exclusão de provisão',
        undo: async () => { await provider.saveProvision(prevProv); setProvisions(await provider.loadProvisions()) },
      })
    }
  }, [provider, provisions])

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

import { MACRO_CATEGORIES } from '../config/categories'
import type { Category, ClassificationType, SubCategory, Transaction } from '../types'
import type { CategoryRule } from './categoryRules.service'
import { deleteRule, loadRules, normalizeText, upsertRule } from './categoryRules.service'
import { buildFinanceCommandPlan, type FinanceCommandPlan } from './financeCommand.service'
import {
  createCommandSnapshot,
  findCommandHistoryEntry,
  getCommandHistory,
  getLastAppliedCommand,
  saveCommandHistoryEntry,
  updateCommandHistoryEntry,
  type FinanceCommandHistoryEntry,
} from './financeCommandHistory.service'
import {
  deleteCustomCategory,
  findCategoryByName,
  getAllCategories,
  isCustomCategoryId,
  upsertCustomCategory,
} from './financeCategories.service'
import { loadSubCategories, newSubCategoryId } from './subcategory.service'

export type FinanceCommandResult = {
  commandId: string
  affectedTransactions: number
  createdCategories: string[]
  createdSubCategories: string[]
  createdRules: string[]
  message: string
}

export type FinanceCommandPreview = {
  plan: FinanceCommandPlan
  matchedTransactions: Transaction[]
  wouldCreateCategories: string[]
  wouldCreateSubCategories: string[]
  wouldCreateRules: string[]
}

export type FinanceCommandContext = {
  transactions: Transaction[]
  subCategories: SubCategory[]
  updateTransactions: (items: Array<{ id: string; patch: Partial<Transaction> }>, opts?: { markManual?: boolean }) => Promise<void>
  saveSubCategory: (sub: SubCategory) => Promise<void>
  deleteSubCategory: (id: string) => Promise<void>
  reload: () => void
}

type ResolvedTargets = {
  category?: Category
  macroCategoryId?: string
  classificationType?: ClassificationType
  createdCategoryName?: string
  subCategory?: SubCategory
  createdSubCategoryName?: string
}

function classifyTypeFromMacro(macroCategoryId: string | undefined): ClassificationType | undefined {
  return MACRO_CATEGORIES.find(macro => macro.id === macroCategoryId)?.classificationType
}

function inferMacroCategoryId(name: string | undefined): string | undefined {
  if (!name) return undefined
  const norm = normalizeText(name)
  const exactMacro = MACRO_CATEGORIES.find(macro => normalizeText(macro.name) === norm)
  if (exactMacro) return exactMacro.id

  const aliases: Array<[RegExp, string]> = [
    [/SALAR|RECEITA/, 'mac_receita_op'],
    [/SAUDE|FARMA|DROGA/, 'mac_saude'],
    [/TRANSP|ESTACION|PEDAG|SEM PARAR|COMBUST/, 'mac_transporte'],
    [/ASSINAT|SPOTIFY|MUSICA|STREAMING/, 'mac_assinaturas'],
    [/CASA|ALUGUEL|CONTA/, 'mac_casa'],
    [/EDUCAC|CURSO/, 'mac_educacao'],
    [/COMPRA|LOJA|AMAZON|MERCADO LIVRE/, 'mac_compras'],
    [/DIVID|JURO/, 'mac_divida'],
    [/INVEST|RESGATE|APORTE|MOVIMENT/, 'mac_movfin'],
  ]
  return aliases.find(([pattern]) => pattern.test(norm))?.[1]
}

function matchTransactions(plan: FinanceCommandPlan, transactions: Transaction[], subCategories: SubCategory[]): Transaction[] {
  return transactions.filter(tx => {
    if (plan.filters.onlyUncategorized && tx.macroCategoryId) return false
    if (plan.filters.type && plan.filters.type !== 'any') {
      if (plan.filters.type === 'income' && tx.type !== 'income') return false
      if (plan.filters.type === 'expense' && tx.type !== 'expense') return false
      if (plan.filters.type === 'transfer' && tx.classificationType !== 'transfer' && tx.classificationType !== 'neutral') return false
    }
    if (plan.filters.dateFrom && tx.competenceDate < plan.filters.dateFrom) return false
    if (plan.filters.dateTo && tx.competenceDate > plan.filters.dateTo) return false
    if (plan.filters.amountMin != null && tx.amount < plan.filters.amountMin) return false
    if (plan.filters.amountMax != null && tx.amount > plan.filters.amountMax) return false

    const haystack = normalizeText(`${tx.description} ${tx.originalDescription ?? ''} ${tx.pluggyReceiverName ?? ''} ${tx.pluggyPayerName ?? ''}`)
    if (plan.filters.descriptionContains?.length) {
      const ok = plan.filters.descriptionContains.every(term => haystack.includes(normalizeText(term)))
      if (!ok) return false
    }
    if (plan.filters.accountContains?.length) {
      const accountHay = normalizeText(`${tx.accountId} ${tx.pluggyAccountName ?? ''} ${tx.pluggyInstitutionName ?? ''}`)
      const ok = plan.filters.accountContains.every(term => accountHay.includes(normalizeText(term)))
      if (!ok) return false
    }
    if (plan.filters.categoryContains?.length) {
      const categoryHay = normalizeText(tx.macroCategoryId ?? '')
      const ok = plan.filters.categoryContains.every(term => categoryHay.includes(normalizeText(term)))
      if (!ok) return false
    }
    if (plan.filters.subCategoryContains?.length) {
      const currentSub = subCategories.find(sub => sub.id === tx.subCategoryId)
      const subHay = normalizeText(`${tx.subCategoryId ?? ''} ${currentSub?.name ?? ''}`)
      const ok = plan.filters.subCategoryContains.every(term => subHay.includes(normalizeText(term)))
      if (!ok) return false
    }
    return true
  })
}

async function resolveTargets(plan: FinanceCommandPlan, ctx: FinanceCommandContext): Promise<ResolvedTargets> {
  const categoryName = plan.actions.categoryName
  const subCategoryName = plan.actions.subCategoryName
  let category = plan.actions.categoryId ? getAllCategories().find(item => item.id === plan.actions.categoryId) : undefined
  let macroCategoryId = category?.macroCategoryId
  let classificationType = category?.classificationType
  let createdCategoryName: string | undefined

  if (!category && categoryName) {
    category = findCategoryByName(categoryName)
    macroCategoryId = category?.macroCategoryId
    classificationType = category?.classificationType
  }

  if (!macroCategoryId && categoryName) {
    macroCategoryId = inferMacroCategoryId(categoryName)
    classificationType = classifyTypeFromMacro(macroCategoryId)
  }

  let subCategory = plan.actions.subCategoryId
    ? ctx.subCategories.find(item => item.id === plan.actions.subCategoryId)
    : undefined

  if (!subCategory && subCategoryName) {
    subCategory = ctx.subCategories.find(item => normalizeText(item.name) === normalizeText(subCategoryName))
  }

  if (!macroCategoryId && subCategory) {
    macroCategoryId = subCategory.macroCategoryId
    classificationType = classifyTypeFromMacro(macroCategoryId)
  }

  if (!category && categoryName && plan.actions.createCategoryIfMissing && macroCategoryId) {
    category = upsertCustomCategory({
      name: categoryName,
      macroCategoryId,
      classificationType: classificationType ?? classifyTypeFromMacro(macroCategoryId) ?? 'operational_expense',
    })
    createdCategoryName = category.name
    classificationType = category.classificationType
  }

  let createdSubCategoryName: string | undefined
  if (!subCategory && subCategoryName && plan.actions.createSubCategoryIfMissing && macroCategoryId) {
    subCategory = {
      id: newSubCategoryId(),
      name: subCategoryName.trim(),
      macroCategoryId,
      essentiality: 'inherit',
      active: true,
      createdAt: new Date().toISOString(),
    }
    await ctx.saveSubCategory(subCategory)
    createdSubCategoryName = subCategory.name
  }

  return { category, macroCategoryId, classificationType, createdCategoryName, subCategory, createdSubCategoryName }
}

function buildPatch(tx: Transaction, plan: FinanceCommandPlan, resolved: ResolvedTargets): Partial<Transaction> {
  const now = new Date().toISOString()
  const tags = new Set(tx.tags ?? [])
  for (const tag of plan.actions.tagsToAdd ?? []) tags.add(tag)

  const patch: Partial<Transaction> = {
    updatedAt: now,
    needsReview: false,
    categoryConfidence: 'high',
    categorySuggestionSource: 'command',
    manualCategoryOverride: true,
    manualEditedAt: now,
  }

  if (resolved.category) patch.categoryId = resolved.category.id
  if (resolved.macroCategoryId) patch.macroCategoryId = resolved.macroCategoryId
  if (resolved.subCategory) {
    patch.subCategoryId = resolved.subCategory.id
    patch.manualSubCategoryOverride = true
  }
  if (resolved.classificationType) patch.classificationType = resolved.classificationType
  if (tags.size > 0) patch.tags = Array.from(tags)

  if (plan.intent === 'mark_income') {
    patch.type = 'income'
    patch.classificationType = 'operational_income'
  }
  if (plan.intent === 'mark_expense') {
    patch.type = 'expense'
    patch.classificationType = 'operational_expense'
  }
  if (plan.intent === 'mark_neutral') {
    patch.classificationType = 'neutral'
    patch.includeInOperationalResult = false
    patch.includeInBudget = false
  }

  return patch
}

function buildRule(tx: Transaction, plan: FinanceCommandPlan, resolved: ResolvedTargets): CategoryRule | null {
  if (!plan.actions.createRule || !resolved.macroCategoryId) return null
  const beforeRuleIds = new Set(loadRules().map(rule => rule.id))
  const rule = upsertRule({
    pattern: plan.actions.rulePattern ?? plan.filters.descriptionContains?.[0] ?? tx.description,
    macroCategoryId: resolved.macroCategoryId,
    subCategoryId: resolved.subCategory?.id,
    classificationType: resolved.classificationType,
    confidence: 'high',
    origin: 'command',
  })
  if (!rule) return null
  return beforeRuleIds.has(rule.id) ? null : rule
}

export function previewFinanceCommand(plan: FinanceCommandPlan, ctx: FinanceCommandContext): FinanceCommandPreview {
  const matchedTransactions = matchTransactions(plan, ctx.transactions, ctx.subCategories)
  const existingCategory = plan.actions.categoryName ? findCategoryByName(plan.actions.categoryName) : undefined
  const existingSub = plan.actions.subCategoryName
    ? ctx.subCategories.find(item => normalizeText(item.name) === normalizeText(plan.actions.subCategoryName!))
    : undefined
  return {
    plan,
    matchedTransactions,
    wouldCreateCategories: plan.actions.createCategoryIfMissing && plan.actions.categoryName && !existingCategory ? [plan.actions.categoryName] : [],
    wouldCreateSubCategories: plan.actions.createSubCategoryIfMissing && plan.actions.subCategoryName && !existingSub ? [plan.actions.subCategoryName] : [],
    wouldCreateRules: plan.actions.createRule && plan.actions.rulePattern ? [plan.actions.rulePattern] : [],
  }
}

export async function executeFinanceCommand(plan: FinanceCommandPlan, ctx: FinanceCommandContext): Promise<FinanceCommandResult> {
  const matchedTransactions = matchTransactions(plan, ctx.transactions, ctx.subCategories)
  const beforeRules = loadRules()
  const beforeCustomCategories = getAllCategories().filter(category => isCustomCategoryId(category.id))
  const resolved = await resolveTargets(plan, ctx)

  const patches = matchedTransactions.map(tx => ({ id: tx.id, patch: buildPatch(tx, plan, resolved) }))
  const createdRuleNames: string[] = []
  for (const tx of matchedTransactions.slice(0, 1)) {
    const createdRule = buildRule(tx, plan, resolved)
    if (createdRule) createdRuleNames.push(createdRule.pattern)
  }

  const snapshot = createCommandSnapshot({
    command: plan.originalPrompt,
    plan,
    summary: {
      affectedTransactions: matchedTransactions.length,
      createdCategories: resolved.createdCategoryName ? [resolved.createdCategoryName] : [],
      createdSubCategories: resolved.createdSubCategoryName ? [resolved.createdSubCategoryName] : [],
      createdRules: createdRuleNames,
    },
    before: {
      transactions: matchedTransactions.map(tx => ({ ...tx })),
      categories: beforeCustomCategories.map(category => ({ ...category })),
      subCategories: ctx.subCategories.map(sub => ({ ...sub })),
      rules: beforeRules.map(rule => ({ ...rule })),
    },
  })

  saveCommandHistoryEntry(snapshot)

  if (patches.length > 0) {
    await ctx.updateTransactions(patches, { markManual: true })
  }

  ctx.reload()

  const afterRules = loadRules()
  const afterCategories = getAllCategories().filter(category => isCustomCategoryId(category.id))
  const afterSubCategories = loadSubCategories()
  updateCommandHistoryEntry(snapshot.id, {
    after: {
      transactions: matchTransactions(plan, ctx.transactions.map(tx => {
        const patch = patches.find(item => item.id === tx.id)?.patch
        return patch ? { ...tx, ...patch } : tx
      }), afterSubCategories),
      categories: afterCategories.map(category => ({ ...category })),
      subCategories: afterSubCategories.map(sub => ({ ...sub })),
      rules: afterRules.map(rule => ({ ...rule })),
    },
  })

  const createdCategories = resolved.createdCategoryName ? [resolved.createdCategoryName] : []
  const createdSubCategories = resolved.createdSubCategoryName ? [resolved.createdSubCategoryName] : []
  const message = [
    'Comando aplicado:',
    `${matchedTransactions.length} lançamento${matchedTransactions.length !== 1 ? 's' : ''} atualizado${matchedTransactions.length !== 1 ? 's' : ''}`,
    createdCategories.length ? `categoria ${createdCategories.join(', ')} criada` : '',
    createdSubCategories.length ? `subcategoria ${createdSubCategories.join(', ')} criada` : '',
    createdRuleNames.length ? `regra ${createdRuleNames.join(', ')} criada` : '',
  ].filter(Boolean).join(', ')

  return {
    commandId: plan.id,
    affectedTransactions: matchedTransactions.length,
    createdCategories,
    createdSubCategories,
    createdRules: createdRuleNames,
    message,
  }
}

function buildRestorePatch(before: Transaction): Partial<Transaction> {
  return {
    description: before.description,
    originalDescription: before.originalDescription,
    amount: before.amount,
    type: before.type,
    classificationType: before.classificationType,
    transactionDate: before.transactionDate,
    competenceDate: before.competenceDate,
    paymentDate: before.paymentDate,
    status: before.status,
    categoryId: before.categoryId,
    subCategoryId: before.subCategoryId,
    macroCategoryId: before.macroCategoryId,
    paymentMethod: before.paymentMethod,
    includeInOperationalResult: before.includeInOperationalResult,
    includeInCashflow: before.includeInCashflow,
    includeInBudget: before.includeInBudget,
    isInternalTransfer: before.isInternalTransfer,
    notes: before.notes,
    tags: before.tags,
    needsReview: before.needsReview,
    categoryConfidence: before.categoryConfidence,
    categorySuggestionSource: before.categorySuggestionSource,
    manualCategoryOverride: before.manualCategoryOverride,
    manualSubCategoryOverride: before.manualSubCategoryOverride,
    manualTextOverride: before.manualTextOverride,
    manualEditedAt: before.manualEditedAt,
  }
}

async function removeUnusedArtifacts(entry: FinanceCommandHistoryEntry, ctx: FinanceCommandContext): Promise<void> {
  const restoreMap = new Map(entry.before.transactions.map(tx => [tx.id, tx]))
  const projectedTransactions = ctx.transactions.map(tx => restoreMap.get(tx.id) ?? tx)

  for (const categoryName of entry.summary.createdCategories) {
    const category = findCategoryByName(categoryName)
    if (!category || !isCustomCategoryId(category.id)) continue
    const inUse = projectedTransactions.some(tx => tx.categoryId === category.id)
    if (!inUse) deleteCustomCategory(category.id)
  }

  for (const subName of entry.summary.createdSubCategories) {
    const sub = loadSubCategories().find(item => normalizeText(item.name) === normalizeText(subName))
    if (!sub) continue
    const inUse = projectedTransactions.some(tx => tx.subCategoryId === sub.id)
    if (!inUse) await ctx.deleteSubCategory(sub.id)
  }

  for (const ruleName of entry.summary.createdRules) {
    const rule = loadRules().find(item => item.pattern === normalizeText(ruleName))
    if (rule) deleteRule(rule.id)
  }
}

export async function undoCommand(entryId: string, ctx: FinanceCommandContext): Promise<FinanceCommandResult> {
  const entry = getCommandHistory().find(item => item.id === entryId && item.status === 'applied')
  if (!entry) {
    return {
      commandId: entryId,
      affectedTransactions: 0,
      createdCategories: [],
      createdSubCategories: [],
      createdRules: [],
      message: 'Nenhum comando aplicável encontrado para desfazer.',
    }
  }

  const patches = entry.before.transactions.map(tx => ({ id: tx.id, patch: buildRestorePatch(tx) }))
  if (patches.length > 0) await ctx.updateTransactions(patches, { markManual: false })
  await removeUnusedArtifacts(entry, ctx)
  updateCommandHistoryEntry(entry.id, { status: 'undone' })
  ctx.reload()

  return {
    commandId: entry.id,
    affectedTransactions: patches.length,
    createdCategories: [],
    createdSubCategories: [],
    createdRules: [],
    message: `Último comando desfeito. ${patches.length} lançamento${patches.length !== 1 ? 's' : ''} restaurado${patches.length !== 1 ? 's' : ''}.`,
  }
}

export async function undoLastFinanceCommand(ctx: FinanceCommandContext): Promise<FinanceCommandResult> {
  const last = getLastAppliedCommand()
  if (!last) {
    return {
      commandId: 'none',
      affectedTransactions: 0,
      createdCategories: [],
      createdSubCategories: [],
      createdRules: [],
      message: 'Nenhum comando anterior para desfazer.',
    }
  }
  return undoCommand(last.id, ctx)
}

export async function executePromptAsFinanceCommand(prompt: string, ctx: FinanceCommandContext, mode: 'apply' | 'preview' = 'apply') {
  const plan = buildFinanceCommandPlan(prompt)
  if (mode === 'preview' || plan.intent === 'find_transactions' || plan.intent === 'unknown') {
    return previewFinanceCommand(plan, ctx)
  }
  if (plan.intent === 'undo_last') return undoLastFinanceCommand(ctx)
  if (plan.intent === 'undo_command') {
    const token = plan.filters.descriptionContains?.[0]
    const entry = token ? findCommandHistoryEntry(token) : getLastAppliedCommand()
    return entry ? undoCommand(entry.id, ctx) : {
      commandId: plan.id,
      affectedTransactions: 0,
      createdCategories: [],
      createdSubCategories: [],
      createdRules: [],
      message: 'Nenhum comando correspondente encontrado para desfazer.',
    }
  }
  return executeFinanceCommand(plan, ctx)
}

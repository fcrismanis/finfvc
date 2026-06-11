import type { ClassificationType, TransactionType } from '../types'
import type { ClassificationResult } from './types'

interface ClassificationRule {
  keywords: string[]
  type: TransactionType
  classificationType: ClassificationType
  macroCategoryId: string
  categoryId: string
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  includeInBudget: boolean
  isInternalTransfer: boolean
}

const RULES: ClassificationRule[] = [
  // Debt / special check interest
  {
    keywords: ['JUROS', 'LIMITE DA CONTA', 'IOF', 'CHEQUE ESPECIAL'],
    type: 'expense', classificationType: 'debt_cost', macroCategoryId: 'mac_divida', categoryId: 'cat_dividas',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Redemption
  {
    keywords: ['RESGATE', 'RESG.', 'RESGATE INVEST'],
    type: 'income', classificationType: 'redemption', macroCategoryId: 'mac_movfin', categoryId: 'cat_resgate',
    includeInOperationalResult: false, includeInCashflow: true, includeInBudget: false, isInternalTransfer: false,
  },
  // Investment / aporte
  {
    keywords: ['APORTE', 'INVESTIMENTO', 'APLICACAO', 'APLICAÇÃO', 'CDB', 'LCI', 'LCA', 'TESOURO', 'FUNDO'],
    type: 'expense', classificationType: 'investment', macroCategoryId: 'mac_movfin', categoryId: 'cat_aporte',
    includeInOperationalResult: false, includeInCashflow: true, includeInBudget: false, isInternalTransfer: false,
  },
  // Transfer / internal — NOTE: 'DOC' removed (too broad; matches DOCE/COMERCIO/DOCTO)
  {
    keywords: ['TRANSFERENCIA', 'TRANSFERÊNCIA', 'TRANSF.', 'TED ', ' DOC ', 'PAGAMENTO DE FATURA', 'PAGAMENTO FAT', 'PAG FAT', 'FAT. CARTAO', 'FATURA CARTAO', 'PAG FATURA', 'PAG. FATURA', 'DOCTO:'],
    type: 'expense', classificationType: 'transfer', macroCategoryId: 'mac_movfin', categoryId: 'cat_aporte',
    includeInOperationalResult: false, includeInCashflow: true, includeInBudget: false, isInternalTransfer: true,
  },
  // Adjustment / control entries
  {
    keywords: ['DIFERENCA PARA ACHAR', 'DIFERENÇA PARA ACHAR', 'AJUSTE MANUAL', 'LANCAMENTO AJUSTE'],
    type: 'expense', classificationType: 'adjustment', macroCategoryId: 'mac_movfin', categoryId: 'cat_aporte',
    includeInOperationalResult: false, includeInCashflow: false, includeInBudget: false, isInternalTransfer: false,
  },
  // Salary
  {
    keywords: ['SALARIO', 'SALÁRIO', 'FOLHA', 'PAGAMENTO FOLHA', 'VENCIMENTO'],
    type: 'income', classificationType: 'operational_income', macroCategoryId: 'mac_receita_op', categoryId: 'cat_salario',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Extraordinary income - PLR / 13th / vacation
  {
    keywords: ['PLR', '13 SAL', 'DECIMO', 'DÉCIMO', 'FERIAS', 'FÉRIAS', 'BONUS', 'BÔNUS'],
    type: 'income', classificationType: 'extraordinary_income', macroCategoryId: 'mac_receita_ev', categoryId: 'cat_outras_receitas',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: false, isInternalTransfer: false,
  },
  // FIT payment
  {
    keywords: ['FIT ', 'FIT-', 'PAGAMENTO FIT'],
    type: 'income', classificationType: 'operational_income', macroCategoryId: 'mac_receita_op', categoryId: 'cat_fit',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Food: supermarkets
  {
    keywords: ['SUPERMERCADO', 'MERCADO', 'CARREFOUR', 'EXTRA', 'ASSAI', 'ATACADAO', 'ATACADÃO', 'PORCAO', 'PORCÃO', 'ZONA SUL', 'HORTIFRUTI', 'PERIM', 'BIG', 'WALMART', 'COMPER'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_alimentacao',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Food: butcher
  {
    keywords: ['ACOUGUE', 'AÇOUGUE', 'FRIGORÍFICO', 'FRIGORIFICO'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_acougue',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Food: bakery / delivery
  {
    keywords: ['PADARIA', 'CONFEITARIA', 'PANIFICADORA', 'IFOOD', 'RAPPI', 'UBER EAT', 'DELIVERY'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_padaria',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Food: restaurants
  {
    keywords: ['RESTAURANTE', 'LANCHONETE', 'LANCHE', 'CHURRASCARIA', 'PIZZARIA', 'HAMBURGER', 'BURGUER', 'SUSHI', 'CAFE ', 'CAFETERIA', 'MCDONALDS', 'SUBWAY', 'STARBUCKS', 'KFC', 'BURGER KING'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_restaurantes',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Health: pharmacy
  {
    keywords: ['FARMACIA', 'FARMÁCIA', 'DROGARIA', 'DROGASIL', 'ULTRAFARMA', 'PACHECO', 'PANVEL'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_saude', categoryId: 'cat_farmacia',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Health: gym
  {
    keywords: ['ACADEMIA', 'SMART FIT', 'SMARTFIT', 'BLUEFIT', 'BODYTECH', 'CROSSFIT'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_saude', categoryId: 'cat_academias',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Transport: fuel
  {
    keywords: ['POSTO ', 'COMBUSTIVEL', 'COMBUSTÍVEL', 'GASOLINA', 'ALCOOL', 'DIESEL', 'IPIRANGA', 'SHELL', 'BR DIST', 'PETROBRAS'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_transporte', categoryId: 'cat_combustivel',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Transport: parking
  {
    keywords: ['ESTACIONAMENTO', 'PARQUIMETRO', 'SEM PARAR', 'VELOE', 'CONECT CAR', 'AUTOPASS'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_transporte', categoryId: 'cat_estacionamento',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Education: Bethel
  {
    keywords: ['BETHEL', 'ESCOLA BETHEL'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_educacao', categoryId: 'cat_bethel',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Education: Supera
  {
    keywords: ['SUPERA'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_educacao', categoryId: 'cat_supera',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Education: languages
  {
    keywords: ['IDIOMA', 'ENGLISH', 'WIZARD', 'CNA ', 'CURSO '],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_educacao', categoryId: 'cat_idiomas',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Subscriptions: AI / productivity
  {
    keywords: ['OPENAI', 'CHATGPT', 'CLAUDE', 'COPILOT', 'NOTION', 'FIGMA', 'GITHUB'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_assinaturas', categoryId: 'cat_ia',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Housing: mortgage / financing
  {
    keywords: ['FINANC IMOB', 'FINANCIAMENTO IMOB', 'PRESTACAO IMOB', 'PRESTAÇÃO IMOB', 'CAIXA ECON', 'CEF'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_prestacao',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Subscriptions: music/video
  {
    keywords: ['SPOTIFY', 'NETFLIX', 'AMAZON PRIME', 'DISNEY', 'HBO', 'YOUTUBE PREMIUM', 'GLOBOPLAY', 'DEEZER', 'APPLE MUSIC'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_assinaturas', categoryId: 'cat_spotify',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Shopping: marketplace
  {
    keywords: ['MERCADO LIVRE', 'AMERICANAS', 'MAGAZINE LUIZA', 'MAGALU', 'SHOPEE', 'ALIEXPRESS'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_compras', categoryId: 'cat_ml',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
  // Shopping: Amazon
  {
    keywords: ['AMAZON'],
    type: 'expense', classificationType: 'operational_expense', macroCategoryId: 'mac_compras', categoryId: 'cat_ml',
    includeInOperationalResult: true, includeInCashflow: true, includeInBudget: true, isInternalTransfer: false,
  },
]

// Map raw category names from file → ClassificationResult overrides
const RAW_CATEGORY_MAP: Record<string, Partial<ClassificationResult>> = {
  'resgate': { classificationType: 'redemption', macroCategoryId: 'mac_movfin', categoryId: 'cat_resgate', includeInOperationalResult: false, includeInBudget: false },
  'aporte': { classificationType: 'investment', macroCategoryId: 'mac_movfin', categoryId: 'cat_aporte', includeInOperationalResult: false, includeInBudget: false },
  'investimento': { classificationType: 'investment', macroCategoryId: 'mac_movfin', categoryId: 'cat_aporte', includeInOperationalResult: false, includeInBudget: false },
  'transferência saída': { classificationType: 'transfer', macroCategoryId: 'mac_movfin', isInternalTransfer: true, includeInOperationalResult: false, includeInBudget: false },
  'transferência entrada': { classificationType: 'transfer', macroCategoryId: 'mac_movfin', isInternalTransfer: true, includeInOperationalResult: false, includeInBudget: false },
  'transferencia saida': { classificationType: 'transfer', macroCategoryId: 'mac_movfin', isInternalTransfer: true, includeInOperationalResult: false, includeInBudget: false },
  'transferencia entrada': { classificationType: 'transfer', macroCategoryId: 'mac_movfin', isInternalTransfer: true, includeInOperationalResult: false, includeInBudget: false },
  'pagamento de fatura': { classificationType: 'transfer', macroCategoryId: 'mac_movfin', isInternalTransfer: true, includeInOperationalResult: false, includeInBudget: false },
  'salário': { classificationType: 'operational_income', macroCategoryId: 'mac_receita_op', categoryId: 'cat_salario', includeInOperationalResult: true },
  'salario': { classificationType: 'operational_income', macroCategoryId: 'mac_receita_op', categoryId: 'cat_salario', includeInOperationalResult: true },
  'outras receitas': { classificationType: 'extraordinary_income', macroCategoryId: 'mac_receita_ev', categoryId: 'cat_outras_receitas', includeInOperationalResult: true },
  'alimentação': { classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_alimentacao', includeInOperationalResult: true },
  'restaurantes': { classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_restaurantes', includeInOperationalResult: true },
  'padaria / delivery': { classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_padaria', includeInOperationalResult: true },
  'açougue': { classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_acougue', includeInOperationalResult: true },
  'suplementos': { classificationType: 'operational_expense', macroCategoryId: 'mac_alimentacao', categoryId: 'cat_suplementos', includeInOperationalResult: true },
  'casa': { classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_contas', includeInOperationalResult: true },
  'prestação': { classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_prestacao', includeInOperationalResult: true },
  'prestacao': { classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_prestacao', includeInOperationalResult: true },
  'contas de consumo': { classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_contas', includeInOperationalResult: true },
  'manutenção': { classificationType: 'operational_expense', macroCategoryId: 'mac_casa', categoryId: 'cat_manutencao_casa', includeInOperationalResult: true },
  'saúde': { classificationType: 'operational_expense', macroCategoryId: 'mac_saude', categoryId: 'cat_farmacia', includeInOperationalResult: true },
  'farmácia': { classificationType: 'operational_expense', macroCategoryId: 'mac_saude', categoryId: 'cat_farmacia', includeInOperationalResult: true },
  'academias': { classificationType: 'operational_expense', macroCategoryId: 'mac_saude', categoryId: 'cat_academias', includeInOperationalResult: true },
  'transporte': { classificationType: 'operational_expense', macroCategoryId: 'mac_transporte', categoryId: 'cat_combustivel', includeInOperationalResult: true },
  'combustível': { classificationType: 'operational_expense', macroCategoryId: 'mac_transporte', categoryId: 'cat_combustivel', includeInOperationalResult: true },
  'estacionamento / sem parar': { classificationType: 'operational_expense', macroCategoryId: 'mac_transporte', categoryId: 'cat_estacionamento', includeInOperationalResult: true },
  'educação': { classificationType: 'operational_expense', macroCategoryId: 'mac_educacao', categoryId: 'cat_bethel', includeInOperationalResult: true },
  'assinaturas': { classificationType: 'operational_expense', macroCategoryId: 'mac_assinaturas', categoryId: 'cat_ia', includeInOperationalResult: true },
  'ia / produtividade': { classificationType: 'operational_expense', macroCategoryId: 'mac_assinaturas', categoryId: 'cat_ia', includeInOperationalResult: true },
  'compras': { classificationType: 'operational_expense', macroCategoryId: 'mac_compras', categoryId: 'cat_compras', includeInOperationalResult: true },
  'mercado livre / amazon': { classificationType: 'operational_expense', macroCategoryId: 'mac_compras', categoryId: 'cat_ml', includeInOperationalResult: true },
  'serviços': { classificationType: 'operational_expense', macroCategoryId: 'mac_servicos', categoryId: 'cat_compras', includeInOperationalResult: true },
  'lazer': { classificationType: 'operational_expense', macroCategoryId: 'mac_lazer', categoryId: 'cat_compras', includeInOperationalResult: true },
  'impostos e taxas': { classificationType: 'operational_expense', macroCategoryId: 'mac_impostos', categoryId: 'cat_compras', includeInOperationalResult: true },
  'impostos': { classificationType: 'operational_expense', macroCategoryId: 'mac_impostos', categoryId: 'cat_compras', includeInOperationalResult: true },
  'dívidas': { classificationType: 'debt_cost', macroCategoryId: 'mac_divida', categoryId: 'cat_dividas', includeInOperationalResult: true },
  'dividas': { classificationType: 'debt_cost', macroCategoryId: 'mac_divida', categoryId: 'cat_dividas', includeInOperationalResult: true },
}

function classifyByRawCategory(rawCategory: string, rawType: string): ClassificationResult | null {
  const key = rawCategory.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const override = RAW_CATEGORY_MAP[key]
  if (!override) return null

  const isIncome = ['operational_income', 'extraordinary_income', 'redemption'].includes(override.classificationType ?? '')
  const type = isIncome ? 'income' : 'expense'
  const rawIsIncome = rawType.toLowerCase().includes('receita') || rawType.toLowerCase().includes('entrada')

  return {
    type: override.type ?? (rawIsIncome ? 'income' : type),
    classificationType: override.classificationType ?? 'operational_expense',
    macroCategoryId: override.macroCategoryId ?? 'mac_compras',
    categoryId: override.categoryId ?? 'cat_compras',
    includeInOperationalResult: override.includeInOperationalResult ?? true,
    includeInCashflow: override.includeInCashflow ?? true,
    includeInBudget: override.includeInBudget ?? true,
    isInternalTransfer: override.isInternalTransfer ?? false,
  }
}

const FALLBACK_INCOME: ClassificationResult = {
  type: 'income',
  classificationType: 'extraordinary_income',
  macroCategoryId: 'mac_receita_ev',
  categoryId: 'cat_outras_receitas',
  includeInOperationalResult: true,
  includeInCashflow: true,
  includeInBudget: false,
  isInternalTransfer: false,
}

const FALLBACK_EXPENSE: ClassificationResult = {
  type: 'expense',
  classificationType: 'operational_expense',
  macroCategoryId: 'mac_compras',
  categoryId: 'cat_compras',
  includeInOperationalResult: true,
  includeInCashflow: true,
  includeInBudget: true,
  isInternalTransfer: false,
}

export function classifyByDescription(description: string, rawType: string, rawCategory?: string): ClassificationResult {
  // Category-based classification takes priority — more accurate than keyword matching
  if (rawCategory && rawCategory.trim()) {
    const catResult = classifyByRawCategory(rawCategory, rawType)
    if (catResult) return catResult
  }
  const upper = description.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (upper.includes(keyword)) {
        return {
          type: rule.type,
          classificationType: rule.classificationType,
          macroCategoryId: rule.macroCategoryId,
          categoryId: rule.categoryId,
          includeInOperationalResult: rule.includeInOperationalResult,
          includeInCashflow: rule.includeInCashflow,
          includeInBudget: rule.includeInBudget,
          isInternalTransfer: rule.isInternalTransfer,
        }
      }
    }
  }

  // Fall back to type from source data
  const type = rawType.toLowerCase().includes('receita') || rawType.toLowerCase().includes('entrada') ? 'income' : 'expense'
  return type === 'income' ? FALLBACK_INCOME : FALLBACK_EXPENSE
}

export function classificationTypeOptions(): { value: ClassificationType; label: string }[] {
  return [
    { value: 'operational_income', label: 'Receita Operacional' },
    { value: 'extraordinary_income', label: 'Receita Eventual' },
    { value: 'operational_expense', label: 'Despesa Operacional' },
    { value: 'debt_cost', label: 'Dívida / Juros' },
    { value: 'investment', label: 'Investimento / Aporte' },
    { value: 'redemption', label: 'Resgate' },
    { value: 'transfer', label: 'Transferência' },
    { value: 'reimbursement', label: 'Reembolso' },
    { value: 'adjustment', label: 'Ajuste' },
    { value: 'neutral', label: 'Neutro' },
  ]
}

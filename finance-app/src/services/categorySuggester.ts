import type { Transaction, ClassificationType } from '../types'
import { MACRO_CATEGORIES } from '../config/categories'

export type SuggestionConfidence = 'high' | 'medium' | 'low'

export interface CategorySuggestion {
  transactionId: string
  macroCategoryId: string
  macroCategoryName: string
  classificationType: ClassificationType
  confidence: SuggestionConfidence
  reason: string
}

interface SuggestionRule {
  keywords: string[]
  macroCategoryId: string
  classificationType: ClassificationType
  reason: string
}

const RULES: SuggestionRule[] = [
  {
    keywords: ['MERCADO', 'SUPERMERCADO', 'ATACADAO', 'ATACADÃO', 'CARREFOUR', 'PAO DE ACUCAR', 'PÃO DE AÇÚCAR', 'EXTRA', 'BIG', 'WALMART', 'ASSAI', 'ASSAÍ', 'FORT', 'MAKRO', 'PREZUNIC', 'MUNDIAL', 'HORTIFRUTI', 'SACOLAO', 'SACOLÃO', 'QUITANDA'],
    macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', reason: 'Mercado/supermercado',
  },
  {
    keywords: ['IFOOD', 'RAPPI', 'UBER EATS', 'RESTAURANTE', 'LANCHONETE', 'PIZZARIA', 'HAMBURGER', 'HAMBURGUERIA', 'CHURRASCARIA', 'SUSHI', 'JAPANESE', 'CHINESE', 'SABOR', 'GRILL', 'BAR ', 'BOTECO', 'BISTRÔ', 'BISTRO', 'CANTINA', 'SORVETE', 'ACAI', 'AÇAÍ', 'DOCERIA'],
    macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', reason: 'Restaurante/delivery',
  },
  {
    keywords: ['PADARIA', 'PANIFICADORA', 'PÃO ', 'PAO ', 'CAFE ', 'CAFÉ ', 'CAFETERIA', 'CONFEITARIA', 'PASTELARIA', 'SALGADO'],
    macroCategoryId: 'mac_alimentacao', classificationType: 'operational_expense', reason: 'Padaria/café',
  },
  {
    keywords: ['UBER', '99 ', '99POP', 'CABIFY', 'TAXI', 'TÁXI', 'ONIBUS', 'ÔNIBUS', 'METRO', 'METRÔ', 'TREM', 'BARCA', 'BALSA', 'PASSAGEM', 'BRT', 'VLT', 'SPTrans', 'BILHETE'],
    macroCategoryId: 'mac_transporte', classificationType: 'operational_expense', reason: 'Transporte público/aplicativo',
  },
  {
    keywords: ['COMBUSTIVEL', 'COMBUSTÍVEL', 'GASOLINA', 'ETANOL', 'DIESEL', 'POSTO ', 'IPIRANGA', 'SHELL', 'PETROBRAS', 'BR DISTRIBUIDORA', 'PAULINIA'],
    macroCategoryId: 'mac_transporte', classificationType: 'operational_expense', reason: 'Combustível',
  },
  {
    keywords: ['ESTACIONAMENTO', 'ESTACION', 'PARKING', 'SEM PARAR', 'SEMPARAR', 'VIAPASS', 'CONNECT CAR', 'VELOE', 'AUTOPASS'],
    macroCategoryId: 'mac_transporte', classificationType: 'operational_expense', reason: 'Estacionamento/pedágio',
  },
  {
    keywords: ['FARMACIA', 'FARMÁCIA', 'DROGARIA', 'DROGASIL', 'DROGA RAIA', 'ULTRAFARMA', 'PAGUE MENOS', 'PANVEL', 'NOSSA', 'MEDICO', 'MÉDICO', 'CONSULTA', 'CLINICA', 'CLÍNICA', 'HOSPITAL', 'LABORATORIO', 'LABORATÓRIO', 'EXAME', 'PLANO DE SAUDE', 'AMIL', 'UNIMED', 'BRADESCO SAUDE', 'HAPVIDA', 'NOTREDAME'],
    macroCategoryId: 'mac_saude', classificationType: 'operational_expense', reason: 'Saúde/farmácia',
  },
  {
    keywords: ['ACADEMIA', 'SMART FIT', 'SMARTFIT', 'BLUEFIT', 'FITNESS', 'GYM', 'BIKE', 'PILATES', 'YOGA', 'NATACAO', 'NATAÇÃO', 'CROSSFIT'],
    macroCategoryId: 'mac_saude', classificationType: 'operational_expense', reason: 'Academia/exercício',
  },
  {
    keywords: ['ESCOLA', 'COLEGIO', 'COLÉGIO', 'CRECHE', 'CURSO ', 'FACULDADE', 'UNIVERSIDADE', 'MENSALIDADE ESCOLAR', 'MATERIAL ESCOLAR', 'LIVRO', 'IDIOMA', 'INGLES', 'INGLÊS', 'ESPANHOL'],
    macroCategoryId: 'mac_educacao', classificationType: 'operational_expense', reason: 'Educação/curso',
  },
  {
    keywords: ['NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'PRIME VIDEO', 'DISNEY', 'HBO', 'GLOBOPLAY', 'APPLE TV', 'YOUTUBE PREMIUM', 'DEEZER', 'PARAMOUNT', 'DISCOVERY', 'LINKEDIN', 'CANVA', 'ADOBE', 'MICROSOFT', 'GOOGLE ONE', 'ICLOUD', 'DROPBOX', 'CHATGPT', 'OPENAI', 'ANTHROPIC', 'ASSINATURA'],
    macroCategoryId: 'mac_assinaturas', classificationType: 'operational_expense', reason: 'Assinatura digital',
  },
  {
    keywords: ['AMAZON', 'MERCADO LIVRE', 'SHOPEE', 'SUBMARINO', 'AMERICANAS', 'MAGAZINE LUIZA', 'MAGAZINELUIZA', 'CASAS BAHIA', 'FAST SHOP', 'KABUM', 'ALIEXPRESS', 'SHEIN', 'SHOPPING', 'LOJAS ', 'HERING', 'RENNER', 'C&A ', 'RIACHUELO', 'MARISA', 'ZARA', 'H&M'],
    macroCategoryId: 'mac_compras', classificationType: 'operational_expense', reason: 'Compras online/loja',
  },
  {
    keywords: ['JUROS', 'LIMITE', 'IOF', 'FINANCIAMENTO', 'EMPRESTIMO', 'EMPRÉSTIMO', 'PARCELA', 'DIVIDA', 'DÍVIDA', 'CHEQUE ESPECIAL', 'CREDITO PESSOAL', 'CRÉDITO PESSOAL'],
    macroCategoryId: 'mac_divida', classificationType: 'debt_cost', reason: 'Dívida/juros',
  },
  {
    keywords: ['LUZ ', 'ENERGIA ', 'ENEL', 'CEMIG', 'COPEL', 'CELPE', 'CELG', 'COMGAS', 'GAS ', 'GÁS ', 'AGUA ', 'ÁGUA ', 'SANEAMENTO', 'SABESP', 'EMBASA', 'CAESB', 'INTERNET', 'TIM ', 'VIVO ', 'CLARO ', 'OI ', 'NET ', 'SKY ', 'ALUGUEL', 'CONDOMINIO', 'CONDOMÍNIO', 'IPTU', 'SEGURO INCENDIO', 'SEGUROS INCÊNDIO'],
    macroCategoryId: 'mac_casa', classificationType: 'operational_expense', reason: 'Casa/contas fixas',
  },
  {
    keywords: ['SALARIO', 'SALÁRIO', 'FOLHA', 'HOLERITE', 'PAGAMENTO FOLHA', 'VENCIMENTO'],
    macroCategoryId: 'mac_receita_op', classificationType: 'operational_income', reason: 'Salário',
  },
  {
    keywords: ['PIX RECEBIDO', 'TRANSFERENCIA RECEBIDA', 'TRANSFERÊNCIA RECEBIDA', 'TED RECEBIDO', 'REEMBOLSO', 'DEVOLUCAO', 'DEVOLUÇÃO', 'RESTITUICAO', 'RESTITUIÇÃO'],
    macroCategoryId: 'mac_receita_ev', classificationType: 'extraordinary_income', reason: 'Receita eventual/reembolso',
  },
]

export function suggestCategory(tx: Transaction): CategorySuggestion | null {
  if (tx.macroCategoryId) return null // already categorized

  const desc = (tx.description + ' ' + (tx.originalDescription ?? '')).toUpperCase()

  for (const rule of RULES) {
    // Skip income rules for expense transactions and vice-versa
    const ruleIsIncome = rule.classificationType === 'operational_income' || rule.classificationType === 'extraordinary_income'
    if (ruleIsIncome && tx.type !== 'income') continue
    if (!ruleIsIncome && tx.type !== 'expense') continue

    const matched = rule.keywords.some(kw => desc.includes(kw))
    if (!matched) continue

    const macro = MACRO_CATEGORIES.find(m => m.id === rule.macroCategoryId)
    if (!macro) continue

    // Confidence: high if keyword is long (≥8 chars), medium otherwise
    const matchedKw = rule.keywords.find(kw => desc.includes(kw)) ?? ''
    const confidence: SuggestionConfidence = matchedKw.trim().length >= 8 ? 'high' : 'medium'

    return {
      transactionId: tx.id,
      macroCategoryId: rule.macroCategoryId,
      macroCategoryName: macro.name,
      classificationType: rule.classificationType,
      confidence,
      reason: rule.reason,
    }
  }

  return null
}

export function suggestCategories(txs: Transaction[]): CategorySuggestion[] {
  return txs.flatMap(tx => {
    const s = suggestCategory(tx)
    return s ? [s] : []
  })
}

export function buildAiPrompt(
  pendingTxs: Transaction[],
  availableMacros: typeof MACRO_CATEGORIES,
): string {
  const txLines = pendingTxs
    .slice(0, 80)
    .map(t => `- [${t.id.slice(-6)}] ${t.transactionDate} | ${t.type === 'income' ? '+' : '-'}R$${t.amount.toFixed(2)} | ${t.description}`)
    .join('\n')

  const categories = availableMacros.map(m => `${m.id}: ${m.name}`).join(', ')

  return `Sugira macrocategorias para os lançamentos abaixo.

CATEGORIAS DISPONÍVEIS:
${categories}

LANÇAMENTOS (id | data | valor | descrição):
${txLines}

RESPONDA em JSON com este formato exato:
[
  { "id": "últimos 6 chars do id", "macroCategoryId": "mac_xxx", "confidence": "high|medium|low" }
]

Só responda o JSON, sem explicação adicional.`
}

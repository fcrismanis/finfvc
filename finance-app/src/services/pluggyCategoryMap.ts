import type { ClassificationType } from '../types'

// ── Pluggy category lookup result ─────────────────────────────────────────────

export interface PluggyCategoryEntry {
  macroCategoryId: string
  subCategoryId?: string
  subCategoryNameSuggested?: string
  classificationType: ClassificationType
  includeInBudget: boolean
  includeInOperationalResult: boolean
  includeInCashflow: boolean
  isInternalTransfer?: boolean
  confidence: 'high' | 'medium' | 'low'
}

export interface PluggyLookupResult extends PluggyCategoryEntry {
  source: 'id' | 'name' | 'inference'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXPENSE = (
  macroCategoryId: string,
  opts?: Partial<Omit<PluggyCategoryEntry, 'macroCategoryId' | 'classificationType'>>
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: 'operational_expense',
  includeInBudget: true,
  includeInOperationalResult: true,
  includeInCashflow: true,
  confidence: 'high',
  ...opts,
})

const NEUTRAL_ENTRY = (
  macroCategoryId: string,
  opts?: Partial<Omit<PluggyCategoryEntry, 'macroCategoryId' | 'classificationType'>>
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: 'neutral',
  includeInBudget: false,
  includeInOperationalResult: false,
  includeInCashflow: true,
  isInternalTransfer: false,
  confidence: 'high',
  ...opts,
})

const INCOME_ENTRY = (
  macroCategoryId: string,
  cls: 'operational_income' | 'extraordinary_income' = 'operational_income',
  opts?: Partial<Omit<PluggyCategoryEntry, 'macroCategoryId' | 'classificationType'>>
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: cls,
  includeInBudget: false,
  includeInOperationalResult: true,
  includeInCashflow: true,
  confidence: 'high',
  ...opts,
})

const DEBT_ENTRY = (
  macroCategoryId: string,
  opts?: Partial<Omit<PluggyCategoryEntry, 'macroCategoryId' | 'classificationType'>>
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: 'debt_cost',
  includeInBudget: true,
  includeInOperationalResult: true,
  includeInCashflow: true,
  confidence: 'high',
  ...opts,
})

// ── By categoryId (numeric code) — highest confidence ────────────────────────
// Codes confirmed from real Pluggy payload: 07020000, 04000000, 05070000, 02000000

export const PLUGGY_ID_MAP: Record<string, PluggyCategoryEntry> = {
  // Alimentação
  '01000000': EXPENSE('mac_alimentacao', { subCategoryNameSuggested: 'Alimentação geral' }),
  '01010000': EXPENSE('mac_alimentacao', { subCategoryId: 'cat_alimentacao', subCategoryNameSuggested: 'Supermercado' }),
  '01020000': EXPENSE('mac_alimentacao', { subCategoryId: 'cat_restaurantes', subCategoryNameSuggested: 'Restaurantes' }),
  '01030000': EXPENSE('mac_alimentacao', { subCategoryId: 'cat_padaria', subCategoryNameSuggested: 'Padaria / Delivery' }),
  '01040000': EXPENSE('mac_alimentacao', { subCategoryNameSuggested: 'Bebidas' }),
  '01050000': EXPENSE('mac_alimentacao', { subCategoryId: 'cat_acougue', subCategoryNameSuggested: 'Açougue' }),

  // Dívida / Financiamento — confirmado real
  '02000000': DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Financiamentos' }),
  '02010000': DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Empréstimos' }),
  '02020000': DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Parcelamentos' }),

  // Receita operacional
  '03000000': INCOME_ENTRY('mac_receita_op', 'operational_income', { subCategoryNameSuggested: 'Receita geral' }),
  '03010000': INCOME_ENTRY('mac_receita_op', 'operational_income', { subCategoryId: 'cat_salario', subCategoryNameSuggested: 'Salário' }),
  '03020000': INCOME_ENTRY('mac_receita_ev', 'extraordinary_income', { subCategoryId: 'cat_outras_receitas', subCategoryNameSuggested: 'Outras receitas' }),

  // Transferências mesma pessoa — confirmado real
  '04000000': NEUTRAL_ENTRY('mac_movfin', { isInternalTransfer: true, subCategoryNameSuggested: 'Transferência entre contas próprias' }),
  '04010000': NEUTRAL_ENTRY('mac_movfin', { isInternalTransfer: true, subCategoryNameSuggested: 'Transferência entre contas próprias' }),

  // Transferências externas / PIX — confirmado real (05070000)
  '05000000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Transferência' }),
  '05010000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'TED / DOC' }),
  '05020000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Débito em conta' }),
  '05030000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Boleto' }),
  '05040000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Pagamento de cartão' }),
  '05050000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Pagamento de serviço' }),
  '05060000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'Pagamento de tributo' }),
  '05070000': NEUTRAL_ENTRY('mac_movfin', { subCategoryNameSuggested: 'PIX / Transferência' }),

  // Investimentos
  '06000000': NEUTRAL_ENTRY('mac_movfin', { subCategoryId: 'cat_aporte', subCategoryNameSuggested: 'Investimento / Aporte' }),

  // Educação — confirmado real (07020000)
  '07000000': EXPENSE('mac_educacao', { subCategoryNameSuggested: 'Educação geral' }),
  '07010000': EXPENSE('mac_educacao', { subCategoryId: 'cat_bethel', subCategoryNameSuggested: 'Escola' }),
  '07020000': EXPENSE('mac_educacao', { subCategoryId: 'cat_idiomas', subCategoryNameSuggested: 'Cursos / Idiomas' }),

  // Casa / Moradia
  '08000000': EXPENSE('mac_casa', { subCategoryNameSuggested: 'Casa geral' }),
  '08010000': EXPENSE('mac_casa', { subCategoryId: 'cat_prestacao', subCategoryNameSuggested: 'Aluguel / Prestação' }),
  '08020000': EXPENSE('mac_casa', { subCategoryId: 'cat_contas', subCategoryNameSuggested: 'Contas de consumo' }),
  '08030000': EXPENSE('mac_casa', { subCategoryId: 'cat_manutencao_casa', subCategoryNameSuggested: 'Manutenção' }),
  '08040000': EXPENSE('mac_casa', { subCategoryId: 'cat_iptu', subCategoryNameSuggested: 'IPTU / Taxas municipais' }),

  // Saúde
  '09000000': EXPENSE('mac_saude', { subCategoryNameSuggested: 'Saúde geral' }),
  '09010000': EXPENSE('mac_saude', { subCategoryId: 'cat_farmacia', subCategoryNameSuggested: 'Farmácia' }),
  '09020000': EXPENSE('mac_saude', { subCategoryNameSuggested: 'Médicos e Clínicas' }),
  '09030000': EXPENSE('mac_saude', { subCategoryId: 'cat_academias', subCategoryNameSuggested: 'Academia / Fitness' }),

  // Transporte
  '10000000': EXPENSE('mac_transporte', { subCategoryNameSuggested: 'Transporte geral' }),
  '10010000': EXPENSE('mac_transporte', { subCategoryId: 'cat_combustivel', subCategoryNameSuggested: 'Combustível' }),
  '10020000': EXPENSE('mac_transporte', { subCategoryId: 'cat_estacionamento', subCategoryNameSuggested: 'Estacionamento' }),
  '10030000': EXPENSE('mac_transporte', { subCategoryNameSuggested: 'Transporte público / App' }),

  // Assinaturas
  '11000000': EXPENSE('mac_assinaturas', { subCategoryNameSuggested: 'Assinaturas geral' }),
  '11010000': EXPENSE('mac_assinaturas', { subCategoryId: 'cat_spotify', subCategoryNameSuggested: 'Streaming' }),
  '11020000': EXPENSE('mac_assinaturas', { subCategoryId: 'cat_ia', subCategoryNameSuggested: 'Serviços digitais / IA' }),

  // Compras
  '12000000': EXPENSE('mac_compras', { subCategoryId: 'cat_compras', subCategoryNameSuggested: 'Compras geral' }),
  '12010000': EXPENSE('mac_compras', { subCategoryId: 'cat_ml', subCategoryNameSuggested: 'Compras online' }),
  '12020000': EXPENSE('mac_compras', { subCategoryNameSuggested: 'Eletrônicos' }),

  // Serviços
  '13000000': EXPENSE('mac_servicos', { subCategoryNameSuggested: 'Serviços gerais' }),

  // Seguros
  '14000000': EXPENSE('mac_seguros', { subCategoryNameSuggested: 'Seguros' }),

  // Lazer
  '15000000': EXPENSE('mac_lazer', { subCategoryNameSuggested: 'Lazer geral' }),
  '15010000': EXPENSE('mac_lazer', { subCategoryNameSuggested: 'Viagens' }),

  // Impostos
  '16000000': EXPENSE('mac_impostos', { subCategoryNameSuggested: 'Impostos e Taxas' }),

  // Cuidados pessoais
  '17000000': EXPENSE('mac_cuidados', { subCategoryNameSuggested: 'Cuidados pessoais' }),

  // Pets
  '18000000': EXPENSE('mac_pets', { subCategoryNameSuggested: 'Pets' }),
}

// ── By category name (English) — medium confidence ────────────────────────────

const nameEntry = (
  macroCategoryId: string,
  cls: ClassificationType,
  sub?: { id?: string; suggested?: string },
  neutral = false,
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: cls,
  subCategoryId: sub?.id,
  subCategoryNameSuggested: sub?.suggested,
  includeInBudget: !neutral,
  includeInOperationalResult: !neutral,
  includeInCashflow: true,
  confidence: 'medium',
})

export const PLUGGY_NAME_MAP: Record<string, PluggyCategoryEntry> = {
  // Alimentação
  'Groceries':            nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_alimentacao', suggested: 'Supermercado' }),
  'Eating out':           nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_restaurantes', suggested: 'Restaurantes' }),
  'Bars and restaurants': nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_restaurantes', suggested: 'Restaurantes' }),
  'Food and drink':       nameEntry('mac_alimentacao', 'operational_expense', { suggested: 'Alimentação' }),
  'Bakeries':             nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_padaria', suggested: 'Padaria' }),
  'Coffee shops':         nameEntry('mac_alimentacao', 'operational_expense', { suggested: 'Café' }),

  // Casa
  'Housing':              nameEntry('mac_casa', 'operational_expense', { suggested: 'Moradia' }),
  'Rent':                 nameEntry('mac_casa', 'operational_expense', { id: 'cat_prestacao', suggested: 'Aluguel' }),
  'Water and sewage':     nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Água' }),
  'Electricity':          nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Energia' }),
  'Gas':                  nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Gás' }),
  'Internet and telephone': nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Internet / Telefone' }),
  'Home maintenance':     nameEntry('mac_casa', 'operational_expense', { id: 'cat_manutencao_casa', suggested: 'Manutenção' }),
  'Home and garden':      nameEntry('mac_casa', 'operational_expense', { suggested: 'Casa e Jardim' }),
  'Bills and utilities':  nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Contas' }),

  // Saúde
  'Healthcare':           nameEntry('mac_saude', 'operational_expense', { suggested: 'Saúde geral' }),
  'Pharmacy':             nameEntry('mac_saude', 'operational_expense', { id: 'cat_farmacia', suggested: 'Farmácia' }),
  'Doctors and clinics':  nameEntry('mac_saude', 'operational_expense', { suggested: 'Médicos' }),
  'Gym and fitness centers': nameEntry('mac_saude', 'operational_expense', { id: 'cat_academias', suggested: 'Academia' }),
  'Health insurance':     nameEntry('mac_saude', 'operational_expense', { suggested: 'Plano de saúde' }),
  'Health and beauty':    nameEntry('mac_saude', 'operational_expense', { suggested: 'Saúde e Beleza' }),

  // Transporte
  'Transport':            nameEntry('mac_transporte', 'operational_expense', { suggested: 'Transporte' }),
  'Fuel':                 nameEntry('mac_transporte', 'operational_expense', { id: 'cat_combustivel', suggested: 'Combustível' }),
  'Parking':              nameEntry('mac_transporte', 'operational_expense', { id: 'cat_estacionamento', suggested: 'Estacionamento' }),
  'Tolls and parking':    nameEntry('mac_transporte', 'operational_expense', { id: 'cat_estacionamento', suggested: 'Pedágio / Estacionamento' }),
  'Public transport':     nameEntry('mac_transporte', 'operational_expense', { suggested: 'Transporte público' }),
  'Ride hailing':         nameEntry('mac_transporte', 'operational_expense', { suggested: 'Aplicativo de transporte' }),
  'Car maintenance':      nameEntry('mac_transporte', 'operational_expense', { suggested: 'Manutenção de veículo' }),

  // Educação — confirmado real
  'Education':            nameEntry('mac_educacao', 'operational_expense', { id: 'cat_idiomas', suggested: 'Cursos / Escola' }),
  'Courses and training': nameEntry('mac_educacao', 'operational_expense', { id: 'cat_idiomas', suggested: 'Cursos' }),
  'School supplies':      nameEntry('mac_educacao', 'operational_expense', { suggested: 'Material escolar' }),

  // Assinaturas
  'Digital services':     nameEntry('mac_assinaturas', 'operational_expense', { id: 'cat_ia', suggested: 'Serviços digitais' }),
  'Streaming':            nameEntry('mac_assinaturas', 'operational_expense', { id: 'cat_spotify', suggested: 'Streaming' }),
  'Subscriptions':        nameEntry('mac_assinaturas', 'operational_expense', { suggested: 'Assinaturas' }),
  'Apps':                 nameEntry('mac_assinaturas', 'operational_expense', { id: 'cat_ia', suggested: 'Apps / IA' }),

  // Compras
  'Shopping':             nameEntry('mac_compras', 'operational_expense', { id: 'cat_compras', suggested: 'Compras' }),
  'Online shopping':      nameEntry('mac_compras', 'operational_expense', { id: 'cat_ml', suggested: 'Compras online' }),
  'Electronics':          nameEntry('mac_compras', 'operational_expense', { suggested: 'Eletrônicos' }),
  'Clothing':             nameEntry('mac_compras', 'operational_expense', { suggested: 'Vestuário' }),
  'Home appliances':      nameEntry('mac_compras', 'operational_expense', { suggested: 'Eletrodomésticos' }),

  // Serviços
  'Services':             nameEntry('mac_servicos', 'operational_expense', { suggested: 'Serviços' }),
  'Professional services': nameEntry('mac_servicos', 'operational_expense', { suggested: 'Serviços profissionais' }),
  'Domestic services':    nameEntry('mac_servicos', 'operational_expense', { suggested: 'Serviços domésticos' }),

  // Seguros
  'Insurance':            nameEntry('mac_seguros', 'operational_expense', { suggested: 'Seguro' }),
  'Life insurance':       nameEntry('mac_seguros', 'operational_expense', { suggested: 'Seguro de vida' }),
  'Car insurance':        nameEntry('mac_seguros', 'operational_expense', { suggested: 'Seguro veicular' }),

  // Lazer
  'Leisure and tourism':  nameEntry('mac_lazer', 'operational_expense', { suggested: 'Lazer e Turismo' }),
  'Travel':               nameEntry('mac_lazer', 'operational_expense', { suggested: 'Viagens' }),
  'Cinema and theater':   nameEntry('mac_lazer', 'operational_expense', { suggested: 'Cinema e Teatro' }),
  'Sports and leisure':   nameEntry('mac_lazer', 'operational_expense', { suggested: 'Esporte e Lazer' }),
  'Entertainment':        nameEntry('mac_lazer', 'operational_expense', { suggested: 'Entretenimento' }),

  // Cuidados pessoais
  'Personal care':        nameEntry('mac_cuidados', 'operational_expense', { suggested: 'Cuidados pessoais' }),
  'Beauty salon':         nameEntry('mac_cuidados', 'operational_expense', { suggested: 'Salão de beleza' }),
  'Wellness':             nameEntry('mac_cuidados', 'operational_expense', { suggested: 'Bem-estar' }),

  // Pets
  'Pets':                 nameEntry('mac_pets', 'operational_expense', { suggested: 'Pets' }),
  'Veterinary':           nameEntry('mac_pets', 'operational_expense', { suggested: 'Veterinário' }),

  // Impostos
  'Taxes':                nameEntry('mac_impostos', 'operational_expense', { suggested: 'Impostos' }),
  'Bank fees':            nameEntry('mac_impostos', 'operational_expense', { suggested: 'Tarifas bancárias' }),
  'Fees':                 nameEntry('mac_impostos', 'operational_expense', { suggested: 'Tarifas' }),

  // Receita
  'Salary':               nameEntry('mac_receita_op', 'operational_income', { id: 'cat_salario', suggested: 'Salário' }),
  'Income':               nameEntry('mac_receita_ev', 'extraordinary_income', { id: 'cat_outras_receitas', suggested: 'Receita' }),
  'Other credits':        nameEntry('mac_receita_ev', 'extraordinary_income', { id: 'cat_outras_receitas', suggested: 'Outras receitas' }),
  'Investment returns':   nameEntry('mac_receita_ev', 'extraordinary_income', { id: 'cat_resgate', suggested: 'Retorno de investimento' }),

  // Neutros / movimentação financeira — confirmados real
  'Credit card payment':  nameEntry('mac_movfin', 'neutral', { suggested: 'Pagamento de cartão' }, true),
  'Transfers':            nameEntry('mac_movfin', 'neutral', { suggested: 'Transferências' }, true),
  'Same person transfer': nameEntry('mac_movfin', 'neutral', { suggested: 'Transferência entre contas próprias' }, true),
  'Transfer - PIX':       nameEntry('mac_movfin', 'neutral', { suggested: 'PIX / Transferência' }, true),
  'Investments':          nameEntry('mac_movfin', 'neutral', { id: 'cat_aporte', suggested: 'Investimento' }, true),
  'Loans and financing':  DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Financiamentos', confidence: 'medium' }),

  // Português (fallback)
  'Alimentação e Bebidas': nameEntry('mac_alimentacao', 'operational_expense', { suggested: 'Alimentação' }),
  'Restaurantes e Bares':  nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_restaurantes', suggested: 'Restaurantes' }),
  'Supermercados':         nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_alimentacao', suggested: 'Supermercado' }),
  'Padaria e Confeitaria': nameEntry('mac_alimentacao', 'operational_expense', { id: 'cat_padaria', suggested: 'Padaria' }),
  'Saúde e Beleza':        nameEntry('mac_saude', 'operational_expense', { suggested: 'Saúde e Beleza' }),
  'Farmácias':             nameEntry('mac_saude', 'operational_expense', { id: 'cat_farmacia', suggested: 'Farmácia' }),
  'Médicos e Clínicas':    nameEntry('mac_saude', 'operational_expense', { suggested: 'Médicos' }),
  'Academia e Esportes':   nameEntry('mac_saude', 'operational_expense', { id: 'cat_academias', suggested: 'Academia' }),
  'Transporte':            nameEntry('mac_transporte', 'operational_expense', { suggested: 'Transporte' }),
  'Combustível':           nameEntry('mac_transporte', 'operational_expense', { id: 'cat_combustivel', suggested: 'Combustível' }),
  'Educação':              nameEntry('mac_educacao', 'operational_expense', { suggested: 'Educação' }),
  'Assinaturas e Serviços': nameEntry('mac_assinaturas', 'operational_expense', { suggested: 'Assinaturas' }),
  'Streaming e Entretenimento': nameEntry('mac_assinaturas', 'operational_expense', { id: 'cat_spotify', suggested: 'Streaming' }),
  'Compras e Shopping':    nameEntry('mac_compras', 'operational_expense', { id: 'cat_compras', suggested: 'Compras' }),
  'Transferências':        nameEntry('mac_movfin', 'neutral', { suggested: 'Transferências' }, true),
  'Investimentos':         nameEntry('mac_movfin', 'neutral', { id: 'cat_aporte', suggested: 'Investimento' }, true),
  'Empréstimos':           DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Empréstimos', confidence: 'medium' }),
  'Financiamentos':        DEBT_ENTRY('mac_divida', { subCategoryId: 'cat_dividas', subCategoryNameSuggested: 'Financiamentos', confidence: 'medium' }),
  'Salário':               nameEntry('mac_receita_op', 'operational_income', { id: 'cat_salario', suggested: 'Salário' }),
  'Outros Créditos':       nameEntry('mac_receita_ev', 'extraordinary_income', { id: 'cat_outras_receitas', suggested: 'Outras Receitas' }),
  'Contas e Utilidades':   nameEntry('mac_casa', 'operational_expense', { id: 'cat_contas', suggested: 'Contas' }),
  'Impostos e Taxas':      nameEntry('mac_impostos', 'operational_expense', { suggested: 'Impostos' }),
  'Seguros':               nameEntry('mac_seguros', 'operational_expense', { suggested: 'Seguro' }),
  'Lazer e Turismo':       nameEntry('mac_lazer', 'operational_expense', { suggested: 'Lazer' }),
  'Cuidados Pessoais':     nameEntry('mac_cuidados', 'operational_expense', { suggested: 'Cuidados pessoais' }),
  'Animais e Pets':        nameEntry('mac_pets', 'operational_expense', { suggested: 'Pets' }),
}

// ── Description / text-based inference (legacy + no-metadata fallback) ────────
// Used for old imports without pluggyCategory / pluggyCategoryId

interface InferenceRule {
  pattern: RegExp
  entry: PluggyCategoryEntry
}

const inferEntry = (
  macroCategoryId: string,
  cls: ClassificationType,
  sub?: { id?: string; suggested?: string },
  neutral = false,
): PluggyCategoryEntry => ({
  macroCategoryId,
  classificationType: cls,
  subCategoryId: sub?.id,
  subCategoryNameSuggested: sub?.suggested,
  includeInBudget: !neutral,
  includeInOperationalResult: !neutral,
  includeInCashflow: true,
  confidence: 'low',
})

const INFERENCE_RULES: InferenceRule[] = [
  // Neutros prioritários — detectar primeiro para evitar falso positivo
  {
    pattern: /pagamento\s*de\s*cart[aã]o|pag\s*cart[aã]o|fatura\s*cart[aã]o/i,
    entry: inferEntry('mac_movfin', 'neutral', { suggested: 'Pagamento de cartão' }, true),
  },
  {
    pattern: /transferência entre contas|mesma titularidade|same person/i,
    entry: { ...inferEntry('mac_movfin', 'neutral', { suggested: 'Transferência entre contas próprias' }, true), isInternalTransfer: true },
  },
  {
    pattern: /^pix\b|transfer[eê]ncia pix|pix enviado|pix recebido/i,
    entry: inferEntry('mac_movfin', 'neutral', { suggested: 'PIX / Transferência' }, true),
  },
  {
    pattern: /ted\b|doc\b|transfer[eê]ncia bancária|transfer[eê]ncia eletr/i,
    entry: inferEntry('mac_movfin', 'neutral', { suggested: 'TED / DOC' }, true),
  },
  {
    pattern: /boleto|cod bar|pagamento boleto/i,
    entry: inferEntry('mac_movfin', 'neutral', { suggested: 'Boleto' }, true),
  },
  {
    pattern: /aporte|aplica[çc][aã]o|cdb|lci|lca|fundo|renda fixa|tesouro/i,
    entry: inferEntry('mac_movfin', 'neutral', { id: 'cat_aporte', suggested: 'Investimento' }, true),
  },

  // Receita
  {
    pattern: /sal[aá]rio|pagamento fgts|13[°º]\s*sal[aá]rio/i,
    entry: inferEntry('mac_receita_op', 'operational_income', { id: 'cat_salario', suggested: 'Salário' }),
  },

  // Dívida / Financiamento
  {
    pattern: /portoseg|financiamento|presta[çc][aã]o|parcela\s+\d|cr[eé]dito pessoal|empréstimo|sicredi\s+financ|caixa habitação|habitação/i,
    entry: inferEntry('mac_divida', 'debt_cost', { id: 'cat_dividas', suggested: 'Financiamentos' }),
  },

  // Educação
  {
    pattern: /aggile|english|idioma|curso|escola|facul|universidade|supera|bethel|neuroeducacao|neuroeducação/i,
    entry: inferEntry('mac_educacao', 'operational_expense', { id: 'cat_idiomas', suggested: 'Cursos / Idiomas' }),
  },

  // Saúde
  {
    pattern: /farmácia|farmacia|drogaria|drogasil|raia|onofre|pacheco|ultrafarma/i,
    entry: inferEntry('mac_saude', 'operational_expense', { id: 'cat_farmacia', suggested: 'Farmácia' }),
  },
  {
    pattern: /academia|smartfit|bodytech|bluefit|crossfit|gym|fitness|natação|natacao/i,
    entry: inferEntry('mac_saude', 'operational_expense', { id: 'cat_academias', suggested: 'Academia' }),
  },
  {
    pattern: /hospital|cl[ií]nica|m[eé]dico|dentista|odonto|laborat[oó]rio|exame/i,
    entry: inferEntry('mac_saude', 'operational_expense', { suggested: 'Médicos / Clínicas' }),
  },
  {
    pattern: /plano.de.sa[uú]de|amil|unimed|bradesco.sa[uú]de|sulam[eé]rica/i,
    entry: inferEntry('mac_saude', 'operational_expense', { suggested: 'Plano de saúde' }),
  },

  // Transporte
  {
    pattern: /posto|combust[ií]vel|gasolina|etanol|shell|ipiranga|raízen|petrobras|br\s*distrib/i,
    entry: inferEntry('mac_transporte', 'operational_expense', { id: 'cat_combustivel', suggested: 'Combustível' }),
  },
  {
    pattern: /estacionamento|sem\s+parar|veloe|estapar|conpark/i,
    entry: inferEntry('mac_transporte', 'operational_expense', { id: 'cat_estacionamento', suggested: 'Estacionamento' }),
  },
  {
    pattern: /uber|99\s*taxi|cabify|lyft|táxi|taxi/i,
    entry: inferEntry('mac_transporte', 'operational_expense', { suggested: 'App de transporte' }),
  },
  {
    pattern: /metrô|metro|sptrans|bilhete único|bilhete unico|cptm/i,
    entry: inferEntry('mac_transporte', 'operational_expense', { suggested: 'Transporte público' }),
  },

  // Alimentação
  {
    pattern: /carrefour|pão.de.açúcar|pao.de.acucar|extra|atacadão|atacadao|assaí|assai|dia\s+sup|supermercado/i,
    entry: inferEntry('mac_alimentacao', 'operational_expense', { id: 'cat_alimentacao', suggested: 'Supermercado' }),
  },
  {
    pattern: /ifood|uber\s*eats|rappi|mcdonalds|mc\s*donalds|burger|subway|outback|habbib|restaurante|lanchonete/i,
    entry: inferEntry('mac_alimentacao', 'operational_expense', { id: 'cat_restaurantes', suggested: 'Restaurantes' }),
  },
  {
    pattern: /padaria|confeitaria|pão\s+francês|pao\s+frances/i,
    entry: inferEntry('mac_alimentacao', 'operational_expense', { id: 'cat_padaria', suggested: 'Padaria' }),
  },

  // Assinaturas
  {
    pattern: /netflix|spotify|amazon\s*prime|youtube\s*premium|hbo|disney|apple\s*tv|paramount/i,
    entry: inferEntry('mac_assinaturas', 'operational_expense', { id: 'cat_spotify', suggested: 'Streaming' }),
  },
  {
    pattern: /openai|chatgpt|claude|anthropic|github\s*cop|adobe|microsoft\s*365|google\s*(workspace|one)/i,
    entry: inferEntry('mac_assinaturas', 'operational_expense', { id: 'cat_ia', suggested: 'IA / Produtividade' }),
  },

  // Compras online
  {
    pattern: /mercado\s*livre|amazon|shopee|americanas|magalu|magazine|casas\s*bahia|extra\s*online/i,
    entry: inferEntry('mac_compras', 'operational_expense', { id: 'cat_ml', suggested: 'Compras online' }),
  },
]

export function inferCategoryFromText(
  description: string,
  receiverName?: string | null,
  payerName?: string | null,
): PluggyLookupResult | null {
  const text = [description, receiverName, payerName].filter(Boolean).join(' ')
  for (const rule of INFERENCE_RULES) {
    if (rule.pattern.test(text)) {
      return { ...rule.entry, source: 'inference' }
    }
  }
  return null
}

// ── Main lookup function ──────────────────────────────────────────────────────

export function lookupPluggyCategory(
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): PluggyLookupResult | null {
  if (categoryId) {
    const byId = PLUGGY_ID_MAP[categoryId]
    if (byId) return { ...byId, source: 'id' }
  }
  if (categoryName) {
    const byName = PLUGGY_NAME_MAP[categoryName]
    if (byName) return { ...byName, source: 'name' }
  }
  return null
}

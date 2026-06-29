import type { MacroCategory } from '../data/types.js'

export const MACRO_CATEGORIES: MacroCategory[] = [
  { id: 'mac_receita_op',   name: 'Salário',                  classificationType: 'operational_income',   displayInBudget: true,  color: '#16A34A' },
  { id: 'mac_receita_ev',   name: 'Outras Receitas',           classificationType: 'extraordinary_income', displayInBudget: false, color: '#65A30D' },
  { id: 'mac_invest_rec',   name: 'Investimentos (Resgate)',   classificationType: 'redemption',           displayInBudget: false, color: '#0D9488' },
  { id: 'mac_neutra_rec',   name: 'Neutra (Entrada)',          classificationType: 'neutral',              displayInBudget: false, color: '#9CA3AF' },
  { id: 'mac_alimentacao',  name: 'Alimentação',               classificationType: 'operational_expense',  displayInBudget: true,  color: '#F97316' },
  { id: 'mac_assinaturas',  name: 'Assinaturas',               classificationType: 'operational_expense',  displayInBudget: true,  color: '#F59E0B' },
  { id: 'mac_casa',         name: 'Casa',                      classificationType: 'operational_expense',  displayInBudget: true,  color: '#6366F1' },
  { id: 'mac_compras',      name: 'Compra',                    classificationType: 'operational_expense',  displayInBudget: true,  color: '#F43F5E' },
  { id: 'mac_cuidados',     name: 'Cuidados Pessoais',         classificationType: 'operational_expense',  displayInBudget: true,  color: '#0D9488' },
  { id: 'mac_divida',       name: 'Dívidas',                   classificationType: 'debt_cost',            displayInBudget: true,  color: '#991B1B' },
  { id: 'mac_doacoes',      name: 'Doações',                   classificationType: 'operational_expense',  displayInBudget: true,  color: '#DC2626' },
  { id: 'mac_educacao',     name: 'Educação',                  classificationType: 'operational_expense',  displayInBudget: true,  color: '#8B5CF6' },
  { id: 'mac_impostos',     name: 'Impostos e Taxas',          classificationType: 'operational_expense',  displayInBudget: true,  color: '#B45309' },
  { id: 'mac_invest_desp',  name: 'Investimentos (Aporte)',    classificationType: 'investment',           displayInBudget: false, color: '#0891B2' },
  { id: 'mac_lazer',        name: 'Lazer',                     classificationType: 'operational_expense',  displayInBudget: true,  color: '#EC4899' },
  { id: 'mac_neutra_desp',  name: 'Neutra (Saída)',            classificationType: 'neutral',              displayInBudget: false, color: '#9CA3AF' },
  { id: 'mac_outros_desp',  name: 'Outros',                    classificationType: 'operational_expense',  displayInBudget: true,  color: '#6B7280' },
  { id: 'mac_pets',         name: 'Pets',                      classificationType: 'operational_expense',  displayInBudget: true,  color: '#A16207' },
  { id: 'mac_presentes',    name: 'Presentes',                 classificationType: 'operational_expense',  displayInBudget: true,  color: '#DB2777' },
  { id: 'mac_prestadores',  name: 'Prestadores de Serviços',   classificationType: 'operational_expense',  displayInBudget: true,  color: '#7C3AED' },
  { id: 'mac_saude',        name: 'Saúde',                     classificationType: 'operational_expense',  displayInBudget: true,  color: '#0284C7' },
  { id: 'mac_transporte',   name: 'Transporte',                classificationType: 'operational_expense',  displayInBudget: true,  color: '#CA8A04' },
  { id: 'mac_viagem',       name: 'Viagem',                    classificationType: 'operational_expense',  displayInBudget: true,  color: '#7C3AED' },
]

export const EXPENSE_MACRO_IDS = new Set(
  MACRO_CATEGORIES
    .filter(m => ['operational_expense', 'debt_cost'].includes(m.classificationType))
    .map(m => m.id),
)

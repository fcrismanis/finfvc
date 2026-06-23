const KEY = 'finance_bens_patrimoniais'

export type BemTipo = 'movel' | 'imovel' | 'outro'
export type BemFinalidade = 'uso_proprio' | 'aluguel' | 'investimento' | 'outro'

export interface BemPatrimonial {
  id: string
  nome: string
  tipo: BemTipo
  categoria: string
  finalidade: BemFinalidade
  valorMercado: number
  saldoDevedor: number
  descricao?: string
  createdAt: string
}

export const TIPO_LABEL: Record<BemTipo, string> = {
  movel:  'Bem Móvel',
  imovel: 'Bem Imóvel',
  outro:  'Outro',
}

export const FINALIDADE_LABEL: Record<BemFinalidade, string> = {
  uso_proprio:  'Uso Próprio',
  aluguel:      'Aluguel',
  investimento: 'Investimento',
  outro:        'Outro',
}

export const CATEGORIAS_POR_TIPO: Record<BemTipo, string[]> = {
  movel:  ['Veículo', 'Eletrônico', 'Móvel / Utensílio', 'Joia / Arte', 'Outro'],
  imovel: ['Casa', 'Apartamento', 'Terreno', 'Sala Comercial', 'Outro'],
  outro:  ['Outro'],
}

export function getBens(): BemPatrimonial[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BemPatrimonial[]) : []
  } catch {
    return []
  }
}

export function addBem(bem: Omit<BemPatrimonial, 'id' | 'createdAt'>): BemPatrimonial {
  const bens = getBens()
  const novo: BemPatrimonial = {
    ...bem,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify([...bens, novo]))
  return novo
}

export function deleteBem(id: string): void {
  const bens = getBens().filter(b => b.id !== id)
  localStorage.setItem(KEY, JSON.stringify(bens))
}

export function updateBem(id: string, patch: Partial<Omit<BemPatrimonial, 'id' | 'createdAt'>>): void {
  const bens = getBens().map(b => (b.id === id ? { ...b, ...patch } : b))
  localStorage.setItem(KEY, JSON.stringify(bens))
}

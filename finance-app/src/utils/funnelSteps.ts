import type { MacroCategoryTotal } from '../types'

export type FunnelStep = {
  id: string
  label: string
  color: string
  macroIds: string[]
  amount: number
  percentage: number
  runningBalance: number
  isAboveAverage: boolean
  isCritical: boolean
  hasData: boolean
}

const GROUPS: readonly { id: string; label: string; color: string; macroIds: readonly string[]; isCritical?: true }[] = [
  { id: 'fixed',         label: 'Compromissos fixos',  color: '#6366F1', macroIds: ['mac_casa', 'mac_seguros', 'mac_impostos', 'mac_prestadores'] },
  { id: 'food',          label: 'Alimentação',          color: '#F97316', macroIds: ['mac_alimentacao'] },
  { id: 'transport',     label: 'Transporte',           color: '#0EA5E9', macroIds: ['mac_transporte'] },
  { id: 'health_edu',    label: 'Saúde e educação',     color: '#10B981', macroIds: ['mac_saude', 'mac_educacao'] },
  { id: 'subscriptions', label: 'Assinaturas',          color: '#F59E0B', macroIds: ['mac_assinaturas'] },
  { id: 'shopping',      label: 'Compras e lazer',      color: '#F43F5E', macroIds: ['mac_compras', 'mac_lazer', 'mac_pets', 'mac_presentes', 'mac_doacoes', 'mac_cuidados', 'mac_servicos'] },
  { id: 'debt',          label: 'Dívidas e juros',      color: '#DC2626', macroIds: ['mac_divida'], isCritical: true },
]

export function buildFunnelSteps(
  income: number,
  macroCategoryTotals: MacroCategoryTotal[]
): FunnelStep[] {
  const byId = new Map(macroCategoryTotals.map(m => [m.macroCategoryId, m]))
  let runningBalance = income

  return GROUPS.map(group => {
    const macros = (group.macroIds as string[])
      .map(id => byId.get(id))
      .filter((m): m is MacroCategoryTotal => m !== undefined)
    const amount = macros.reduce((sum, m) => sum + m.total, 0)
    const isAboveAverage = macros.some(m => m.isAboveAverage)
    runningBalance -= amount
    return {
      id: group.id,
      label: group.label,
      color: group.color,
      macroIds: [...group.macroIds],
      amount,
      percentage: income > 0 ? (amount / income) * 100 : 0,
      runningBalance,
      isAboveAverage,
      isCritical: group.isCritical === true,
      hasData: amount > 0,
    }
  })
}

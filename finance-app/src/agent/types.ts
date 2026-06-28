export type AgentMode = 'diagnose' | 'suggest' | 'execute'
export type AgentRisk = 'low' | 'medium' | 'high'

export interface FinanceAgentPlan {
  id: string
  createdAt: string
  prompt: string
  mode: AgentMode
  affectedTransactionIds: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
  riskLevel: AgentRisk
  requiresConfirmation: boolean
  status: 'pending' | 'approved' | 'applied' | 'rolled_back'
  rollbackData?: Record<string, unknown>
}

export interface AgentToolResult<T = unknown> {
  tool: string
  ok: boolean
  data?: T
  error?: string
  alerts: string[]
}

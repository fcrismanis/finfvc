/**
 * Pluggy Open Finance connector stub.
 * 
 * IMPORTANT: Never put Pluggy client_secret in frontend code.
 * The connect flow must go through a backend/edge function that:
 *   1. Creates a connect_token via Pluggy API (POST /auth/token)
 *   2. Returns the token to the frontend
 *   3. Frontend uses PluggyConnect SDK with that token
 *   4. Backend polls /items/:id for sync status and fetches /transactions
 *
 * Docs: https://docs.pluggy.ai/docs/connect-widget
 */

export interface PluggyConnectConfig {
  connectToken: string  // short-lived token from backend
  clientUserId: string  // opaque user identifier (no PII)
  webhookUrl?: string
}

export type PluggyConnectStatus = 'idle' | 'loading_token' | 'open' | 'success' | 'error'

export async function getConnectToken(_userId: string): Promise<string> {
  // TODO: call your backend endpoint that calls Pluggy API
  // e.g. POST /api/pluggy/token  → { connectToken: '...' }
  throw new Error('Backend endpoint not implemented yet. See services/pluggy.service.ts for instructions.')
}

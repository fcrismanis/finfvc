/**
 * Authoritative Itaú checking saldo — master = bank statement (extrato).
 *
 * The Pluggy connection in use ("MeuPluggy") is NOT the real Itaú: it points at
 * account 94662932 with balance 0, not the real ag 1145 / conta 023475-1. Until
 * the real Itaú is reconnected via Open Finance, this anchor is the single
 * source of truth for the Itaú checking balance, in every environment (it lives
 * in committed code, not in per-browser localStorage).
 *
 * Source of these numbers: /FINFVC/EXTRATO_ITAU_VERDADE.md (extratos
 * itau_extrato_072025.pdf + itau_extrato_012026.pdf, emitidos 30/06/2026).
 *
 * When the REAL Itaú is connected via Open Finance and its live balance is
 * trustworthy, set `enabled = false` so the live Pluggy balance takes over.
 */
export interface BankCheckpoint {
  /** 'YYYY-MM-DD' — date the SALDO DO DIA was established (month-end). */
  date: string
  balance: number
}

export const ITAU_ANCHOR = {
  /** Master switch. Set false once the real Itaú is reconnected via Open Finance. */
  enabled: true,
  bank: 'Itaú',
  agency: '1145',
  accountNumber: '023475-1',
  /** Saldo em conta no extrato (30/06/2026). */
  balance: 40186.72,
  asOf: '2026-06-30',
  /** Month-end SALDO DO DIA checkpoints, oldest first. 2025-06-30 is the anchor. */
  checkpoints: [
    { date: '2025-06-30', balance: 82925.55 },
    { date: '2025-07-31', balance: -10855.64 },
    { date: '2025-08-29', balance: -968.12 },
    { date: '2025-09-30', balance: 8913.89 },
    { date: '2025-10-31', balance: -9228.34 },
    { date: '2025-11-28', balance: -10288.13 },
    { date: '2025-12-31', balance: -14582.20 },
    { date: '2026-01-30', balance: -18749.71 },
    { date: '2026-02-26', balance: -21.64 },
    { date: '2026-03-30', balance: -18217.37 },
    { date: '2026-04-30', balance: -23148.27 },
    { date: '2026-05-28', balance: 17297.26 },
    { date: '2026-06-30', balance: 40186.72 },
  ] as BankCheckpoint[],
} as const

/** Synthetic itemId/accountId for the manual Itaú anchor (never hits Pluggy). */
export const ITAU_ANCHOR_ID = 'manual:itau-023475-1'

import type { PaperAccount } from '../models/paper-trading-types.js';

let paperAccountData: PaperAccount | null = null;

export function updatePaperTradingDashboard(account: PaperAccount): void {
  paperAccountData = account;
}

export function getPaperTradingData(): PaperAccount | null {
  return paperAccountData;
}

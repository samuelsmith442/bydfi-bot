import type { EarlySignal } from '../strategies/early-entry.js';
import type { TradingSignal } from '../strategies/combined.js';

export interface DashboardData {
  earlySignals: EarlySignal[];
  confirmedSignals: TradingSignal[];
  timestamp: number;
  mode: string;
}

let currentData: DashboardData = {
  earlySignals: [],
  confirmedSignals: [],
  timestamp: Date.now(),
  mode: 'day',
};

export function updateDashboardData(
  earlySignals: EarlySignal[],
  confirmedSignals: TradingSignal[],
  mode: string
): void {
  currentData = {
    earlySignals,
    confirmedSignals,
    timestamp: Date.now(),
    mode,
  };
  console.log(`[DASHBOARD-SERVICE] Updated data: ${earlySignals.length} early, ${confirmedSignals.length} confirmed`);
}

export function getDashboardData(): DashboardData {
  console.log(`[DASHBOARD-SERVICE] Returning data: ${currentData.earlySignals.length} early, ${currentData.confirmedSignals.length} confirmed`);
  return currentData;
}

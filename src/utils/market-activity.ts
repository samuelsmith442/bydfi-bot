import type { Ticker } from '../models/types.js';

export interface MarketActivity {
  isActive: boolean;
  totalVolume: number;
  avgVolume: number;
  volumeRatio: number;
  activePairs: number;
  timestamp: Date;
}

export interface ActivityThresholds {
  minTotalVolume: number;      // Minimum total volume across all pairs
  minAvgVolume: number;        // Minimum average volume per pair
  minActivePairs: number;      // Minimum pairs with significant volume
  minVolumeRatio: number;      // Minimum volume ratio to historical average
}

// Default thresholds for BYDFi market activity
export const DEFAULT_THRESHOLDS: ActivityThresholds = {
  minTotalVolume: parseInt(process.env.MIN_TOTAL_VOLUME || '100000000'),      // $100M total volume
  minAvgVolume: parseInt(process.env.MIN_AVG_VOLUME || '500000'),              // $500K average per pair
  minActivePairs: parseInt(process.env.MIN_ACTIVE_PAIRS || '20'),              // At least 20 active pairs
  minVolumeRatio: parseFloat(process.env.MIN_VOLUME_RATIO || '1.5'),           // 50% above normal volume
};

/**
 * Analyze market activity based on volume metrics
 */
export function analyzeMarketActivity(
  tickers: Ticker[],
  thresholds: ActivityThresholds = DEFAULT_THRESHOLDS
): MarketActivity {
  // Calculate volume metrics
  const volumes = tickers.map(t => parseFloat(t.volume24h));
  const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
  const avgVolume = totalVolume / tickers.length;
  
  // Count active pairs (pairs with significant volume)
  const activePairs = tickers.filter(t => parseFloat(t.volume24h) > thresholds.minAvgVolume).length;
  
  // Calculate volume ratio (current vs expected baseline)
  // Using a baseline of $200K per pair as normal activity
  const baselineVolume = 200000;
  const volumeRatio = avgVolume / baselineVolume;
  
  // Determine if market is active
  const isActive = 
    totalVolume >= thresholds.minTotalVolume &&
    avgVolume >= thresholds.minAvgVolume &&
    activePairs >= thresholds.minActivePairs &&
    volumeRatio >= thresholds.minVolumeRatio;
  
  return {
    isActive,
    totalVolume,
    avgVolume,
    volumeRatio,
    activePairs,
    timestamp: new Date(),
  };
}

/**
 * Check if market conditions are suitable for trading
 */
export function shouldRunBot(
  tickers: Ticker[],
  thresholds: ActivityThresholds = DEFAULT_THRESHOLDS
): { shouldRun: boolean; reason: string; activity: MarketActivity } {
  const activity = analyzeMarketActivity(tickers, thresholds);
  
  if (!activity.isActive) {
    const reasons = [];
    
    if (activity.totalVolume < thresholds.minTotalVolume) {
      reasons.push(`Low total volume: $${(activity.totalVolume / 1000000).toFixed(1)}M`);
    }
    
    if (activity.avgVolume < thresholds.minAvgVolume) {
      reasons.push(`Low average volume: $${(activity.avgVolume / 1000).toFixed(0)}K`);
    }
    
    if (activity.activePairs < thresholds.minActivePairs) {
      reasons.push(`Few active pairs: ${activity.activePairs}`);
    }
    
    if (activity.volumeRatio < thresholds.minVolumeRatio) {
      reasons.push(`Below normal volume: ${activity.volumeRatio.toFixed(1)}x`);
    }
    
    return {
      shouldRun: false,
      reason: `Market inactive: ${reasons.join(', ')}`,
      activity
    };
  }
  
  return {
    shouldRun: true,
    reason: `Market active: ${activity.activePairs} pairs, ${activity.volumeRatio.toFixed(1)}x volume`,
    activity
  };
}

/**
 * Adaptive thresholds based on time of day
 */
export function getAdaptiveThresholds(): ActivityThresholds {
  const hour = new Date().getHours();
  
  // Peak trading hours (8am-8pm EST)
  if (hour >= 8 && hour <= 20) {
    return {
      ...DEFAULT_THRESHOLDS,
      minTotalVolume: 150000000,      // Higher threshold during peak hours
      minAvgVolume: 750000,           // Higher per-pair requirement
    };
  }
  
  // Off-peak hours (8pm-8am EST)
  return {
    ...DEFAULT_THRESHOLDS,
    minTotalVolume: 75000000,        // Lower threshold during off-peak
    minAvgVolume: 350000,            // Lower per-pair requirement
    minActivePairs: 15,              // Fewer pairs required
  };
}

/**
 * Log market activity for debugging
 */
export function logMarketActivity(activity: MarketActivity, shouldRun: boolean, reason: string): void {
  console.log(`[MARKET] Activity Check - ${new Date().toLocaleTimeString()}`);
  console.log(`[MARKET] Total Volume: $${(activity.totalVolume / 1000000).toFixed(1)}M`);
  console.log(`[MARKET] Average Volume: $${(activity.avgVolume / 1000).toFixed(0)}K`);
  console.log(`[MARKET] Active Pairs: ${activity.activePairs}`);
  console.log(`[MARKET] Volume Ratio: ${activity.volumeRatio.toFixed(1)}x`);
  console.log(`[MARKET] Decision: ${shouldRun ? 'RUN' : 'SKIP'} - ${reason}`);
  console.log('─'.repeat(50));
}

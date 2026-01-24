/**
 * Trading Configuration
 * Customize bot behavior for different trading styles
 */

export interface TradingConfig {
  // Polling interval in milliseconds
  pollingInterval: number;
  
  // Trading style
  style: 'scalp' | 'day' | 'swing';
  
  // Alert settings
  maxAlertsPerCycle: number;
  minTimeBetweenAlerts: number; // milliseconds
  
  // Signal thresholds
  earlyEntry: {
    minPriceChange: number;
    minVolumeRatio: number;
  };
  
  confirmed: {
    minPriceChange: number;
    minVolumeRatio: number;
  };
}

/**
 * SCALP TRADING (5-15 min timeframe)
 * - Quick entries and exits
 * - High frequency, smaller moves
 * - More alerts, tighter stops
 */
export const SCALP_CONFIG: TradingConfig = {
  pollingInterval: 5 * 60 * 1000, // 5 minutes
  style: 'scalp',
  maxAlertsPerCycle: 10, // Top 5 longs + Top 5 shorts
  minTimeBetweenAlerts: 0,
  
  earlyEntry: {
    minPriceChange: 1.5, // 1.5%+ for early signals
    minVolumeRatio: 2.5, // 2.5x average volume
  },
  
  confirmed: {
    minPriceChange: 3, // 3%+ for confirmed
    minVolumeRatio: 2,
  },
};

/**
 * DAY TRADING (1-4 hour timeframe)
 * - Balanced approach
 * - Moderate frequency, medium moves
 * - Quality over quantity
 */
export const DAY_CONFIG: TradingConfig = {
  pollingInterval: 60 * 60 * 1000, // 1 hour
  style: 'day',
  maxAlertsPerCycle: 6, // Top 3 longs + Top 3 shorts
  minTimeBetweenAlerts: 5 * 60 * 1000, // 5 min between alerts
  
  earlyEntry: {
    minPriceChange: 2, // 2%+ for early signals (lowered to catch more)
    minVolumeRatio: 2.5, // 2.5x volume (lowered from 3x)
  },
  
  confirmed: {
    minPriceChange: 5, // 5%+ for confirmed
    minVolumeRatio: 2.5,
  },
};

/**
 * SWING TRADING (4hr - daily timeframe)
 * - Longer holds
 * - Low frequency, bigger moves
 * - Only the strongest signals
 */
export const SWING_CONFIG: TradingConfig = {
  pollingInterval: 4 * 60 * 60 * 1000, // 4 hours
  style: 'swing',
  maxAlertsPerCycle: 4, // Top 2 longs + Top 2 shorts
  minTimeBetweenAlerts: 15 * 60 * 1000, // 15 min between alerts
  
  earlyEntry: {
    minPriceChange: 5, // 5%+ for early signals
    minVolumeRatio: 4,
  },
  
  confirmed: {
    minPriceChange: 10, // 10%+ for confirmed
    minVolumeRatio: 3,
  },
};

/**
 * Get configuration based on trading style
 */
export function getConfig(style: 'scalp' | 'day' | 'swing' = 'day'): TradingConfig {
  switch (style) {
    case 'scalp':
      return SCALP_CONFIG;
    case 'swing':
      return SWING_CONFIG;
    case 'day':
    default:
      return DAY_CONFIG;
  }
}

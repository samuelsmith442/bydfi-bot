import 'dotenv/config';
import { fetchTickers } from './api/rest.js';
import { streamTickers } from './api/ws.js';
import { generateCombinedSignals } from './strategies/combined.js';
import { detectEarlyEntries, getHighConfidenceEarlySignals } from './strategies/early-entry.js';
import { sendAlert } from './services/alerts.js';
import { getConfig } from './config/trading-config.js';
import { updateDashboardData } from './services/dashboard.js';
import { startDashboardServer } from './api/dashboard-server.js';
import { shouldRunBot, getAdaptiveThresholds, logMarketActivity } from './utils/market-activity.js';
import { logEarlySignals, logConfirmedSignals, printSignalReport } from './services/signal-history.js';
import { PaperTradingManager } from './services/paper-trading.js';
import { PaperTradingStrategy } from './services/paper-trading-strategy.js';
import { updatePaperTradingDashboard } from './services/paper-trading-dashboard.js';
import { updateLivePrices } from './services/live-prices.js';
import type { Ticker } from './models/types.js';

// CONFIGURE YOUR TRADING STYLE HERE:
// Options: 'scalp' (5min), 'day' (1hr), 'swing' (4hr)
const TRADING_STYLE = 'scalp';
const config = getConfig(TRADING_STYLE);

// PAPER TRADING CONFIGURATION
const PAPER_TRADING_ENABLED = true;
const paperTradingManager = new PaperTradingManager({
  initialBalance: 1000,
  leverage: 3,
  riskPercentage: 4,
  stopLossPercentage: 5,
  maxOpenPositions: 5,
});
const paperStrategy = new PaperTradingStrategy(paperTradingManager, 6, PAPER_TRADING_ENABLED);

async function runBot() {
  // Start dashboard server FIRST so Railway can detect the app is alive
  console.log('[BOT] Starting dashboard server for Railway health checks...');
  startDashboardServer(paperTradingManager);
  
  console.log(`[BOT] Starting BYDFi trading bot in ${config.style.toUpperCase()} mode...`);
  console.log(`[BOT] Polling interval: ${config.pollingInterval / 60000} minutes`);
  console.log(`[BOT] Max alerts per cycle: ${config.maxAlertsPerCycle}`);
  console.log('='.repeat(60) + '\n');
  
  // Function to fetch and process tickers
  const fetchAndProcessTickers = async () => {
    try {
      console.log('[REST] Fetching tickers...');
      const tickers = await fetchTickers();
      console.log(`[REST] Received ${tickers.length} tickers`)
      // Keep live prices up to date for manual trade validation
      const priceMap = new Map(tickers.map(t => [t.symbol, parseFloat(t.lastPrice)]))
      updateLivePrices(priceMap);
      
      // Check if market is active enough for trading
      const thresholds = getAdaptiveThresholds();
      const { shouldRun, reason, activity } = shouldRunBot(tickers, thresholds);
      
      logMarketActivity(activity, shouldRun, reason);
      
      if (!shouldRun) {
        console.log(`[BOT] Skipping signal generation - ${reason}`);
        return; // Skip processing but keep checking
      }
      
      console.log(`[BOT] Market active - generating signals...`);
      
      // Early Entry Signals (catch moves before +10%)
      const earlySignals = detectEarlyEntries(tickers);
      const highConfidenceEarly = getHighConfidenceEarlySignals(earlySignals);
      
      console.log(`[DEBUG] Total early signals: ${earlySignals.length}`);
      console.log(`[DEBUG] High confidence early signals: ${highConfidenceEarly.length}`);
      if (earlySignals.length > 0 && highConfidenceEarly.length === 0) {
        console.log(`[DEBUG] Sample early signal confidence levels:`, earlySignals.slice(0, 3).map(s => ({ symbol: s.symbol, confidence: s.confidence, score: s.score })));
      }
      
      const maxEarly = 5; // Show top 5 early signals per type (10 total)
      const maxConfirmed = 3; // Show top 3 confirmed per type
      
      const earlyLongs = highConfidenceEarly.filter(s => s.type === 'EARLY_LONG').slice(0, maxEarly);
      const earlyShorts = highConfidenceEarly.filter(s => s.type === 'EARLY_SHORT').slice(0, maxEarly);
      
      console.log(`[DEBUG] Early longs after filter: ${earlyLongs.length}`);
      console.log(`[DEBUG] Early shorts after filter: ${earlyShorts.length}`);
      if (earlyLongs.length > 0 && earlyLongs[0]) {
        console.log(`[DEBUG] First early long:`, { symbol: earlyLongs[0].symbol, type: earlyLongs[0].type, confidence: earlyLongs[0].confidence });
      }
      
      // Confirmed Signals (moves already in progress)
      const signals = generateCombinedSignals(tickers);
      console.log(`[STRATEGY] Generated ${signals.length} confirmed signals, ${earlySignals.length} early signals`);
      
      // Update dashboard with latest data
      const allConfirmedSignals = signals.filter(s => Math.abs(s.score) >= 3).slice(0, 10);
      const allEarlySignals = [...earlyLongs, ...earlyShorts]; // Combined 10 early signals (5 long + 5 short)
      updateDashboardData(allEarlySignals, allConfirmedSignals, config.style);
      
      // Log signals to history for tracking
      logEarlySignals(allEarlySignals);
      logConfirmedSignals(allConfirmedSignals);
      
      // Paper Trading: Process confirmed signals
      if (PAPER_TRADING_ENABLED) {
        paperStrategy.processConfirmedSignals(allConfirmedSignals, tickers);
      }
      
      // Separate long and short signals based on config
      const longSignals = signals.filter(s => s.score > 0).slice(0, maxConfirmed);
      const shortSignals = signals.filter(s => s.score < 0).slice(0, maxConfirmed);
      
      console.log('\n' + '='.repeat(60));
      console.log('⚡ EARLY ENTRY ALERTS (Catch Before +10%)');
      console.log('='.repeat(60));
      
      if (earlyLongs.length > 0) {
        console.log('\n🎯 Early Long Setups:');
        earlyLongs.forEach((signal, index) => {
          const triggers = signal.triggers.join(' | ');
          sendAlert(
            `⚡#${index + 1} ${signal.symbol}`,
            `🎯 EARLY LONG [${signal.confidence.toUpperCase()}] - ${triggers} | Price: $${signal.data.lastPrice} (${signal.data.priceChange}%)`
          );
        });
      }
      
      if (earlyShorts.length > 0) {
        console.log('\n🎯 Early Short Setups:');
        earlyShorts.forEach((signal, index) => {
          const triggers = signal.triggers.join(' | ');
          sendAlert(
            `⚡#${index + 1} ${signal.symbol}`,
            `🎯 EARLY SHORT [${signal.confidence.toUpperCase()}] - ${triggers} | Price: $${signal.data.lastPrice} (${signal.data.priceChange}%)`
          );
        });
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 CONFIRMED OPPORTUNITIES (Strong Moves)');
      console.log('='.repeat(60));
      console.log('\n📈 Top 3 Longs:');
      
      longSignals.forEach((signal, index) => {
        const reasons = signal.reasons.join(', ');
        sendAlert(
          `#${index + 1} ${signal.symbol}`,
          `📈 ${signal.type} (Score: ${signal.score}) - ${reasons} | Price: $${signal.data.lastPrice} (${signal.data.priceChange}%)`
        );
      });
      
      console.log('\n📉 Top 3 Shorts:');
      
      shortSignals.forEach((signal, index) => {
        const reasons = signal.reasons.join(', ');
        sendAlert(
          `#${index + 1} ${signal.symbol}`,
          `📉 ${signal.type} (Score: ${signal.score}) - ${reasons} | Price: $${signal.data.lastPrice} (${signal.data.priceChange}%)`
        );
      });
      
      console.log('='.repeat(60) + '\n');
      console.log(`[DASHBOARD] Data updated - ${highConfidenceEarly.length} early signals, ${allConfirmedSignals.length} confirmed signals\n`);
      
      // Print paper trading account summary and update dashboard
      if (PAPER_TRADING_ENABLED) {
        const paperAccount = paperTradingManager.getAccount();
        updatePaperTradingDashboard(paperAccount);
        paperTradingManager.printAccountSummary();
      }
    } catch (error) {
      console.error('[REST] Error fetching tickers:', error);
    }
  };
  
  // Fetch immediately on startup
  console.log('[BOT] Running initial ticker fetch...');
  await fetchAndProcessTickers();
  
  // Then set up interval for subsequent fetches
  setInterval(fetchAndProcessTickers, config.pollingInterval);

  // Keep the process alive
  console.log('[BOT] Bot is running. Press Ctrl+C to stop.');
  
  // WebSocket: Real-time updates (disabled for now due to 403 error)
  // streamTickers((ticker: any) => {
  //   console.log(`[WS] ${ticker.symbol}: ${ticker.lastPrice}`);
  // });
}

runBot().catch((error) => {
  console.error('[BOT] Fatal error during startup:', error);
  console.error('[BOT] Stack trace:', error.stack);
  process.exit(1);
});

import 'dotenv/config';
import { fetchTickers } from './api/rest.js';
import { streamTickers } from './api/ws.js';
import { generateCombinedSignals } from './strategies/combined.js';
import { detectEarlyEntries, getHighConfidenceEarlySignals } from './strategies/early-entry.js';
import { sendAlert } from './services/alerts.js';
import { getConfig } from './config/trading-config.js';
import { updateDashboardData } from './services/dashboard.js';
import { startDashboardServer } from './api/dashboard-server.js';
import type { Ticker } from './models/types.js';

// CONFIGURE YOUR TRADING STYLE HERE:
// Options: 'scalp' (5min), 'day' (1hr), 'swing' (4hr)
const TRADING_STYLE = 'day';
const config = getConfig(TRADING_STYLE);

async function runBot() {
  console.log(`[BOT] Starting BYDFi trading bot in ${config.style.toUpperCase()} mode...`);
  console.log(`[BOT] Polling interval: ${config.pollingInterval / 60000} minutes`);
  console.log(`[BOT] Max alerts per cycle: ${config.maxAlertsPerCycle}`);
  console.log('='.repeat(60) + '\n');
  
  // Start dashboard server
  startDashboardServer();
  
  // Function to fetch and process tickers
  const fetchAndProcessTickers = async () => {
    try {
      console.log('[REST] Fetching tickers...');
      const tickers = await fetchTickers();
      console.log(`[REST] Received ${tickers.length} tickers`);
      
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
    } catch (error) {
      console.error('[REST] Error fetching tickers:', error);
    }
  };
  
  // Start dashboard server after defining the fetch function
  startDashboardServer();
  
  // Fetch immediately on startup
  console.log('[BOT] Running initial ticker fetch...');
  await fetchAndProcessTickers();
  
  // Then set up interval for subsequent fetches
  setInterval(fetchAndProcessTickers, config.pollingInterval);

  // WebSocket: Real-time updates (disabled for now due to 403 error)
  // streamTickers((ticker: any) => {
  //   console.log(`[WS] ${ticker.symbol}: ${ticker.lastPrice}`);
  // });
}

runBot();

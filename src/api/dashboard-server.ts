import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDashboardData } from '../services/dashboard.js';
import { getPaperTradingData } from '../services/paper-trading-dashboard.js';
import type { PaperTradingManager } from '../services/paper-trading.js';
import { getLivePrice } from '../services/live-prices.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

export function startDashboardServer(paperTradingManager?: PaperTradingManager): void {
  console.log(`[DASHBOARD] Attempting to start server on port ${PORT}`);
  console.log(`[DASHBOARD] PORT env variable: ${process.env.PORT || 'not set (using default 3000)'}`);
  
  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint for Railway
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // API endpoint for dashboard data
    if (req.url === '/api/signals' && req.method === 'GET') {
      try {
        const data = getDashboardData();
        console.log(`[DASHBOARD] API request - returning ${data.earlySignals.length} early, ${data.confirmedSignals.length} confirmed signals`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (error) {
        console.error('[DASHBOARD] Error in /api/signals:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // API endpoint for paper trading data
    if (req.url === '/api/paper-trading' && req.method === 'GET') {
      try {
        const data = getPaperTradingData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data || { message: 'No paper trading data available' }));
      } catch (error) {
        console.error('[DASHBOARD] Error in /api/paper-trading:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // GET /api/price/:symbol — live price lookup for form validation
    const priceMatch = req.url?.match(/^\/api\/price\/(.+)$/);
    if (priceMatch && req.method === 'GET') {
      const symbol = (priceMatch[1] ?? '').toUpperCase();
      const price = getLivePrice(symbol);
      if (price === null) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `No live price for ${symbol}` }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ symbol, price }));
      }
      return;
    }

    // POST /api/reset-paper-account — reset paper trading account to initial state
    if (req.url === '/api/reset-paper-account' && req.method === 'POST') {
      if (!paperTradingManager) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Paper trading not initialised' }));
        return;
      }
      paperTradingManager.resetAccount();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Account reset to $1000' }));
      return;
    }

    // POST /api/manual-trade — open a manual paper trade
    if (req.url === '/api/manual-trade' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          if (!paperTradingManager) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Paper trading not initialised' }));
            return;
          }
          const { symbol, side, entryPrice, stopLoss, takeProfit, notes, forceSubmit } = JSON.parse(body);
          if (!symbol || !side || !entryPrice || !stopLoss) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'symbol, side, entryPrice and stopLoss are required' }));
            return;
          }
          if (side !== 'LONG' && side !== 'SHORT') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'side must be LONG or SHORT' }));
            return;
          }
          // Price sanity check — warn if entry deviates >50% from live price
          const livePrice = getLivePrice(symbol);
          if (livePrice && !forceSubmit) {
            const entry = parseFloat(entryPrice);
            const deviation = Math.abs(entry - livePrice) / livePrice;
            if (deviation > 0.5) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'PRICE_WARNING',
                message: `Entry $${entry} deviates ${(deviation*100).toFixed(0)}% from live price $${livePrice.toFixed(6)}. Send again with forceSubmit:true to override.`,
                livePrice,
                entryPrice: entry,
                deviationPercent: (deviation * 100).toFixed(1),
              }));
              return;
            }
          }
          const position = paperTradingManager.openManualPosition(
            symbol,
            side,
            parseFloat(entryPrice),
            parseFloat(stopLoss),
            takeProfit ? parseFloat(takeProfit) : undefined,
            notes || undefined
          );
          if (!position) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Could not open position (max positions reached or already open)' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, position }));
        } catch (err) {
          console.error('[DASHBOARD] Error in /api/manual-trade:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
      return;
    }

    // DELETE /api/close-position/:id — manually close an open position
    const closeMatch = req.url?.match(/^\/api\/close-position\/(.+)$/);
    if (closeMatch && req.method === 'DELETE') {
      try {
        if (!paperTradingManager) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Paper trading not initialised' }));
          return;
        }
        const positionId = closeMatch[1] ?? '';
        const account = paperTradingManager.getAccount();
        const position = account.openPositions.find(p => p.id === positionId);
        if (!position) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Position not found' }));
          return;
        }
        const trade = paperTradingManager.closePosition(positionId, position.currentPrice, 'MANUAL');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, trade }));
      } catch (err) {
        console.error('[DASHBOARD] Error in /api/close-position:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }

    // Serve dashboard HTML
    if (req.url === '/' || req.url === '/dashboard.html') {
      const dashboardPath = path.join(__dirname, '../../dashboard.html');
      fs.readFile(dashboardPath, 'utf8', (err, data) => {
        if (err) {
          console.error('[DASHBOARD] Error reading dashboard.html:', err);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Dashboard not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }

    // Serve paper trading dashboard HTML
    if (req.url === '/paper-trading' || req.url === '/paper-trading.html') {
      const dashboardPath = path.join(__dirname, '../../paper-trading-dashboard.html');
      fs.readFile(dashboardPath, 'utf8', (err, data) => {
        if (err) {
          console.error('[DASHBOARD] Error reading paper-trading-dashboard.html:', err);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Paper trading dashboard not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }

    // Serve static files from public folder
    if (req.url?.startsWith('/public/')) {
      const filePath = path.join(__dirname, '../..', req.url);
      const ext = path.extname(filePath);
      
      const contentTypes: { [key: string]: string } = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
      };
      
      const contentType = contentTypes[ext] || 'text/plain';
      
      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.error(`[DASHBOARD] Error reading ${req.url}:`, err);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
      return;
    }

    // 404
    console.log(`[DASHBOARD] 404 - Unknown path: ${req.url}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[DASHBOARD] Port ${PORT} is already in use. Try: lsof -ti:${PORT} | xargs kill -9`);
    } else {
      console.error('[DASHBOARD] Server error:', err);
    }
  });

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[DASHBOARD] ✅ Server running on port ${PORT}`);
    console.log(`[DASHBOARD] Ready to accept connections`);
  });
}

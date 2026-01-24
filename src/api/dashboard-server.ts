import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDashboardData } from '../services/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

export function startDashboardServer(): void {
  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
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

  server.listen(PORT, () => {
    console.log(`[DASHBOARD] ✅ Server running at http://localhost:${PORT}`);
    console.log(`[DASHBOARD] Open http://localhost:${PORT} in your browser`);
  });
}

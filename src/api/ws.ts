import WebSocket from 'ws';

export function streamTickers(callback: (ticker: any) => void) {
  const ws = new WebSocket('wss://stream.bydfi.com/stream');
  
  ws.on('open', () => {
    console.log('[WS] Connected to BYDFi WebSocket');
    // Subscribe to all tickers (you can specify symbols like BTC-USDT@ticker)
    ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: ['!ticker@arr'],
      id: 1
    }));
  });
  
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.e === '24hrTicker' || Array.isArray(message)) {
        callback(message);
      }
    } catch (error) {
      console.error('[WS] Parse error:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });
  
  ws.on('close', () => {
    console.log('[WS] Connection closed');
  });
}

let livePrices: Map<string, number> = new Map();

export function updateLivePrices(prices: Map<string, number>): void {
  livePrices = prices;
}

export function getLivePrice(symbol: string): number | null {
  return livePrices.get(symbol.toUpperCase()) ?? null;
}

export function getAllLivePrices(): Record<string, number> {
  return Object.fromEntries(livePrices);
}

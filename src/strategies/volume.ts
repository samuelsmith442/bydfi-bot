import type { Ticker } from '../models/types.js';

export function detectVolumeSpikes(tickers: Ticker[], threshold: number = 3): Ticker[] {
  const avgVolumes: Record<string, number[]> = {};
  tickers.forEach(t => {
    if (!avgVolumes[t.symbol]) {
      avgVolumes[t.symbol] = [];
    }
    avgVolumes[t.symbol]!.push(parseFloat(t.volume24h));
  });

  return tickers.filter(t => {
    const symbolVolumes = avgVolumes[t.symbol] || [];
    const avgVolume = symbolVolumes.reduce((a, b) => a + b, 0) / symbolVolumes.length;
    return parseFloat(t.volume24h) > threshold * avgVolume;
  });
}

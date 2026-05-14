/**
 * Adaptive MACD+ — TypeScript port of the Pine Script indicator by MarketAlgoBot
 * https://www.tradingview.com/script/Il2VRAlq-Adaptive-MACD-MACD/
 * Mozilla Public License 2.0 — © MarketAlgoBot
 *
 * Instead of fixed EMA lengths, this evaluates all fast (8–20) and slow (21–50)
 * combinations in parallel and selects the best-performing pair on every bar
 * using an EMA-smoothed momentum-direction score (perfAlpha = 10).
 */

import { fetchKlinesCached } from '../api/rest.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdaptiveMACDConfig {
  minFast?:   number  // default 8
  maxFast?:   number  // default 20
  minSlow?:   number  // default 21
  maxSlow?:   number  // default 50
  signalLen?: number  // default 9
  interval?:  string  // default '1h'
  limit?:     number  // candles to fetch (default 200)
}

export interface AdaptiveMACDResult {
  macd:       number
  signal:     number
  histogram:  number
  bestFast:   number
  bestSlow:   number
  bullCross:  boolean
  bearCross:  boolean
  isValid:    boolean
}

// ---------------------------------------------------------------------------
// Core maths (stateless helpers)
// ---------------------------------------------------------------------------

/**
 * Compute a full EMA series over a closes array.
 * Pine's ta.ema seeds from the first value (SMA of first `period` bars).
 */
function emaFull(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period) return result

  // Seed: SMA of first `period` values
  let sum = 0
  for (let i = 0; i < period; i++) sum += closes[i]!
  result[period - 1] = sum / period

  const k = 2 / (period + 1)
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i]! * k + result[i - 1]! * (1 - k)
  }
  return result
}

/**
 * Single-pass EMA of an arbitrary series (used for the signal line).
 */
function emaSeries(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN)
  // Find first non-NaN index
  let start = values.findIndex(v => !isNaN(v))
  if (start === -1 || values.length - start < period) return result

  let sum = 0
  for (let i = start; i < start + period; i++) sum += values[i]!
  result[start + period - 1] = sum / period

  const k = 2 / (period + 1)
  for (let i = start + period; i < values.length; i++) {
    result[i] = values[i]! * k + result[i - 1]! * (1 - k)
  }
  return result
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calculate Adaptive MACD+ from a closes array.
 * Returns the result for the LAST bar (most recent candle).
 *
 * @param closes  - Array of close prices, oldest first
 * @param config  - Optional parameter overrides
 */
export function calculateAdaptiveMACDFromCloses(
  closes: number[],
  config: AdaptiveMACDConfig = {}
): AdaptiveMACDResult {
  const {
    minFast   = 8,
    maxFast   = 20,
    minSlow   = 21,
    maxSlow   = 50,
    signalLen = 9,
  } = config

  const INVALID: AdaptiveMACDResult = {
    macd: 0, signal: 0, histogram: 0,
    bestFast: minFast, bestSlow: minSlow,
    bullCross: false, bearCross: false, isValid: false,
  }

  const n = closes.length
  if (n < maxSlow + signalLen + 5) return INVALID

  const perfAlpha = 10
  const alpha     = 2 / (perfAlpha + 1)

  // ── Build all fast EMAs (8–20) ──────────────────────────────────────────
  const fastPeriods: number[] = []
  for (let p = 8; p <= 20; p++) fastPeriods.push(p)

  const fastEMAs = fastPeriods.map(p => emaFull(closes, p))

  // ── Build all slow EMAs (21–50) ─────────────────────────────────────────
  const slowPeriods: number[] = []
  for (let p = 21; p <= 50; p++) slowPeriods.push(p)

  const slowEMAs = slowPeriods.map(p => emaFull(closes, p))

  // ── MACD series for fast scoring: mFx = emaFx - emaS25 (index 4 = period 25)
  const slowEMA25 = slowEMAs[4]!  // index 4 → period 25
  const mF: number[][] = fastEMAs.map(fe =>
    fe.map((v, i) => isNaN(v) || isNaN(slowEMA25[i]!) ? NaN : v - slowEMA25[i]!)
  )

  // ── MACD series for slow scoring: mSx = emaF12 - emaSx (index 4 = period 12)
  const emaF12 = fastEMAs[4]!  // index 4 → period 12
  const mS: number[][] = slowEMAs.map(se =>
    se.map((v, i) => isNaN(v) || isNaN(emaF12[i]!) ? NaN : emaF12[i]! - v)
  )

  // ── Performance scoring — EMA-smoothed momentum direction ───────────────
  // Mirrors Pine: perf[i] += alpha * (sign(m[i] - m[i-1]) - perf[i])
  // which is equivalent to an EMA of sign(delta).

  const fastPerf = new Array(fastPeriods.length).fill(0)
  const slowPerf = new Array(slowPeriods.length).fill(0)

  // Walk every bar, updating running EMA scores
  for (let bar = 1; bar < n; bar++) {
    // Fast scores
    for (let fi = 0; fi < fastPeriods.length; fi++) {
      const cur  = mF[fi]![bar]!
      const prev = mF[fi]![bar - 1]!
      if (!isNaN(cur) && !isNaN(prev)) {
        const direction = Math.sign(cur - prev)
        fastPerf[fi]! += alpha * (direction - fastPerf[fi]!)
      }
    }
    // Slow scores
    for (let si = 0; si < slowPeriods.length; si++) {
      const cur  = mS[si]![bar]!
      const prev = mS[si]![bar - 1]!
      if (!isNaN(cur) && !isNaN(prev)) {
        const direction = Math.sign(cur - prev)
        slowPerf[si]! += alpha * (direction - slowPerf[si]!)
      }
    }
  }

  // ── Select best fast index (within minFast..maxFast) ────────────────────
  let bestFastIdx  = 0
  let bestFastVal  = fastPerf[0]!
  for (let i = 1; i < fastPeriods.length; i++) {
    const period = fastPeriods[i]!
    if (period >= minFast && period <= maxFast && fastPerf[i]! > bestFastVal) {
      bestFastVal = fastPerf[i]!
      bestFastIdx = i
    }
  }

  // ── Select best slow index (within minSlow..maxSlow) ────────────────────
  let bestSlowIdx = 0
  let bestSlowVal = slowPerf[0]!
  for (let i = 1; i < slowPeriods.length; i++) {
    const period = slowPeriods[i]!
    if (period >= minSlow && period <= maxSlow && slowPerf[i]! > bestSlowVal) {
      bestSlowVal = slowPerf[i]!
      bestSlowIdx = i
    }
  }

  const bestFast = fastPeriods[bestFastIdx]!
  const bestSlow = slowPeriods[bestSlowIdx]!

  // ── Compute final MACD line = bestFastEMA - bestSlowEMA ─────────────────
  const macdSeries: number[] = fastEMAs[bestFastIdx]!.map((fv, i) => {
    const sv = slowEMAs[bestSlowIdx]![i]!
    return isNaN(fv) || isNaN(sv) ? NaN : fv - sv
  })

  // ── Signal line = EMA(macdSeries, signalLen) ────────────────────────────
  const signalSeries = emaSeries(macdSeries, signalLen)

  // ── Histogram & crossovers at last two valid bars ────────────────────────
  const lastIdx = n - 1
  const prevIdx = n - 2

  const macd       = macdSeries[lastIdx] ?? NaN
  const signal     = signalSeries[lastIdx] ?? NaN
  const macdPrev   = macdSeries[prevIdx] ?? NaN
  const signalPrev = signalSeries[prevIdx] ?? NaN

  if (isNaN(macd) || isNaN(signal)) return INVALID

  const histogram = macd - signal

  // Pine ta.crossover:  prev <= threshold AND curr > threshold
  // Pine ta.crossunder: prev >= threshold AND curr < threshold
  const bullCross = !isNaN(macdPrev) && !isNaN(signalPrev)
    && macdPrev <= signalPrev && macd > signal

  const bearCross = !isNaN(macdPrev) && !isNaN(signalPrev)
    && macdPrev >= signalPrev && macd < signal

  return {
    macd,
    signal,
    histogram,
    bestFast,
    bestSlow,
    bullCross,
    bearCross,
    isValid: true,
  }
}

// ---------------------------------------------------------------------------
// Convenience wrapper — fetches klines then calculates
// ---------------------------------------------------------------------------

/**
 * Fetch klines for a symbol and return the Adaptive MACD+ result.
 *
 * @param symbol  - e.g. 'BTCUSDT'
 * @param config  - Optional overrides
 */
export async function calculateAdaptiveMACD(
  symbol: string,
  config: AdaptiveMACDConfig = {}
): Promise<AdaptiveMACDResult> {
  const { interval = '1h', limit = 200 } = config

  try {
    const klines = await fetchKlinesCached(symbol, interval, limit)
    if (klines.length === 0) {
      return {
        macd: 0, signal: 0, histogram: 0,
        bestFast: 8, bestSlow: 21,
        bullCross: false, bearCross: false, isValid: false,
      }
    }

    const closes = klines.map(k => parseFloat(k.close))
    return calculateAdaptiveMACDFromCloses(closes, config)

  } catch (error: any) {
    console.error(`[AdaptiveMACD] Error for ${symbol}:`, error.message)
    return {
      macd: 0, signal: 0, histogram: 0,
      bestFast: 8, bestSlow: 21,
      bullCross: false, bearCross: false, isValid: false,
    }
  }
}

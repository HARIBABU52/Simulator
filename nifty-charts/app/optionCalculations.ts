import { Timeframe } from './types';
import { ExpiryRawData } from './actions/optionsData';

export interface PrecalcOptionBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;       // timeframe bar volume
  dayVolume: number;    // cumulative volume for trading day
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayChange: number;
  dayChangePct: number;
  min1Change: number;
  min1ChangePct: number;
  tfChangePct: number;
}

export interface MinuteRecord {
  time: string;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

export interface OptionChainItem {
  strike: number;
  isATM: boolean;
  ce: {
    ltp: number;
    dayChange: number;
    dayChangePct: number;
    min1Change: number;
    min1ChangePct: number;
    tfChangePct: number;
    dayOpen: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    tfVolume: number;
    dayVolume: number;
    isITM: boolean;
    recent1MinHistory: MinuteRecord[];
  };
  pe: {
    ltp: number;
    dayChange: number;
    dayChangePct: number;
    min1Change: number;
    min1ChangePct: number;
    tfChangePct: number;
    dayOpen: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    tfVolume: number;
    dayVolume: number;
    isITM: boolean;
    recent1MinHistory: MinuteRecord[];
  };
}

export interface SimulatedEnvInfo {
  activeDate: string;
  activeTime: string;
  spotPrice: number;
  atmStrike: number;
  timeframe?: string;
  timeframeLabel?: string;
  pcrDayVolume: number;
  order: string;
}

export interface CalculatedExpiryCache {
  expiry: string;
  strikes: number[]; // Descending e.g. [22900, 22850]
  timeframes: Record<Timeframe, {
    [strike: number]: {
      ce: PrecalcOptionBar[];
      pe: PrecalcOptionBar[];
    };
  }>;
}

const TIMEFRAMES: Timeframe[] = ['1min', '5min', '15min', '1h', '1d', '1w'];
const TF_MS_MAP: Record<Timeframe, number> = {
  '1min': 60_000,
  '5min': 5 * 60_000,
  '15min': 15 * 60_000,
  '1h': 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
};

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

// Calculate 1-min day metrics and aggregate into all timeframes for a single series
function calculateSeriesTimeframes(
  rawRecords: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>
): Record<Timeframe, PrecalcOptionBar[]> {
  if (!rawRecords || rawRecords.length === 0) {
    const emptyMap: any = {};
    TIMEFRAMES.forEach(tf => (emptyMap[tf] = []));
    return emptyMap;
  }

  // Ensure sorted by time ascending
  const sorted = [...rawRecords].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 1. Process 1-min base data with day-wise metrics
  const min1Bars: PrecalcOptionBar[] = [];
  let currentDay = '';
  let dayOpen = 0;
  let dayHigh = -Infinity;
  let dayLow = Infinity;
  let dayVol = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const itemDate = item.time.slice(0, 10);
    const open = item.open;
    const high = item.high;
    const low = item.low;
    const close = item.close;
    const vol = item.volume || 0;
    const prevClose = prev ? prev.close : open;

    if (itemDate !== currentDay) {
      currentDay = itemDate;
      dayOpen = open;
      dayHigh = high;
      dayLow = low;
      dayVol = vol;
    } else {
      dayHigh = Math.max(dayHigh, high);
      dayLow = Math.min(dayLow, low);
      dayVol += vol;
    }

    const dayChange = round2(close - dayOpen);
    const dayChangePct = dayOpen > 0 ? round2(((close - dayOpen) / dayOpen) * 100) : 0;
    const min1Change = round2(close - prevClose);
    const min1ChangePct = prevClose > 0 ? round2(((close - prevClose) / prevClose) * 100) : 0;
    const tfChangePct = open > 0 ? round2(((close - open) / open) * 100) : 0;

    min1Bars.push({
      time: item.time,
      open,
      high,
      low,
      close,
      volume: vol,
      dayVolume: dayVol,
      dayOpen,
      dayHigh,
      dayLow,
      dayChange,
      dayChangePct,
      min1Change,
      min1ChangePct,
      tfChangePct,
    });
  }

  // 2. Aggregate into higher timeframes
  const tfMap: Record<Timeframe, PrecalcOptionBar[]> = {
    '1min': min1Bars,
    '5min': [],
    '15min': [],
    '1h': [],
    '1d': [],
    '1w': [],
  };

  for (const tf of ['5min', '15min', '1h', '1d', '1w'] as Timeframe[]) {
    const bucketMs = TF_MS_MAP[tf];
    const buckets = new Map<number, PrecalcOptionBar[]>();

    for (const b of min1Bars) {
      const t = new Date(b.time).getTime();
      const bKey = Math.floor(t / bucketMs) * bucketMs;
      if (!buckets.has(bKey)) {
        buckets.set(bKey, []);
      }
      buckets.get(bKey)!.push(b);
    }

    const aggregated: PrecalcOptionBar[] = [];
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

    for (let k = 0; k < sortedKeys.length; k++) {
      const key = sortedKeys[k];
      const items = buckets.get(key)!;
      const first = items[0];
      const last = items[items.length - 1];

      const open = first.open;
      const close = last.close;
      const high = items.reduce((m, p) => Math.max(m, p.high), -Infinity);
      const low = items.reduce((m, p) => Math.min(m, p.low), Infinity);
      const volume = items.reduce((s, p) => s + p.volume, 0);

      const dayChange = last.dayChange;
      const dayChangePct = last.dayChangePct;
      const min1Change = last.min1Change;
      const min1ChangePct = last.min1ChangePct;
      const tfChangePct = open > 0 ? round2(((close - open) / open) * 100) : 0;

      aggregated.push({
        time: new Date(key).toISOString(),
        open,
        high,
        low,
        close,
        volume,
        dayVolume: last.dayVolume,
        dayOpen: last.dayOpen,
        dayHigh: last.dayHigh,
        dayLow: last.dayLow,
        dayChange,
        dayChangePct,
        min1Change,
        min1ChangePct,
        tfChangePct,
      });
    }

    tfMap[tf] = aggregated;
  }

  return tfMap;
}

// Calculate entire expiry data on browser initial load once and return cacheable structure
export function processRawExpiryData(rawData: ExpiryRawData): CalculatedExpiryCache {
  const result: CalculatedExpiryCache = {
    expiry: rawData.expiry,
    strikes: rawData.strikes, // Descending order
    timeframes: {
      '1min': {},
      '5min': {},
      '15min': {},
      '1h': {},
      '1d': {},
      '1w': {},
    },
  };

  for (const strike of rawData.strikes) {
    const ceRaw = rawData.options[strike]?.ce || [];
    const peRaw = rawData.options[strike]?.pe || [];

    const ceTimeframes = calculateSeriesTimeframes(ceRaw);
    const peTimeframes = calculateSeriesTimeframes(peRaw);

    for (const tf of TIMEFRAMES) {
      if (!result.timeframes[tf][strike]) {
        result.timeframes[tf][strike] = { ce: [], pe: [] };
      }
      result.timeframes[tf][strike].ce = ceTimeframes[tf];
      result.timeframes[tf][strike].pe = peTimeframes[tf];
    }
  }

  return result;
}

// Fast binary search to find bar at or immediately before target timestamp
export function findBarAtOrBefore(bars: PrecalcOptionBar[], targetTimeMs?: number): PrecalcOptionBar | null {
  if (!bars || bars.length === 0) return null;
  if (!targetTimeMs) return bars[bars.length - 1]; // Default to latest

  let low = 0;
  let high = bars.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const barMs = new Date(bars[mid].time).getTime();
    if (barMs <= targetTimeMs) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best !== -1) return bars[best];
  return bars[0]; // If target time is before first candle, return first
}

// Get recent 1-min history in descending order (latest first) up to targetTimeMs
function getRecent1MinHistory(min1Bars: PrecalcOptionBar[], targetTimeMs?: number): MinuteRecord[] {
  if (!min1Bars || min1Bars.length === 0) return [];

  let endIdx = min1Bars.length - 1;
  if (targetTimeMs) {
    let low = 0;
    let high = min1Bars.length - 1;
    let best = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const barMs = new Date(min1Bars[mid].time).getTime();
      if (barMs <= targetTimeMs) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (best !== -1) endIdx = best;
  }

  const targetDate = min1Bars[endIdx].time.slice(0, 10);
  let startIdx = endIdx;
  while (startIdx > 0 && min1Bars[startIdx - 1].time.startsWith(targetDate)) {
    startIdx--;
  }

  const dayBars = min1Bars.slice(startIdx, endIdx + 1);
  return dayBars
    .slice(-10)
    .reverse()
    .map(b => ({
      time: b.time,
      timeLabel: new Date(b.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      changePct: b.min1ChangePct,
    }));
}

// Instant synchronous retrieval of Option Chain from TanStack cache
export function getOptionChainFromCache(
  cache: CalculatedExpiryCache,
  timeframe: Timeframe,
  spot: number,
  targetTime?: string
): { chain: OptionChainItem[]; simulatedEnv: SimulatedEnvInfo } {
  const targetTimeMs = targetTime ? new Date(targetTime).getTime() : undefined;
  const tf = timeframe || '1min';
  const tfData = cache.timeframes[tf] || cache.timeframes['1min'];

  let totalCeVolume = 0;
  let totalPeVolume = 0;
  let activeDate = '';
  let activeTime = '';

  const chain: OptionChainItem[] = cache.strikes.map(strike => {
    const isATM = Math.abs(strike - spot) <= 25;
    const ceITM = strike < spot;
    const peITM = strike > spot;

    const ceBars = tfData[strike]?.ce || [];
    const peBars = tfData[strike]?.pe || [];
    const ce1mBars = cache.timeframes['1min'][strike]?.ce || [];
    const pe1mBars = cache.timeframes['1min'][strike]?.pe || [];

    const ceBar = findBarAtOrBefore(ceBars, targetTimeMs);
    const peBar = findBarAtOrBefore(peBars, targetTimeMs);

    if (ceBar) {
      totalCeVolume += ceBar.dayVolume;
      if (!activeDate) activeDate = ceBar.time.slice(0, 10);
      if (!activeTime) activeTime = ceBar.time;
    }
    if (peBar) {
      totalPeVolume += peBar.dayVolume;
    }

    const ceHistory = getRecent1MinHistory(ce1mBars, targetTimeMs);
    const peHistory = getRecent1MinHistory(pe1mBars, targetTimeMs);

    return {
      strike,
      isATM,
      ce: {
        ltp: ceBar ? ceBar.close : 0,
        dayChange: ceBar ? ceBar.dayChange : 0,
        dayChangePct: ceBar ? ceBar.dayChangePct : 0,
        min1Change: ceBar ? ceBar.min1Change : 0,
        min1ChangePct: ceBar ? ceBar.min1ChangePct : 0,
        tfChangePct: ceBar ? ceBar.tfChangePct : 0,
        dayOpen: ceBar ? ceBar.dayOpen : 0,
        dayHigh: ceBar ? ceBar.dayHigh : 0,
        dayLow: ceBar ? ceBar.dayLow : 0,
        volume: ceBar ? ceBar.volume : 0,
        tfVolume: ceBar ? ceBar.volume : 0,
        dayVolume: ceBar ? ceBar.dayVolume : 0,
        isITM: ceITM,
        recent1MinHistory: ceHistory,
      },
      pe: {
        ltp: peBar ? peBar.close : 0,
        dayChange: peBar ? peBar.dayChange : 0,
        dayChangePct: peBar ? peBar.dayChangePct : 0,
        min1Change: peBar ? peBar.min1Change : 0,
        min1ChangePct: peBar ? peBar.min1ChangePct : 0,
        tfChangePct: peBar ? peBar.tfChangePct : 0,
        dayOpen: peBar ? peBar.dayOpen : 0,
        dayHigh: peBar ? peBar.dayHigh : 0,
        dayLow: peBar ? peBar.dayLow : 0,
        volume: peBar ? peBar.volume : 0,
        tfVolume: peBar ? peBar.volume : 0,
        dayVolume: peBar ? peBar.dayVolume : 0,
        isITM: peITM,
        recent1MinHistory: peHistory,
      },
    };
  });

  const atmStrike = cache.strikes.reduce((closest, curr) => {
    return Math.abs(curr - spot) < Math.abs(closest - spot) ? curr : closest;
  }, cache.strikes[0] || 22900);

  const tfLabelMap: Record<Timeframe, string> = {
    '1min': '1m',
    '5min': '5m',
    '15min': '15m',
    '1h': '1H',
    '1d': '1D',
    '1w': '1W',
  };

  const pcr = totalCeVolume > 0 ? round2(totalPeVolume / totalCeVolume) : 1;

  const simulatedEnv: SimulatedEnvInfo = {
    activeDate: targetTime ? targetTime.slice(0, 10) : (activeDate || '2026-10-19'),
    activeTime: targetTime || activeTime || '2026-10-19T10:09:00.000Z',
    spotPrice: spot,
    atmStrike,
    timeframe: tf,
    timeframeLabel: tfLabelMap[tf] || '1m',
    pcrDayVolume: pcr,
    order: 'descending',
  };

  return { chain, simulatedEnv };
}

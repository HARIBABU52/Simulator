import { DataPoint, Timeframe } from './types';

// Calculate ATR (Average True Range)
export function calculateATR(data: DataPoint[], period: number = 14): number[] {
  const atrs: number[] = new Array(data.length).fill(0);
  if (data.length === 0) return atrs;

  let trSum = 0;
  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const tr = prev
      ? Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close))
      : cur.high - cur.low;

    if (i < period) {
      trSum += tr;
      atrs[i] = trSum / (i + 1);
    } else {
      atrs[i] = (atrs[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atrs;
}

// Calculate Close-to-Close percentage: (close - close[1]) / close[1] * 100
export function attachC2C(candles: DataPoint[]): DataPoint[] {
  for (let i = 0; i < candles.length; i++) {
    const prev = i > 0 ? candles[i - 1] : null;
    if (prev && prev.close !== 0) {
      candles[i].c2cPercent = ((candles[i].close - prev.close) / prev.close) * 100;
    } else {
      candles[i].c2cPercent = undefined;
    }
  }
  return candles;
}

// Aggregate 1-min candles into higher timeframes
export function aggregateCandles(data: DataPoint[], tf: Timeframe): DataPoint[] {
  if (tf === '1min') return attachC2C(data);

  const buckets = new Map<number, DataPoint[]>();

  const msMap: Record<Timeframe, number> = {
    '1min': 60_000,
    '5min': 5 * 60_000,
    '15min': 15 * 60_000,
    '1h': 60 * 60_000,
    '1d': 24 * 60 * 60_000,
    '1w': 7 * 24 * 60 * 60_000,
  };

  const bucketMs = msMap[tf];

  for (const d of data) {
    const t = new Date(d.time).getTime();
    const bucket = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(d);
  }

  const result: DataPoint[] = [];
  const keys = Array.from(buckets.keys()).sort((a, b) => a - b);

  for (const key of keys) {
    const pts = buckets.get(key)!;
    result.push({
      time: new Date(key).toISOString(),
      open: pts[0].open,
      high: pts.reduce((m, p) => Math.max(m, p.high), -Infinity),
      low: pts.reduce((m, p) => Math.min(m, p.low), Infinity),
      close: pts[pts.length - 1].close,
      volume: pts.reduce((s, p) => s + p.volume, 0),
    });
  }

  return attachC2C(result);
}

// Format timestamp for axis labels
export function formatAxisTime(isoTime: string, tf: Timeframe): string {
  const d = new Date(isoTime);
  if (tf === '1d' || tf === '1w') {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }
  if (tf === '1h') {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Format tooltip time
export function formatTooltipTime(isoTime: string, tf: Timeframe): string {
  const d = new Date(isoTime);
  if (tf === '1d' || tf === '1w') {
    return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

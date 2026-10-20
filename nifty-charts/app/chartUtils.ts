import { DataPoint, Timeframe } from './types';

// Aggregate 1-min candles into higher timeframes
export function aggregateCandles(data: DataPoint[], tf: Timeframe): DataPoint[] {
  if (tf === '1min') return data;

  const buckets = new Map<number, DataPoint[]>();

  if (tf === '1M') {
    for (const d of data) {
      const dt = new Date(d.time);
      const bucket = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(d);
    }
  } else {
    const msMap: Record<Exclude<Timeframe, '1M'>, number> = {
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

  return result;
}

// Format timestamp for axis labels
export function formatAxisTime(isoTime: string, tf: Timeframe): string {
  const d = new Date(isoTime);
  if (tf === '1M') {
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  }
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
  if (tf === '1M') {
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  if (tf === '1d' || tf === '1w') {
    return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

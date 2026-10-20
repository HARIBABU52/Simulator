import type { DataPoint } from './types';

let cachedData: DataPoint[] | null = null;

export const loadData = async (): Promise<DataPoint[]> => {
  if (cachedData) return cachedData;
  const res = await fetch('/nifty-data.json');
  const raw = await res.json();
  const parsed: DataPoint[] = raw.map((d: any) => ({
    time: d.time,
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseFloat(d.volume),
  }));
  cachedData = parsed;
  return parsed;
};

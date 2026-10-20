import type { DataPoint } from './NiftyChart';

let cachedData: DataPoint[] | null = null;

export const loadData = async (): Promise<DataPoint[]> => {
  if (cachedData) return cachedData;
  const res = await fetch('/nifty-data.json');
  const raw = await res.json();
  cachedData = raw.map((d: any) => ({
    time: d.time,
    open: parseFloat(d.open),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    close: parseFloat(d.close),
    volume: parseFloat(d.volume),
  }));
  return cachedData;
};

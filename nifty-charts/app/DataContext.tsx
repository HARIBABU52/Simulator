"use client";
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { DataPoint } from './types';
export type { DataPoint };

type DataContextType = {
  data: DataPoint[];
  loading: boolean;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

// Module-level cache so JSON is loaded only once per session
let globalCache: DataPoint[] | null = null;
let globalPromise: Promise<DataPoint[]> | null = null;

function fetchData(): Promise<DataPoint[]> {
  if (globalCache) return Promise.resolve(globalCache);
  if (globalPromise) return globalPromise;
  globalPromise = fetch('/nifty-data.json')
    .then(r => r.json())
    .then((raw: any[]) => {
      const parsed: DataPoint[] = raw.map(d => ({
        time: d.time,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
        volume: parseFloat(d.volume) || 0,
      }));
      globalCache = parsed;
      return parsed;
    });
  return globalPromise;
}

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData()
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  return (
    <DataContext.Provider value={{ data, loading }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

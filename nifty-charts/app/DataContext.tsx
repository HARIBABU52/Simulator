"use client";
import React, { createContext, useContext, ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { DataPoint, Timeframe } from './types';
import { aggregateCandles } from './chartUtils';

export type { DataPoint };

const ALL_TIMEFRAMES: Timeframe[] = ['1min', '5min', '15min', '1h', '1d', '1w', '1M'];

// Module-level in-memory cache for raw data so network fetch occurs only once
let globalRawCache: DataPoint[] | null = null;
let globalRawPromise: Promise<DataPoint[]> | null = null;

export async function fetchRawData(): Promise<DataPoint[]> {
  if (globalRawCache) return globalRawCache;
  if (globalRawPromise) return globalRawPromise;

  globalRawPromise = fetch('/nifty-data.json')
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
      globalRawCache = parsed;
      return parsed;
    });

  return globalRawPromise;
}

// Custom hook to get pre-cached candles for a selected timeframe via TanStack Query
export function useTimeframeCandles(timeframe: Timeframe) {
  const queryClient = useQueryClient();

  // 1. Raw 1-min data query
  const rawQuery = useQuery<DataPoint[]>({
    queryKey: ['nifty-raw-data'],
    queryFn: fetchRawData,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 2. Query for the active timeframe, pre-caching other timeframes in background
  const candleQuery = useQuery<DataPoint[]>({
    queryKey: ['nifty-candles', timeframe],
    queryFn: async () => {
      const raw = rawQuery.data ?? await fetchRawData();
      const result = aggregateCandles(raw, timeframe);

      // Background pre-computation: warm up all other timeframes so future clicks are instant
      setTimeout(() => {
        ALL_TIMEFRAMES.forEach(tf => {
          if (tf !== timeframe && !queryClient.getQueryData(['nifty-candles', tf])) {
            const precomputed = aggregateCandles(raw, tf);
            queryClient.setQueryData(['nifty-candles', tf], precomputed);
          }
        });
      }, 50);

      return result;
    },
    enabled: !!rawQuery.data || !rawQuery.isLoading,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    candles: candleQuery.data ?? [],
    loading: candleQuery.isLoading || rawQuery.isLoading,
    rawData: rawQuery.data ?? [],
    isFetching: candleQuery.isFetching,
  };
}

// Backwards-compatible context
type DataContextType = {
  data: DataPoint[];
  loading: boolean;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

const DataContextBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { rawData, loading } = useTimeframeCandles('1min');
  return (
    <DataContext.Provider value={{ data: rawData, loading }}>
      {children}
    </DataContext.Provider>
  );
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <DataContextBridge>
        {children}
      </DataContextBridge>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

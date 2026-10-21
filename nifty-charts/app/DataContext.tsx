"use client";
import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { DataPoint, Timeframe } from './types';
import { aggregateCandles } from './chartUtils';
import { getAvailableExpiries, loadRawExpiryOptions, ExpiryRawData } from './actions/optionsData';
import {
  CalculatedExpiryCache,
  processRawExpiryData,
  getOptionChainFromCache,
  OptionChainItem,
  SimulatedEnvInfo,
} from './optionCalculations';

export type { DataPoint };
export type { OptionChainItem, SimulatedEnvInfo, CalculatedExpiryCache };

const ALL_TIMEFRAMES: Timeframe[] = ['1min', '5min', '15min', '1h', '1d', '1w'];

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

// In-memory module cache for processed expiry data
const globalCalculatedExpiries: Record<string, CalculatedExpiryCache> = {};

// Custom hook to discover available expiry folders dynamically from optionsData
export function useAvailableExpiries() {
  return useQuery<string[]>({
    queryKey: ['available-expiries'],
    queryFn: async () => {
      const expiries = await getAvailableExpiries();
      return expiries;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// Custom hook to load & calculate options data for an expiry ONCE and store in TanStack state
export function useExpiryOptionsCache(expiry: string = '27octExpire') {
  return useQuery<CalculatedExpiryCache>({
    queryKey: ['options-calculated', expiry],
    queryFn: async () => {
      if (globalCalculatedExpiries[expiry]) {
        return globalCalculatedExpiries[expiry];
      }
      // Load raw CE and PE JSON files from optionsData folder (no extra JSON files needed)
      const rawData = await loadRawExpiryOptions(expiry);
      // Calculate 1min, 5min, 15min, 1h, 1d, 1w timeframes on browser initial load
      const calculated = processRawExpiryData(rawData);
      globalCalculatedExpiries[expiry] = calculated;
      return calculated;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// Custom hook to get pre-cached option chain data directly from TanStack state without API/recalculations
export function useOptionChainData({
  timeframe,
  currentCandle,
  isReplayActive = false,
  currentPrice,
  expiry = '27octExpire',
}: {
  timeframe: Timeframe;
  currentCandle?: DataPoint | null;
  isReplayActive?: boolean;
  currentPrice: number;
  expiry?: string;
}) {
  const { data: expiriesList = ['27octExpire'] } = useAvailableExpiries();
  const activeExpiry = expiry || expiriesList[0] || '27octExpire';

  // Load and cache pre-calculated expiry data in TanStack Query
  const { data: cache, isLoading } = useExpiryOptionsCache(activeExpiry);

  const spotVal = currentPrice > 0 ? Math.round(currentPrice * 100) / 100 : 22888.95;
  const targetTime = currentCandle?.time || undefined;

  // Retrieve instantaneous snapshot directly from TanStack state in <0.001ms
  const result = useMemo(() => {
    if (!cache) {
      return {
        chain: [] as OptionChainItem[],
        simulatedEnv: undefined,
      };
    }
    return getOptionChainFromCache(cache, timeframe, spotVal, targetTime);
  }, [cache, timeframe, spotVal, targetTime]);

  return {
    chain: result.chain,
    simulatedEnv: result.simulatedEnv,
    isLoading,
    isFetching: false,
    availableExpiries: expiriesList,
    activeExpiry,
    cache,
  };
}

// Custom hook to get pre-cached candles for a selected timeframe via TanStack Query
export function useTimeframeCandles(timeframe: Timeframe) {
  const queryClient = useQueryClient();

  // 1. Fetch raw 1min data once and cache indefinitely
  const rawQuery = useQuery<DataPoint[]>({
    queryKey: ['nifty-raw-1min'],
    queryFn: fetchRawData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // 2. Aggregate for the active timeframe and cache
  const candleQuery = useQuery<DataPoint[]>({
    queryKey: ['nifty-candles', timeframe],
    queryFn: () => {
      const raw = rawQuery.data;
      if (!raw || raw.length === 0) return [];
      return aggregateCandles(raw, timeframe);
    },
    enabled: !!rawQuery.data && rawQuery.data.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // 3. Pre-aggregate and warm up all other timeframes in background
  React.useEffect(() => {
    if (!rawQuery.data || rawQuery.data.length === 0) return;
    const raw = rawQuery.data;

    ALL_TIMEFRAMES.forEach(tf => {
      if (tf !== timeframe) {
        const key = ['nifty-candles', tf];
        if (!queryClient.getQueryData(key)) {
          queryClient.setQueryData(key, aggregateCandles(raw, tf));
        }
      }
    });
  }, [rawQuery.data, timeframe, queryClient]);

  return {
    candles: candleQuery.data ?? [],
    loading: rawQuery.isLoading || candleQuery.isLoading,
    isLoading: rawQuery.isLoading || candleQuery.isLoading,
    rawData: rawQuery.data ?? [],
    isFetching: candleQuery.isFetching,
    isAggregating: candleQuery.isFetching && !candleQuery.isLoading,
  };
}

// Create React Query Client with infinite cache lifetime
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// DataContext Provider wrapper
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

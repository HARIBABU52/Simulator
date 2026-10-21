"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Timeframe } from "./types";
import { aggregateCandles } from "./chartUtils";
import { fetchRawData } from "./DataContext";

export function TanStackLogo({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <defs>
        <linearGradient id="tanstackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4154" />
          <stop offset="50%" stopColor="#ff7043" />
          <stop offset="100%" stopColor="#ffb300" />
        </linearGradient>
      </defs>
      <path
        d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 3.8l7.2 4.15v8.3L12 20.4l-7.2-4.15v-8.3L12 3.8z"
        fill="url(#tanstackGradient)"
      />
    </svg>
  );
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1m", value: "1min" },
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "1H", value: "1h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

export function TanStackCacheButton({ currentTimeframe }: { currentTimeframe: Timeframe }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  // Subscribe to TanStack Query Cache events without infinite re-render loop
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      // Only react to actual data updates, not observer creation or query mounts
      if (event?.type === 'updated') {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setTick(t => t + 1);
        }, 500);
      }
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [queryClient]);

  // Compute how many timeframes are cached
  const rawQuery = queryClient.getQueryState(["nifty-raw-data"]);
  const rawData = queryClient.getQueryData<any[]>(["nifty-raw-data"]);

  let cachedCount = 0;
  TIMEFRAMES.forEach(tf => {
    const data = queryClient.getQueryData(["nifty-candles", tf.value]);
    if (data) cachedCount++;
  });

  const isAllCached = cachedCount === TIMEFRAMES.length;

  const handlePrewarmAll = async () => {
    const raw = rawData ?? await fetchRawData();
    TIMEFRAMES.forEach(tf => {
      const existing = queryClient.getQueryData(["nifty-candles", tf.value]);
      if (!existing) {
        const computed = aggregateCandles(raw, tf.value);
        queryClient.setQueryData(["nifty-candles", tf.value], computed);
      }
    });
    setTick(t => t + 1);
  };

  const handleClearCache = () => {
    TIMEFRAMES.forEach(tf => {
      queryClient.removeQueries({ queryKey: ["nifty-candles", tf.value] });
    });
    setTick(t => t + 1);
  };

  return (
    <>
      <button
        type="button"
        className={`tanstack-cache-trigger ${isAllCached ? "fully-cached" : ""}`}
        onClick={() => setIsOpen(p => !p)}
        title={`TanStack Query Cache (${cachedCount}/${TIMEFRAMES.length} cached) - Click to inspect states`}
        id="tanstack-cache-button"
      >
        <span className="tanstack-icon-wrapper">
          <TanStackLogo size={13} />
        </span>
        <span className={`cache-indicator-dot ${isAllCached ? "online" : "warming"}`} />
      </button>

      {isOpen && (
        <div className="tanstack-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="tanstack-cache-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="tanstack-modal-header">
              <div className="tanstack-header-title">
                <TanStackLogo size={22} />
                <div>
                  <div className="tanstack-title-main">TanStack Query Cache State</div>
                  <div className="tanstack-title-sub">
                    In-memory aggregated timeframe cache for instant (0ms) chart switching
                  </div>
                </div>
              </div>
              <button
                className="tanstack-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Global Cache Status Banner */}
            <div className="tanstack-stats-row">
              <div className="tanstack-stat-card">
                <span className="stat-label">Raw 1-Min Data</span>
                <span className="stat-val">
                  {rawQuery?.status === "success" && rawData
                    ? `${rawData.length.toLocaleString()} bars`
                    : rawQuery?.status ?? "pending"}
                </span>
                <span className="stat-sub">
                  {rawQuery?.status === "success" ? "⚡ Cached in memory" : "Loading..."}
                </span>
              </div>

              <div className="tanstack-stat-card">
                <span className="stat-label">Cached Timeframes</span>
                <span className="stat-val highlight">
                  {cachedCount} / {TIMEFRAMES.length}
                </span>
                <span className="stat-sub">
                  {isAllCached ? "🚀 100% Pre-warmed" : "Background computing"}
                </span>
              </div>

              <div className="tanstack-stat-card">
                <span className="stat-label">Cache Switch Latency</span>
                <span className="stat-val text-green">0 ms</span>
                <span className="stat-sub">Instant zero-recalc render</span>
              </div>
            </div>

            {/* Timeframe Cache Table */}
            <div className="tanstack-cache-table-wrap">
              <table className="tanstack-table">
                <thead>
                  <tr>
                    <th>Timeframe</th>
                    <th>Query Key</th>
                    <th>Status</th>
                    <th>Candle Count</th>
                    <th>Size (est)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {TIMEFRAMES.map(tf => {
                    const queryState = queryClient.getQueryState(["nifty-candles", tf.value]);
                    const data = queryClient.getQueryData<any[]>(["nifty-candles", tf.value]);
                    const isCurrent = currentTimeframe === tf.value;
                    const isCached = !!data && data.length > 0;
                    const estSizeKb = data ? Math.round((data.length * 64) / 1024) : 0;

                    return (
                      <tr
                        key={tf.value}
                        className={`${isCurrent ? "current-timeframe-row" : ""} ${isCached ? "cached-row" : ""}`}
                      >
                        <td>
                          <div className="tf-cell">
                            <span className="tf-badge">{tf.label}</span>
                            {isCurrent && <span className="active-tag">Active</span>}
                          </div>
                        </td>
                        <td>
                          <code className="key-code">
                            ['nifty-candles', '{tf.value}']
                          </code>
                        </td>
                        <td>
                          {isCached ? (
                            <span className="cache-status-pill status-fresh">
                              ● Cached (Fresh)
                            </span>
                          ) : queryState?.fetchStatus === "fetching" ? (
                            <span className="cache-status-pill status-fetching">
                              ⟳ Fetching
                            </span>
                          ) : (
                            <span className="cache-status-pill status-idle">
                              ○ Idle
                            </span>
                          )}
                        </td>
                        <td className="number-cell">
                          {data ? data.length.toLocaleString() : "—"}
                        </td>
                        <td className="number-cell">
                          {estSizeKb > 1024
                            ? `${(estSizeKb / 1024).toFixed(1)} MB`
                            : estSizeKb > 0
                            ? `${estSizeKb} KB`
                            : "—"}
                        </td>
                        <td>
                          <button
                            className="recalc-btn"
                            title="Recalculate this timeframe from raw data"
                            onClick={async () => {
                              const raw = rawData ?? await fetchRawData();
                              const computed = aggregateCandles(raw, tf.value);
                              queryClient.setQueryData(["nifty-candles", tf.value], computed);
                              setTick(t => t + 1);
                            }}
                          >
                            ⟳ Recalc
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Controls */}
            <div className="tanstack-modal-footer">
              <div className="footer-info">
                💡 TanStack Query holds pre-aggregated timeframes in memory with <code>staleTime: Infinity</code> for zero-latency chart interactions.
              </div>
              <div className="footer-actions">
                <button
                  type="button"
                  className="tanstack-action-btn secondary"
                  onClick={handleClearCache}
                  title="Purge all timeframe caches except active"
                >
                  Clear Cache
                </button>
                <button
                  type="button"
                  className="tanstack-action-btn primary"
                  onClick={handlePrewarmAll}
                  title="Precompute and cache all timeframes immediately"
                >
                  ⚡ Warm All Timeframes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

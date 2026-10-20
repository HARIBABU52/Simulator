"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { DataProvider, useData } from './DataContext';
import TradingChart from './TradingChart';
import OrderPanel from './OrderPanel';
import StrategyPanel from './StrategyPanel';
import { aggregateCandles } from './chartUtils';
import { DataPoint, Order, Timeframe } from './types';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

function SimulatorApp() {
  const { data, loading } = useData();
  const [timeframe, setTimeframe] = useState<Timeframe>('1min');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCandle, setSelectedCandle] = useState<DataPoint | null>(null);
  const [clickedPrice, setClickedPrice] = useState<number | null>(null);
  const [rightPanel, setRightPanel] = useState<'orders' | 'strategy'>('orders');

  // Aggregate data for selected timeframe (memoized)
  const chartData = useMemo(() => aggregateCandles(data, timeframe), [data, timeframe]);

  const handleCandleClick = useCallback((candle: DataPoint, price: number) => {
    setSelectedCandle(candle);
    setClickedPrice(price);
  }, []);

  const handleAddOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, order]);
  }, []);

  const handleCancelOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
  }, []);

  const handleClearOrders = useCallback(() => setOrders([]), []);

  // Summary bar stats
  const lastCandle = chartData[chartData.length - 1];
  const prevCandle = chartData[chartData.length - 2];
  const change = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const changePct = prevCandle ? (change / prevCandle.close) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="app-root">
      {/* Top toolbar */}
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="brand">
            <span className="brand-icon">📈</span>
            <span className="brand-name">NIFTY Simulator</span>
          </div>

          {/* Timeframe selector */}
          <div className="tf-group">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                className={`tf-btn ${timeframe === tf.value ? 'active' : ''}`}
                onClick={() => setTimeframe(tf.value)}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market info */}
        {lastCandle && (
          <div className="market-info">
            <span className="market-name">NIFTY 50</span>
            <span className={`market-price ${isUp ? 'up' : 'down'}`}>
              {lastCandle.close.toFixed(1)}
            </span>
            <span className={`market-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)} ({Math.abs(changePct).toFixed(2)}%)
            </span>
            <span className="market-meta">
              H: {lastCandle.high.toFixed(1)} &nbsp; L: {lastCandle.low.toFixed(1)} &nbsp;
              O: {lastCandle.open.toFixed(1)}
            </span>
          </div>
        )}

        {/* Right panel toggle */}
        <div className="panel-toggle">
          <button className={rightPanel === 'orders' ? 'active' : ''} onClick={() => setRightPanel('orders')}>
            Orders
          </button>
          <button className={rightPanel === 'strategy' ? 'active' : ''} onClick={() => setRightPanel('strategy')}>
            Strategy
          </button>
        </div>
      </header>

      <div className="workspace">
        {/* Chart area */}
        <div className="chart-area">
          {loading && (
            <div className="chart-loading">
              <div className="spinner" />
              <span>Loading NIFTY data...</span>
            </div>
          )}
          {!loading && (
            <TradingChart
              data={chartData}
              orders={orders}
              timeframe={timeframe}
              onCandleClick={handleCandleClick}
            />
          )}
        </div>

        {/* Right panel */}
        <aside className="right-panel">
          {rightPanel === 'orders' ? (
            <OrderPanel
              selectedCandle={selectedCandle}
              clickedPrice={clickedPrice}
              orders={orders}
              onAddOrder={handleAddOrder}
              onCancelOrder={handleCancelOrder}
            />
          ) : (
            <StrategyPanel
              orders={orders}
              onClearOrders={handleClearOrders}
            />
          )}
        </aside>
      </div>

      {/* Bottom status bar */}
      <footer className="status-bar">
        <span>
          {loading ? 'Loading...' : `${data.length.toLocaleString()} bars loaded · ${chartData.length.toLocaleString()} candles (${timeframe})`}
        </span>
        <span>
          {orders.filter(o => o.status === 'FILLED').length} active orders
        </span>
        <span className="hint">
          🖱 Drag to pan · Scroll to pan · Ctrl+Scroll to zoom · Click candle to place order
        </span>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <DataProvider>
      <SimulatorApp />
    </DataProvider>
  );
}

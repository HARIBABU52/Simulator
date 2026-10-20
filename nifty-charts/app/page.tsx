"use client";
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DataProvider, useTimeframeCandles } from './DataContext';
import TradingChart from './TradingChart';
import OrderPanel from './OrderPanel';
import StrategyPanel from './StrategyPanel';
import { DataPoint, Order, Timeframe } from './types';
import { TanStackCacheButton } from './TanStackCacheModal';
import OptionChain from './OptionChain';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

function SimulatorApp() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1min');
  const { candles: chartData, loading, rawData, isFetching } = useTimeframeCandles(timeframe);
  const [showC2C, setShowC2C] = useState<boolean>(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCandle, setSelectedCandle] = useState<DataPoint | null>(null);
  const [clickedPrice, setClickedPrice] = useState<number | null>(null);
  const [rightPanel, setRightPanel] = useState<'orders' | 'strategy'>('orders');
  const [showOptionChain, setShowOptionChain] = useState<boolean>(true);
  const [isStrategyExpanded, setIsStrategyExpanded] = useState<boolean>(false);

  // Replay State
  const [isReplayActive, setIsReplayActive] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(500); // ms per step
  const [isSelectingBar, setIsSelectingBar] = useState<boolean>(false);

  // Sliced data based on replay
  const displayData = useMemo(() => {
    if (!isReplayActive) return chartData;
    return chartData.slice(0, Math.min(chartData.length, Math.max(1, replayIndex + 1)));
  }, [chartData, isReplayActive, replayIndex]);

  const currentCandle = displayData[displayData.length - 1];
  const currentPrice = currentCandle ? currentCandle.close : (chartData[chartData.length - 1]?.close ?? 0);

  // Real-time P&L for placed orders based on current replay/live candle
  const liveOrders = useMemo(() => {
    return orders.map(order => {
      if (order.status === 'CLOSED' || order.status === 'CANCELLED') {
        return order;
      }
      if (order.status === 'FILLED' && currentPrice) {
        const pts = (order.side === 'BUY' ? 1 : -1) * (currentPrice - order.price);
        // NIFTY 1 lot = 25 qty; ₹ PnL = pts * qty * 25
        const pnl = pts * order.qty * 25;
        return {
          ...order,
          pnl,
          pnlPoints: pts,
        };
      }
      return order;
    });
  }, [orders, currentPrice]);

  // Replay Auto-Playback timer
  useEffect(() => {
    if (!isReplayActive || !isPlaying) return;
    const timer = setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= chartData.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, replaySpeed);
    return () => clearInterval(timer);
  }, [isReplayActive, isPlaying, chartData.length, replaySpeed]);

  const handleToggleReplay = () => {
    if (isReplayActive) {
      setIsReplayActive(false);
      setIsPlaying(false);
      setIsSelectingBar(false);
    } else {
      setIsReplayActive(true);
      if (selectedCandle) {
        const idx = chartData.findIndex(d => d.time === selectedCandle.time);
        if (idx !== -1) {
          setReplayIndex(idx);
          setIsPlaying(false);
          setIsSelectingBar(false);
          return;
        }
      }
      // If no candle selected, arm bar selection cut tool
      setIsSelectingBar(true);
      setReplayIndex(Math.max(10, chartData.length - 120));
      setIsPlaying(false);
    }
  };

  const handleStartReplayFromCandle = useCallback((candle: DataPoint) => {
    const idx = chartData.findIndex(d => d.time === candle.time);
    if (idx !== -1) {
      setIsReplayActive(true);
      setReplayIndex(idx);
      setIsPlaying(false);
      setIsSelectingBar(false);
      setSelectedCandle(candle);
    }
  }, [chartData]);

  const handleCandleClick = useCallback((candle: DataPoint, price: number) => {
    if (isSelectingBar) {
      const idx = chartData.findIndex(d => d.time === candle.time);
      if (idx !== -1) {
        setReplayIndex(idx);
        setIsSelectingBar(false);
      }
      return;
    }
    setSelectedCandle(candle);
    setClickedPrice(price);
  }, [isSelectingBar, chartData]);

  const handleAddOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, order]);
  }, []);

  const handleAddOrders = useCallback((newOrders: Order[]) => {
    setOrders(prev => [...prev, ...newOrders]);
  }, []);

  const handleCloseOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id || o.status !== 'FILLED') return o;
      const pts = (o.side === 'BUY' ? 1 : -1) * (currentPrice - o.price);
      const pnl = pts * o.qty * 25;
      return {
        ...o,
        status: 'CLOSED' as const,
        exitPrice: currentPrice,
        exitTime: currentCandle?.time ?? new Date().toISOString(),
        pnl,
        pnlPoints: pts,
      };
    }));
  }, [currentPrice, currentCandle]);

  const handleCancelOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
  }, []);

  const handleClearOrders = useCallback(() => setOrders([]), []);

  // Summary stats
  const lastCandle = displayData[displayData.length - 1];
  const prevCandle = displayData[displayData.length - 2];
  const change = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const changePct = prevCandle ? (change / prevCandle.close) * 100 : 0;
  const isUp = change >= 0;

  const openPnL = useMemo(() => {
    return liveOrders.filter(o => o.status === 'FILLED').reduce((s, o) => s + (o.pnl ?? 0), 0);
  }, [liveOrders]);

  const closedPnL = useMemo(() => {
    return liveOrders.filter(o => o.status === 'CLOSED').reduce((s, o) => s + (o.pnl ?? 0), 0);
  }, [liveOrders]);

  const totalPnL = openPnL + closedPnL;

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


          {/* Replay Mode Toggle */}
          <button
            className={`replay-mode-btn ${isReplayActive ? 'active' : ''}`}
            onClick={handleToggleReplay}
            title="Toggle Bar Replay Simulator mode (updates live order P&L on each candle step)"
          >
            <span>⏪</span>
            <span>Replay</span>
          </button>

          {/* Option Chain Toggle */}
          <button
            className={`chain-toggle-btn ${showOptionChain ? 'active' : ''}`}
            onClick={() => setShowOptionChain(p => !p)}
            title="Toggle Indian NSE Option Chain below chart"
          >
            <span>⛓️</span>
            <span>Option Chain</span>
          </button>

          {/* TanStack Query Cache State Inspector */}
          <TanStackCacheButton currentTimeframe={timeframe} />
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

      {/* Bar Replay Toolbar */}
      {isReplayActive && (
        <div className="replay-toolbar">
          <div className="replay-controls-left">
            <span className="replay-badge">⏪ REPLAY</span>

            <button
              className={`replay-btn ${isSelectingBar ? 'active' : ''}`}
              onClick={() => setIsSelectingBar(p => !p)}
              title="Click any candle on chart to start replay from that point"
            >
              📍 {isSelectingBar ? 'Click a candle...' : 'Jump To Bar'}
            </button>

            <button
              className="replay-btn"
              onClick={() => setReplayIndex(Math.max(10, chartData.length - 200))}
              title="Rewind to start"
            >
              ⏮️
            </button>

            <button
              className="replay-btn"
              onClick={() => setReplayIndex(p => Math.max(0, p - 1))}
              title="Step Back 1 Candle"
            >
              ◀ Step
            </button>

            <button
              className={`replay-btn play ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(p => !p)}
              title={isPlaying ? 'Pause Replay' : 'Play Replay (Auto step forward)'}
            >
              {isPlaying ? '⏸️ Pause' : '▶ Play'}
            </button>

            <button
              className="replay-btn"
              onClick={() => setReplayIndex(p => Math.min(chartData.length - 1, p + 1))}
              title="Step Forward 1 Candle"
            >
              Step ▶
            </button>

            {/* Speed selectors */}
            <div className="replay-speed-group">
              {[
                { label: '0.5s', val: 1000 },
                { label: '1s', val: 500 },
                { label: '2x', val: 250 },
                { label: '5x', val: 100 },
              ].map(sp => (
                <button
                  key={sp.val}
                  className={`speed-btn ${replaySpeed === sp.val ? 'active' : ''}`}
                  onClick={() => setReplaySpeed(sp.val)}
                >
                  {sp.label}
                </button>
              ))}
            </div>

            <div className="replay-info">
              <span>Bar {replayIndex + 1}/{chartData.length}</span>
              {currentCandle && (
                <span className="replay-time">
                  {new Date(currentCandle.time).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                </span>
              )}
              <span className="replay-ltp">LTP: ₹{currentPrice.toFixed(1)}</span>
            </div>
          </div>

          <div className="replay-pnl-summary">
            <div className="pnl-chip">
              <span className="pnl-chip-label">Open:</span>
              <span className={`pnl-chip-val ${openPnL >= 0 ? 'profit' : 'loss'}`}>
                {openPnL >= 0 ? '+' : ''}₹{Math.round(openPnL).toLocaleString()}
              </span>
            </div>
            <div className="pnl-chip">
              <span className="pnl-chip-label">Closed:</span>
              <span className={`pnl-chip-val ${closedPnL >= 0 ? 'profit' : 'loss'}`}>
                {closedPnL >= 0 ? '+' : ''}₹{Math.round(closedPnL).toLocaleString()}
              </span>
            </div>
            <div className="pnl-chip total">
              <span className="pnl-chip-label">Total P&L:</span>
              <span className={`pnl-chip-val ${totalPnL >= 0 ? 'profit' : 'loss'}`}>
                {totalPnL >= 0 ? '+' : ''}₹{Math.round(totalPnL).toLocaleString()}
              </span>
            </div>

            <button className="exit-replay-btn" onClick={handleToggleReplay} title="Exit Replay Mode">
              ✕ Exit
            </button>
          </div>
        </div>
      )}

      <div className="workspace">
        {/* Chart area container with Option Chain below */}
        <div className="chart-area-container">
          <div className={`chart-area ${showOptionChain ? 'with-chain' : ''}`}>
            {loading && (
              <div className="chart-loading">
                <div className="spinner" />
                <span>Loading NIFTY data...</span>
              </div>
            )}
            {!loading && (
              <TradingChart
                data={displayData}
                orders={liveOrders}
                timeframe={timeframe}
                onCandleClick={handleCandleClick}
                showC2C={showC2C}
                onToggleC2C={() => setShowC2C(p => !p)}
                selectedCandle={selectedCandle}
                isReplayActive={isReplayActive}
                isSelectingBar={isSelectingBar}
                currentPrice={currentPrice}
              />
            )}
          </div>

          {/* Authentic Indian Option Chain below chart */}
          {showOptionChain && (
            <OptionChain
              currentPrice={currentPrice}
              currentCandle={currentCandle}
              timeframe={timeframe}
              onClose={() => setShowOptionChain(false)}
              onAddOrder={handleAddOrder}
              isReplayActive={isReplayActive}
            />
          )}
        </div>

        {/* Right panel */}
        <aside className={`right-panel ${rightPanel === 'strategy' ? 'strategy-mode' : ''} ${isStrategyExpanded && rightPanel === 'strategy' ? 'expanded' : ''}`}>
          {rightPanel === 'orders' ? (
            <OrderPanel
              selectedCandle={selectedCandle}
              clickedPrice={clickedPrice}
              orders={liveOrders}
              onAddOrder={handleAddOrder}
              onCancelOrder={handleCancelOrder}
              onCloseOrder={handleCloseOrder}
              onStartReplayFromCandle={handleStartReplayFromCandle}
              currentPrice={currentPrice}
              currentCandle={currentCandle}
              isReplayActive={isReplayActive}
            />
          ) : (
            <StrategyPanel
              orders={liveOrders}
              onClearOrders={handleClearOrders}
              onAddOrder={handleAddOrder}
              onAddOrders={handleAddOrders}
              onCloseOrder={handleCloseOrder}
              currentPrice={currentPrice}
              currentCandle={currentCandle}
              timeframe={timeframe}
              isReplayActive={isReplayActive}
              isExpanded={isStrategyExpanded}
              onToggleExpand={() => setIsStrategyExpanded(p => !p)}
            />
          )}
        </aside>
      </div>

      {/* Bottom status bar */}
      <footer className="status-bar">
        <span>
          {loading ? 'Loading...' : `${rawData.length.toLocaleString()} bars loaded · ${chartData.length.toLocaleString()} candles (${timeframe})`}
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

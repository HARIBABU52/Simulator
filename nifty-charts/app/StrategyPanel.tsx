"use client";
import React, { useMemo } from 'react';
import { Order, StrategyStats } from './types';

interface StrategyPanelProps {
  orders: Order[];
  onClearOrders: () => void;
}

function computeStats(orders: Order[]): StrategyStats & { paired: { buy: Order; sell: Order; pnl: number }[] } {
  const filled = orders.filter(o => o.status === 'FILLED');
  const buys = filled.filter(o => o.side === 'BUY');
  const sells = filled.filter(o => o.side === 'SELL');
  const paired: { buy: Order; sell: Order; pnl: number }[] = [];

  // Pair buys and sells in chronological order (FIFO)
  const buyQ = [...buys].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const sellQ = [...sells].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  while (buyQ.length > 0 && sellQ.length > 0) {
    const b = buyQ.shift()!;
    const s = sellQ.shift()!;
    const pnl = (s.price - b.price) * Math.min(b.qty, s.qty);
    paired.push({ buy: b, sell: s, pnl });
  }

  const totalPnl = paired.reduce((s, p) => s + p.pnl, 0);
  const wins = paired.filter(p => p.pnl > 0);
  const losses = paired.filter(p => p.pnl <= 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p.pnl, 0) / losses.length : 0;

  // Max drawdown (running equity)
  let equity = 0, peak = 0, maxDD = 0;
  for (const p of paired) {
    equity += p.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalTrades: paired.length,
    wins: wins.length,
    losses: losses.length,
    winRate: paired.length > 0 ? (wins.length / paired.length) * 100 : 0,
    totalPnl,
    maxDrawdown: maxDD,
    avgWin,
    avgLoss,
    paired,
  };
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ orders, onClearOrders }) => {
  const stats = useMemo(() => computeStats(orders), [orders]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">📊</span>
        Strategy Results
        <button className="clear-btn" onClick={onClearOrders} title="Clear all orders">Clear All</button>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard label="Total P&L" value={`₹${stats.totalPnl.toFixed(0)}`} accent={stats.totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} accent={stats.winRate >= 50 ? 'green' : 'orange'} />
        <StatCard label="Trades" value={`${stats.totalTrades}`} />
        <StatCard label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} />
        <StatCard label="Avg Win" value={`₹${stats.avgWin.toFixed(0)}`} accent="green" />
        <StatCard label="Avg Loss" value={`₹${stats.avgLoss.toFixed(0)}`} accent="red" />
        <StatCard label="Max Drawdown" value={`₹${stats.maxDrawdown.toFixed(0)}`} accent="red" />
        <StatCard label="Profit Factor" value={
          stats.avgLoss !== 0
            ? Math.abs(stats.avgWin / stats.avgLoss).toFixed(2)
            : stats.avgWin > 0 ? '∞' : '0'
        } accent={stats.avgWin / Math.abs(stats.avgLoss || 1) >= 1 ? 'green' : 'orange'} />
      </div>

      {/* Trade log */}
      <div className="trade-log">
        <div className="orders-header">Trade Log ({stats.paired.length} pairs)</div>
        {stats.paired.length === 0 && (
          <div className="empty-msg">No completed trades yet. Add both Buy and Sell orders to simulate P&L.</div>
        )}
        {stats.paired.map((p, i) => (
          <div key={i} className={`trade-row ${p.pnl >= 0 ? 'win' : 'loss'}`}>
            <div className="trade-meta">
              <span className="trade-num">#{i + 1}</span>
              <span className="buy-text">B ₹{p.buy.price.toFixed(1)}</span>
              <span>→</span>
              <span className="sell-text">S ₹{p.sell.price.toFixed(1)}</span>
              <span className="trade-qty">×{Math.min(p.buy.qty, p.sell.qty)}</span>
            </div>
            <div className={`trade-pnl ${p.pnl >= 0 ? 'profit' : 'loss'}`}>
              {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}
            </div>
          </div>
        ))}
      </div>

      {/* Equity curve (mini bar chart) */}
      {stats.paired.length > 1 && (
        <EquityCurve paired={stats.paired} />
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent?: 'green' | 'red' | 'orange' }> = ({
  label, value, accent,
}) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${accent ? `accent-${accent}` : ''}`}>{value}</div>
  </div>
);

const EquityCurve: React.FC<{ paired: { pnl: number }[] }> = ({ paired }) => {
  const equities: number[] = [];
  let running = 0;
  for (const p of paired) { running += p.pnl; equities.push(running); }
  const maxE = Math.max(...equities.map(Math.abs), 1);
  return (
    <div className="equity-curve">
      <div className="orders-header">Equity Curve</div>
      <div className="equity-bars">
        {equities.map((e, i) => (
          <div
            key={i}
            title={`Trade #${i + 1}: ₹${e.toFixed(0)}`}
            className={`equity-bar ${e >= 0 ? 'win' : 'loss'}`}
            style={{ height: `${Math.max(4, (Math.abs(e) / maxE) * 60)}px` }}
          />
        ))}
      </div>
      <div className="equity-baseline" />
    </div>
  );
};

export default StrategyPanel;

"use client";
import React, { useMemo } from 'react';
import { Order, StrategyStats } from './types';

interface StrategyPanelProps {
  orders: Order[];
  onClearOrders: () => void;
}

function computeStats(orders: Order[]): {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  trades: { desc: string; pnl: number; status: string }[];
} {
  const closed = orders.filter(o => o.status === 'CLOSED');
  const open = orders.filter(o => o.status === 'FILLED');

  const trades: { desc: string; pnl: number; status: string }[] = [];

  for (const c of closed) {
    const pnl = c.pnl ?? 0;
    trades.push({
      desc: `${c.side} ${c.qty}L @ ₹${c.price.toFixed(1)} → ₹${c.exitPrice?.toFixed(1) ?? 'Exit'}`,
      pnl,
      status: 'CLOSED',
    });
  }

  // Also pair unclosed opposite orders in FIFO manner if present
  const unclosedBuys = open.filter(o => o.side === 'BUY');
  const unclosedSells = open.filter(o => o.side === 'SELL');
  if (unclosedBuys.length > 0 && unclosedSells.length > 0) {
    const buyQ = [...unclosedBuys].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const sellQ = [...unclosedSells].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    while (buyQ.length > 0 && sellQ.length > 0) {
      const b = buyQ.shift()!;
      const s = sellQ.shift()!;
      const pnl = (s.price - b.price) * Math.min(b.qty, s.qty) * 25;
      trades.push({
        desc: `Pair: B ₹${b.price.toFixed(1)} / S ₹${s.price.toFixed(1)}`,
        pnl,
        status: 'PAIRED',
      });
    }
  }

  const realizedPnl = closed.reduce((s, o) => s + (o.pnl ?? 0), 0);
  const unrealizedPnl = open.reduce((s, o) => s + (o.pnl ?? 0), 0);
  const totalPnl = realizedPnl + unrealizedPnl;

  const wins = trades.filter(p => p.pnl > 0);
  const losses = trades.filter(p => p.pnl <= 0);
  const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p.pnl, 0) / losses.length : 0;

  // Max drawdown
  let equity = 0, peak = 0, maxDD = 0;
  for (const p of trades) {
    equity += p.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    realizedPnl,
    unrealizedPnl,
    totalPnl,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    avgWin,
    avgLoss,
    maxDrawdown: maxDD,
    trades,
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
        <StatCard label="Net Total P&L" value={`${stats.totalPnl >= 0 ? '+' : ''}₹${Math.round(stats.totalPnl).toLocaleString()}`} accent={stats.totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Realized P&L" value={`${stats.realizedPnl >= 0 ? '+' : ''}₹${Math.round(stats.realizedPnl).toLocaleString()}`} accent={stats.realizedPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Open P&L" value={`${stats.unrealizedPnl >= 0 ? '+' : ''}₹${Math.round(stats.unrealizedPnl).toLocaleString()}`} accent={stats.unrealizedPnl >= 0 ? 'green' : 'orange'} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} accent={stats.winRate >= 50 ? 'green' : 'orange'} />
        <StatCard label="Closed Trades" value={`${stats.totalTrades}`} />
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
        <div className="orders-header">Trade Log ({stats.trades.length} closed)</div>
        {stats.trades.length === 0 && (
          <div className="empty-msg">No closed trades yet. Enter positions and close them during replay to view realized stats.</div>
        )}
        {stats.trades.map((t, i) => (
          <div key={i} className={`trade-row ${t.pnl >= 0 ? 'win' : 'loss'}`}>
            <div className="trade-meta">
              <span className="trade-num">#{i + 1}</span>
              <span>{t.desc}</span>
            </div>
            <div className={`trade-pnl ${t.pnl >= 0 ? 'profit' : 'loss'}`}>
              {t.pnl >= 0 ? '+' : ''}₹{Math.round(t.pnl).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {stats.trades.length > 1 && (
        <EquityCurve paired={stats.trades} />
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

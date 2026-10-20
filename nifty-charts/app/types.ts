// Shared types

export type DataPoint = {
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = '1min' | '5min' | '15min' | '1h' | '1d' | '1w' | '1M';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED';

export type Order = {
  id: string;
  side: OrderSide;
  price: number;
  qty: number;
  time: string; // ISO string — timestamp when the order should trigger
  status: OrderStatus;
  pnl?: number; // computed after pairing
};

export type StrategyStats = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
};

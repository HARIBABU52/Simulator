// Shared types

export type DataPoint = {
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  c2cPercent?: number;
};

export type Timeframe = '1min' | '5min' | '15min' | '1h' | '1d' | '1w' | '1M';

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CLOSED' | 'CANCELLED';

export type Order = {
  id: string;
  side: OrderSide;
  price: number;
  qty: number;
  time: string; // ISO string — timestamp when the order was placed
  status: OrderStatus;
  pnl?: number; // current unrealized or realized pnl (in ₹)
  pnlPoints?: number; // pnl in index points
  exitPrice?: number;
  exitTime?: string;
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

"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { Order, OrderSide, StrategyLeg, DataPoint, Timeframe } from './types';
import { useOptionChainData } from './DataContext';

export interface StrategyDefinition {
  id: string;
  name: string;
  category: 'Bullish' | 'Bearish' | 'Neutral' | 'Other';
  description: string;
  buildLegs: (atm: number, itmC: number, otmC: number, itmP: number, otmP: number, prices: Record<string, number>) => StrategyLeg[];
}

interface StrategyPanelProps {
  orders: Order[];
  onClearOrders: () => void;
  onAddOrder?: (order: Order) => void;
  onAddOrders?: (orders: Order[]) => void;
  onCloseOrder?: (id: string) => void;
  currentPrice: number;
  currentCandle?: DataPoint | null;
  timeframe?: Timeframe;
  isReplayActive?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// 32 Ready-Made Strategies matching the exact categories from user screenshots
export const READY_MADE_STRATEGIES: StrategyDefinition[] = [
  // ===== BULLISH =====
  {
    id: 'buy_call',
    name: 'Buy Call',
    category: 'Bullish',
    description: 'Bullish directional strategy with defined risk and uncapped upside.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
    ],
  },
  {
    id: 'sell_put',
    name: 'Sell Put',
    category: 'Bullish',
    description: 'Bullish/mildly bullish strategy collecting premium with capped profit.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
  {
    id: 'long_synthetic_future',
    name: 'Long Synthetic Future',
    category: 'Bullish',
    description: 'Synthesizes long futures position by buying ATM call and selling ATM put.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '2', side: 'SELL', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
    ],
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    category: 'Bullish',
    description: 'Defined-risk vertical spread buying lower strike call and selling higher strike call.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '2', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'bull_put_spread',
    name: 'Bull Put Spread',
    category: 'Bullish',
    description: 'Credit vertical spread selling higher strike put and buying lower strike put protection.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '2', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
  {
    id: 'long_calendar_calls',
    name: 'Long Calendar with Calls',
    category: 'Bullish',
    description: 'Exploits time decay by selling near-term call and buying longer-term call.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '2', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'bull_condor',
    name: 'Bull Condor',
    category: 'Bullish',
    description: 'Four-leg spread with defined risk and defined profit targeting moderately higher levels.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '2', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '3', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '4', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'bull_butterfly',
    name: 'Bull Butterfly',
    category: 'Bullish',
    description: 'Three-strike butterfly targeting max profit at the center body strike.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '2', side: 'SELL', strike: atm, optionType: 'CE', qty: 2, price: p[`${atm}_CE`] || 169.85 },
      { id: '3', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'range_forward',
    name: 'Range Forward',
    category: 'Bullish',
    description: 'Zero/low-cost collar buying call and financing via short put.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '2', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },

  // ===== BEARISH =====
  {
    id: 'buy_put',
    name: 'Buy Put',
    category: 'Bearish',
    description: 'Bearish directional strategy profiting from falling spot price with capped risk.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
    ],
  },
  {
    id: 'sell_call',
    name: 'Sell Call',
    category: 'Bearish',
    description: 'Bearish strategy collecting call premium; uncapped risk if underlying surges.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'short_synthetic_future',
    name: 'Short Synthetic Future',
    category: 'Bearish',
    description: 'Synthesizes short futures by selling ATM call and buying ATM put.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '2', side: 'BUY', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
    ],
  },
  {
    id: 'bear_call_spread',
    name: 'Bear Call Spread',
    category: 'Bearish',
    description: 'Credit vertical spread selling lower strike call and buying higher strike call protection.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '2', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    category: 'Bearish',
    description: 'Debit vertical spread buying higher strike put and selling lower strike put.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '2', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
  {
    id: 'long_calendar_puts',
    name: 'Long Calendar with Puts',
    category: 'Bearish',
    description: 'Exploits time decay using put options around key support level.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
      { id: '2', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
  {
    id: 'bear_condor',
    name: 'Bear Condor',
    category: 'Bearish',
    description: 'Four-leg spread with defined risk targeting lower price plateau.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '4', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'bear_butterfly',
    name: 'Bear Butterfly',
    category: 'Bearish',
    description: 'Three-strike butterfly targeting sweet spot below current spot price.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: atm, optionType: 'PE', qty: 2, price: p[`${atm}_PE`] || 172.50 },
      { id: '3', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
    ],
  },
  {
    id: 'risk_reversal',
    name: 'Risk Reversal',
    category: 'Bearish',
    description: 'Bearish hedge selling OTM call to finance purchase of OTM put.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },

  // ===== NEUTRAL =====
  {
    id: 'short_straddle',
    name: 'Short Straddle',
    category: 'Neutral',
    description: 'Sells ATM call and ATM put to collect maximum premium; profits from low volatility.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '2', side: 'SELL', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
    ],
  },
  {
    id: 'short_strangle',
    name: 'Short Strangle',
    category: 'Neutral',
    description: 'Sells OTM call and OTM put; profits if underlying stays inside wide strike band.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'short_iron_condor',
    name: 'Short Iron Condor',
    category: 'Neutral',
    description: 'Defined-risk range-bound strategy selling OTM strangle and buying protective wings.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '4', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'short_iron_butterfly',
    name: 'Short Iron Butterfly',
    category: 'Neutral',
    description: 'Sells ATM straddle with protective OTM wings, giving capped risk and high return.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
      { id: '3', side: 'SELL', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '4', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'batman',
    name: 'Batman',
    category: 'Neutral',
    description: 'Dual-peak neutral structure creating two separate profit zones with center valley.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '4', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'jade_lizard',
    name: 'Jade Lizard',
    category: 'Neutral',
    description: 'Sells OTM put plus a bear call spread; no upside risk when credit exceeds spread width.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '3', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'reverse_jade_lizard',
    name: 'Reverse Jade Lizard',
    category: 'Neutral',
    description: 'Sells OTM call plus a bull put spread; eliminates downside risk when properly structured.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '2', side: 'SELL', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
  {
    id: 'double_plateau',
    name: 'Double Plateau',
    category: 'Neutral',
    description: 'Neutral setup offering two distinct high-probability target profit areas.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '4', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },

  // ===== OTHER =====
  {
    id: 'long_straddle',
    name: 'Long Straddle',
    category: 'Other',
    description: 'Buys ATM call and ATM put; profits from huge breakout moves in either direction.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '2', side: 'BUY', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
    ],
  },
  {
    id: 'long_strangle',
    name: 'Long Strangle',
    category: 'Other',
    description: 'Buys OTM call and OTM put; lower cost breakout strategy needing bigger move.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'long_iron_condor',
    name: 'Long Iron Condor',
    category: 'Other',
    description: 'Reverse iron condor betting on a large move outside the wings with limited risk.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '3', side: 'BUY', strike: otmC, optionType: 'CE', qty: 1, price: p[`${otmC}_CE`] || 169.85 },
      { id: '4', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'long_iron_butterfly',
    name: 'Long Iron Butterfly',
    category: 'Other',
    description: 'Reverse iron fly buying ATM wings and selling protective edges for sharp moves.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'SELL', strike: otmP, optionType: 'PE', qty: 1, price: p[`${otmP}_PE`] || 149.50 },
      { id: '2', side: 'BUY', strike: atm, optionType: 'PE', qty: 1, price: p[`${atm}_PE`] || 172.50 },
      { id: '3', side: 'BUY', strike: atm, optionType: 'CE', qty: 1, price: p[`${atm}_CE`] || 169.85 },
      { id: '4', side: 'SELL', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
    ],
  },
  {
    id: 'call_ratio_spread',
    name: 'Call Ratio Spread',
    category: 'Other',
    description: 'Buys 1 lower call and sells 2 higher calls; profits if price rises up to short strike.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmC, optionType: 'CE', qty: 1, price: p[`${itmC}_CE`] || 195.00 },
      { id: '2', side: 'SELL', strike: otmC, optionType: 'CE', qty: 2, price: p[`${otmC}_CE`] || 169.85 },
    ],
  },
  {
    id: 'put_ratio_spread',
    name: 'Put Ratio Spread',
    category: 'Other',
    description: 'Buys 1 higher put and sells 2 lower puts; profits if price drops down to short strike.',
    buildLegs: (atm, itmC, otmC, itmP, otmP, p) => [
      { id: '1', side: 'BUY', strike: itmP, optionType: 'PE', qty: 1, price: p[`${itmP}_PE`] || 172.50 },
      { id: '2', side: 'SELL', strike: otmP, optionType: 'PE', qty: 2, price: p[`${otmP}_PE`] || 149.50 },
    ],
  },
];

// Helper to compute theoretical option payoff at expiry across spot prices
export function computePayoffPoints(legs: StrategyLeg[], centerSpot: number) {
  const range = 450;
  const step = 6;
  const start = Math.floor((centerSpot - range) / 10) * 10;
  const end = Math.ceil((centerSpot + range) / 10) * 10;

  const points: { spot: number; pnl: number }[] = [];
  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (let s = start; s <= end; s += step) {
    let pnl = 0;
    for (const leg of legs) {
      const intrinsic = leg.optionType === 'CE'
        ? Math.max(0, s - leg.strike)
        : Math.max(0, leg.strike - s);

      const legPnl = (leg.side === 'BUY' ? (intrinsic - leg.price) : (leg.price - intrinsic)) * leg.qty * 25;
      pnl += legPnl;
    }
    points.push({ spot: s, pnl });
    if (pnl > maxProfit) maxProfit = pnl;
    if (pnl < maxLoss) maxLoss = pnl;
  }

  // Find Breakevens
  const breakevens: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if ((p1.pnl <= 0 && p2.pnl >= 0) || (p1.pnl >= 0 && p2.pnl <= 0)) {
      if (p2.pnl !== p1.pnl) {
        const be = p1.spot + (0 - p1.pnl) * ((p2.spot - p1.spot) / (p2.pnl - p1.pnl));
        breakevens.push(Math.round(be));
      }
    }
  }

  // Net Premium
  let netPremiumPoints = 0;
  for (const leg of legs) {
    const sign = leg.side === 'BUY' ? -1 : 1;
    netPremiumPoints += sign * leg.price * leg.qty;
  }
  const netPremiumRupees = netPremiumPoints * 25;

  return {
    points,
    maxProfit: Math.round(maxProfit),
    maxLoss: Math.round(maxLoss),
    breakevens,
    netPremiumPoints: Math.round(netPremiumPoints * 100) / 100,
    netPremiumRupees: Math.round(netPremiumRupees),
    minSpot: start,
    maxSpot: end,
  };
}

// Mini SVG Curve Generator matching the exact look in the screenshots
const MiniPayoffSvg: React.FC<{ type: string }> = ({ type }) => {
  // SVG height: 50, width: 88, baseline y=25
  switch (type) {
    case 'buy_call':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,38 42,38 42,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="42,25 42,38 78,10 78,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 38 L 42 38 L 78 10" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 42 38 L 78 10" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'sell_put':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,44 48,15 48,25 12,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="48,25 48,15 78,15 78,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 44 L 48 15" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 48 15 L 78 15" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'long_synthetic_future':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="14,44 44,25 14,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="44,25 76,8 76,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 14 44 L 44 25" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 44 25 L 76 8" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'bull_call_spread':
    case 'bull_put_spread':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,38 38,38 48,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="48,25 58,14 78,14 78,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 38 L 38 38 L 48 25" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 48 25 L 58 14 L 78 14" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'long_calendar_calls':
    case 'long_calendar_puts':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,25 12,38 28,38 44,12 60,38 76,38 76,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="34,25 44,12 54,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 38 Q 44 0 76 38" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'bull_condor':
    case 'bear_condor':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,38 34,38 44,14 54,14 64,38 78,38 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="38,25 44,14 54,14 60,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 38 L 34 38 L 44 14 L 54 14 L 64 38 L 78 38" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'bull_butterfly':
    case 'bear_butterfly':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,38 36,38 44,12 52,38 78,38 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="40,25 44,12 48,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 38 L 36 38 L 44 12 L 52 38 L 78 38" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'buy_put':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,25 12,10 46,38 46,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="46,25 46,38 78,38 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 10 L 46 38" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 46 38 L 78 38" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'sell_call':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,25 12,15 48,15 48,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="48,25 48,15 78,44 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 15 L 48 15" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 48 15 L 78 44" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'short_synthetic_future':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="14,25 14,8 44,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="44,25 76,44 76,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 14 8 L 44 25" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 44 25 L 76 44" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'bear_call_spread':
    case 'bear_put_spread':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,14 36,14 46,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="46,25 56,38 78,38 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 14 L 36 14 L 46 25" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 46 25 L 56 38 L 78 38" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'short_straddle':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,25 12,44 32,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="32,25 44,12 56,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="56,25 76,44 76,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 44 L 44 12 L 76 44" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 12 44 L 32 25" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 56 25 L 76 44" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'short_strangle':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,44 30,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="30,25 38,15 50,15 58,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="58,25 78,44 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 44 L 38 15 L 50 15 L 78 44" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 10 44 L 30 25" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 58 25 L 78 44" fill="none" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    case 'short_iron_condor':
    case 'short_iron_butterfly':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,40 28,40 38,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="38,25 44,14 48,14 54,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="54,25 64,40 78,40 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 40 L 28 40 L 44 14 L 48 14 L 64 40 L 78 40" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'long_straddle':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="12,25 12,10 32,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="32,25 44,42 56,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="56,25 76,10 76,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 12 10 L 44 42 L 76 10" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 12 10 L 32 25" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 56 25 L 76 10" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'long_strangle':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,10 30,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="30,25 38,40 50,40 58,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="58,25 78,10 78,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 10 L 38 40 L 50 40 L 78 10" fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d="M 10 10 L 30 25" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M 58 25 L 78 10" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    case 'batman':
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,42 26,42 34,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="34,25 38,18 44,24 50,18 54,25" fill="rgba(34, 197, 94, 0.25)" />
          <polygon points="54,25 62,42 78,42 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 42 L 26 42 L 38 18 L 44 24 L 50 18 L 62 42 L 78 42" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
    default:
      // Generic Plateau
      return (
        <svg viewBox="0 0 88 50" className="mini-payoff-svg">
          <polygon points="10,25 10,38 34,38 44,16 60,16 70,38 78,38 78,25" fill="rgba(239, 68, 68, 0.25)" />
          <polygon points="38,25 44,16 60,16 66,25" fill="rgba(34, 197, 94, 0.25)" />
          <line x1="6" y1="25" x2="82" y2="25" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 10 38 L 34 38 L 44 16 L 60 16 L 70 38 L 78 38" fill="none" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );
  }
};

export const StrategyPanel: React.FC<StrategyPanelProps> = ({
  orders,
  onClearOrders,
  onAddOrder,
  onAddOrders,
  onCloseOrder,
  currentPrice,
  currentCandle,
  timeframe = '1min',
  isReplayActive = false,
  isExpanded = false,
  onToggleExpand,
}) => {
  // Main Tab: 'payoff' or 'performance' (Ignored: Strategy Chart, NIFTY Chart, Strategy Chart + NIFTY Chart)
  const [activeMainTab, setActiveMainTab] = useState<'payoff' | 'performance'>('payoff');
  const [activeCategory, setActiveCategory] = useState<'Bullish' | 'Bearish' | 'Neutral' | 'Other'>('Bullish');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('bull_call_spread');
  const [configuredLegs, setConfiguredLegs] = useState<StrategyLeg[]>([]);
  const [activeComboTrackerId, setActiveComboTrackerId] = useState<string | null>(null);

  // TanStack Query live option chain cache to get live prices
  const { chain } = useOptionChainData({
    timeframe,
    currentCandle,
    isReplayActive,
    currentPrice,
  });

  // Price map from option chain
  const optionPrices = useMemo(() => {
    const map: Record<string, number> = {
      '22850_CE': 195.00,
      '22850_PE': 149.50,
      '22900_CE': 169.85,
      '22900_PE': 172.50,
    };
    chain.forEach(row => {
      if (row.strike) {
        if (row.ce && row.ce.ltp > 0) map[`${row.strike}_CE`] = row.ce.ltp;
        if (row.pe && row.pe.ltp > 0) map[`${row.strike}_PE`] = row.pe.ltp;
      }
    });
    return map;
  }, [chain]);

  const atmStrike = useMemo(() => {
    return Math.abs(currentPrice - 22850) < Math.abs(currentPrice - 22900) ? 22850 : 22900;
  }, [currentPrice]);

  const itmC = 22850;
  const otmC = 22900;
  const itmP = 22900;
  const otmP = 22850;

  // Initialize legs on strategy selection
  const selectStrategy = useCallback((strat: StrategyDefinition) => {
    setSelectedStrategyId(strat.id);
    const legs = strat.buildLegs(atmStrike, itmC, otmC, itmP, otmP, optionPrices);
    setConfiguredLegs(legs);
  }, [atmStrike, itmC, otmC, itmP, otmP, optionPrices]);

  // Initial load
  React.useEffect(() => {
    if (configuredLegs.length === 0) {
      const defaultStrat = READY_MADE_STRATEGIES.find(s => s.id === selectedStrategyId) || READY_MADE_STRATEGIES[3];
      const legs = defaultStrat.buildLegs(atmStrike, itmC, otmC, itmP, otmP, optionPrices);
      setConfiguredLegs(legs);
    }
  }, [atmStrike, itmC, otmC, itmP, otmP, optionPrices, configuredLegs.length, selectedStrategyId]);

  // Selected strategy metadata
  const currentStrategyDef = useMemo(() => {
    return READY_MADE_STRATEGIES.find(s => s.id === selectedStrategyId) || READY_MADE_STRATEGIES[0];
  }, [selectedStrategyId]);

  // Payoff calculations
  const payoffData = useMemo(() => {
    if (configuredLegs.length === 0) return null;
    return computePayoffPoints(configuredLegs, currentPrice || 22888.95);
  }, [configuredLegs, currentPrice]);

  // Filtered strategies by category
  const visibleStrategies = useMemo(() => {
    return READY_MADE_STRATEGIES.filter(s => s.category === activeCategory);
  }, [activeCategory]);

  // Active combo strategy positions from placed orders
  const comboPositions = useMemo(() => {
    const openOrders = orders.filter(o => o.status === 'FILLED');
    const groups: Record<string, { id: string; name: string; orders: Order[]; totalPnl: number }> = {};

    openOrders.forEach(o => {
      const stratKey = o.strategyId || 'standalone';
      if (!groups[stratKey]) {
        groups[stratKey] = {
          id: stratKey,
          name: o.strategyName || (o.symbol || 'Option Position'),
          orders: [],
          totalPnl: 0,
        };
      }
      groups[stratKey].orders.push(o);
      groups[stratKey].totalPnl += (o.pnl || 0);
    });

    return Object.values(groups);
  }, [orders]);

  // One-click combo order execution
  const handleExecuteAllComboOrders = () => {
    if (configuredLegs.length === 0) return;
    const strategyId = `strat_${Date.now()}_${selectedStrategyId}`;
    const orderTime = currentCandle?.time || new Date().toISOString();

    const newOrders: Order[] = configuredLegs.map((leg, idx) => {
      const symbol = `NIFTY 27OCT ${leg.strike} ${leg.optionType}`;
      return {
        id: `ord_${Date.now()}_${idx}_${leg.strike}_${leg.optionType}`,
        side: leg.side,
        price: leg.price,
        qty: leg.qty,
        time: orderTime,
        status: 'FILLED' as const,
        symbol,
        strike: leg.strike,
        optionType: leg.optionType,
        strategyId,
        strategyName: currentStrategyDef.name,
        pnl: 0,
        pnlPoints: 0,
      };
    });

    if (onAddOrders) {
      onAddOrders(newOrders);
    } else if (onAddOrder) {
      newOrders.forEach(o => onAddOrder(o));
    }
  };

  // Close all legs of a combo strategy
  const handleCloseEntireCombo = (comboId: string) => {
    if (!onCloseOrder) return;
    const combo = comboPositions.find(c => c.id === comboId);
    if (combo) {
      combo.orders.forEach(o => onCloseOrder(o.id));
    }
  };

  // Load an active combo strategy into the Payoff Chart
  const handleTrackComboPayoff = (comboId: string) => {
    const combo = comboPositions.find(c => c.id === comboId);
    if (!combo) return;
    setActiveComboTrackerId(comboId);
    const legs: StrategyLeg[] = combo.orders.map(o => ({
      id: o.id,
      side: o.side,
      strike: o.strike || 22900,
      optionType: o.optionType || 'CE',
      qty: o.qty,
      price: o.price,
    }));
    setConfiguredLegs(legs);
  };

  // Leg manipulation
  const handleToggleLegSide = (idx: number) => {
    setConfiguredLegs(prev => prev.map((l, i) => i === idx ? { ...l, side: l.side === 'BUY' ? 'SELL' : 'BUY' } : l));
  };

  const handleUpdateLegQty = (idx: number, delta: number) => {
    setConfiguredLegs(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const newQty = Math.max(1, Math.min(20, l.qty + delta));
      return { ...l, qty: newQty };
    }));
  };

  const handleDeleteLeg = (idx: number) => {
    setConfiguredLegs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddCustomLeg = () => {
    const newLeg: StrategyLeg = {
      id: `custom_${Date.now()}`,
      side: 'BUY',
      strike: 22900,
      optionType: 'CE',
      qty: 1,
      price: optionPrices['22900_CE'] || 169.85,
    };
    setConfiguredLegs(prev => [...prev, newLeg]);
  };

  // Performance calculations
  const closedOrders = orders.filter(o => o.status === 'CLOSED');
  const realizedPnl = closedOrders.reduce((s, o) => s + (o.pnl || 0), 0);
  const openPnl = orders.filter(o => o.status === 'FILLED').reduce((s, o) => s + (o.pnl || 0), 0);
  const totalPnl = realizedPnl + openPnl;

  return (
    <div className={`panel strategy-builder-panel ${isExpanded ? 'panel-expanded' : ''}`}>
      {/* Top Header Tabs */}
      <div className="panel-header strat-top-header">
        <div className="strat-header-left">
          <div className="strat-nav-tabs">
            <button
              className={`strat-tab-btn ${activeMainTab === 'payoff' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('payoff')}
            >
              Payoff
            </button>
            <button
              className={`strat-tab-btn ${activeMainTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('performance')}
            >
              Performance
            </button>
          </div>
        </div>

        <div className="strat-header-right">
          {onToggleExpand && (
            <button
              className="strat-expand-btn"
              onClick={onToggleExpand}
              title={isExpanded ? 'Contract Panel' : 'Expand Panel for wide view'}
            >
              {isExpanded ? '🗗 Contract' : '🗖 Expand'}
            </button>
          )}
        </div>
      </div>

      {activeMainTab === 'payoff' ? (
        <div className="payoff-main-scroll">
          {/* Section: Ready-Made Strategies */}
          <div className="ready-made-section">
            <div className="section-title-bar">
              <span className="section-title">Ready-Made Strategies</span>
            </div>

            {/* Category Filter Pills: Bullish, Bearish, Neutral, Other */}
            <div className="strat-category-pills">
              {(['Bullish', 'Bearish', 'Neutral', 'Other'] as const).map(cat => (
                <button
                  key={cat}
                  className={`cat-pill-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 4-Column Strategy Cards Grid */}
            <div className="strat-cards-grid">
              {visibleStrategies.map(strat => {
                const isSelected = selectedStrategyId === strat.id && !activeComboTrackerId;
                return (
                  <div
                    key={strat.id}
                    className={`strat-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setActiveComboTrackerId(null);
                      selectStrategy(strat);
                    }}
                    title={strat.description}
                  >
                    <div className="strat-card-svg-wrap">
                      <MiniPayoffSvg type={strat.id} />
                    </div>
                    <span className="strat-card-name">{strat.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy Legs Configuration & Analytics */}
          <div className="strat-config-card">
            <div className="strat-config-header">
              <div className="config-title-group">
                <span className="config-badge">COMBO BUILDER</span>
                <span className="config-name">
                  {activeComboTrackerId ? 'Live Combo Position' : currentStrategyDef.name}
                </span>
                <span className="config-leg-count">({configuredLegs.length} Legs)</span>
              </div>
              <button className="add-leg-btn" onClick={handleAddCustomLeg}>
                + Add Leg
              </button>
            </div>

            {/* Legs Table */}
            <div className="strat-legs-table-wrap">
              <table className="strat-legs-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Strike</th>
                    <th>Type</th>
                    <th>Lots</th>
                    <th>LTP (₹)</th>
                    <th>✕</th>
                  </tr>
                </thead>
                <tbody>
                  {configuredLegs.map((leg, idx) => (
                    <tr key={idx} className="strat-leg-row">
                      <td>
                        <button
                          className={`leg-side-pill ${leg.side.toLowerCase()}`}
                          onClick={() => handleToggleLegSide(idx)}
                          title="Toggle BUY / SELL"
                        >
                          {leg.side}
                        </button>
                      </td>
                      <td>
                        <select
                          className="leg-strike-select"
                          value={leg.strike}
                          onChange={e => {
                            const newStrike = parseInt(e.target.value, 10);
                            const key = `${newStrike}_${leg.optionType}`;
                            setConfiguredLegs(prev => prev.map((l, i) => i === idx ? {
                              ...l,
                              strike: newStrike,
                              price: optionPrices[key] || l.price,
                            } : l));
                          }}
                        >
                          <option value={22850}>22850</option>
                          <option value={22900}>22900</option>
                        </select>
                      </td>
                      <td>
                        <span className={`leg-type-badge ${leg.optionType.toLowerCase()}`}>
                          {leg.optionType}
                        </span>
                      </td>
                      <td>
                        <div className="leg-qty-stepper">
                          <button onClick={() => handleUpdateLegQty(idx, -1)}>-</button>
                          <span>{leg.qty}</span>
                          <button onClick={() => handleUpdateLegQty(idx, 1)}>+</button>
                        </div>
                      </td>
                      <td className="leg-price-val">
                        ₹{leg.price.toFixed(2)}
                      </td>
                      <td>
                        <button
                          className="leg-del-btn"
                          onClick={() => handleDeleteLeg(idx)}
                          title="Remove this leg"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Strategy Analytics Bar */}
            {payoffData && (
              <div className="strat-metrics-row">
                <div className="strat-metric-box">
                  <span className="sm-label">Max Profit</span>
                  <span className={`sm-val ${payoffData.maxProfit > 0 ? 'bull' : ''}`}>
                    {payoffData.maxProfit >= 100000 ? 'Unlimited' : `₹${payoffData.maxProfit.toLocaleString()}`}
                  </span>
                </div>
                <div className="strat-metric-box">
                  <span className="sm-label">Max Loss</span>
                  <span className={`sm-val ${payoffData.maxLoss < -100000 ? 'bear' : 'bear'}`}>
                    {payoffData.maxLoss <= -100000 ? 'Unlimited' : `₹${Math.abs(payoffData.maxLoss).toLocaleString()}`}
                  </span>
                </div>
                <div className="strat-metric-box">
                  <span className="sm-label">Breakevens</span>
                  <span className="sm-val">
                    {payoffData.breakevens.length > 0 ? payoffData.breakevens.join(', ') : 'None'}
                  </span>
                </div>
                <div className="strat-metric-box">
                  <span className="sm-label">Net Premium</span>
                  <span className={`sm-val ${payoffData.netPremiumRupees >= 0 ? 'bull' : 'bear'}`}>
                    {payoffData.netPremiumRupees >= 0 ? 'Credit' : 'Debit'}{' '}
                    ₹{Math.abs(payoffData.netPremiumRupees).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Payoff Chart */}
            {payoffData && payoffData.points.length > 0 && (
              <div className="payoff-chart-container">
                <div className="payoff-chart-header">
                  <span className="pch-title">Interactive Payoff Chart</span>
                  <span className="pch-spot">
                    📍 Current Spot: <strong>₹{currentPrice.toFixed(1)}</strong>
                  </span>
                </div>
                <div className="payoff-svg-wrapper">
                  <InteractivePayoffSvg
                    data={payoffData}
                    currentSpot={currentPrice}
                  />
                </div>
              </div>
            )}

            {/* Single-Click Place All Orders Button */}
            <div className="execute-combo-bar">
              <button
                className="execute-combo-btn"
                onClick={handleExecuteAllComboOrders}
                disabled={configuredLegs.length === 0}
              >
                <span>🚀</span>
                <span>Place All Orders (Execute Combo Strategy)</span>
              </button>
            </div>
          </div>

          {/* Active Combo Positions & Live Payoff Tracker */}
          {comboPositions.length > 0 && (
            <div className="active-combos-section">
              <div className="section-title-bar">
                <span className="section-title">Active Strategy Positions ({comboPositions.length})</span>
                <span className="section-sub">Live Payoff Tracker</span>
              </div>

              <div className="combos-list">
                {comboPositions.map(combo => (
                  <div
                    key={combo.id}
                    className={`combo-card ${activeComboTrackerId === combo.id ? 'tracking' : ''}`}
                  >
                    <div className="combo-card-header">
                      <div className="combo-meta">
                        <span className="combo-name">{combo.name}</span>
                        <span className="combo-leg-tag">{combo.orders.length} Legs</span>
                      </div>
                      <div className="combo-pnl-group">
                        <span className={`combo-pnl ${combo.totalPnl >= 0 ? 'bull' : 'bear'}`}>
                          {combo.totalPnl >= 0 ? '+' : ''}₹{Math.round(combo.totalPnl).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="combo-legs-preview">
                      {combo.orders.map((o, idx) => (
                        <span key={idx} className="combo-leg-chip">
                          <strong className={o.side === 'BUY' ? 'bull' : 'bear'}>{o.side}</strong>{' '}
                          {o.qty}L {o.symbol} @ ₹{o.price.toFixed(1)}
                        </span>
                      ))}
                    </div>

                    <div className="combo-actions">
                      <button
                        className="combo-track-btn"
                        onClick={() => handleTrackComboPayoff(combo.id)}
                      >
                        📈 Track on Payoff
                      </button>
                      <button
                        className="combo-close-btn"
                        onClick={() => handleCloseEntireCombo(combo.id)}
                      >
                        ✕ Close Strategy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Performance Tab */
        <div className="performance-tab-wrap">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Net Total P&L</div>
              <div className={`stat-value ${totalPnl >= 0 ? 'accent-green' : 'accent-red'}`}>
                {totalPnl >= 0 ? '+' : ''}₹{Math.round(totalPnl).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Realized P&L</div>
              <div className={`stat-value ${realizedPnl >= 0 ? 'accent-green' : 'accent-red'}`}>
                {realizedPnl >= 0 ? '+' : ''}₹{Math.round(realizedPnl).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open P&L</div>
              <div className={`stat-value ${openPnl >= 0 ? 'accent-green' : 'accent-orange'}`}>
                {openPnl >= 0 ? '+' : ''}₹{Math.round(openPnl).toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Trades</div>
              <div className="stat-value">{orders.length}</div>
            </div>
          </div>

          <div className="trade-log">
            <div className="orders-header">Closed Trades ({closedOrders.length})</div>
            {closedOrders.length === 0 ? (
              <div className="empty-msg">No closed trades yet. Enter positions and close them to view realized stats.</div>
            ) : (
              closedOrders.map((t, i) => (
                <div key={i} className={`trade-row ${(t.pnl || 0) >= 0 ? 'win' : 'loss'}`}>
                  <div className="trade-meta">
                    <span className="trade-num">#{i + 1}</span>
                    <span>{t.side} {t.qty}L {t.symbol} @ ₹{t.price}</span>
                  </div>
                  <div className={`trade-pnl ${(t.pnl || 0) >= 0 ? 'profit' : 'loss'}`}>
                    {(t.pnl || 0) >= 0 ? '+' : ''}₹{Math.round(t.pnl || 0).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Interactive SVG Payoff Chart Component
const InteractivePayoffSvg: React.FC<{
  data: {
    points: { spot: number; pnl: number }[];
    maxProfit: number;
    maxLoss: number;
    breakevens: number[];
    minSpot: number;
    maxSpot: number;
  };
  currentSpot: number;
}> = ({ data, currentSpot }) => {
  const width = 500;
  const height = 180;
  const padL = 45;
  const padR = 25;
  const padT = 20;
  const padB = 25;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  // Y Scale: symmetric around 0 or capped
  const extremePnl = Math.max(Math.abs(data.maxProfit), Math.abs(data.maxLoss), 1500);
  const yMax = Math.min(extremePnl, 25000);
  const yMin = -yMax;

  const scaleX = (spot: number) => {
    return padL + ((spot - data.minSpot) / (data.maxSpot - data.minSpot)) * chartW;
  };

  const scaleY = (pnl: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, pnl));
    return padT + (1 - (clamped - yMin) / (yMax - yMin)) * chartH;
  };

  const yZero = scaleY(0);

  // Build SVG path
  const pathD = data.points.map((p, i) => {
    const x = scaleX(p.spot);
    const y = scaleY(p.pnl);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  // Build green polygon (above zero)
  const greenD = `${pathD} L ${scaleX(data.maxSpot)} ${yZero} L ${scaleX(data.minSpot)} ${yZero} Z`;

  const spotX = scaleX(currentSpot);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="payoff-interactive-svg">
      <defs>
        <clipPath id="aboveZero">
          <rect x={padL} y={padT} width={chartW} height={Math.max(0, yZero - padT)} />
        </clipPath>
        <clipPath id="belowZero">
          <rect x={padL} y={yZero} width={chartW} height={Math.max(0, height - padB - yZero)} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      <line x1={padL} y1={padT} x2={width - padR} y2={padT} stroke="#1e293b" strokeWidth="1" />
      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="#1e293b" strokeWidth="1" />

      {/* Zero PnL Baseline */}
      <line
        x1={padL}
        y1={yZero}
        x2={width - padR}
        y2={yZero}
        stroke="#475569"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Green Profit Shading */}
      <path d={greenD} fill="rgba(34, 197, 94, 0.22)" clipPath="url(#aboveZero)" />

      {/* Red Loss Shading */}
      <path d={greenD} fill="rgba(239, 68, 68, 0.22)" clipPath="url(#belowZero)" />

      {/* Main Payoff Line */}
      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

      {/* Breakeven lines */}
      {data.breakevens.map((be, idx) => {
        const beX = scaleX(be);
        if (beX < padL || beX > width - padR) return null;
        return (
          <g key={idx}>
            <line
              x1={beX}
              y1={padT}
              x2={beX}
              y2={height - padB}
              stroke="#eab308"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text x={beX} y={height - 8} fill="#eab308" fontSize="9" textAnchor="middle" fontWeight="bold">
              {be}
            </text>
          </g>
        );
      })}

      {/* Current Spot Vertical Line */}
      {spotX >= padL && spotX <= width - padR && (
        <g>
          <line
            x1={spotX}
            y1={padT}
            x2={spotX}
            y2={height - padB}
            stroke="#f43f5e"
            strokeWidth="1.5"
          />
          <circle cx={spotX} cy={scaleY(0)} r="4" fill="#f43f5e" />
          <text x={spotX} y={padT - 5} fill="#f43f5e" fontSize="9.5" textAnchor="middle" fontWeight="bold">
            Spot ₹{Math.round(currentSpot)}
          </text>
        </g>
      )}

      {/* Y Axis Labels */}
      <text x={padL - 6} y={padT + 4} fill="#64748b" fontSize="8.5" textAnchor="end">
        +₹{Math.round(yMax)}
      </text>
      <text x={padL - 6} y={yZero + 3} fill="#94a3b8" fontSize="8.5" textAnchor="end">
        ₹0
      </text>
      <text x={padL - 6} y={height - padB} fill="#64748b" fontSize="8.5" textAnchor="end">
        -₹{Math.round(yMax)}
      </text>
    </svg>
  );
};

export default StrategyPanel;

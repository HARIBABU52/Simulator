// optionChainUtils.ts
// Black-Scholes Greeks, strike chain generation, and real options data integration

export interface OptionRowData {
  strike: number;
  isATM: boolean;
  isSpotAbove: boolean; // Spot >= Strike (for CE this is ITM, for PE this is OTM)

  // CE (Call)
  ce: {
    symbol: string;
    ltp: number;
    change: number;
    changePct: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
    oiChange: number;
    iv: number;
    delta: number;
    theta: number;
    gamma: number;
    vega: number;
    isRealData: boolean;
    isITM: boolean;
  };

  // PE (Put)
  pe: {
    symbol: string;
    ltp: number;
    change: number;
    changePct: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    oi: number;
    oiChange: number;
    iv: number;
    delta: number;
    theta: number;
    gamma: number;
    vega: number;
    isRealData: boolean;
    isITM: boolean;
  };
}

export interface OptionChainSummary {
  spotPrice: number;
  atmStrike: number;
  pcr: number;
  totalCeOi: number;
  totalPeOi: number;
  maxPain: number;
  expiryDateStr: string;
}

export type RealOptionRecord = {
  time: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
};

// Cumulative Normal Distribution approximation
export function cnd(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * erf);
}

// Black-Scholes formula
export function calculateBlackScholes(
  S: number, // Spot
  K: number, // Strike
  T: number, // Years to expiry
  r: number, // Risk-free rate (e.g. 0.065)
  v: number, // Volatility (e.g. 0.14)
  type: 'CE' | 'PE'
) {
  if (T <= 0.0001) {
    const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
    return {
      price: intrinsic,
      delta: type === 'CE' ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0),
      theta: 0,
      gamma: 0,
      vega: 0,
    };
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);
  const nd1 = cnd(d1);
  const nd2 = cnd(d2);
  const nPrimeD1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);

  let price = 0;
  let delta = 0;
  if (type === 'CE') {
    price = S * nd1 - K * Math.exp(-r * T) * nd2;
    delta = nd1;
  } else {
    price = K * Math.exp(-r * T) * (1 - nd2) - S * (1 - nd1);
    delta = nd1 - 1;
  }

  const gamma = nPrimeD1 / (S * v * Math.sqrt(T));
  const vega = (S * Math.sqrt(T) * nPrimeD1) / 100;
  const theta =
    (-(S * nPrimeD1 * v) / (2 * Math.sqrt(T)) -
      (type === 'CE' ? 1 : -1) * r * K * Math.exp(-r * T) * (type === 'CE' ? nd2 : 1 - nd2)) /
    365;

  return {
    price: Math.max(0.05, Math.round(price * 20) / 20),
    delta: Math.round(delta * 100) / 100,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

// In-memory cache for loaded real options JSON data
const realDataCache: Record<string, RealOptionRecord[]> = {};

export async function loadRealOptionData(
  type: 'CE' | 'PE',
  strike: number
): Promise<RealOptionRecord[]> {
  const key = `${strike}_${type}`;
  if (realDataCache[key]) return realDataCache[key];

  let filename = '';
  if (strike === 22850) {
    filename = type === 'CE'
      ? 'NIFTY 27 OCT 22850 CALL_1792511372212.json'
      : 'NIFTY 27 OCT 22850 PUT_1792511408144.json';
  } else if (strike === 22900) {
    filename = type === 'CE'
      ? 'NIFTY 27 OCT 22900 CALL_1792511515795.json'
      : 'NIFTY 27 OCT 22900 PUT_1792511451728.json';
  } else {
    return [];
  }

  const subfolder = type === 'CE' ? 'ce' : 'pe';
  const url = `/optionsData/27octExpire/${subfolder}/${encodeURIComponent(filename)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: RealOptionRecord[] = await res.json();
    realDataCache[key] = data;
    return data;
  } catch (err) {
    console.error(`Failed to load options data from ${url}:`, err);
    return [];
  }
}

// Find closest candle matching timestamp
export function findMatchingCandle(
  records: RealOptionRecord[],
  targetTime?: string
): { candle: RealOptionRecord | null; prevCandle: RealOptionRecord | null } {
  if (!records || records.length === 0) return { candle: null, prevCandle: null };
  if (!targetTime) {
    return {
      candle: records[records.length - 1],
      prevCandle: records[records.length - 2] || null,
    };
  }

  const targetMs = new Date(targetTime).getTime();

  // Binary search for closest timestamp <= targetMs
  let low = 0;
  let high = records.length - 1;
  let bestIdx = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midMs = new Date(records[mid].time).getTime();
    if (midMs <= targetMs) {
      bestIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestIdx === -1) {
    bestIdx = 0;
  }

  return {
    candle: records[bestIdx],
    prevCandle: bestIdx > 0 ? records[bestIdx - 1] : null,
  };
}

// Generate the complete Option Chain rows
export function buildOptionChainRows({
  spotPrice,
  targetTime,
  strikeRangeCount = 10,
  expiryDateStr = '2026-10-27T15:30:00.000Z',
}: {
  spotPrice: number;
  targetTime?: string;
  strikeRangeCount?: number; // +/- strikes around ATM
  expiryDateStr?: string;
}): { rows: OptionRowData[]; summary: OptionChainSummary } {
  const safeSpot = spotPrice > 0 ? spotPrice : 22880;
  const atmStrike = Math.round(safeSpot / 50) * 50;

  // Calculate time to expiry T in years (using deterministic fallback to prevent prerender error)
  const targetMs = targetTime ? new Date(targetTime).getTime() : 1792404540000; // 2026-10-19T10:09:00.000Z
  const expiryMs = new Date(expiryDateStr).getTime();
  const diffMs = Math.max(1000 * 60 * 60, expiryMs - targetMs);
  const T = diffMs / (1000 * 60 * 60 * 24 * 365);
  const r = 0.065; // RBI repo rate standard

  const strikes: number[] = [];
  for (let i = -strikeRangeCount; i <= strikeRangeCount; i++) {
    strikes.push(atmStrike + i * 50);
  }

  let totalCeOi = 0;
  let totalPeOi = 0;

  const rows: OptionRowData[] = strikes.map(strike => {
    const isATM = strike === atmStrike;
    const isSpotAbove = safeSpot >= strike;
    const ceITM = strike < safeSpot;
    const peITM = strike > safeSpot;

    // Baseline implied volatilities: Indian skew typically higher for OTM puts
    const moneyness = strike / safeSpot;
    const baseIv = 0.145 + Math.max(0, 1 - moneyness) * 0.06 + Math.max(0, moneyness - 1) * 0.04;
    const ivPct = Math.round(baseIv * 1000) / 10;

    // Check if real data is available for this strike
    const realCeRecords = realDataCache[`${strike}_CE`] || [];
    const realPeRecords = realDataCache[`${strike}_PE`] || [];

    const realCe = findMatchingCandle(realCeRecords, targetTime);
    const realPe = findMatchingCandle(realPeRecords, targetTime);

    // CALL (CE) Data
    let ceLtp: number;
    let ceChange: number;
    let ceChangePct: number;
    let ceVol: number;
    let ceOi: number;
    let ceOiChg: number;
    let ceOpen = 0;
    let ceHigh = 0;
    let ceLow = 0;
    let ceClose = 0;
    let isRealCe = false;

    const bsCe = calculateBlackScholes(safeSpot, strike, T, r, baseIv, 'CE');

    if (realCe.candle) {
      isRealCe = true;
      ceClose = parseFloat(String(realCe.candle.close));
      ceOpen = parseFloat(String(realCe.candle.open));
      ceHigh = parseFloat(String(realCe.candle.high));
      ceLow = parseFloat(String(realCe.candle.low));
      ceVol = parseFloat(String(realCe.candle.volume));
      ceLtp = ceClose;

      const prevClose = realCe.prevCandle ? parseFloat(String(realCe.prevCandle.close)) : ceOpen;
      ceChange = Math.round((ceLtp - prevClose) * 20) / 20;
      ceChangePct = prevClose > 0 ? Math.round((ceChange / prevClose) * 10000) / 100 : 0;
      ceOi = Math.round(50000 + (ceVol * 3.5));
      ceOiChg = Math.round((ceChange >= 0 ? 1 : -1) * (ceVol * 0.4));
    } else {
      ceLtp = bsCe.price;
      ceOpen = ceLtp;
      ceHigh = ceLtp * 1.02;
      ceLow = ceLtp * 0.98;
      ceClose = ceLtp;
      // Synthetic realistic OI and volume for other strikes
      const distFromAtm = Math.abs(strike - atmStrike) / 50;
      ceVol = Math.max(120, Math.round(45000 / (1 + distFromAtm * 0.9)));
      ceOi = Math.max(10000, Math.round(180000 / (1 + distFromAtm * 0.6)));
      ceChange = Math.round((bsCe.delta * (safeSpot - atmStrike) * 0.1) * 20) / 20;
      ceChangePct = ceLtp > 0 ? Math.round((ceChange / ceLtp) * 10000) / 100 : 0;
      ceOiChg = Math.round((Math.sin(strike) * 5000));
    }

    // PUT (PE) Data
    let peLtp: number;
    let peChange: number;
    let peChangePct: number;
    let peVol: number;
    let peOi: number;
    let peOiChg: number;
    let peOpen = 0;
    let peHigh = 0;
    let peLow = 0;
    let peClose = 0;
    let isRealPe = false;

    const bsPe = calculateBlackScholes(safeSpot, strike, T, r, baseIv, 'PE');

    if (realPe.candle) {
      isRealPe = true;
      peClose = parseFloat(String(realPe.candle.close));
      peOpen = parseFloat(String(realPe.candle.open));
      peHigh = parseFloat(String(realPe.candle.high));
      peLow = parseFloat(String(realPe.candle.low));
      peVol = parseFloat(String(realPe.candle.volume));
      peLtp = peClose;

      const prevClose = realPe.prevCandle ? parseFloat(String(realPe.prevCandle.close)) : peOpen;
      peChange = Math.round((peLtp - prevClose) * 20) / 20;
      peChangePct = prevClose > 0 ? Math.round((peChange / prevClose) * 10000) / 100 : 0;
      peOi = Math.round(52000 + (peVol * 3.2));
      peOiChg = Math.round((peChange >= 0 ? 1 : -1) * (peVol * 0.35));
    } else {
      peLtp = bsPe.price;
      peOpen = peLtp;
      peHigh = peLtp * 1.02;
      peLow = peLtp * 0.98;
      peClose = peLtp;
      const distFromAtm = Math.abs(strike - atmStrike) / 50;
      peVol = Math.max(150, Math.round(48000 / (1 + distFromAtm * 0.85)));
      peOi = Math.max(12000, Math.round(195000 / (1 + distFromAtm * 0.55)));
      peChange = Math.round((bsPe.delta * (safeSpot - atmStrike) * 0.1) * 20) / 20;
      peChangePct = peLtp > 0 ? Math.round((peChange / peLtp) * 10000) / 100 : 0;
      peOiChg = Math.round((Math.cos(strike) * 4500));
    }

    totalCeOi += ceOi;
    totalPeOi += peOi;

    return {
      strike,
      isATM,
      isSpotAbove,
      ce: {
        symbol: `NIFTY 27OCT ${strike} CE`,
        ltp: ceLtp,
        change: ceChange,
        changePct: ceChangePct,
        open: ceOpen,
        high: ceHigh,
        low: ceLow,
        close: ceClose,
        volume: ceVol,
        oi: ceOi,
        oiChange: ceOiChg,
        iv: ivPct,
        delta: bsCe.delta,
        theta: bsCe.theta,
        gamma: bsCe.gamma,
        vega: bsCe.vega,
        isRealData: isRealCe,
        isITM: ceITM,
      },
      pe: {
        symbol: `NIFTY 27OCT ${strike} PE`,
        ltp: peLtp,
        change: peChange,
        changePct: peChangePct,
        open: peOpen,
        high: peHigh,
        low: peLow,
        close: peClose,
        volume: peVol,
        oi: peOi,
        oiChange: peOiChg,
        iv: ivPct,
        delta: bsPe.delta,
        theta: bsPe.theta,
        gamma: bsPe.gamma,
        vega: bsPe.vega,
        isRealData: isRealPe,
        isITM: peITM,
      },
    };
  });

  const pcr = totalCeOi > 0 ? Math.round((totalPeOi / totalCeOi) * 100) / 100 : 1;

  // Max Pain calculation: strike where option buyers' total payout is minimum
  let minLoss = Infinity;
  let maxPain = atmStrike;
  for (const testStrike of strikes) {
    let totalLoss = 0;
    for (const r of rows) {
      const callLoss = Math.max(0, testStrike - r.strike) * r.ce.oi;
      const putLoss = Math.max(0, r.strike - testStrike) * r.pe.oi;
      totalLoss += callLoss + putLoss;
    }
    if (totalLoss < minLoss) {
      minLoss = totalLoss;
      maxPain = testStrike;
    }
  }

  return {
    rows,
    summary: {
      spotPrice: safeSpot,
      atmStrike,
      pcr,
      totalCeOi,
      totalPeOi,
      maxPain,
      expiryDateStr: '27 OCT 2026',
    },
  };
}

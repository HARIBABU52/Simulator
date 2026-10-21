"use client";
import React, { useState, useRef } from 'react';
import { Order, OrderSide, DataPoint, Timeframe } from './types';
import { useOptionChainData } from './DataContext';

export interface MinuteRecord {
  time: string;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct: number;
}

export interface OptionChainItem {
  strike: number;
  isATM: boolean;
  ce: {
    ltp: number;
    dayChange: number;
    dayChangePct: number;
    min1Change: number;
    min1ChangePct: number;
    tfChangePct?: number;
    dayOpen: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    tfVolume: number;
    dayVolume: number;
    isITM: boolean;
    recent1MinHistory: MinuteRecord[];
  };
  pe: {
    ltp: number;
    dayChange: number;
    dayChangePct: number;
    min1Change: number;
    min1ChangePct: number;
    tfChangePct?: number;
    dayOpen: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    tfVolume: number;
    dayVolume: number;
    isITM: boolean;
    recent1MinHistory: MinuteRecord[];
  };
}

export interface SimulatedEnvInfo {
  activeDate: string;
  activeTime: string;
  spotPrice: number;
  atmStrike: number;
  timeframe?: string;
  timeframeLabel?: string;
  pcrDayVolume: number;
  order: string;
}

interface OptionChainProps {
  currentPrice: number;
  currentCandle?: DataPoint | null;
  timeframe?: Timeframe;
  onClose?: () => void;
  onAddOrder?: (order: Order) => void;
  isReplayActive?: boolean;
}

export const OptionChain: React.FC<OptionChainProps> = ({
  currentPrice,
  currentCandle,
  timeframe = '1min',
  onClose,
  onAddOrder,
  isReplayActive = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'ce' | 'pe'>('all');
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [showMinuteHistory, setShowMinuteHistory] = useState<boolean>(false);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('27octExpire');

  // Consume pre-calculated Option Chain state directly from TanStack Query
  const { chain, simulatedEnv, isLoading, availableExpiries } = useOptionChainData({
    timeframe,
    currentCandle,
    isReplayActive,
    currentPrice,
    expiry: selectedExpiry,
  });

  const defaultEnvInfo: SimulatedEnvInfo = {
    activeDate: '2026-10-19',
    activeTime: '2026-10-19T10:09:00.000Z',
    spotPrice: currentPrice || 22888.95,
    atmStrike: 22900,
    timeframe: timeframe || '1min',
    timeframeLabel:
      timeframe === '5min'
        ? '5m'
        : timeframe === '15min'
        ? '15m'
        : timeframe === '1h'
        ? '1H'
        : timeframe === '1d'
        ? '1D'
        : timeframe === '1w'
        ? '1W'
        : '1m',
    pcrDayVolume: 1.52,
    order: 'descending',
  };

  const envInfo = simulatedEnv || defaultEnvInfo;

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Derive active timeframe label (up to weekly, no monthly)
  const currentTfLabel =
    envInfo.timeframeLabel ||
    (timeframe === '5min'
      ? '5m'
      : timeframe === '15min'
      ? '15m'
      : timeframe === '1h'
      ? '1H'
      : timeframe === '1d'
      ? '1D'
      : timeframe === '1w'
      ? '1W'
      : '1m');

  const handleQuickTrade = (
    side: OrderSide,
    type: 'CE' | 'PE',
    strike: number,
    price: number
  ) => {
    if (!onAddOrder) return;
    const orderTime = currentCandle?.time || new Date().toISOString();
    const symbol = `NIFTY 27OCT ${strike} ${type}`;
    const newOrder: Order = {
      id: `opt_${Date.now()}_${strike}_${type}`,
      side,
      price,
      qty: 1, // 1 lot = 65 qty
      time: orderTime,
      status: 'FILLED',
      symbol,
      strike,
      optionType: type,
      pnl: 0,
      pnlPoints: 0,
    };
    onAddOrder(newOrder);
  };

  const selectedRow = chain.find(c => c.strike === selectedStrike) || chain[0];

  return (
    <div className={`option-chain-container ${isExpanded ? 'expanded' : ''}`}>
      {/* Header Bar */}
      <div className="oc-header">
        <div className="oc-header-left">
          <div className="oc-title-group">
            <span className="oc-badge">SIMULATOR CHAIN</span>
            <select
              className="oc-expiry-dropdown"
              value={selectedExpiry}
              onChange={e => setSelectedExpiry(e.target.value)}
              title="Select Options Expiry"
            >
              {availableExpiries && availableExpiries.length > 0 ? (
                availableExpiries.map(exp => (
                  <option key={exp} value={exp}>
                    {exp.replace(/([0-9]+)([a-zA-Z]+)Expire/i, '$1 $2').toUpperCase()} EXPIRY
                  </option>
                ))
              ) : (
                <option value="27octExpire">27 OCT EXPIRY</option>
              )}
            </select>
          </div>

          <div className="oc-expiry-select">
            <span className="oc-label">Sim Date:</span>
            <span className="oc-expiry-pill">
              {envInfo.activeDate ? `${envInfo.activeDate}` : 'Live'}
            </span>
            {envInfo.activeTime && (
              <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>
                {new Date(envInfo.activeTime).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </span>
            )}
          </div>

          {/* View Filter */}
          <div className="oc-tab-group">
            <button
              className={`oc-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Both (CE & PE)
            </button>
            <button
              className={`oc-tab-btn ${activeTab === 'ce' ? 'active' : ''}`}
              onClick={() => setActiveTab('ce')}
            >
              Calls (CE)
            </button>
            <button
              className={`oc-tab-btn ${activeTab === 'pe' ? 'active' : ''}`}
              onClick={() => setActiveTab('pe')}
            >
              Puts (PE)
            </button>
          </div>
        </div>

        {/* Spot & Summary */}
        <div className="oc-header-center">
          <div className="oc-spot-card">
            <span className="oc-spot-label">NIFTY SPOT</span>
            <span className="oc-spot-val">₹{envInfo.spotPrice.toFixed(2)}</span>
          </div>

          <div className="oc-metric-chip">
            <span className="oc-metric-title">ATM:</span>
            <span className="oc-metric-val highlight">{envInfo.atmStrike}</span>
          </div>

          <div className="oc-metric-chip">
            <span className="oc-metric-title">TF:</span>
            <span className="oc-metric-val tf-badge">{currentTfLabel}</span>
          </div>

          <div className="oc-metric-chip">
            <span className="oc-metric-title">PCR (Vol):</span>
            <span className={`oc-metric-val ${envInfo.pcrDayVolume >= 1 ? 'bull' : 'bear'}`}>
              {envInfo.pcrDayVolume}
            </span>
          </div>

          <div className="oc-feed-badge">
            <span className="oc-pulse-dot" />
            <span>Descending Order (Higher First)</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="oc-header-right">
          <button
            className={`oc-ctrl-btn ${showMinuteHistory ? 'active' : ''}`}
            onClick={() => setShowMinuteHistory(p => !p)}
            title="Toggle 1-Minute Day-Wise Candle History"
          >
            ⏱️ 1-Min History
          </button>

          <button
            className="oc-ctrl-btn"
            onClick={() => setIsExpanded(p => !p)}
            title={isExpanded ? 'Contract' : 'Expand Option Chain'}
          >
            {isExpanded ? '🗗 Contract' : '🗖 Expand'}
          </button>

          {onClose && (
            <button className="oc-close-btn" onClick={onClose} title="Hide Option Chain">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Indian Option Chain Table - Clean, Descending Strikes */}
      <div className="oc-table-wrapper" ref={tableContainerRef}>
        <table className="oc-table">
          <thead>
            {/* Super Header */}
            <tr className="oc-super-header">
              {(activeTab === 'all' || activeTab === 'ce') && (
                <th colSpan={6} className="super-th ce-side">
                  CALLS (CE) — In-the-Money below Spot (Yellow Shading)
                </th>
              )}
              <th className="super-th strike-side">STRIKE</th>
              {(activeTab === 'all' || activeTab === 'pe') && (
                <th colSpan={6} className="super-th pe-side">
                  PUTS (PE) — In-the-Money above Spot (Yellow Shading)
                </th>
              )}
            </tr>

            {/* Sub-header with respective timeframe & day volume, plus 1-min & day-wise % change */}
            <tr className="oc-sub-header">
              {/* CE */}
              {(activeTab === 'all' || activeTab === 'ce') && (
                <>
                  <th className="ce-col" title="Cumulative Day Volume">Day Vol</th>
                  <th className="ce-col tf-vol" title={`Volume in active ${currentTfLabel} timeframe`}>
                    {currentTfLabel} Vol
                  </th>
                  <th className="ce-col" title="1-Minute Candle Change %">1m % Chg</th>
                  <th className="ce-col" title="Day-Wise Change % from Day Open">Day % Chg</th>
                  <th className="ce-col ltp" title="Last Traded Price">LTP (₹)</th>
                  <th className="ce-col act">Trade</th>
                </>
              )}

              {/* Center Strike */}
              <th className="strike-col">STRIKE</th>

              {/* PE */}
              {(activeTab === 'all' || activeTab === 'pe') && (
                <>
                  <th className="pe-col act">Trade</th>
                  <th className="pe-col ltp" title="Last Traded Price">LTP (₹)</th>
                  <th className="pe-col" title="Day-Wise Change % from Day Open">Day % Chg</th>
                  <th className="pe-col" title="1-Minute Candle Change %">1m % Chg</th>
                  <th className="pe-col tf-vol" title={`Volume in active ${currentTfLabel} timeframe`}>
                    {currentTfLabel} Vol
                  </th>
                  <th className="pe-col" title="Cumulative Day Volume">Day Vol</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {chain.map((row, idx) => {
              const nextRow = chain[idx + 1];
              // In descending order, spot sits between row.strike (higher) and nextRow.strike (lower)
              const isSpotBetween =
                nextRow &&
                envInfo.spotPrice <= row.strike &&
                envInfo.spotPrice > nextRow.strike;

              const isSelected = selectedStrike === row.strike;

              return (
                <React.Fragment key={row.strike}>
                  <tr
                    className={`oc-data-row ${row.isATM ? 'atm' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedStrike(row.strike)}
                  >
                    {/* ===== CE (LEFT) ===== */}
                    {(activeTab === 'all' || activeTab === 'ce') && (
                      <>
                        {/* Day Volume */}
                        <td className={`ce-cell ${row.ce.isITM ? 'itm' : 'otm'}`}>
                          {row.ce.dayVolume.toLocaleString()}
                        </td>

                        {/* Respective Timeframe Volume */}
                        <td className={`ce-cell tf-vol-cell ${row.ce.isITM ? 'itm' : 'otm'}`}>
                          <span className="vol-tf-pill">{row.ce.tfVolume.toLocaleString()}</span>
                        </td>

                        {/* 1-min % change */}
                        <td
                          className={`ce-cell ${row.ce.isITM ? 'itm' : 'otm'} ${
                            row.ce.min1ChangePct >= 0 ? 'bull' : 'bear'
                          }`}
                        >
                          <span className={`pill-pct ${row.ce.min1ChangePct >= 0 ? 'pos' : 'neg'}`}>
                            {row.ce.min1ChangePct >= 0 ? '+' : ''}
                            {row.ce.min1ChangePct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Day-wise % change */}
                        <td
                          className={`ce-cell ${row.ce.isITM ? 'itm' : 'otm'} ${
                            row.ce.dayChangePct >= 0 ? 'bull' : 'bear'
                          }`}
                        >
                          <strong>
                            {row.ce.dayChangePct >= 0 ? '+' : ''}
                            {row.ce.dayChangePct.toFixed(2)}%
                          </strong>
                        </td>

                        {/* LTP */}
                        <td className={`ce-cell ltp ${row.ce.isITM ? 'itm' : 'otm'}`}>
                          <div className="ltp-inner">
                            <span className="price-bold">₹{row.ce.ltp.toFixed(2)}</span>
                          </div>
                        </td>

                        {/* Trade buttons */}
                        <td className={`ce-cell act ${row.ce.isITM ? 'itm' : 'otm'}`}>
                          <div className="trade-btn-group">
                            <button
                              className="oc-trade-btn buy"
                              onClick={e => {
                                e.stopPropagation();
                                handleQuickTrade('BUY', 'CE', row.strike, row.ce.ltp);
                              }}
                              title={`Buy ${row.strike} CE @ ₹${row.ce.ltp}`}
                            >
                              B
                            </button>
                            <button
                              className="oc-trade-btn sell"
                              onClick={e => {
                                e.stopPropagation();
                                handleQuickTrade('SELL', 'CE', row.strike, row.ce.ltp);
                              }}
                              title={`Sell ${row.strike} CE @ ₹${row.ce.ltp}`}
                            >
                              S
                            </button>
                          </div>
                        </td>
                      </>
                    )}

                    {/* ===== CENTER STRIKE ===== */}
                    <td className={`strike-cell ${row.isATM ? 'atm' : ''}`}>
                      <div className="strike-inner">
                        <span className="strike-num">{row.strike}</span>
                        {row.isATM && <span className="atm-badge">ATM</span>}
                      </div>
                    </td>

                    {/* ===== PE (RIGHT) ===== */}
                    {(activeTab === 'all' || activeTab === 'pe') && (
                      <>
                        {/* Trade buttons */}
                        <td className={`pe-cell act ${row.pe.isITM ? 'itm' : 'otm'}`}>
                          <div className="trade-btn-group">
                            <button
                              className="oc-trade-btn buy"
                              onClick={e => {
                                e.stopPropagation();
                                handleQuickTrade('BUY', 'PE', row.strike, row.pe.ltp);
                              }}
                              title={`Buy ${row.strike} PE @ ₹${row.pe.ltp}`}
                            >
                              B
                            </button>
                            <button
                              className="oc-trade-btn sell"
                              onClick={e => {
                                e.stopPropagation();
                                handleQuickTrade('SELL', 'PE', row.strike, row.pe.ltp);
                              }}
                              title={`Sell ${row.strike} PE @ ₹${row.pe.ltp}`}
                            >
                              S
                            </button>
                          </div>
                        </td>

                        {/* LTP */}
                        <td className={`pe-cell ltp ${row.pe.isITM ? 'itm' : 'otm'}`}>
                          <div className="ltp-inner">
                            <span className="price-bold">₹{row.pe.ltp.toFixed(2)}</span>
                          </div>
                        </td>

                        {/* Day-wise % change */}
                        <td
                          className={`pe-cell ${row.pe.isITM ? 'itm' : 'otm'} ${
                            row.pe.dayChangePct >= 0 ? 'bull' : 'bear'
                          }`}
                        >
                          <strong>
                            {row.pe.dayChangePct >= 0 ? '+' : ''}
                            {row.pe.dayChangePct.toFixed(2)}%
                          </strong>
                        </td>

                        {/* 1-min % change */}
                        <td
                          className={`pe-cell ${row.pe.isITM ? 'itm' : 'otm'} ${
                            row.pe.min1ChangePct >= 0 ? 'bull' : 'bear'
                          }`}
                        >
                          <span className={`pill-pct ${row.pe.min1ChangePct >= 0 ? 'pos' : 'neg'}`}>
                            {row.pe.min1ChangePct >= 0 ? '+' : ''}
                            {row.pe.min1ChangePct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Respective Timeframe Volume */}
                        <td className={`pe-cell tf-vol-cell ${row.pe.isITM ? 'itm' : 'otm'}`}>
                          <span className="vol-tf-pill">{row.pe.tfVolume.toLocaleString()}</span>
                        </td>

                        {/* Day Volume */}
                        <td className={`pe-cell ${row.pe.isITM ? 'itm' : 'otm'}`}>
                          {row.pe.dayVolume.toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>

                  {/* Spot Price Line between strikes in descending order */}
                  {isSpotBetween && (
                    <tr className="oc-spot-divider-row">
                      <td colSpan={activeTab === 'all' ? 13 : 7} className="spot-divider-cell">
                        <div className="spot-divider-bar">
                          <span className="spot-marker">
                            📍 CURRENT NIFTY SPOT: <strong>₹{envInfo.spotPrice.toFixed(2)}</strong>
                          </span>
                          <span className="spot-divider-line" />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 1-Minute Day-Wise Candle History in DESCENDING Order (Latest minute first) */}
      {showMinuteHistory && selectedRow && (
        <div className="oc-minute-history-card">
          <div className="mh-header">
            <span className="mh-title">
              ⏱️ 1-Minute Day-Wise Breakdown — Strike {selectedRow.strike} (Descending: Latest First)
            </span>
            <button className="mh-close-btn" onClick={() => setShowMinuteHistory(false)}>
              ✕
            </button>
          </div>

          <div className="mh-grid">
            {/* CE 1-Min History */}
            <div className="mh-side-col">
              <div className="mh-side-hdr ce">CALL (CE) 1-Min Bars</div>
              <div className="mh-table-scroll">
                <table className="mh-subtable">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>LTP</th>
                      <th>1m % Chg</th>
                      <th>Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.ce.recent1MinHistory.map((m, idx) => (
                      <tr key={idx}>
                        <td className="time-td">{m.timeLabel}</td>
                        <td>₹{m.open}</td>
                        <td>₹{m.high}</td>
                        <td>₹{m.low}</td>
                        <td className="bold-td">₹{m.close}</td>
                        <td className={m.changePct >= 0 ? 'bull' : 'bear'}>
                          {m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(2)}%
                        </td>
                        <td>{m.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PE 1-Min History */}
            <div className="mh-side-col">
              <div className="mh-side-hdr pe">PUT (PE) 1-Min Bars</div>
              <div className="mh-table-scroll">
                <table className="mh-subtable">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>LTP</th>
                      <th>1m % Chg</th>
                      <th>Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRow.pe.recent1MinHistory.map((m, idx) => (
                      <tr key={idx}>
                        <td className="time-td">{m.timeLabel}</td>
                        <td>₹{m.open}</td>
                        <td>₹{m.high}</td>
                        <td>₹{m.low}</td>
                        <td className="bold-td">₹{m.close}</td>
                        <td className={m.changePct >= 0 ? 'bull' : 'bear'}>
                          {m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(2)}%
                        </td>
                        <td>{m.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Strike Day-Wise Metrics Summary Drawer */}
      {selectedRow && (
        <div className="oc-detail-bar">
          <div className="detail-item">
            <span className="detail-label">Strike:</span>
            <span className="detail-val strike">{selectedRow.strike}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">CE LTP:</span>
            <span className="detail-val bull">₹{selectedRow.ce.ltp.toFixed(2)}</span>
            <span className="detail-sub">
              {currentTfLabel} Vol: {selectedRow.ce.tfVolume.toLocaleString()} · Day Vol: {selectedRow.ce.dayVolume.toLocaleString()} · Day Open: ₹{selectedRow.ce.dayOpen}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">PE LTP:</span>
            <span className="detail-val bear">₹{selectedRow.pe.ltp.toFixed(2)}</span>
            <span className="detail-sub">
              {currentTfLabel} Vol: {selectedRow.pe.tfVolume.toLocaleString()} · Day Vol: {selectedRow.pe.dayVolume.toLocaleString()} · Day Open: ₹{selectedRow.pe.dayOpen}
            </span>
          </div>

          <div className="detail-actions">
            <button
              className="detail-btn buy"
              onClick={() => handleQuickTrade('BUY', 'CE', selectedRow.strike, selectedRow.ce.ltp)}
            >
              + Buy {selectedRow.strike} CE
            </button>
            <button
              className="detail-btn buy pe"
              onClick={() => handleQuickTrade('BUY', 'PE', selectedRow.strike, selectedRow.pe.ltp)}
            >
              + Buy {selectedRow.strike} PE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionChain;

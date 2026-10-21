"use client";
import React, { useState } from 'react';
import { Order, OrderSide, DataPoint, LOT_SIZE } from './types';

interface OrderPanelProps {
  selectedCandle: DataPoint | null;
  clickedPrice: number | null;
  orders: Order[];
  onAddOrder: (order: Order) => void;
  onCancelOrder: (id: string) => void;
  onCloseOrder?: (id: string) => void;
  onStartReplayFromCandle?: (candle: DataPoint) => void;
  currentPrice?: number;
  currentCandle?: DataPoint | null;
  isReplayActive?: boolean;
}

const OrderPanel: React.FC<OrderPanelProps> = ({
  selectedCandle,
  clickedPrice,
  orders,
  onAddOrder,
  onCancelOrder,
  onCloseOrder,
  onStartReplayFromCandle,
  currentPrice,
  currentCandle,
  isReplayActive = false,
}) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [qty, setQty] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [useClickPrice, setUseClickPrice] = useState(true);

  // If in replay mode and not using click price or no click price, default to current replay price
  const activePrice = isReplayActive && currentPrice ? currentPrice : clickedPrice;
  const effectivePrice = useClickPrice && activePrice ? activePrice : parseFloat(price);

  const handleAdd = () => {
    if (!effectivePrice || isNaN(effectivePrice) || Number(qty) <= 0) return;
    const orderTime = isReplayActive && currentCandle ? currentCandle.time : (selectedCandle?.time ?? new Date().toISOString());
    const order: Order = {
      id: `ord_${Date.now()}`,
      side,
      price: effectivePrice,
      qty: Number(qty),
      time: orderTime,
      status: 'FILLED',
      pnl: 0,
      pnlPoints: 0,
    };
    onAddOrder(order);
  };

  const handleQuickMarket = (quickSide: OrderSide) => {
    if (!currentPrice || Number(qty) <= 0) return;
    const orderTime = currentCandle ? currentCandle.time : new Date().toISOString();
    const order: Order = {
      id: `ord_${Date.now()}`,
      side: quickSide,
      price: currentPrice,
      qty: Number(qty),
      time: orderTime,
      status: 'FILLED',
      pnl: 0,
      pnlPoints: 0,
    };
    onAddOrder(order);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        Order Entry
      </div>

      <div className="order-form">
        {/* Side toggle */}
        <div className="side-toggle">
          <button
            className={`side-btn buy ${side === 'BUY' ? 'active' : ''}`}
            onClick={() => setSide('BUY')}
          >▲ BUY</button>
          <button
            className={`side-btn sell ${side === 'SELL' ? 'active' : ''}`}
            onClick={() => setSide('SELL')}
          >▼ SELL</button>
        </div>

        {/* Selected candle info */}
        {selectedCandle && (
          <div className="candle-info">
            <div className="ci-header-row">
              <span className="ci-label">Selected Candle</span>
              {selectedCandle.c2cPercent !== undefined && (
                <span className={`c2c-pill ${selectedCandle.c2cPercent >= 0 ? 'pos' : 'neg'}`}>
                  C2C: {selectedCandle.c2cPercent >= 0 ? '+' : ''}{selectedCandle.c2cPercent.toFixed(2)}%
                </span>
              )}
            </div>
            <span className="ci-value">{new Date(selectedCandle.time).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: false,
            })}</span>
            <div className="ci-row">
              <span>O: {selectedCandle.open.toFixed(1)}</span>
              <span>H: {selectedCandle.high.toFixed(1)}</span>
              <span>L: {selectedCandle.low.toFixed(1)}</span>
              <span>C: {selectedCandle.close.toFixed(1)}</span>
            </div>
            {onStartReplayFromCandle && (
              <button
                className="replay-from-candle-btn"
                onClick={() => onStartReplayFromCandle(selectedCandle)}
                title="Cut subsequent candles and start replay from this selected candle"
              >
                ✂️ Replay From This Candle (Hide Future)
              </button>
            )}
          </div>
        )}

        {/* Price */}
        <div className="form-group">
          <label>Price</label>
          <div className="price-input-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useClickPrice}
                onChange={e => setUseClickPrice(e.target.checked)}
              />
              Use click price
            </label>
            {!useClickPrice && (
              <input
                type="number"
                className="input"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Enter price"
              />
            )}
            {useClickPrice && (
              <div className="price-display">
                {clickedPrice ? clickedPrice.toFixed(1) : '— click a candle —'}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Quantity (Lots)</label>
          <input
            type="number"
            className="input"
            value={qty}
            min={1}
            onChange={e => setQty(e.target.value)}
          />
        </div>

        {isReplayActive && currentPrice && (
          <div className="quick-market-group">
            <button
              className="quick-mkt-btn buy"
              onClick={() => handleQuickMarket('BUY')}
              title="Instant Market Buy at current replay price"
            >
              ▲ Buy Mkt ({qty}L)
            </button>
            <button
              className="quick-mkt-btn sell"
              onClick={() => handleQuickMarket('SELL')}
              title="Instant Market Sell at current replay price"
            >
              ▼ Sell Mkt ({qty}L)
            </button>
          </div>
        )}

        <button className={`submit-btn ${side === 'BUY' ? 'buy' : 'sell'}`} onClick={handleAdd}>
          {side === 'BUY' ? '▲ Place Buy Order' : '▼ Place Sell Order'}
        </button>
      </div>

      {/* Orders list */}
      <div className="orders-list">
        <div className="orders-header">
          <span>Orders ({orders.length})</span>
          {isReplayActive && currentPrice && (
            <span className="replay-active-tag">● Replay Live</span>
          )}
        </div>
        {orders.length === 0 && <div className="empty-msg">No orders yet. Place an order or click Buy/Sell.</div>}
        {orders.map(o => (
          <div key={o.id} className={`order-item ${o.side.toLowerCase()} ${o.status.toLowerCase()}`}>
            <div className="order-row">
              {o.symbol && (
                <span className="order-symbol-tag" style={{
                  fontSize: '10px',
                  background: 'rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  color: '#a5b4fc',
                  fontFamily: 'monospace',
                  fontWeight: 700
                }}>
                  {o.symbol.replace('NIFTY 27OCT ', '')}
                </span>
              )}
              <span className={`order-side ${o.side === 'BUY' ? 'buy-text' : 'sell-text'}`}>
                {o.side === 'BUY' ? '▲' : '▼'} {o.side}
              </span>
              <span className="order-price">₹{o.price.toFixed(1)}</span>
              <span className="order-qty">×{o.qty}</span>
              <span className={`order-status ${o.status.toLowerCase()}`}>
                {o.status === 'FILLED' ? 'OPEN' : o.status}
              </span>
              {o.pnl !== undefined && o.status !== 'CANCELLED' && (
                <span className={`order-pnl ${o.pnl >= 0 ? 'profit' : 'loss'}`}>
                  {o.pnl >= 0 ? '+' : ''}₹{Math.round(o.pnl).toLocaleString()}
                  {o.pnlPoints !== undefined && (
                    <span className="pnl-pts"> ({o.pnlPoints >= 0 ? '+' : ''}{o.pnlPoints.toFixed(1)}p)</span>
                  )}
                </span>
              )}
            </div>
            <div className="order-values-row" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              padding: '4px 6px',
              margin: '3px 0',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <span>Placed: <strong style={{ color: '#e2e8f0' }}>₹{Math.round(o.price * o.qty * LOT_SIZE).toLocaleString()}</strong></span>
              <span>Updated: <strong style={{ color: '#38bdf8' }}>₹{Math.round((o.currentPrice ?? o.price) * o.qty * LOT_SIZE).toLocaleString()}</strong></span>
              <span>Net: <strong className={(o.pnl || 0) >= 0 ? 'profit' : 'loss'}>{(o.pnl || 0) >= 0 ? '+' : ''}₹{Math.round(o.pnl || 0).toLocaleString()}</strong></span>
            </div>
            <div className="order-time-row">
              <span className="order-time" title="Order Start Date & Time">
                📅 Start: {new Date(o.time).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                })}
              </span>
              {o.status === 'FILLED' && onCloseOrder && (
                <button
                  className="close-pos-btn"
                  onClick={() => onCloseOrder(o.id)}
                  title="Close position at current replay price"
                >
                  Exit Pos
                </button>
              )}
              {o.status === 'OPEN' && (
                <button className="cancel-btn" onClick={() => onCancelOrder(o.id)}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderPanel;

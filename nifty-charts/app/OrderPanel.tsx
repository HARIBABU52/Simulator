"use client";
import React, { useState } from 'react';
import { Order, OrderSide, DataPoint } from './types';

interface OrderPanelProps {
  selectedCandle: DataPoint | null;
  clickedPrice: number | null;
  orders: Order[];
  onAddOrder: (order: Order) => void;
  onCancelOrder: (id: string) => void;
}

const OrderPanel: React.FC<OrderPanelProps> = ({
  selectedCandle,
  clickedPrice,
  orders,
  onAddOrder,
  onCancelOrder,
}) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [qty, setQty] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [useClickPrice, setUseClickPrice] = useState(true);

  const effectivePrice = useClickPrice && clickedPrice ? clickedPrice : parseFloat(price);

  const handleAdd = () => {
    if (!effectivePrice || isNaN(effectivePrice) || Number(qty) <= 0) return;
    const order: Order = {
      id: `ord_${Date.now()}`,
      side,
      price: effectivePrice,
      qty: Number(qty),
      time: selectedCandle?.time ?? new Date().toISOString(),
      status: 'FILLED',
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
            <span className="ci-label">Selected Candle</span>
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

        {/* Qty */}
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

        <button className={`submit-btn ${side === 'BUY' ? 'buy' : 'sell'}`} onClick={handleAdd}>
          {side === 'BUY' ? '▲ Place Buy Order' : '▼ Place Sell Order'}
        </button>
      </div>

      {/* Orders list */}
      <div className="orders-list">
        <div className="orders-header">Orders ({orders.length})</div>
        {orders.length === 0 && <div className="empty-msg">No orders yet. Click a candle to place one.</div>}
        {orders.map(o => (
          <div key={o.id} className={`order-item ${o.side.toLowerCase()}`}>
            <div className="order-row">
              <span className={`order-side ${o.side === 'BUY' ? 'buy-text' : 'sell-text'}`}>
                {o.side === 'BUY' ? '▲' : '▼'} {o.side}
              </span>
              <span className="order-price">₹{o.price.toFixed(1)}</span>
              <span className="order-qty">×{o.qty}</span>
              <span className={`order-status ${o.status.toLowerCase()}`}>{o.status}</span>
              {o.pnl !== undefined && (
                <span className={`order-pnl ${o.pnl >= 0 ? 'profit' : 'loss'}`}>
                  {o.pnl >= 0 ? '+' : ''}{o.pnl.toFixed(0)}
                </span>
              )}
            </div>
            <div className="order-time">
              {new Date(o.time).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
              })}
            </div>
            {o.status !== 'CANCELLED' && (
              <button className="cancel-btn" onClick={() => onCancelOrder(o.id)}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderPanel;

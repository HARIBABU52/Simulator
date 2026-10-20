"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DataPoint, Order, Timeframe } from './types';
import { formatAxisTime, formatTooltipTime } from './chartUtils';

interface TradingChartProps {
  data: DataPoint[];
  orders: Order[];
  timeframe: Timeframe;
  onCandleClick?: (candle: DataPoint, price: number) => void;
}

const COLORS = {
  bg: '#0e1117',
  grid: '#1e2330',
  axisText: '#6b7280',
  bull: '#26a69a',
  bear: '#ef5350',
  wick: '#26a69a',
  bearWick: '#ef5350',
  crosshair: '#4b5563',
  tooltip: 'rgba(15,20,35,0.95)',
  tooltipBorder: '#2d3748',
  volumeBull: 'rgba(38,166,154,0.35)',
  volumeBear: 'rgba(239,83,80,0.35)',
  orderBuy: '#22d3ee',
  orderSell: '#f97316',
};

const PADDING = { top: 20, right: 80, bottom: 60, left: 12 };
const VOLUME_HEIGHT_RATIO = 0.18; // bottom 18% for volume

const TradingChart: React.FC<TradingChartProps> = ({ data, orders, timeframe, onCandleClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // View state
  const [candleWidth, setCandleWidth] = useState(9);
  const [offsetX, setOffsetX] = useState(0); // pixels scrolled from right
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; offsetX: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const canvasWidth = useRef(1200);
  const canvasHeight = useRef(600);

  // Clamp offsetX so we don't scroll past the data
  const clampOffset = useCallback((off: number, cw: number, cWidth: number) => {
    const totalWidth = data.length * (cw + 2);
    const viewWidth = cWidth - PADDING.left - PADDING.right;
    const maxOffset = Math.max(0, totalWidth - viewWidth);
    return Math.max(0, Math.min(off, maxOffset));
  }, [data.length]);

  // Derived helpers
  const getViewport = useCallback((cWidth: number, cw: number, off: number) => {
    const viewWidth = cWidth - PADDING.left - PADDING.right;
    const stride = cw + 2;
    const totalCandles = data.length;
    const firstIdx = Math.max(0, Math.floor(off / stride));
    const lastIdx = Math.min(totalCandles - 1, Math.ceil((off + viewWidth) / stride));
    return { firstIdx, lastIdx, viewWidth, stride };
  }, [data.length]);

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cw = candleWidth;
    const off = offsetX;

    const chartH = H - PADDING.top - PADDING.bottom;
    const volH = chartH * VOLUME_HEIGHT_RATIO;
    const priceH = chartH - volH;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    if (data.length === 0) {
      ctx.fillStyle = COLORS.axisText;
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading data...', W / 2, H / 2);
      return;
    }

    const { firstIdx, lastIdx, viewWidth, stride } = getViewport(W, cw, off);
    const visibleData = data.slice(firstIdx, lastIdx + 1);

    // Price range
    let minPrice = Infinity, maxPrice = -Infinity;
    for (const d of visibleData) {
      if (d.low < minPrice) minPrice = d.low;
      if (d.high > maxPrice) maxPrice = d.high;
    }
    const priceRange = maxPrice - minPrice || 1;
    const pricePad = priceRange * 0.05;
    const priceMin = minPrice - pricePad;
    const priceMax = maxPrice + pricePad;

    // Volume range
    let maxVol = 0;
    for (const d of visibleData) if (d.volume > maxVol) maxVol = d.volume;

    const priceToY = (p: number) =>
      PADDING.top + priceH - ((p - priceMin) / (priceMax - priceMin)) * priceH;
    const volToH = (v: number) => maxVol > 0 ? (v / maxVol) * volH : 0;

    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(PADDING.left, 0, W - PADDING.left - PADDING.right, H - PADDING.bottom);
    ctx.clip();

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const p = priceMin + (priceMax - priceMin) * (i / priceSteps);
      const y = priceToY(p);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(W - PADDING.right, y);
      ctx.stroke();
    }

    // Draw volume bars
    visibleData.forEach((d, i) => {
      const globalIdx = firstIdx + i;
      const x = PADDING.left + globalIdx * stride - off + cw / 2;
      const isBull = d.close >= d.open;
      const volBarH = volToH(d.volume);
      const volY = H - PADDING.bottom - volBarH;
      ctx.fillStyle = isBull ? COLORS.volumeBull : COLORS.volumeBear;
      ctx.fillRect(x - cw / 2, volY, cw, volBarH);
    });

    // Draw candles
    visibleData.forEach((d, i) => {
      const globalIdx = firstIdx + i;
      const x = PADDING.left + globalIdx * stride - off + cw / 2;
      const isBull = d.close >= d.open;
      const color = isBull ? COLORS.bull : COLORS.bear;

      const yHigh = priceToY(d.high);
      const yLow = priceToY(d.low);
      const yOpen = priceToY(d.open);
      const yClose = priceToY(d.close);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyH = Math.max(1, Math.abs(yClose - yOpen));
      ctx.fillStyle = color;
      if (cw >= 3) {
        ctx.fillRect(x - cw / 2, bodyTop, cw, bodyH);
      } else {
        // Very small: just draw a line
        ctx.fillRect(x - 0.5, bodyTop, 1, bodyH);
      }
    });

    // Draw order markers on chart
    for (const order of orders) {
      if (order.status === 'CANCELLED') continue;
      const orderTime = new Date(order.time).getTime();
      const idx = data.findIndex(d => new Date(d.time).getTime() >= orderTime);
      if (idx < firstIdx || idx > lastIdx) continue;
      const x = PADDING.left + idx * stride - off + cw / 2;
      const y = priceToY(order.price);
      const isBuy = order.side === 'BUY';
      const markerColor = isBuy ? COLORS.orderBuy : COLORS.orderSell;

      // Triangle marker
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      if (isBuy) {
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x - 7, y);
        ctx.lineTo(x + 7, y);
      } else {
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x - 7, y);
        ctx.lineTo(x + 7, y);
      }
      ctx.closePath();
      ctx.fill();

      // Dashed line across
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 0.7;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(W - PADDING.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = markerColor;
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText(`${order.side} ${order.qty}`, x + 9, y - 2);
    }

    ctx.restore();

    // ---- Y-axis price labels ----
    ctx.fillStyle = COLORS.axisText;
    ctx.font = '11px Inter, monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= priceSteps; i++) {
      const p = priceMin + (priceMax - priceMin) * (i / priceSteps);
      const y = priceToY(p);
      ctx.fillText(p.toFixed(0), W - PADDING.right + 6, y + 4);
    }

    // ---- X-axis time labels ----
    ctx.fillStyle = COLORS.axisText;
    ctx.font = '10px Inter, monospace';
    ctx.textAlign = 'center';
    const labelEvery = Math.max(1, Math.floor(60 / (cw + 2)));
    visibleData.forEach((d, i) => {
      const globalIdx = firstIdx + i;
      if (globalIdx % labelEvery !== 0) return;
      const x = PADDING.left + globalIdx * stride - off + cw / 2;
      ctx.fillText(formatAxisTime(d.time, timeframe), x, H - PADDING.bottom + 16);
    });

    // ---- Crosshair + tooltip ----
    if (mousePos && hoveredIdx !== null && hoveredIdx >= firstIdx && hoveredIdx <= lastIdx) {
      const mx = mousePos.x;
      const my = mousePos.y;

      // Crosshair lines
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, my);
      ctx.lineTo(W - PADDING.right, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, PADDING.top);
      ctx.lineTo(mx, H - PADDING.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label on Y axis
      const hoverPrice = priceMax - ((my - PADDING.top) / priceH) * (priceMax - priceMin);
      if (hoverPrice >= priceMin && hoverPrice <= priceMax) {
        ctx.fillStyle = '#374151';
        ctx.fillRect(W - PADDING.right + 1, my - 9, PADDING.right - 2, 18);
        ctx.fillStyle = '#f9fafb';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(hoverPrice.toFixed(1), W - PADDING.right + 5, my + 4);
      }

      // OHLCV Tooltip box
      const d = data[hoveredIdx];
      if (d) {
        const isBull = d.close >= d.open;
        const lines = [
          formatTooltipTime(d.time, timeframe),
          `O: ${d.open.toFixed(1)}  H: ${d.high.toFixed(1)}`,
          `L: ${d.low.toFixed(1)}  C: ${d.close.toFixed(1)}`,
          `Vol: ${d.volume > 0 ? d.volume.toLocaleString() : 'N/A'}`,
        ];
        const boxW = 210, boxH = 76, pad = 10;
        let bx = mx + 14;
        let by = my - boxH / 2;
        if (bx + boxW > W - PADDING.right) bx = mx - boxW - 14;
        if (by < PADDING.top) by = PADDING.top;
        if (by + boxH > H - PADDING.bottom) by = H - PADDING.bottom - boxH;

        ctx.fillStyle = COLORS.tooltip;
        ctx.strokeStyle = isBull ? COLORS.bull : COLORS.bear;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.axisText;
        ctx.font = '10px Inter, monospace';
        ctx.fillText(lines[0], bx + pad, by + pad + 10);
        ctx.fillStyle = isBull ? COLORS.bull : COLORS.bear;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(lines[1], bx + pad, by + pad + 26);
        ctx.fillText(lines[2], bx + pad, by + pad + 41);
        ctx.fillStyle = COLORS.axisText;
        ctx.font = '10px monospace';
        ctx.fillText(lines[3], bx + pad, by + pad + 56);
      }
    }
  }, [data, orders, candleWidth, offsetX, hoveredIdx, mousePos, timeframe, getViewport]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (!canvasRef.current) return;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        canvasWidth.current = width;
        canvasHeight.current = height;
        draw();
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  // Redraw on state change
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [draw]);

  // Mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    const off = offsetX;
    const cw = candleWidth;
    const stride = cw + 2;
    const chartX = mx - PADDING.left + off;
    const idx = Math.floor(chartX / stride);
    setHoveredIdx(idx >= 0 && idx < data.length ? idx : null);

    if (isDragging && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const newOff = clampOffset(dragStart.current.offsetX - dx, cw, canvasWidth.current);
      setOffsetX(newOff);
    }
  }, [offsetX, candleWidth, isDragging, data.length, clampOffset]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, offsetX };
  }, [offsetX]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart.current) return;
    const dx = Math.abs(e.clientX - dragStart.current.x);
    setIsDragging(false);
    dragStart.current = null;

    // Click (not drag) — pass candle info up
    if (dx < 4 && hoveredIdx !== null && onCandleClick) {
      const d = data[hoveredIdx];
      const canvas = canvasRef.current;
      if (d && canvas) {
        const chartH = canvas.height - PADDING.top - PADDING.bottom;
        const volH = chartH * VOLUME_HEIGHT_RATIO;
        const priceH = chartH - volH;
        const visStart = Math.max(0, Math.floor(offsetX / (candleWidth + 2)));
        const visEnd = Math.min(data.length - 1, visStart + Math.ceil((canvasWidth.current - PADDING.left - PADDING.right) / (candleWidth + 2)));
        let minP = Infinity, maxP = -Infinity;
        for (let i = visStart; i <= visEnd; i++) {
          if (data[i].low < minP) minP = data[i].low;
          if (data[i].high > maxP) maxP = data[i].high;
        }
        const pricePad = (maxP - minP) * 0.05;
        const priceMin = minP - pricePad;
        const priceMax = maxP + pricePad;
        const rect = canvas.getBoundingClientRect();
        const my = e.clientY - rect.top;
        const price = priceMax - ((my - PADDING.top) / priceH) * (priceMax - priceMin);
        onCandleClick(d, parseFloat(price.toFixed(1)));
      }
    }
  }, [isDragging, hoveredIdx, data, offsetX, candleWidth, onCandleClick]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setMousePos(null);
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const factor = e.deltaY > 0 ? 0.85 : 1.15;
      setCandleWidth(prev => {
        const nw = Math.max(2, Math.min(40, prev * factor));
        setOffsetX(o => clampOffset(o, nw, canvasWidth.current));
        return nw;
      });
    } else {
      // Pan
      setOffsetX(o => clampOffset(o + e.deltaY * 1.5, candleWidth, canvasWidth.current));
    }
  }, [candleWidth, clampOffset]);

  return (
    <div ref={containerRef} className="tv-chart-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: isDragging ? 'grabbing' : 'crosshair', width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />
      {/* Zoom controls */}
      <div className="chart-zoom-controls">
        <button onClick={() => setCandleWidth(p => Math.min(40, p * 1.2))} title="Zoom In">+</button>
        <button onClick={() => setCandleWidth(p => Math.max(2, p * 0.8))} title="Zoom Out">−</button>
        <button onClick={() => setOffsetX(o => clampOffset(o - 200, candleWidth, canvasWidth.current))} title="Scroll Left">◀</button>
        <button onClick={() => setOffsetX(o => clampOffset(o + 200, candleWidth, canvasWidth.current))} title="Scroll Right">▶</button>
        <button onClick={() => setOffsetX(clampOffset(0, candleWidth, canvasWidth.current))} title="Go to Start">|◀</button>
        <button onClick={() => {
          const total = data.length * (candleWidth + 2);
          const vw = canvasWidth.current - PADDING.left - PADDING.right;
          setOffsetX(clampOffset(total - vw, candleWidth, canvasWidth.current));
        }} title="Go to End">▶|</button>
      </div>
    </div>
  );
};

export default TradingChart;

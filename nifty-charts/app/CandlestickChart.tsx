"use client"
import React, { useEffect, useRef } from 'react';

type DataPoint = {
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

interface CandlestickChartProps {
  data: DataPoint[];
  width?: number; // optional fixed width, else stretched
  height?: number; // optional fixed height
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, width = 1200, height = 400 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getYScale = (points: DataPoint[]) => {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.forEach(p => {
      if (p.low < minY) minY = p.low;
      if (p.high > maxY) maxY = p.high;
    });
    const padding = (maxY - minY) * 0.02;
    return { minY: minY - padding, maxY: maxY + padding };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (data.length === 0) {
      ctx.fillStyle = '#888';
      ctx.fillText('No data', width / 2 - 30, height / 2);
      return;
    }
    const { minY, maxY } = getYScale(data);
    const yScale = (value: number) => height - ((value - minY) / (maxY - minY)) * height;
    const candleWidth = Math.max(2, Math.floor(width / data.length) - 2);
    const halfWidth = candleWidth / 2;
    data.forEach((point, idx) => {
      const x = idx * (candleWidth + 2) + halfWidth + 1;
      const yOpen = yScale(point.open);
      const yClose = yScale(point.close);
      const yHigh = yScale(point.high);
      const yLow = yScale(point.low);
      const isBull = point.close >= point.open;
      const color = isBull ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      ctx.fillRect(x - halfWidth, bodyTop, candleWidth, bodyHeight);
    });
  }, [data, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="shadow-lg rounded bg-white dark:bg-gray-800" />;
};

export default CandlestickChart;

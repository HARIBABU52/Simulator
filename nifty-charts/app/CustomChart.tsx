import React, { useEffect, useRef } from 'react';
import type { DataPoint } from './types';

type CustomChartProps = {
  data: DataPoint[];
  smaPeriod?: number;
};

export default function CustomChart({ data, smaPeriod = 20 }: CustomChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute SMA
  const dataWithSma = React.useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => {
      const start = Math.max(0, i - smaPeriod + 1);
      const slice = data.slice(start, i + 1);
      const sum = slice.reduce((acc, cur) => acc + cur.close, 0);
      const sma = sum / slice.length;
      return { ...d, sma };
    });
  }, [data, smaPeriod]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    ctx.clearRect(0, 0, width, height);
    // background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, 'rgba(255,255,255,0.8)');
    bg.addColorStop(1, 'rgba(200,200,255,0.4)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if (dataWithSma.length === 0) return;
    const times = dataWithSma.map(d => new Date(d.time).getTime());
    const closes = dataWithSma.map(d => d.close);
    const minX = times.reduce((a, b) => (a < b ? a : b), times[0] ?? 0);
    const maxX = times.reduce((a, b) => (a > b ? a : b), times[0] ?? 0);
    const minY = closes.reduce((a, b) => (a < b ? a : b), closes[0] ?? 0);
    const maxY = closes.reduce((a, b) => (a > b ? a : b), closes[0] ?? 0);
    const padY = (maxY - minY) * 0.1;
    const yScale = (val: number) => height - ((val - (minY - padY)) / (maxY - minY + 2 * padY)) * height;
    const xScale = (val: number) => ((val - minX) / (maxX - minX)) * width;
    // draw close line
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4F46E5'; // indigo
    dataWithSma.forEach((pt, idx) => {
      const x = xScale(new Date(pt.time).getTime());
      const y = yScale(pt.close);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // draw SMA line
    ctx.beginPath();
    ctx.strokeStyle = '#FF7300'; // orange
    dataWithSma.forEach((pt, idx) => {
      const x = xScale(new Date(pt.time).getTime());
      const y = yScale(pt.sma);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [dataWithSma]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={400}
      className="rounded-lg shadow-md backdrop-blur-md bg-white/70 dark:bg-gray-800/70"
    />
  );
}

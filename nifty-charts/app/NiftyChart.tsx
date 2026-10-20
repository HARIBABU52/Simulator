"use client";
import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts';

type DataPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Signal = {
  type: 'buy' | 'sell';
  index: number;
  price: number;
};

export default function NiftyChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [smaPeriod, setSmaPeriod] = useState<number>(20);
  const [signals, setSignals] = useState<Signal[]>([]);

  // Load data JSON from public folder (cached)
  useEffect(() => {
    if (data.length > 0) return; // already loaded
    // If not loaded, fetch and cache
    fetch('/nifty-data.json')
      .then((res) => res.json())
      .then((raw) => {
        const parsed: DataPoint[] = raw.map((d: any) => ({
          time: d.time,
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close),
          volume: parseFloat(d.volume),
        }));
        setData(parsed);
      })
      .catch(console.error);
  }, []);

  // Calculate SMA values
  const dataWithSMA = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => {
      const start = Math.max(0, i - smaPeriod + 1);
      const slice = data.slice(start, i + 1);
      const sum = slice.reduce((acc, cur) => acc + cur.close, 0);
      const sma = sum / slice.length;
      return { ...d, sma };
    });
  }, [data, smaPeriod]);

  const runBacktest = () => {
    const sigs: Signal[] = [];
    for (let i = 1; i < dataWithSMA.length; i++) {
      const prev = dataWithSMA[i - 1];
      const cur = dataWithSMA[i];
      if (prev.close <= prev.sma && cur.close > cur.sma) {
        sigs.push({ type: 'buy', index: i, price: cur.close });
      } else if (prev.close >= prev.sma && cur.close < cur.sma) {
        sigs.push({ type: 'sell', index: i, price: cur.close });
      }
    }
    setSignals(sigs);
  };

  return (
    <div className="p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">NIFTY Chart</h2>
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          SMA Period:
          <input
            type="number"
            min={1}
            value={smaPeriod}
            onChange={(e) => setSmaPeriod(parseInt(e.target.value) || 1)}
            className="ml-2 w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
          />
        </label>
        <button
          onClick={runBacktest}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          Run Backtest
        </button>
      </div>
      <LineChart width={900} height={400} data={dataWithSMA} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        <YAxis domain={['dataMin', 'dataMax']} />
        <Tooltip labelFormatter={(t) => new Date(t).toLocaleString()} />
        <Legend />
        <Line type="monotone" dataKey="close" stroke="#8884d8" dot={false} name="Close" />
        <Line type="monotone" dataKey="sma" stroke="#ff7300" dot={false} name={`SMA ${smaPeriod}`} />
        {signals.map((s, idx) => (
          <ReferenceDot
            key={idx}
            x={s.index}
            y={s.price}
            r={5}
            fill={s.type === 'buy' ? 'green' : 'red'}
            stroke="none"
            label={s.type.toUpperCase()}
          />
        ))}
      </LineChart>
    </div>
  );
}

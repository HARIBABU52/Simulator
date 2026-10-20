'use server';

import fs from 'fs';
import path from 'path';

export interface RawOptionFileInfo {
  strike: number;
  type: 'CE' | 'PE';
  fileName: string;
  records: Array<{
    time: string;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>;
}

export interface ExpiryRawData {
  expiry: string;
  strikes: number[];
  options: {
    [strike: number]: {
      ce?: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
      pe?: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
    };
  };
}

export async function getAvailableExpiries(): Promise<string[]> {
  try {
    const optionsDir = path.join(process.cwd(), 'optionsData');
    if (!fs.existsSync(optionsDir)) return ['27octExpire'];
    const entries = fs.readdirSync(optionsDir, { withFileTypes: true });
    const expiries = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
    return expiries.length > 0 ? expiries : ['27octExpire'];
  } catch (err) {
    console.error('Error listing expiries:', err);
    return ['27octExpire'];
  }
}

export async function loadRawExpiryOptions(expiry: string = '27octExpire'): Promise<ExpiryRawData> {
  const optionsDir = path.join(process.cwd(), 'optionsData', expiry);
  if (!fs.existsSync(optionsDir)) {
    return { expiry, strikes: [], options: {} };
  }

  const ceDir = path.join(optionsDir, 'ce');
  const peDir = path.join(optionsDir, 'pe');

  const ceFiles = fs.existsSync(ceDir) ? fs.readdirSync(ceDir).filter(f => f.endsWith('.json')) : [];
  const peFiles = fs.existsSync(peDir) ? fs.readdirSync(peDir).filter(f => f.endsWith('.json')) : [];

  const strikesSet = new Set<number>();
  const optionsMap: ExpiryRawData['options'] = {};

  const processFile = (filePath: string, type: 'CE' | 'PE') => {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const records = JSON.parse(raw);
      // Extract strike from filename e.g. "NIFTY 27 OCT 22900 CALL_1792511515795.json"
      const m = path.basename(filePath).match(/\b(\d{5})\b/);
      if (!m) return;
      const strike = parseInt(m[1], 10);
      strikesSet.add(strike);

      if (!optionsMap[strike]) optionsMap[strike] = {};

      const parsedRecords = records.map((r: any) => ({
        time: r.time,
        open: typeof r.open === 'number' ? r.open : parseFloat(r.open),
        high: typeof r.high === 'number' ? r.high : parseFloat(r.high),
        low: typeof r.low === 'number' ? r.low : parseFloat(r.low),
        close: typeof r.close === 'number' ? r.close : parseFloat(r.close),
        volume: typeof r.volume === 'number' ? r.volume : (parseFloat(r.volume) || 0),
      }));

      if (type === 'CE') {
        optionsMap[strike].ce = parsedRecords;
      } else {
        optionsMap[strike].pe = parsedRecords;
      }
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
    }
  };

  for (const f of ceFiles) {
    processFile(path.join(ceDir, f), 'CE');
  }
  for (const f of peFiles) {
    processFile(path.join(peDir, f), 'PE');
  }

  // Descending strikes: higher strikes first (e.g. 22900, 22850)
  const strikes = Array.from(strikesSet).sort((a, b) => b - a);

  return {
    expiry,
    strikes,
    options: optionsMap,
  };
}

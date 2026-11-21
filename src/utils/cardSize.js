// Grid | Big card switch on the browse grid (/showroom, dealer /cars; owner 2026-11-21).
// Same pattern as priceMode.js: remembered on this device only; blocked or private-mode
// storage falls back to 'grid'.
import { useState, useCallback } from 'react';

const KEY = 'xd_card_size';
export const CARD_SIZES = ['grid', 'big'];

export function readCardSize() {
  try {
    const v = localStorage.getItem(KEY);
    return CARD_SIZES.includes(v) ? v : 'grid';
  } catch { return 'grid'; }
}

export function useCardSize() {
  const [size, setSizeState] = useState(readCardSize);
  const setSize = useCallback((s) => {
    if (!CARD_SIZES.includes(s)) return;
    setSizeState(s);
    try { localStorage.setItem(KEY, s); } catch { /* device-only nicety */ }
  }, []);
  return [size, setSize];
}

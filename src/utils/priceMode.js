// Monthly | Price switch on the browse grid (Carlist does the same: most
// Malaysian buyers shop by instalment). Remembered on this device only; a
// blocked or private-mode storage simply falls back to 'price'.
import { useState, useCallback } from 'react';

const KEY = 'xd_price_mode';
export const PRICE_MODES = ['price', 'monthly'];

export function readPriceMode() {
  try {
    const v = localStorage.getItem(KEY);
    return PRICE_MODES.includes(v) ? v : 'price';
  } catch { return 'price'; }
}

export function usePriceMode() {
  const [mode, setModeState] = useState(readPriceMode);
  const setMode = useCallback((m) => {
    if (!PRICE_MODES.includes(m)) return;
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* device-only nicety */ }
  }, []);
  return [mode, setMode];
}

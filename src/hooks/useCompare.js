import { useState, useCallback, useEffect } from 'react';

const SS_KEY = 'xdrive_compare';
const MAX = 4;

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '[]'); } catch { return []; }
}

// ── Singleton store ──────────────────────────────────
// All hook instances share this state and get notified together.
let _state = readSession();
const _listeners = new Set();

function _setState(next) {
  _state = next;
  sessionStorage.setItem(SS_KEY, JSON.stringify(next));
  _listeners.forEach(fn => fn(next));
}
// ─────────────────────────────────────────────────────

export function useCompare() {
  const [compareIds, setCompareIds] = useState(_state);

  useEffect(() => {
    const handler = (next) => setCompareIds([...next]);
    _listeners.add(handler);
    return () => _listeners.delete(handler);
  }, []);

  const addToCompare = useCallback((id) => {
    if (_state.includes(id) || _state.length >= MAX) return;
    _setState([..._state, id]);
  }, []);

  const removeFromCompare = useCallback((id) => {
    _setState(_state.filter(x => x !== id));
  }, []);

  const isInCompare = useCallback((id) => _state.includes(id), [compareIds]);

  const clearCompare = useCallback(() => _setState([]), []);

  return { compareIds, addToCompare, removeFromCompare, isInCompare, clearCompare };
}

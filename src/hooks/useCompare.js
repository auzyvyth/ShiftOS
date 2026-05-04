import { useState, useCallback, useEffect } from 'react';

const SS_KEY = 'xdrive_compare';
const MAX = 3;

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function useCompare() {
  const [compareIds, setCompareIds] = useState(() => readSession());

  // Keep sessionStorage in sync whenever compareIds changes
  useEffect(() => {
    sessionStorage.setItem(SS_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  const addToCompare = useCallback((id) => {
    setCompareIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX) return prev;
      return [...prev, id];
    });
  }, []);

  const removeFromCompare = useCallback((id) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const isInCompare = useCallback(
    (id) => compareIds.includes(id),
    [compareIds],
  );

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  return { compareIds, addToCompare, removeFromCompare, isInCompare, clearCompare };
}

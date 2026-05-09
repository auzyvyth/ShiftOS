import { useState, useEffect } from 'react';

let _open = false;
const _listeners = new Set();

function _set(v) {
  _open = v;
  _listeners.forEach(fn => fn(v));
}

export function useCompareModal() {
  const [open, setOpen] = useState(_open);

  useEffect(() => {
    _listeners.add(setOpen);
    return () => _listeners.delete(setOpen);
  }, []);

  return {
    open,
    openModal:  () => _set(true),
    closeModal: () => _set(false),
  };
}

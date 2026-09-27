import { useEffect, useRef, useState } from 'react';
import { hasStoredSession, PANEL_SEED_TTL } from '../utils/panelCache';

// useState that remembers its last value on this device, so a dashboard tab
// paints the numbers it showed last time instead of a spinner while its own
// fetch runs. Drop-in for the `const [rows, setRows] = useState([])` a tab
// already fills from Supabase — the fetch code does not change at all.
//
//   const [rows, setRows, hadCache] = usePersistentState(
//     dealerId ? `hp:${dealerId}` : null, [],
//   );
//   const [loading, setLoading] = useState(!hadCache);
//
// Same rules as panelCache (read it before widening what goes in here):
// - Keys live under `cf:v1:` so clearPanelDataCache() purges them on logout,
//   and every key MUST end in the dealer/user id it belongs to.
// - Nothing is read back when this device holds no Supabase session.
// - Pass `redact` for anything carrying identity documents or home addresses
//   (IC numbers, buyer_address): localStorage is plaintext.
// - Entries older than PANEL_SEED_TTL are ignored.
// A null key disables persistence and behaves exactly like useState.
// Plain JSON only: a Map or Set comes back as {} — keep those in useState.

const PREFIX = 'cf:v1:ps:';

function read(key) {
  if (!key || !hasStoredSession()) return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const { t, data } = JSON.parse(raw);
    return Date.now() - t < PANEL_SEED_TTL ? data : undefined;
  } catch {
    return undefined;
  }
}

export function usePersistentState(key, initial, { redact } = {}) {
  const [state, setState] = useState(() => {
    const hit = read(key);
    return hit === undefined ? initial : hit;
  });
  const [hadCache] = useState(() => read(key) !== undefined);

  // A different account/dealer on the same mounted component: swap to that
  // key's cache (or the initial value) so one account's rows never linger.
  const keyRef = useRef(key);
  const swappedRef = useRef(false);
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    // The write effect below runs in this same commit with the OLD key's
    // value; without this flag it would file that value under the new key.
    swappedRef.current = true;
    const hit = read(key);
    setState(hit === undefined ? initial : hit);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const redactRef = useRef(redact);
  redactRef.current = redact;

  // Write on change rather than wrapping the setter: tabs call their setter
  // with updater functions, and this sees the settled value either way.
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (swappedRef.current) { swappedRef.current = false; return; }
    if (!key) return;
    try {
      const data = redactRef.current ? redactRef.current(state) : state;
      localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data }));
    } catch {
      // Quota / private mode — the cache is an optimisation, never required.
    }
  }, [key, state]);

  return [state, setState, hadCache];
}

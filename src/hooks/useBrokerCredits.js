import { useEffect, useState } from 'react';
import { dealerBrokers, dealerRegistrations } from '../lib/brokerApi';

// BROKER-1: the dealer's brokers + the buyers they registered, for the lead screens to name who owns
// a lead (src/utils/brokerCredit.js). Two small reads, kept for a minute so opening the pipeline, a
// stage and a lead is one fetch, not three. A manager gets empty lists (the database only answers the
// dealer / owner); the screens then say "Broker" without a name rather than "Unassigned".
let cache = { at: 0, value: null };
const TTL = 60 * 1000;

export function useBrokerCredits() {
  const [data, setData] = useState(() => cache.value || { brokers: [], regs: [] });
  useEffect(() => {
    let alive = true;
    if (cache.value && Date.now() - cache.at < TTL) { setData(cache.value); return undefined; }
    Promise.all([dealerBrokers(), dealerRegistrations()]).then(([b, r]) => {
      if (!alive || b.error || r.error) return; // a failed read keeps what is on screen
      cache = { at: Date.now(), value: { brokers: b.rows, regs: r.rows } };
      setData(cache.value);
    });
    return () => { alive = false; };
  }, []);
  return data;
}

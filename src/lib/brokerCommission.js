// What a dealer owes outside brokers, PER CAR (BROKER-2, owner 2026-11-15: "mix them into the totals,
// no separate columns"). One read, shared by every screen that calls carPnl(), so the car pop-up, the
// stock row, the P&L modal, Reports and Overview all count the same commission on the same car.
// The database function answers only the dealer / owner and a manager whose "view gross profit"
// switch is on (`dealer_can(dealer, 'view_gross')`); anyone else gets no rows, never an error.
//
// Before migration 20261116a is applied the function does not exist: that is "no broker commission",
// not a failure. Any OTHER error throws, so a screen keeps its last good numbers instead of showing a
// profit that is too high (the same rule as the rest of the money loaders).
import { supabase } from '../supabaseClient';

const inflight = new Map();

function isMissingFunction(error) {
  return error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');
}

/** { byCar: { [listingId]: { amount, items: [{ name, amount, paid }] } } } */
export function loadBrokerCommission(dealerId) {
  if (!dealerId) return Promise.resolve({ byCar: {} });
  if (!inflight.has(dealerId)) {
    const p = (async () => {
      const { data, error } = await supabase.rpc('dealer_broker_commission_by_car');
      if (error) {
        if (isMissingFunction(error)) return { byCar: {} };
        throw new Error('broker_commission_read_failed');
      }
      const byCar = {};
      for (const r of data || []) {
        if (!r.listing_id) continue;
        const x = byCar[r.listing_id] || (byCar[r.listing_id] = { amount: 0, items: [] });
        const amount = Number(r.amount) || 0;
        x.amount += amount;
        x.items.push({ name: r.broker_name || 'A broker', amount, paid: !!r.paid });
      }
      return { byCar };
    })().finally(() => setTimeout(() => inflight.delete(dealerId), 2000));
    inflight.set(dealerId, p);
  }
  return inflight.get(dealerId);
}

export const brokerAmount = (byCar, listingId) => Number(byCar?.[listingId]?.amount) || 0;

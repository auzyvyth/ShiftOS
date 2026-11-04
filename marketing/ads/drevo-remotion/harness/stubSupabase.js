// Stands in for src/supabaseClient.js in the recording harness: no network.
// The presenter reads new-car variants through publicClient.rpc and pings
// set_live_listing; everything answers from fixture.js.
import { LISTINGS, infoFor } from './fixture.js';

const ok = (data, extra = {}) => Promise.resolve({ data, error: null, count: 0, ...extra });
function query(result) {
  const q = {
    then: (a, b) => ok(result, { count: Array.isArray(result) ? result.length : 0 }).then(a, b),
    maybeSingle: () => ok(Array.isArray(result) ? result[0] ?? null : result),
    single: () => ok(Array.isArray(result) ? result[0] ?? null : result),
  };
  for (const m of ['insert', 'update', 'upsert', 'delete', 'select', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'is', 'order', 'limit', 'range', 'match', 'not', 'or', 'filter', 'contains', 'ilike']) q[m] = () => q;
  return q;
}
function rpc(name, args = {}) {
  if (name === 'get_new_car_listing_info') return query(infoFor(args.p_listing_id));
  if (name === 'get_new_car_variants_batch') return query((args.p_listing_ids || []).map((id) => ({ listing_id: id, variants: infoFor(id)?.variants || [] })));
  if (name === 'set_live_listing') return query(true);
  return query(null);
}
const channel = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {}, track: () => {}, send: () => {} }; return c; };
const client = {
  rpc, from: (t) => query(globalThis.__STUB_TABLES?.[t] ?? []), channel, removeChannel: () => {},
  auth: {
    getSession: () => ok({ session: null }), getUser: () => ok({ user: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: () => ok({ session: null }),
  },
};
export const supabase = client;
export const publicClient = client;
export const SUPABASE_URL = 'https://stub.invalid';
export const SUPABASE_ANON_KEY = 'stub';
export const INITIAL_URL = typeof window !== 'undefined' ? window.location.href : '';
export { LISTINGS };

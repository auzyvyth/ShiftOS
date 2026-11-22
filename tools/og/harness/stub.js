// Stands in for src/supabaseClient.js in the link-preview harness: no network.
// Every table answers from fixture.js (globalThis.__STUB).
const ok = (data, extra = {}) => Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0, ...extra });
function query(result) {
  const q = { then: (a, b) => ok(result).then(a, b), maybeSingle: () => ok(Array.isArray(result) ? result[0] ?? null : result), single: () => ok(Array.isArray(result) ? result[0] ?? null : result) };
  for (const m of ['insert','update','upsert','delete','select','eq','neq','gte','lte','gt','lt','in','is','order','limit','range','match','not','or','filter','contains','ilike']) q[m] = () => q;
  return q;
}
const T = () => globalThis.__STUB || {};
const channel = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {}, track: () => {}, send: () => {}, presenceState: () => ({}) }; return c; };
const client = {
  rpc: (n) => query(T().rpc?.[n] ?? null), from: (t) => query(T()[t] ?? []), channel, removeChannel: () => {}, removeAllChannels: () => {},
  auth: { getSession: () => ok({ session: null }), getUser: () => ok({ user: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), refreshSession: () => ok({ session: null }) },
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};
export const supabase = client; export const publicClient = client; export const platformClient = client; export default client;

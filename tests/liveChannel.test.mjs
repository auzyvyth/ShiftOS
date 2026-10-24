// IO-2 live updates by Broadcast: topics, delivery through an RLS re-read,
// shared channels, cleanup, and the postgres_changes fallback.
// Run: npm run test:livechannel
import { liveChannel, liveTopic, parseLiveFilter, wantsOp, liveBindings } from '../src/lib/liveChannel.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const tick = () => new Promise((r) => setTimeout(r, 0));

// A fake supabase client: channels record their handlers; `rows` is what RLS
// lets this viewer read.
function fakeClient(rows = {}) {
  const c = {
    channels: [], removed: [], reads: 0,
    channel(topic, opts) {
      const ch = {
        topic, opts, handlers: [], statusCb: null,
        on(type, spec, cb) { this.handlers.push({ type, spec, cb }); return this; },
        subscribe(cb) { this.statusCb = cb; return this; },
      };
      c.channels.push(ch);
      return ch;
    },
    // Like realtime-js: removeChannel calls unsubscribe() then teardown().
    removeChannel(ch) {
      if (!c.channels.includes(ch)) return ch.unsubscribe().then((st) => { ch.teardown(); return st; });
      c.removed.push(ch.topic); c.channels = c.channels.filter((x) => x !== ch);
      return Promise.resolve('ok');
    },
    from(table) {
      const q = { col: null, val: null };
      return {
        select() { return this; },
        eq(col, val) { q.col = col; q.val = val; return this; },
        limit() { c.reads += 1; return Promise.resolve({ data: (rows[table] || []).filter((r) => String(r[q.col]) === String(q.val)), error: null }); },
      };
    },
    send(topic, payload) {
      c.channels.filter((ch) => ch.topic === topic).forEach((ch) => ch.handlers.forEach((h) => h.type === 'broadcast' && h.cb({ payload })));
    },
    status(topic, s) { c.channels.filter((ch) => ch.topic === topic).forEach((ch) => ch.statusCb?.(s)); },
  };
  return c;
}

// Topics
is('filter: eq parsed', parseLiveFilter('salesman_id=eq.abc'), { column: 'salesman_id', value: 'abc' });
is('filter: none = all', parseLiveFilter(null), { column: null, value: null });
is('filter: non-eq refused', parseLiveFilter('stage=in.(a,b)'), null);
is('topic: filtered', liveTopic('leads', 'salesman_id=eq.u1'), 'rt:leads:salesman_id:u1');
is('topic: unfiltered', liveTopic('kyc_documents', null), 'rt:kyc_documents:all');
is('topic: status value', liveTopic('car_listings', 'status=eq.pending_approval'), 'rt:car_listings:status:pending_approval');
is('op: star hears all', wantsOp('*', 'DELETE'), true);
is('op: INSERT only', [wantsOp('INSERT', 'INSERT'), wantsOp('INSERT', 'UPDATE')], [true, false]);

// Delivery: a private channel per topic; the row is re-read, not trusted from the message.
{
  const c = fakeClient({ leads: [{ id: 'L1', salesman_id: 'u1', buyer_name: 'Ali' }] });
  const got = [];
  const ch = liveChannel(c, 'premium-rt-u1')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: 'salesman_id=eq.u1' }, (p) => got.push([p.eventType, p.new.buyer_name]))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'salesman_notifications', filter: 'salesman_id=eq.u1' }, (p) => got.push(['notif', p.new.id]))
    .subscribe();
  is('channels: one per topic, private', c.channels.map((x) => [x.topic, x.opts?.config?.private]), [['rt:leads:salesman_id:u1', true], ['rt:salesman_notifications:salesman_id:u1', true]]);
  c.send('rt:leads:salesman_id:u1', { op: 'UPDATE', id: 'L1', key: 'id', table: 'leads' });
  await tick(); await tick();
  is('delivery: re-read row reaches the callback', got, [['UPDATE', 'Ali']]);
  c.send('rt:leads:salesman_id:u1', { op: 'UPDATE', id: 'HIDDEN', key: 'id', table: 'leads' });
  await tick(); await tick();
  is('delivery: a row RLS hides is dropped', got.length, 1);
  c.send('rt:leads:salesman_id:u1', { op: 'DELETE', id: 'L9', key: 'id', table: 'leads' });
  await tick();
  is('delivery: DELETE carries old.id, no read', got[1], ['DELETE', undefined]);
  is('registry: bindings listed for replay', liveBindings(c).map((b) => b.table), ['leads', 'salesman_notifications']);
  await c.removeChannel(ch); // what screens call
  is('cleanup: removeChannel drops both topics', c.channels.length, 0);
  is('cleanup: registry emptied', liveBindings(c).length, 0);
}

// INSERT-only binding ignores updates without a read.
{
  const c = fakeClient({ salesman_notifications: [{ id: 'N1', salesman_id: 'u1' }] });
  let n = 0;
  liveChannel(c, 'n').on('postgres_changes', { event: 'INSERT', table: 'salesman_notifications', filter: 'salesman_id=eq.u1' }, () => { n += 1; }).subscribe();
  c.send('rt:salesman_notifications:salesman_id:u1', { op: 'UPDATE', id: 'N1', key: 'id' });
  await tick(); await tick();
  is('event filter: UPDATE not heard, not read', [n, c.reads], [0, 0]);
}

// Two screens on one topic share one channel; it closes with the last one.
{
  const c = fakeClient({ chat_threads: [{ id: 'T1', salesman_id: 'u1' }] });
  let a = 0, b = 0;
  const one = liveChannel(c, 'badge').on('postgres_changes', { event: '*', table: 'chat_threads', filter: 'salesman_id=eq.u1' }, () => { a += 1; }).subscribe();
  const two = liveChannel(c, 'inbox').on('postgres_changes', { event: '*', table: 'chat_threads', filter: 'salesman_id=eq.u1' }, () => { b += 1; }).subscribe();
  is('shared: one channel for two screens', c.channels.length, 1);
  c.send('rt:chat_threads:salesman_id:u1', { op: 'UPDATE', id: 'T1', key: 'id' });
  await tick(); await tick();
  is('shared: both screens hear it, one read', [a, b, c.reads], [1, 1, 1]);
  await one.unsubscribe();
  is('shared: stays open for the other screen', c.channels.length, 1);
  await two.unsubscribe();
  is('shared: closes with the last screen', c.channels.length, 0);
}

// Refused private topic -> postgres_changes fallback, private channel removed.
{
  const c = fakeClient();
  const seen = [];
  let subscribed = 0;
  liveChannel(c, 'x').on('postgres_changes', { event: 'INSERT', table: 'appointments', filter: 'salesman_id=eq.u1' }, (p) => seen.push(p.eventType))
    .subscribe(() => { subscribed += 1; });
  c.status('rt:appointments:salesman_id:u1', 'CHANNEL_ERROR');
  const legacy = c.channels.find((x) => x.topic.startsWith('legacy:'));
  is('fallback: private channel removed', c.removed, ['rt:appointments:salesman_id:u1']);
  is('fallback: postgres_changes with the same filter', legacy?.handlers[0]?.spec, { event: '*', schema: 'public', table: 'appointments', filter: 'salesman_id=eq.u1' });
  legacy.handlers[0].cb({ eventType: 'UPDATE', new: { id: 'A1' } });
  legacy.handlers[0].cb({ eventType: 'INSERT', new: { id: 'A2' } });
  is('fallback: event filter still applies', seen, ['INSERT']);
  is('status callback: fired once', subscribed, 1);
}

// Status callback waits for every topic.
{
  const c = fakeClient();
  const calls = [];
  liveChannel(c, 'y')
    .on('postgres_changes', { event: '*', table: 'leads', filter: 'salesman_id=eq.u1' }, () => {})
    .on('postgres_changes', { event: '*', table: 'appointments', filter: 'salesman_id=eq.u1' }, () => {})
    .subscribe((s) => calls.push(s));
  c.status('rt:leads:salesman_id:u1', 'SUBSCRIBED');
  is('status: not yet with one topic joined', calls, []);
  c.status('rt:appointments:salesman_id:u1', 'SUBSCRIBED');
  c.status('rt:appointments:salesman_id:u1', 'SUBSCRIBED');
  is('status: SUBSCRIBED once all joined, never twice', calls, ['SUBSCRIBED']);
}

console.log(`liveChannel: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

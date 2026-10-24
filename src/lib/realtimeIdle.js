// IO-6 (2026-10-22): live updates stop on a hidden screen and catch up on return.
//
// While ANY postgres_changes listener is connected, Supabase Realtime polls the
// database for changes nonstop (realtime.list_changes, ~100k calls in 2 days).
// Seller panels stay open all day and night in background tabs, so the poller
// never rests, and on 2026-10-22 the database's disk budget ran out (TODO IO).
//
// So: a client whose tab has been hidden for HIDDEN_MS disconnects its realtime
// socket. On return it reconnects (phoenix rejoins every channel by itself:
// a disconnect errors each channel, and socket.onOpen rejoins errored ones),
// and REPLAYS what it missed: for each postgres_changes listener, the rows of
// its table, under its filter, changed since the disconnect, fed to the SAME
// callback as { eventType: 'INSERT' | 'UPDATE', new: row }. Screens need no
// code of their own, RLS decides what comes back exactly as it does for live
// events, and a seller still gets the "New booking" toast for what arrived.
//
// Missed DELETEs are not replayed (leads are soft-deleted, an UPDATE). Events
// before the disconnect were delivered live, so `since` is the disconnect time.

import { liveBindings } from './liveChannel.js';

const HIDDEN_MS = 2 * 60 * 1000;
const SKEW_MS = 5 * 1000;
const REPLAY_LIMIT = 200;
const REJOIN_WAIT_MS = 1500;
// Tried in order; a table's first existing column is remembered (the tables
// were built in the dashboard, so the repo cannot say which they have).
const TIME_COLUMNS = ['updated_at', 'last_message_at', 'created_at'];

// "salesman_id=eq.<uuid>" -> { column, value }. Only `eq` is used in the app;
// anything else returns null and that listener is not replayed.
export function parseFilter(filter) {
  if (!filter) return { column: null, value: null };
  const m = /^([a-z_][a-z0-9_]*)=eq\.(.+)$/i.exec(String(filter));
  return m ? { column: m[1], value: m[2] } : null;
}

// A row created after `since` is an INSERT, anything else an UPDATE; then the
// listener's own event filter decides whether it hears it.
export function replayEvent(row, since, listenFor) {
  const created = row?.created_at ? Date.parse(row.created_at) : NaN;
  const type = Number.isFinite(created) && created >= since ? 'INSERT' : 'UPDATE';
  const ev = String(listenFor || '*').toUpperCase();
  return ev === '*' || ev === type ? type : null;
}

const timeColumnCache = new Map(); // table -> column | null

async function timeColumnFor(client, table) {
  if (timeColumnCache.has(table)) return timeColumnCache.get(table);
  let found = null;
  for (const col of TIME_COLUMNS) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await client.from(table).select(col).limit(0);
    if (!error) { found = col; break; }
  }
  timeColumnCache.set(table, found);
  return found;
}

async function replayBinding(client, binding, since) {
  const f = binding?.filter || {};
  if (!f.table || (f.schema && f.schema !== 'public')) return;
  const parsed = parseFilter(f.filter);
  if (!parsed) return;
  const col = await timeColumnFor(client, f.table);
  if (!col) return;
  let q = client.from(f.table).select('*').gt(col, new Date(since).toISOString())
    .order(col, { ascending: true }).limit(REPLAY_LIMIT);
  if (parsed.column) q = q.eq(parsed.column, parsed.value);
  const { data, error } = await q;
  if (error || !Array.isArray(data)) return;
  for (const row of data) {
    const eventType = replayEvent(row, since, f.event);
    if (!eventType) continue;
    try {
      binding.callback({
        schema: 'public', table: f.table, commit_timestamp: row[col], eventType,
        new: row, old: { id: row.id }, errors: null,
      });
    } catch (e) { console.error('realtimeIdle replay:', e); }
  }
}

function replayMissed(client, since) {
  const channels = client.realtime?.getChannels?.() || [];
  channels.forEach((ch) => {
    (ch.bindings?.postgres_changes || []).forEach((b) => { replayBinding(client, b, since); });
  });
  // IO-2: screens on liveChannel listen by Broadcast; their bindings live in
  // its registry, in the same { filter, callback } shape replayBinding reads.
  liveBindings(client).forEach((b) => {
    replayBinding(client, { filter: { schema: 'public', table: b.table, filter: b.filter, event: b.event }, callback: b.callback }, since);
  });
}

const installed = new WeakSet();

// Call once per client (App.jsx: main + public; AdminPage: the console's).
export function installRealtimeIdle(client) {
  if (!client?.realtime || installed.has(client) || typeof document === 'undefined') return;
  installed.add(client);
  let hideTimer = null;
  let pausedAt = null;

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!client.realtime.getChannels().length) return;
        pausedAt = Date.now();
        client.realtime.disconnect();
      }, HIDDEN_MS);
      return;
    }
    clearTimeout(hideTimer);
    if (pausedAt == null) return;
    const since = pausedAt - SKEW_MS;
    pausedAt = null;
    client.realtime.connect();
    // After the channels have rejoined, so a change made while they were
    // rejoining lands in the replay instead of falling between the two.
    setTimeout(() => replayMissed(client, since), REJOIN_WAIT_MS);
  };
  document.addEventListener('visibilitychange', onVisibility);
}

// IO-2 (2026-10-24): live updates arrive by Broadcast from the database, not
// by postgres_changes.
//
// While ANY postgres_changes listener is connected, Supabase Realtime polls the
// database nonstop (realtime.list_changes: ~121k calls and ~30 min of database
// time in a day, the biggest load on a small server that kept stalling). A
// Broadcast costs nothing until a row actually changes.
//
// How it works:
// - DB trigger `rt_notify` (migration 20261024a) sends {op, id, key, table} to
//   the private topic `rt:<table>:<column>:<value>` for each column a screen
//   filters on (`rt:<table>:all` for the console's unfiltered lists).
// - The message carries NO row data. This side re-reads the one row through
//   the normal client, so RLS decides what a viewer sees exactly as it did for
//   postgres_changes. A wrong topic permission can leak an id, never a buyer.
// - `liveChannel(client, name)` is a drop-in for `client.channel(name)` when
//   the channel only carries postgres_changes: same `.on(...)` / `.subscribe()`,
//   and `client.removeChannel(ch)` still works (it calls unsubscribe/teardown).
//   Callbacks get the same payload shape: { eventType, new, old, table, ... }.
// - If the private topic is refused (the migration is not applied yet, or
//   topic auth fails) that topic falls back to a plain postgres_changes channel,
//   so a screen never goes quiet. Once every topic joins, nothing polls.
// - realtimeIdle.js replays missed rows for these bindings too (`liveBindings`).

const REFUSED = new Set(['CHANNEL_ERROR', 'TIMED_OUT']);

// "salesman_id=eq.<uuid>" -> { column, value }; no filter -> { column: null };
// anything that is not `eq` -> null (no topic can carry it).
export function parseLiveFilter(filter) {
  if (!filter) return { column: null, value: null };
  const m = /^([a-z_][a-z0-9_]*)=eq\.(.+)$/i.exec(String(filter));
  return m ? { column: m[1], value: m[2] } : null;
}

// The topic the database broadcasts a table + filter on (see rt_notify).
export function liveTopic(table, filter) {
  const f = parseLiveFilter(filter);
  if (!f || !table) return null;
  return f.column ? `rt:${table}:${f.column}:${f.value}` : `rt:${table}:all`;
}

// Does a binding want this operation? '*' hears everything.
export function wantsOp(bindingEvent, op) {
  const ev = String(bindingEvent || '*').toUpperCase();
  return ev === '*' || ev === String(op || '').toUpperCase();
}

// Every live binding, for realtimeIdle's replay: { client, table, filter, event, callback }.
const registry = new Set();
export function liveBindings(client) {
  return [...registry].filter((b) => b.client === client);
}

// One real channel per client + topic, shared by every screen listening to it
// (supabase-js allows one channel per topic, and two screens often watch the
// same rows: the nav badge and the inbox).
const shared = new WeakMap(); // client -> Map(topic -> entry)

function topicsOf(client) {
  if (!shared.has(client)) shared.set(client, new Map());
  return shared.get(client);
}

async function deliver(client, entry, msg) {
  const op = String(msg?.op || '').toUpperCase();
  const id = msg?.id;
  if (!op || id == null) return;
  const hearers = [...entry.bindings].filter((b) => wantsOp(b.event, op));
  if (!hearers.length) return;
  const base = { schema: 'public', table: entry.table, commit_timestamp: new Date().toISOString(), eventType: op, errors: null };
  if (op === 'DELETE') {
    hearers.forEach((b) => { try { b.callback({ ...base, new: {}, old: { id } }); } catch (e) { console.error('liveChannel:', e); } });
    return;
  }
  // Re-read through RLS: a row this viewer may not see comes back empty and is
  // dropped, the same as postgres_changes never sending it.
  const { data, error } = await client.from(entry.table).select('*').eq(msg.key || 'id', id).limit(1);
  const row = !error && Array.isArray(data) ? data[0] : null;
  if (!row) return;
  hearers.forEach((b) => { try { b.callback({ ...base, new: row, old: { id: row.id ?? id } }); } catch (e) { console.error('liveChannel:', e); } });
}

// The fallback: today's postgres_changes for this topic's bindings.
function startLegacy(client, entry) {
  if (entry.legacy) return;
  console.warn(`liveChannel: ${entry.topic} refused, using postgres_changes`);
  let ch = client.channel(`legacy:${entry.topic}`);
  ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: entry.table, ...(entry.filter ? { filter: entry.filter } : {}) },
    (payload) => {
      [...entry.bindings].forEach((b) => {
        if (!wantsOp(b.event, payload.eventType)) return;
        try { b.callback(payload); } catch (e) { console.error('liveChannel:', e); }
      });
    });
  entry.legacy = ch.subscribe();
}

function attach(client, topic, binding) {
  const map = topicsOf(client);
  let entry = map.get(topic);
  if (!entry) {
    entry = { topic, table: binding.table, filter: binding.filter, bindings: new Set(), channel: null, legacy: null, status: null, waiters: new Set() };
    map.set(topic, entry);
    const e = entry;
    e.channel = client.channel(topic, { config: { private: true } })
      .on('broadcast', { event: 'change' }, ({ payload }) => { deliver(client, e, payload); })
      .subscribe((status) => {
        e.status = status;
        if (REFUSED.has(status) && !e.legacy) {
          // Stop the private channel retrying (it would until the next reload)
          // and hand its bindings to postgres_changes.
          const dead = e.channel;
          e.channel = null;
          if (dead) client.removeChannel(dead);
          startLegacy(client, e);
        }
        e.waiters.forEach((fn) => fn(status));
      });
  }
  entry.bindings.add(binding);
  return entry;
}

function detach(client, topic, binding) {
  const map = topicsOf(client);
  const entry = map.get(topic);
  if (!entry) return;
  entry.bindings.delete(binding);
  if (entry.bindings.size) return;
  map.delete(topic);
  if (entry.channel) client.removeChannel(entry.channel);
  if (entry.legacy) client.removeChannel(entry.legacy);
}

class LiveChannel {
  constructor(client, name) {
    this.client = client;
    this.topic = `live:${name}`; // what logs and removeChannel see; never joined itself
    this.pending = [];
    this.attached = [];
    this.waiters = [];
  }

  on(type, spec, callback) {
    if (type !== 'postgres_changes') throw new Error(`liveChannel carries postgres_changes only, got ${type}`);
    this.pending.push({ client: this.client, table: spec?.table, filter: spec?.filter || null, event: spec?.event || '*', callback });
    return this;
  }

  subscribe(statusCallback) {
    const bindings = this.pending;
    this.pending = [];
    const entries = [];
    bindings.forEach((b) => {
      const topic = liveTopic(b.table, b.filter);
      if (!topic) { console.error('liveChannel: no topic for', b.table, b.filter); return; }
      registry.add(b);
      entries.push(attach(this.client, topic, b));
      this.attached.push([topic, b]);
    });
    if (statusCallback) {
      // SUBSCRIBED once, when every topic has answered (joined, or fell back).
      const done = new Set();
      let fired = false;
      const settle = () => {
        if (fired || done.size < entries.length) return;
        fired = true;
        statusCallback('SUBSCRIBED');
      };
      entries.forEach((entry) => {
        if (entry.status === 'SUBSCRIBED' || REFUSED.has(entry.status)) { done.add(entry); return; }
        const fn = (status) => {
          if (status !== 'SUBSCRIBED' && !REFUSED.has(status)) return;
          done.add(entry);
          entry.waiters.delete(fn);
          settle();
        };
        entry.waiters.add(fn);
        this.waiters.push([entry, fn]);
      });
      settle();
    }
    return this;
  }

  async unsubscribe() {
    this.waiters.forEach(([entry, fn]) => entry.waiters.delete(fn));
    this.waiters = [];
    this.attached.forEach(([topic, b]) => { registry.delete(b); detach(this.client, topic, b); });
    this.attached = [];
    return 'ok';
  }

  teardown() {}
}

export function liveChannel(client, name) {
  return new LiveChannel(client, name);
}

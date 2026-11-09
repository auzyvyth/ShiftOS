// IO-6: hidden-tab realtime pause + replay. Run: npm run test:realtimeidle
import { parseFilter, replayEvent, timeColumnFor, KNOWN_TIME_COLUMNS, _resetTimeColumnCache } from '../src/lib/realtimeIdle.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

is('filter: eq', parseFilter('salesman_id=eq.abc-123'), { column: 'salesman_id', value: 'abc-123' });
is('filter: none', parseFilter(undefined), { column: null, value: null });
is('filter: other op is not replayed', parseFilter('id=in.(1,2)'), null);

const since = Date.parse('2026-10-22T01:00:00Z');
const fresh = { created_at: '2026-10-22T01:05:00Z' };
const old = { created_at: '2026-10-20T01:00:00Z' };
is('event: new row is an INSERT', replayEvent(fresh, since, '*'), 'INSERT');
is('event: old row changed is an UPDATE', replayEvent(old, since, '*'), 'UPDATE');
is('event: INSERT listener skips updates', replayEvent(old, since, 'INSERT'), null);
is('event: UPDATE listener skips inserts', replayEvent(fresh, since, 'UPDATE'), null);
is('event: no created_at is an UPDATE', replayEvent({}, since, 'UPDATE'), 'UPDATE');
is('event: lower-case event filter', replayEvent(fresh, since, 'insert'), 'INSERT');

// Time column: known tables never probe; unknown ones probe once, then cached.
let probes = [];
const fake = (ok) => ({ from: (t) => ({ select: (c) => ({ limit: async () => { probes.push(`${t}.${c}`); return { error: ok.includes(c) ? null : { message: 'no' } }; } }) }) });
_resetTimeColumnCache();
is('col: lead_activities', await timeColumnFor(fake([]), 'lead_activities'), 'created_at');
is('col: dealer_notifications', await timeColumnFor(fake([]), 'dealer_notifications'), 'created_at');
is('col: chat_threads', await timeColumnFor(fake([]), 'chat_threads'), 'last_message_at');
is('col: leads', await timeColumnFor(fake([]), 'leads'), 'updated_at');
is('col: known tables send no probe query', probes, []);
is('col: unknown table probes in order', await timeColumnFor(fake(['created_at']), 'mystery'), 'created_at');
is('col: probe list', probes, ['mystery.updated_at', 'mystery.last_message_at', 'mystery.created_at']);
probes = [];
await timeColumnFor(fake(['created_at']), 'mystery');
is('col: remembered, no second probe', probes, []);
is('col: unknown with no column caches null', [await timeColumnFor(fake([]), 'ghost'), await timeColumnFor(fake([]), 'ghost')], [null, null]);
is('col: map is complete for listener tables', ['appointments','car_listings','chat_messages','chat_threads','dealer_notifications','lead_activities','leads','profiles','salesman_notifications','stock_units','whatsapp_enquiries'].every((t) => KNOWN_TIME_COLUMNS[t]), true);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

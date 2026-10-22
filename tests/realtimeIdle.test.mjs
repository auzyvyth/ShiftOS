// IO-6: hidden-tab realtime pause + replay. Run: npm run test:realtimeidle
import { parseFilter, replayEvent } from '../src/lib/realtimeIdle.js';

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

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

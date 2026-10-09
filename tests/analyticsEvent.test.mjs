// ANALYTICS-SPOOF: the /api/track shape check. Run: npm run test:analytics
import assert from 'node:assert/strict';
import { cleanEvent } from '../lib/analyticsEvent.js';

const SID = '0b8e6f2a-3c1d-4e5f-8a9b-0c1d2e3f4a5b';
const CAR = '11111111-2222-4333-8444-555555555555';
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('a normal car view passes', () => {
  const r = cleanEvent({ event_type: 'car_view', session_id: SID, car_id: CAR, car_name: 'Myvi', page_path: '/showroom/x', salesman_slug: 'ali-cars' });
  assert.equal(r.event_type, 'car_view');
  assert.equal(r.car_id, CAR);
  assert.equal(r.salesman_slug, 'ali-cars');
});
t('unknown event type is dropped', () => assert.equal(cleanEvent({ event_type: 'drop_table', session_id: SID }), null));
t('missing or invented session id is dropped', () => {
  assert.equal(cleanEvent({ event_type: 'page_view' }), null);
  assert.equal(cleanEvent({ event_type: 'page_view', session_id: 'abc' }), null);
});
t('non-object bodies are dropped', () => {
  for (const b of [null, 'x', 42, [], undefined]) assert.equal(cleanEvent(b), null);
});
t('bad ids and slugs become null, not errors', () => {
  const r = cleanEvent({ event_type: 'page_view', session_id: SID, car_id: 'nope', dealer_id: '1 or 1=1', salesman_slug: '../admin' });
  assert.equal(r.car_id, null); assert.equal(r.dealer_id, null); assert.equal(r.salesman_slug, null);
});
t('page_path must be a path; long text is cut', () => {
  assert.equal(cleanEvent({ event_type: 'page_view', session_id: SID, page_path: 'https://evil' }).page_path, null);
  assert.equal(cleanEvent({ event_type: 'page_view', session_id: SID, car_name: 'x'.repeat(999) }).car_name.length, 120);
});
t('time_spent must be a sane whole number', () => {
  assert.equal(cleanEvent({ event_type: 'page_exit', session_id: SID, time_spent: 42 }).time_spent, 42);
  for (const v of [-1, 1.5, 1e9, 'x']) assert.equal(cleanEvent({ event_type: 'page_exit', session_id: SID, time_spent: v }).time_spent, null);
});
t('oversized metadata is dropped, small metadata kept', () => {
  assert.deepEqual(cleanEvent({ event_type: 'share', session_id: SID, metadata: { channel: 'tiktok' } }).metadata, { channel: 'tiktok' });
  assert.equal(cleanEvent({ event_type: 'share', session_id: SID, metadata: { a: 'x'.repeat(3000) } }).metadata, null);
});
t('no extra columns pass through', () => {
  const r = cleanEvent({ event_type: 'page_view', session_id: SID, id: CAR, created_at: '2000-01-01' });
  assert.equal('id' in r, false); assert.equal('created_at' in r, false);
});
console.log(`\n${n} passed`);

// npm run test:searchtrack
import assert from 'node:assert/strict';
import { cleanSearchText, activeFilterKeys, searchKey } from '../src/utils/searchTracking.js';
import { cleanEvent } from '../lib/analyticsEvent.js';

const SID = '0b8e6f2a-3c1d-4e5f-8a9b-0c1d2e3f4a5b';
assert.equal(cleanSearchText('  Alphard   2019 '), 'alphard 2019');
assert.equal(cleanSearchText('0123456789'), null);
assert.equal(cleanSearchText('call 012-345 6789'), null);
assert.equal(cleanSearchText('a@b.com'), null);
assert.equal(cleanSearchText('https://x.my'), null);
assert.equal(cleanSearchText(''), null);
assert.equal(cleanSearchText('x'.repeat(200)).length, 60);
assert.deepEqual(activeFilterKeys({ q: '', brand: 'honda', state: 'selangor', hot: false }), ['brand', 'state']);
assert.equal(searchKey('m', { q: 'a' }, 'newest'), searchKey('m', { q: 'a' }, 'newest'));
assert.notEqual(searchKey('m', { q: 'a' }, 'newest'), searchKey('m', { q: 'b' }, 'newest'));
for (const t of ['search_run', 'listing_impressions', 'signin_prompt', 'signin_done', 'car_saved']) {
  assert.equal(cleanEvent({ event_type: t, session_id: SID, metadata: { n: 3 } }).event_type, t);
}
console.log('searchTracking ok');

import { summariseSearches } from '../src/utils/searchTracking.js';
const ev = (m) => ({ event_type: 'search_run', metadata: m });
const s = summariseSearches([
  ev({ q: 'alphard', results: 0 }), ev({ q: 'alphard', results: 0 }), ev({ q: 'myvi', results: 4 }),
  ev({ filters: ['brand', 'maxPrice'], results: 2 }), { event_type: 'page_view' },
]);
assert.equal(s.total, 4); assert.equal(s.noMatch, 2);
assert.deepEqual(s.top[0], { label: 'alphard', count: 2, noMatch: 2 });
assert.equal(s.top.length, 3);
assert.deepEqual(summariseSearches(null), { total: 0, noMatch: 0, top: [] });
console.log('summariseSearches ok');

assert.ok(s.top.some((r) => r.label === 'brand + max price'));

// Guards the rules in src/utils/panelCache.js that decide what a panel is
// allowed to paint BEFORE auth has resolved. Getting these wrong is not a
// perf regression — it shows one person's pipeline to another, or lets a
// suspended account into a panel it should never reach.

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] ?? null,
};
// Object.keys(localStorage) is what clearPanelDataCache/hasStoredSession walk.
// The shim above exposes methods, not the entries, so back it with a Proxy that
// enumerates the stored keys the way a real Storage does.
globalThis.localStorage = new Proxy(globalThis.localStorage, {
  ownKeys: () => Object.keys(store),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const {
  seedPanelCache, writeCache, rememberPanelUid, clearPanelDataCache,
  redactLeadsForCache, redactProfileForCache,
} = await import('../src/utils/panelCache.js');

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (got === want) { pass++; console.log('ok  ', name); }
  else { fail++; console.log('FAIL', name, '- got', JSON.stringify(got), 'want', JSON.stringify(want)); }
};

const reset = () => { store = {}; };
const signedIn = () => { store['sb-abc-auth-token'] = '{"access_token":"x"}'; };
const okProfile = { id: 'u1', role: 'salesman', account_status: 'active' };

// ── rule 3: no session on this device, no cached paint ──────────────────────
reset();
rememberPanelUid('slite', 'u1');
writeCache('slite_profile_u1', okProfile);
writeCache('slite_leads_u1', [{ id: 'l1' }]);
is('signed out: no profile seed', seedPanelCache('slite').profile, null);
is('signed out: no leads seed', seedPanelCache('slite').leads, null);

signedIn();
is('signed in: profile seeds', seedPanelCache('slite').profile?.id, 'u1');
is('signed in: leads seed', seedPanelCache('slite').leads?.length, 1);

// ── a panel only ever reads its own namespace ───────────────────────────────
is('premium does not read lite\'s cache', seedPanelCache('sp').profile, null);

// ── blocked accounts get no seed (they must wait for the fresh profile) ─────
const blocked = [
  ['pending approval', { account_status: 'pending' }],
  ['scheduled deletion', { account_status: 'deleted' }],
  ['suspended', { is_active: false }],
  ['awaiting payment', { payment_status: 'pending' }],
  ['half-onboarded', { onboarding_complete: false }],
  ['expired trial', { subscription_status: 'trial', trial_ends_at: new Date(Date.now() - 864e5).toISOString() }],
];
for (const [name, patch] of blocked) {
  reset(); signedIn();
  rememberPanelUid('sp', 'u1');
  writeCache('sp_profile_u1', { ...okProfile, ...patch });
  writeCache('sp_listings_u1', [{ id: 'c1' }]);
  is(`no seed for ${name}`, seedPanelCache('sp').profile, null);
  is(`no data seed for ${name}`, seedPanelCache('sp').listings.length, 0);
}

// A trial still running is not blocked.
reset(); signedIn();
rememberPanelUid('sp', 'u1');
writeCache('sp_profile_u1', { ...okProfile, subscription_status: 'trial', trial_ends_at: new Date(Date.now() + 864e5).toISOString() });
is('live trial still seeds', seedPanelCache('sp').profile?.id, 'u1');

// ── TTL ─────────────────────────────────────────────────────────────────────
reset(); signedIn();
rememberPanelUid('slite', 'u1');
// The seed window is 7 days (PANEL_SEED_TTL): an owner opening the app the
// next morning must still paint from cache, not sit through a cold start.
localStorage.setItem('slite_profile_u1', JSON.stringify({ ts: Date.now() - 20 * 60 * 60 * 1000, data: okProfile }));
is('an overnight profile still seeds', seedPanelCache('slite').profile?.id, 'u1');
localStorage.setItem('slite_profile_u1', JSON.stringify({ ts: Date.now() - 8 * 24 * 60 * 60 * 1000, data: okProfile }));
is('an 8-day-old profile is past the seed window', seedPanelCache('slite').profile, null);

// ── redaction: identity material never reaches disk ─────────────────────────
const lead = { id: 'l1', buyer_name: 'A', buyer_ic: '900101-10-1234', buyer_address: '1 Jalan X', phone: '60123456789' };
const [redacted] = redactLeadsForCache([lead]);
is('lead IC stripped', 'buyer_ic' in redacted, false);
is('lead address stripped', 'buyer_address' in redacted, false);
is('lead phone kept (the card renders it)', redacted.phone, '60123456789');

const rp = redactProfileForCache({ ...okProfile, ic_hash: 'h', ic_last4: '1234' });
// ic_hash is kept as a plain boolean (the IC gate branches on it), never the hash.
is('profile ic_hash reduced to a boolean', rp.ic_hash, true);
is('profile ic_last4 stripped', 'ic_last4' in rp, false);
is('profile role kept (gates read it)', rp.role, 'salesman');

// ── logout purges every panel's data, keeps preferences ─────────────────────
reset(); signedIn();
for (const p of ['slite', 'sp', 'spanel', 'dash']) {
  rememberPanelUid(p, 'u1');
  writeCache(`${p}_profile_u1`, okProfile);
  writeCache(`${p}_leads_u1`, [{ id: 'l1' }]);
  writeCache(`${p}_listings_u1`, [{ id: 'c1' }]);
}
writeCache('cf:v1:snapshot:u1', { totalSold: 3 });
// usePersistentState tab caches (customers, leads board, handover, team...)
writeCache('cf:v1:ps:customers:all:u1', [{ id: 'k1', name: 'A' }]);
localStorage.setItem('slite_goal_u1', '{"target":5}');
localStorage.setItem('sp_tour_seen_u1', '1');
clearPanelDataCache();
is('logout clears lite', seedPanelCache('slite').profile, null);
is('logout clears premium', seedPanelCache('sp').profile, null);
is('logout clears the linked panel', seedPanelCache('spanel').profile, null);
is('logout clears the dealer dashboard', seedPanelCache('dash').profile, null);
is('logout clears the snapshot', localStorage.getItem('cf:v1:snapshot:u1'), null);
is('logout clears persisted tab data', localStorage.getItem('cf:v1:ps:customers:all:u1'), null);
is('logout keeps the goal preference', localStorage.getItem('slite_goal_u1'), '{"target":5}');
is('logout keeps tour-seen', localStorage.getItem('sp_tour_seen_u1'), '1');

console.log(`\npanelCache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

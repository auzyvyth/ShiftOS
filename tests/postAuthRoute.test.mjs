// Guards the ONE post-sign-in router (src/utils/postAuthRoute.js). Every sign-in
// path (password, Google, magic link, email confirm, reset) lands through it, so
// a wrong answer here puts someone on the wrong panel from every door at once.
// The source uses extensionless imports, so bundle it with esbuild first.
import { build } from 'esbuild';

const out = await build({
  entryPoints: ['src/utils/postAuthRoute.js'],
  bundle: true, write: false, format: 'esm', platform: 'node',
  // The router hooks in useRoleRedirect are never called here; stub the package.
  plugins: [{
    name: 'stub-router',
    setup(b) {
      b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'rrd', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useNavigate = () => {}; export const useLocation = () => ({});' }));
    },
  }],
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { resolvePostAuthRoute } = mod;

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `- got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const setHost = (h) => { globalThis.window = { location: { hostname: h } }; };
const session = { access_token: 'AT', refresh_token: 'RT' };
const done = { onboarding_complete: true, is_active: true };
const future = new Date(Date.now() + 864e6).toISOString();
const r = (p, o = {}) => resolvePostAuthRoute({ ...done, ...p }, { session, ...o });

setHost('shift-abc.vercel.app'); // preview: never leave this host
is('premium (paid) -> premium, not via lite',
   r({ role: 'salesman', plan: 'salesman_full', payment_status: 'received' }), { url: '/salesman-premium', hard: false });
is('premium (inside paid window) -> premium',
   r({ role: 'salesman', plan: 'salesman_full', plan_expires_at: future }), { url: '/salesman-premium', hard: false });
is('plan full but unpaid -> lite (same rule the Premium panel enforces)',
   r({ role: 'salesman', plan: 'salesman_full', payment_status: 'pending' }), { url: '/salesman-lite', hard: false });
is('lite -> lite', r({ role: 'salesman', plan: 'salesman_lite' }), { url: '/salesman-lite', hard: false });
is('linked salesman -> /salesman', r({ role: 'salesman', dealer_id: 'd1', plan: 'salesman_full' }), { url: '/salesman', hard: false });
for (const [role, url] of [['manager', '/manager'], ['admin', '/admin'], ['accountant', '/accountant'], ['fi_officer', '/fi']]) {
  is(`${role} -> ${url} directly, never /salesman first`, r({ role }), { url, hard: false });
}
is('superadmin -> /platform', r({ role: 'superadmin' }), { url: '/platform', hard: false });
is('buyer -> return-to page', r({ role: 'buyer' }, { buyerHome: '/find-me/9' }), { url: '/find-me/9', hard: false });
is('unknown role -> /account', r({ role: 'mystery' }), { url: '/account', hard: false });
is('dealer mid-signup resumes dealer wizard, not /plans',
   r({ role: 'dealer', onboarding_complete: false, full_name: 'Ali' }), { url: '/dealer-onboarding', hard: false });
is('bare dealer stub -> plan chooser', r({ role: 'dealer', onboarding_complete: false }), { url: '/choose-plan', hard: false });
is('premium rep mid-signup keeps premium tier',
   r({ role: 'salesman', plan: 'salesman_full', onboarding_complete: false }), { url: '/salesman-onboarding/premium', hard: false });
is('premium hint from signup metadata wins over lite plan',
   r({ role: 'salesman', plan: 'salesman_lite', onboarding_complete: false }, { premiumHint: true }), { url: '/salesman-onboarding/premium', hard: false });
is('dealer with subdomain on a preview stays on the preview',
   r({ role: 'dealer', subdomain: 'acme' }), { url: '/dashboard', hard: false });

setHost('xdrive.my');
is('prod: dealer subdomain gets the session handoff',
   r({ role: 'dealer', subdomain: 'acme' }), { url: 'https://acme.xdrive.my/dashboard#_at=AT&_rt=RT', hard: true });
is('prod: premium rep lands on premium on the apex with the session',
   r({ role: 'salesman', plan: 'salesman_full', payment_status: 'received' }), { url: 'https://xdrive.my/salesman-premium#_at=AT&_rt=RT', hard: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

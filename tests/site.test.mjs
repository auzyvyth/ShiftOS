// Guards src/config/site.js, the ONE place the domain lives (BRAND-1). These
// helpers decide "is this our site?" for sign-in, captcha reporting and dealer
// storefronts, so a wrong answer breaks login only in production.
import { ROOT_DOMAIN, SITE_URL, OWN_DOMAINS, isOwnHost, storefrontSubdomain, isOwnUrl } from '../src/config/site.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `- got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

const D = ROOT_DOMAIN;
is('SITE_URL is https + root', SITE_URL, `https://${D}`);
is('root domain listed first', OWN_DOMAINS[0], D);

is('own: apex', isOwnHost(D), true);
is('own: www', isOwnHost(`www.${D}`), true);
is('own: dealer subdomain', isOwnHost(`fast.${D}`), true);
is('own: case-insensitive', isOwnHost(D.toUpperCase()), true);
is('not own: localhost', isOwnHost('localhost'), false);
is('not own: vercel preview', isOwnHost('shiftos-git-staging.vercel.app'), false);
is('not own: lookalike suffix', isOwnHost(`evil${D}`), false);
is('not own: domain as a label', isOwnHost(`${D}.evil.com`), false);
is('not own: empty', isOwnHost(''), false);

is('storefront: apex is marketplace', storefrontSubdomain(D), null);
is('storefront: www is marketplace', storefrontSubdomain(`www.${D}`), null);
is('storefront: dealer label', storefrontSubdomain(`fast.${D}`), 'fast');
is('storefront: nested name rejected', storefrontSubdomain(`a.b.${D}`), null);
is('storefront: foreign host', storefrontSubdomain('fast.example.com'), null);
is('storefront: localhost', storefrontSubdomain('localhost'), null);

is('url: own page', isOwnUrl(`https://${D}/showroom`), true);
is('url: dealer page', isOwnUrl(`https://fast.${D}/cars/x`), true);
is('url: google', isOwnUrl('https://www.google.com/'), false);
is('url: empty', isOwnUrl(''), false);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

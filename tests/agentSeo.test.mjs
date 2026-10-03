// Agent page title/description + settings-preview warnings.
// Run: npm run test:agentseo
import { agentPageTitle, agentPageDescription, agentSeoIssues, DESC_LIMIT } from '../src/utils/agentSeo.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const keys = (p) => agentSeoIssues(p).map((i) => i.key);

is('title trims stray spaces', agentPageTitle({ full_name: ' Ali ', city: 'Klang ', state: ' Selangor' }), 'Ali — Car Agent in Klang, Selangor | XDrive');
is('title without location', agentPageTitle({ full_name: 'Ali' }), 'Ali — Car Agent | XDrive');
is('title falls back to slug', agentPageTitle({ slug: 'ali88' }), 'ali88 — Car Agent | XDrive');
is('bio collapses whitespace', agentPageDescription({ bio: 'Recon\n\nAlphard  Penang' }), 'Recon Alphard Penang');
const long = agentPageDescription({ bio: 'x'.repeat(300) });
is('long bio capped', long.length, DESC_LIMIT);
is('dealer about_text never used', agentPageDescription({ full_name: 'Ali', about_text: 'DEALER' }).includes('DEALER'), false);
is('no-bio sentence counts cars', agentPageDescription({ full_name: 'Ali' }, 1), 'Ali is a car sales agent on XDrive. Browse 1 car for sale and message them directly.');

is('clean profile has no issues', keys({ full_name: 'Ali Hassan', city: 'Klang', state: 'Selangor', bio: 'Recon Alphard' }), []);
is('lowercase name flagged', keys({ full_name: 'diara', city: 'Klang', state: 'Selangor', bio: 'x' }), ['name']);
is('caps name flagged', keys({ full_name: 'AISY AZIM', city: 'Klang', state: 'Selangor', bio: 'x' }), ['name']);
is('missing bio + location flagged', keys({ full_name: 'Ali' }), ['bio', 'location']);
is('long title flagged', keys({ full_name: 'Airy Motors', city: 'Wilayah persekutuan', state: 'Kuala Lumpur', bio: 'x' }), ['title']);

console.log(`agentSeo: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

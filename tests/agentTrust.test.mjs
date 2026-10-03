// Agent page trust signals: wording + thresholds.
// Run: npm run test:agenttrust
import { replyTimeLabel, docsCheckedLine, termsLines, soldMonthLabel, REPLY_MIN_SAMPLES } from '../src/utils/agentTrust.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

is('reply: too few samples hides', replyTimeLabel({ median_minutes: 2, samples: REPLY_MIN_SAMPLES - 1 }), null);
is('reply: 2 min', replyTimeLabel({ median_minutes: 2, samples: 17 }), 'Usually replies within 5 minutes');
is('reply: 6 min rounds up', replyTimeLabel({ median_minutes: 6, samples: 9 }), 'Usually replies within 15 minutes');
is('reply: 50 min', replyTimeLabel({ median_minutes: 50, samples: 9 }), 'Usually replies within an hour');
is('reply: 3 h', replyTimeLabel({ median_minutes: 180, samples: 9 }), 'Usually replies within a few hours');
is('reply: a full day is not a selling point', replyTimeLabel({ median_minutes: 1440, samples: 9 }), null);
is('reply: missing function', replyTimeLabel(null), null);

is('docs: none checked says nothing', docsCheckedLine([{ docs_verified: false }]), null);
is('docs: all', docsCheckedLine([{ docs_verified: true }, { docs_verified: true }]), 'Documents checked by XDrive on all 2 cars');
is('docs: one car', docsCheckedLine([{ docs_verified: true }]), 'Documents checked by XDrive on this car');
is('docs: some', docsCheckedLine([{ docs_verified: true }, {}, {}]), 'Documents checked by XDrive on 1 of 3 cars');

is('terms: nothing set', termsLines({ handles_roadtax_insurance: true }), []);
is('terms: real agent', termsLines({ deposit_policy: 'non_refundable', processing_fee: 300 }).map((t) => t.text), ['Non-refundable once paid.', 'RM 300']);
is('terms: zero fee', termsLines({ processing_fee: 0 }).map((t) => t.text), ['None charged']);
is('terms: unknown policy ignored', termsLines({ deposit_policy: 'whatever' }), []);
is('terms: rti only when false', termsLines({ handles_roadtax_insurance: false }).map((t) => t.key), ['rti']);

is('month label', soldMonthLabel('2026-09-01'), 'Sep 2026');
is('month label bad', soldMonthLabel(null), '');

console.log(`agentTrust: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

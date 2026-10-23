// Car page reading progress (REVISIT-1). Run: npm run test:revisit
import { scrollProgress, mergeProgress, liveEntries, barWidth, PROGRESS_MAX, PROGRESS_TTL } from '../src/utils/viewProgress.js';

let pass = 0, fail = 0;
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; console.log(`FAIL ${name} - got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

// scroll depth: first screen = 0, end marker reaching the bottom of the screen = 1
is('bounce is 0', scrollProgress(0, 800, 2800), 0);
is('halfway', scrollProgress(1000, 800, 2800), 0.5);
is('reached the end', scrollProgress(2000, 800, 2800), 1);
is('last few % reads as done', scrollProgress(1920, 800, 2800), 1);
is('short page is fully seen', scrollProgress(0, 800, 600), 1);
is('overscroll clamps', scrollProgress(5000, 800, 2800), 1);

const now = 1_000_000_000_000;
let list = mergeProgress([], 'a', undefined, now);
is('open records 0', list, [{ id: 'a', p: 0, t: now }]);
list = mergeProgress(list, 'a', 0.6, now + 1);
list = mergeProgress(list, 'b', 0.2, now + 2);
is('newest first', list.map((e) => e.id), ['b', 'a']);
list = mergeProgress(list, 'a', 0.3, now + 3);
is('a second look never shrinks the bar', list[0], { id: 'a', p: 0.6, t: now + 3 });

is('expired cars drop', liveEntries([{ id: 'x', p: 1, t: now - PROGRESS_TTL - 1 }], now), []);
is('garbage is ignored', liveEntries([null, { id: 5, t: now }, { id: 'y' }], now), []);
is('not an array', liveEntries('nope', now), []);

let many = [];
for (let i = 0; i < PROGRESS_MAX + 5; i++) many = mergeProgress(many, `c${i}`, 0.5, now + i);
is('capped', many.length, PROGRESS_MAX);
is('oldest dropped', many.some((e) => e.id === 'c0'), false);

is('never opened draws nothing', barWidth(undefined), 0);
is('a bounce still draws a sliver', barWidth({ p: 0 }) > 0, true);
is('half', barWidth({ p: 0.5 }), 0.5);

console.log(`viewProgress: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

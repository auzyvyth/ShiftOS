// Run: npm run test:followup
//
// Guards the ONE definition of "this lead needs a call"
// (src/lib/leadsHelpers.js). Four surfaces used to answer this question four
// different ways; the bug that mattered was not the disagreement but the
// COLUMN: every pipeline copy measured inactivity from `updated_at`, which
// moves when a rep edits a note, links a car or re-scores a lead. None of
// those reached the buyer. Measured on the live pipeline the day this landed,
// 16 of 68 open leads had been edited with no contact ever logged.
//
// The first block is the regression that matters. If someone "optimises" this
// helper back onto updated_at, that test is what fails.
import {
  followUpStatus, isLeadStale, compareFollowUp, followUpHoursFor, FOLLOW_UP_REASON,
} from '../src/lib/leadsHelpers.js';

let pass = 0;
const fails = [];
function eq(actual, expected, label) {
  if (actual === expected) pass++;
  else fails.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`);
}
function ok(cond, label) { eq(Boolean(cond), true, label); }

const NOW = Date.parse('2026-09-11T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const hoursAhead = (h) => new Date(NOW + h * 3600000).toISOString();

// --- THE REGRESSION: a note edit must not silence the alarm ---------------
// `contacted` has a 24h window. This buyer was last actually contacted 40h
// ago, but someone opened the lead and typed a note a minute ago, so
// updated_at is fresh. The old rule called this "handled"; it is not.
{
  const lead = {
    stage: 'contacted',
    created_at: hoursAgo(200),
    last_contacted_at: hoursAgo(40),
    updated_at: hoursAgo(0.016),
  };
  const s = followUpStatus(lead, NOW);
  ok(s.due, 'a note edit does NOT clear a lead that has not been contacted in 40h');
  eq(s.reason, 'gone_quiet', 'and the reason is gone_quiet, not silence');
}

// The mirror: genuinely contacted inside the window is NOT due, even if
// nothing else about the row has been touched in weeks.
{
  const lead = {
    stage: 'contacted',
    created_at: hoursAgo(500),
    last_contacted_at: hoursAgo(2),
    updated_at: hoursAgo(500),
  };
  eq(followUpStatus(lead, NOW).due, false, 'contacted 2h ago is not due, stale updated_at notwithstanding');
}

// --- never contacted -------------------------------------------------------
{
  const fresh = { stage: 'new', created_at: hoursAgo(2), last_contacted_at: null };
  eq(followUpStatus(fresh, NOW).due, false, 'a new lead inside its 5h window is not due yet');

  const late = { stage: 'new', created_at: hoursAgo(9), last_contacted_at: null };
  const s = followUpStatus(late, NOW);
  ok(s.due, 'a new lead past its 5h window is due');
  eq(s.reason, 'never_contacted', 'never contacted outranks a generic quiet lead');
  eq(Math.round(s.overdueHours), 4, 'overdue is measured past the window, not since creation');
}

// --- an explicit reminder --------------------------------------------------
{
  // Contacted an hour ago, so the stage window is nowhere near up, but the rep
  // promised to call back at a time that has now passed.
  const lead = {
    stage: 'negotiating',
    created_at: hoursAgo(300),
    last_contacted_at: hoursAgo(1),
    follow_up_at: hoursAgo(3),
  };
  const s = followUpStatus(lead, NOW);
  ok(s.due, 'a lapsed reminder fires even when the stage window has not run out');
  eq(s.reason, 'reminder_due', 'and it is reported as the reminder, not as quiet');

  const future = { ...lead, follow_up_at: hoursAhead(5) };
  eq(followUpStatus(future, NOW).due, false, 'a reminder set for later does not fire early');
}

// A never-contacted lead with a lapsed reminder reports the worse of the two.
{
  const lead = {
    stage: 'contacted', created_at: hoursAgo(100),
    last_contacted_at: null, follow_up_at: hoursAgo(2),
  };
  eq(followUpStatus(lead, NOW).reason, 'never_contacted',
     'never contacted wins over a lapsed reminder on the same lead');
}

// --- per-stage windows are real -------------------------------------------
{
  eq(followUpHoursFor('new'), 5, 'new goes cold in hours');
  eq(followUpHoursFor('deposit_taken'), 72, 'a committed deal gets room');
  eq(followUpHoursFor('nonsense_stage'), 48, 'unknown stage falls back to 48h');

  const at30 = { created_at: hoursAgo(300), last_contacted_at: hoursAgo(30) };
  eq(followUpStatus({ ...at30, stage: 'contacted' }, NOW).due, true,
     '30h since contact IS due at the contacted stage (24h)');
  eq(followUpStatus({ ...at30, stage: 'deposit_taken' }, NOW).due, false,
     'the same 30h is NOT due at deposit_taken (72h)');
}

// --- terminal stages never nag --------------------------------------------
for (const stage of ['won', 'closed_won', 'lost', 'closed_lost']) {
  const lead = { stage, created_at: hoursAgo(9000), last_contacted_at: null, follow_up_at: hoursAgo(500) };
  eq(followUpStatus(lead, NOW).due, false, `a ${stage} lead is finished and never due`);
}

// --- ranking ---------------------------------------------------------------
{
  const never = { stage: 'new', created_at: hoursAgo(50), last_contacted_at: null };
  const reminder = { stage: 'negotiating', created_at: hoursAgo(50), last_contacted_at: hoursAgo(1), follow_up_at: hoursAgo(1) };
  const quiet = { stage: 'contacted', created_at: hoursAgo(300), last_contacted_at: hoursAgo(30) };

  const sorted = [quiet, reminder, never].sort((a, b) => compareFollowUp(a, b, NOW));
  eq(followUpStatus(sorted[0], NOW).reason, 'never_contacted', 'worst first: never contacted');
  eq(followUpStatus(sorted[1], NOW).reason, 'reminder_due', 'then the lapsed reminder');
  eq(followUpStatus(sorted[2], NOW).reason, 'gone_quiet', 'then the quiet one');

  // Same reason: the one that has been waiting longer goes first.
  const older = { stage: 'contacted', created_at: hoursAgo(900), last_contacted_at: hoursAgo(200) };
  const newer = { stage: 'contacted', created_at: hoursAgo(900), last_contacted_at: hoursAgo(30) };
  const pair = [newer, older].sort((a, b) => compareFollowUp(a, b, NOW));
  eq(pair[0].last_contacted_at, older.last_contacted_at, 'within a reason, most overdue first');

  eq(FOLLOW_UP_REASON.never_contacted.rank < FOLLOW_UP_REASON.reminder_due.rank, true,
     'the ranking matches thisWeek.js: never replied outranks a due reminder');
}

// --- the boolean wrapper still behaves ------------------------------------
{
  eq(isLeadStale(null, NOW), false, 'a missing lead is not stale');
  eq(isLeadStale({ stage: 'new', created_at: hoursAgo(1), last_contacted_at: null }, NOW), false,
     'wrapper agrees with followUpStatus (not due)');
  eq(isLeadStale({ stage: 'new', created_at: hoursAgo(40), last_contacted_at: null }, NOW), true,
     'wrapper agrees with followUpStatus (due)');
}

console.log(`\nfollowUp: ${pass} passed${fails.length ? `, ${fails.length} FAILED` : ''}`);
if (fails.length) { console.error('\n' + fails.join('\n\n')); process.exit(1); }

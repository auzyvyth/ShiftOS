// Words for the team health the database works out (TEAM-HEALTH, 2026-11-09).
// The RULES live in ONE place, the SQL function `_team_health`
// (supabase/migrations/20261110a_team_health.sql), used by both the dealer's
// Performance table (gm_salesman_scores) and the daily owner alert
// (notify_team_health). This file only turns its codes into words, so the
// screen and the alert can never disagree about who is inactive.

export const STATUS = {
  active:   { label: 'Active',          tone: 'good' },
  quiet:    { label: 'Quiet',           tone: 'warn' },
  inactive: { label: 'Inactive',        tone: 'bad' },
  never:    { label: 'Not started',     tone: 'bad' },
  new:      { label: 'New',             tone: 'neutral' },
};

// premiumLight pills: ONE grey fill for every status, the WORD carries the
// colour (no tinted background with a matching border). bd = bg on purpose.
export const TONE = {
  good:    { fg: '#047857', bg: '#f5f6f8', bd: '#f5f6f8' },
  warn:    { fg: '#4b5563', bg: '#f5f6f8', bd: '#f5f6f8' },
  bad:     { fg: '#b91c1c', bg: '#f5f6f8', bd: '#f5f6f8' },
  neutral: { fg: '#6b7280', bg: '#f5f6f8', bd: '#f5f6f8' },
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One short line per issue, quoting the real number behind it.
export function issueText(code, s) {
  switch (code) {
    case 'inactive':           return `No activity for ${s.days_quiet} days`;
    case 'never':              return 'Has not started using the app';
    case 'quiet':              return `Quiet for ${s.days_quiet} days`;
    case 'untouched':          return `${plural(s.untouched, 'lead', 'leads')} with no follow-up`;
    case 'slow_reply':         return `Replies slowly (about ${fmtMinutes(s.avg_response_min)})`;
    case 'low_follow_through': return `Followed up ${s.worked_30d} of ${s.leads_30d} new leads`;
    case 'no_sales':           return `No sale from ${s.leads_30d} leads this month`;
    default:                   return null;
  }
}

// Why there is no score, in the person's words. null = there is a score.
export function noScoreReason(s) {
  if (s.score != null) return null;
  if (s.status === 'inactive' || s.status === 'never') return STATUS[s.status].label;
  if (s.status === 'new') return 'Too new';
  if ((s.leads_30d ?? 0) < 3) return 'Under 3 leads';
  return null;
}

export function fmtMinutes(m) {
  if (m == null) return '—';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 48) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

// Rows the owner should look at first (the table header count).
export const needsAttention = (rows) => (rows || []).filter((s) => (s.issues || []).length > 0).length;

// What the owner can do about each issue. One short line, no promises.
export function issueAdvice(code) {
  switch (code) {
    case 'inactive':           return 'Ask if they are still selling. If not, move their leads to someone active.';
    case 'never':              return 'Check they received their login, or remove the account.';
    case 'quiet':              return 'A quick check-in now stops it becoming a lost week.';
    case 'untouched':          return 'Those buyers are waiting. Remind them, or reassign the leads.';
    case 'slow_reply':         return 'Buyers move on within hours. Push notifications on their phone help.';
    case 'low_follow_through': return 'New leads are coming in but not being contacted.';
    case 'no_sales':           return 'Plenty of leads, no closes yet. Worth a look at how they follow up.';
    default:                   return null;
  }
}

// The score's parts, in order, with what each is out of (the DB sends points).
export const SCORE_PARTS = [
  { key: 'conversion',     label: 'Leads turned into sales', max: 35 },
  { key: 'reply',          label: 'Reply speed',             max: 25 },
  { key: 'follow_through', label: 'Leads followed up',       max: 20 },
  { key: 'gross',          label: 'Profit per car',          max: 10 },
  { key: 'docs',           label: 'Loan documents complete', max: 10 },
];

export function lastActiveText(s) {
  if (!s.last_active_at) return 'No activity recorded yet';
  const d = s.days_quiet ?? 0;
  if (d === 0) return 'Active today';
  if (d === 1) return 'Last active yesterday';
  return `Last active ${d} days ago`;
}

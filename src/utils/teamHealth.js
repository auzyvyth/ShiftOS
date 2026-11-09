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

export const TONE = {
  good:    { fg: '#15803d', bg: '#f0fdf4', bd: '#bbf7d0' },
  warn:    { fg: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  bad:     { fg: '#b91c1c', bg: '#fef2f2', bd: '#fecaca' },
  neutral: { fg: '#4b5563', bg: '#f3f4f6', bd: '#e5e7eb' },
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
  if (m == null) return '-';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 48) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

// Rows the owner should look at first (the table header count).
export const needsAttention = (rows) => (rows || []).filter((s) => (s.issues || []).length > 0).length;

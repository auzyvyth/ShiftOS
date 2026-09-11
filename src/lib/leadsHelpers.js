// ─── Stage config ─────────────────────────────────────────────────────────────
import { Sparkles, Phone, Calendar, MessageSquare, DollarSign, Trophy, XCircle, Car } from 'lucide-react';

export const STAGE_ORDER = [
  'new', 'contacted', 'viewing_booked', 'test_drive', 'negotiating', 'deposit_taken', 'won', 'lost',
];

export const STAGE_CONFIG = {
  new:            { label: 'New',             icon: Sparkles,       color: 'text-indigo-600',  bg: '#eef2ff',  border: '#c7d2fe',  headerBorder: '#6366f1' },
  contacted:      { label: 'Contacted',       icon: Phone,          color: 'text-violet-600',  bg: '#f5f3ff',  border: '#ddd6fe',  headerBorder: '#7c3aed' },
  viewing_booked: { label: 'Viewing Booked',  icon: Calendar,       color: 'text-amber-600',   bg: '#fffbeb',  border: '#fde68a',  headerBorder: '#d97706' },
  negotiating:    { label: 'Negotiating',     icon: MessageSquare,  color: 'text-orange-600',  bg: '#fff7ed',  border: '#fed7aa',  headerBorder: '#ea580c' },
  deposit_taken:  { label: 'Deposit Taken',   icon: DollarSign,     color: 'text-teal-600',    bg: '#f0fdfa',  border: '#99f6e4',  headerBorder: '#0d9488' },
  won:            { label: 'Won',             icon: Trophy,         color: 'text-emerald-600', bg: '#ecfdf5',  border: '#a7f3d0',  headerBorder: '#059669' },
  lost:           { label: 'Lost',            icon: XCircle,        color: 'text-red-600',     bg: '#fef2f2',  border: '#fecaca',  headerBorder: '#dc2626' },
  // Legacy aliases kept so old DB data still renders
  test_drive:     { label: 'Test Drive',      icon: Car,            color: 'text-amber-600',   bg: '#fffbeb',  border: '#fde68a',  headerBorder: '#d97706' },
  closed_won:     { label: 'Closed Won',      icon: Trophy,         color: 'text-emerald-600', bg: '#ecfdf5',  border: '#a7f3d0',  headerBorder: '#059669' },
  closed_lost:    { label: 'Closed Lost',     icon: XCircle,        color: 'text-red-600',     bg: '#fef2f2',  border: '#fecaca',  headerBorder: '#dc2626' },
};

// Legacy stage values that may still exist on old rows — fold them onto the
// canonical STAGE_ORDER bucket so they don't silently disappear from the board.
const STAGE_ALIASES = { closed_won: 'won', closed_lost: 'lost' };
export function canonicalStage(stage) {
  return STAGE_ALIASES[stage] || stage;
}

// ─── Loss reasons ──────────────────────────────────────────────────────────────

export const LOST_REASONS = [
  'Too expensive',
  'Bought elsewhere',
  'No response',
  'Financing rejected',
  'Changed mind',
  'Wrong car',
  'Other',
];

// ─── WhatsApp templates ────────────────────────────────────────────────────────

export const WHATSAPP_TEMPLATES = [
  {
    label: 'First Contact',
    message: (lead, car) =>
      `Hi ${lead.buyer_name || 'there'}, I saw your enquiry about the ${car ? `${car.brand} ${car.model}` : 'car'}. Is it still available for viewing? We're based in ${car?.state || car?.city || 'our showroom'}. 😊`,
  },
  {
    label: 'Follow-up After Viewing',
    message: (lead, car) =>
      `Hi ${lead.buyer_name || 'there'}, just following up after your visit today for the ${car ? `${car.brand} ${car.model}` : 'car'}. Any questions I can help with?`,
  },
  {
    label: 'Price Drop Alert',
    message: (lead, car) =>
      `Hi ${lead.buyer_name || 'there'}, great news! The ${car ? `${car.brand} ${car.model}` : 'car'} you were interested in just had a price drop. Want to revisit? 🔥`,
  },
  {
    label: 'Financing Reminder',
    message: (lead, car) => {
      const monthly = car?.selling_price ? calcInstalment(car.selling_price) : null;
      return `Hi ${lead.buyer_name || 'there'}, I can help arrange financing for the ${car ? `${car.brand} ${car.model}` : 'car'}. Monthly est. from RM ${monthly ? monthly.toLocaleString() : '---'}. Interested?`;
    },
  },
  {
    label: 'Closing Push',
    message: (lead, car) =>
      `Hi ${lead.buyer_name || 'there'}, just checking if you're still considering the ${car ? `${car.brand} ${car.model}` : 'car'}? We have a few other buyers looking at it too. 👀`,
  },
];

// Editable (per-dealer) WhatsApp templates use placeholder strings instead of
// functions so owners can customise them from Settings. Supported placeholders:
//   {{name}} {{car}} {{brand}} {{model}} {{monthly}} {{location}}
export const WA_PLACEHOLDERS = [
  { token: '{{name}}',     desc: "Buyer's name" },
  { token: '{{car}}',      desc: 'Brand + model' },
  { token: '{{brand}}',    desc: 'Car brand' },
  { token: '{{model}}',    desc: 'Car model' },
  { token: '{{monthly}}',  desc: 'Est. monthly instalment' },
  { token: '{{location}}', desc: 'Showroom state/city' },
];

export const DEFAULT_WA_TEMPLATES = [
  { label: 'First Contact', message: "Hi {{name}}, I saw your enquiry about the {{car}}. Is it still available for viewing? We're based in {{location}}. 😊" },
  { label: 'Follow-up After Viewing', message: 'Hi {{name}}, just following up after your visit today for the {{car}}. Any questions I can help with?' },
  { label: 'Price Drop Alert', message: 'Hi {{name}}, great news! The {{car}} you were interested in just had a price drop. Want to revisit? 🔥' },
  { label: 'Financing Reminder', message: 'Hi {{name}}, I can help arrange financing for the {{car}}. Monthly est. from RM {{monthly}}. Interested?' },
  { label: 'Closing Push', message: "Hi {{name}}, just checking if you're still considering the {{car}}? We have a few other buyers looking at it too. 👀" },
];

export function renderWaTemplate(str, lead, car) {
  const monthly = car?.selling_price ? calcInstalment(car.selling_price) : null;
  const map = {
    '{{name}}':     lead?.buyer_name || 'there',
    '{{car}}':      car ? `${car.brand} ${car.model}` : 'car',
    '{{brand}}':    car?.brand || '',
    '{{model}}':    car?.model || '',
    '{{monthly}}':  monthly ? monthly.toLocaleString() : '---',
    '{{location}}': car?.state || car?.city || 'our showroom',
  };
  return String(str || '').replace(/\{\{\w+\}\}/g, (m) => (m in map ? map[m] : m));
}

// ─── Lead source config ────────────────────────────────────────────────────────

export const SOURCE_CONFIG = {
  drevo_enquiry: { label: 'XDrive Enquiry', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  enquiry:       { label: 'General Enquiry', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  walk_in:       { label: 'Walk-In',   bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  mudah:         { label: 'Mudah',     bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  carlist:       { label: 'Carlist',   bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  facebook:      { label: 'Facebook',  bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  tiktok:        { label: 'TikTok',    bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  instagram:     { label: 'Instagram', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  whatsapp:      { label: 'WhatsApp',  bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  referral:      { label: 'Referral',  bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  other:         { label: 'Other',     bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  manual:        { label: 'Manual',    bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  chat:          { label: 'App Chat',  bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
};

// What a HUMAN may pick when creating a lead by hand. The DB CHECK also allows
// 'chat', but only the chat_after_message trigger may write it — a person
// cannot retroactively declare that a buyer started an in-app conversation.
// Any value outside the CHECK rejects the whole insert, so forms must offer
// only these (SOURCE_CONFIG carries extra display-only aliases for older rows).
export const LEAD_SOURCE_DB_VALUES = ['walk_in', 'whatsapp', 'referral', 'drevo_enquiry', 'enquiry', 'manual'];

export const INCOME_OPTIONS = [
  'Below RM 1,500',
  'RM 1,500 – RM 3,000',
  'RM 3,001 – RM 5,000',
  'RM 5,001 – RM 8,000',
  'RM 8,001 – RM 12,000',
  'Above RM 12,000',
];

export const EMPLOYMENT_OPTIONS = [
  'Employed Private',
  'Employed Govt',
  'Self-Employed',
  'Business Owner',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format a Malaysian phone number into a WhatsApp URL */
export function formatWhatsAppURL(phone) {
  let clean = (phone || '').replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('0')) clean = '60' + clean.slice(1);
  return `https://wa.me/${clean}`;
}

/**
 * Calculate estimated monthly instalment.
 * Formula: (principal + principal × 3.5% × 7 years) / 84 months
 */
export function calcInstalment(price) {
  if (!price) return 0;
  const principal = price * 0.9;
  const total = principal + principal * 0.035 * 7;
  return Math.round(total / 84);
}

/** Days since a timestamp */
export function getLeadAgeDays(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

/** Dot color class for urgency indicator — green <7d, amber 7-30d, red >30d */
export function ageDotColor(days) {
  if (days < 7)  return 'bg-emerald-500';
  if (days < 30) return 'bg-amber-400';
  return 'bg-red-500';
}

/** Text color for age label — green <7d, amber 7-30d, red >30d */
export function ageTextColor(days) {
  if (days < 7)  return 'text-emerald-400';
  if (days < 30) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Pipeline ping timing ───────────────────────────────────────────────────
// Hours of inactivity (since lead.updated_at) before a lead in a given stage
// counts as needing follow-up. Early stages go cold fast; later, committed
// stages get more breathing room. Unknown stages fall back to 48h.
// Single source of truth — used by the dealer pipeline board AND the salesman
// panels so the "needs a ping" signal never drifts between surfaces.
export const FOLLOW_UP_HOURS = {
  new: 5,
  contacted: 24,
  viewing_booked: 48,
  test_drive: 24,
  negotiating: 48,
  deposit_taken: 72,
};

/** Hours-since-activity threshold for a stage (canonicalised), default 48. */
export function followUpHoursFor(stage) {
  return FOLLOW_UP_HOURS[canonicalStage(stage)] ?? 48;
}

// ─── Why a lead needs a call, ranked ────────────────────────────────────────
// Lower rank = call this one first. The order matches `src/utils/thisWeek.js`
// (never replied > due reminder > going quiet) on purpose: "This week" is the
// documented call list, and a pipeline badge that disagreed with it would send
// a rep to a different name than the list they were told to work.
export const FOLLOW_UP_REASON = {
  never_contacted: { rank: 0, label: 'Never contacted' },
  reminder_due:    { rank: 1, label: 'Reminder due' },
  gone_quiet:      { rank: 2, label: 'Gone quiet' },
};

const NOT_DUE = Object.freeze({
  due: false, reason: null, rank: 99, label: '', sinceHours: 0, overdueHours: 0,
});

/**
 * Why (and how badly) a lead needs a follow-up. Returns
 * `{ due, reason, rank, label, sinceHours, overdueHours }`.
 *
 * THE CLOCK RUNS FROM `last_contacted_at`, falling back to `created_at` — NOT
 * from `updated_at`. This is the whole point of the helper. `updated_at` moves
 * on ANY write: editing a note, linking a car, an AI re-score, a stage change,
 * a DB trigger. None of those reached the buyer, so measuring from it means a
 * rep who opens a lead and types a note has silenced its alarm for a full stage
 * window without speaking to anyone. Measured on the live pipeline the day this
 * changed: 16 of 68 open leads had been edited since creation with no contact
 * ever logged — a quarter of the board was reporting "recently handled" about
 * buyers nobody had called.
 * `OutreachHub.jsx:96` and `thisWeek.js` already used `last_contacted_at ||
 * created_at`; this brings the pipeline signal onto the same column instead of
 * leaving the product with two contradictory ideas of "touched".
 *
 * Terminal (won/lost) leads never qualify.
 */
export function followUpStatus(lead, now = Date.now()) {
  if (!lead) return NOT_DUE;
  const stage = canonicalStage(lead.stage);
  if (stage === 'won' || stage === 'lost') return NOT_DUE;

  const windowHours = followUpHoursFor(stage);
  const lastTouch = lead.last_contacted_at || lead.created_at;
  const sinceHours = lastTouch
    ? (now - new Date(lastTouch).getTime()) / 3600000
    : 0;

  // A lead that arrived inside its own window is not late yet. Without this a
  // brand-new enquiry would be flagged the second it lands, which is the fastest
  // way to teach a rep that the badge means nothing.
  const pastWindow = Boolean(lastTouch) && sinceHours >= windowHours;

  const followUpAt = lead.follow_up_at ? new Date(lead.follow_up_at).getTime() : null;
  const reminderDue = followUpAt !== null && followUpAt <= now;

  const make = (reason, overdueHours) => ({
    due: true,
    reason,
    rank: FOLLOW_UP_REASON[reason].rank,
    label: FOLLOW_UP_REASON[reason].label,
    sinceHours,
    overdueHours: Math.max(0, overdueHours),
  });

  // Nobody has ever contacted this buyer and their window has run out. The most
  // expensive row on any sales board — they asked, and got silence.
  if (!lead.last_contacted_at && pastWindow) {
    return make('never_contacted', sinceHours - windowHours);
  }
  // A reminder this rep set for this buyer, and let lapse. Fires regardless of
  // the stage window: the rep named the time themselves.
  if (reminderDue) {
    return make('reminder_due', (now - followUpAt) / 3600000);
  }
  if (pastWindow) {
    return make('gone_quiet', sinceHours - windowHours);
  }
  return NOT_DUE;
}

/**
 * True when a lead needs a follow-up ping. Thin wrapper over followUpStatus so
 * existing boolean callers keep working — prefer followUpStatus when you can
 * show the rep WHY, because "12 leads need attention" with no reason is a
 * number they cannot act on.
 */
export function isLeadStale(lead, now = Date.now()) {
  return followUpStatus(lead, now).due;
}

/**
 * Sort comparator: most urgent first (reason rank, then most overdue).
 * Use it wherever due leads are listed so every surface agrees on "worst first".
 */
export function compareFollowUp(a, b, now = Date.now()) {
  const sa = followUpStatus(a, now);
  const sb = followUpStatus(b, now);
  if (sa.rank !== sb.rank) return sa.rank - sb.rank;
  return sb.overdueHours - sa.overdueHours;
}

/** Extract 1-2 initials from a name */
export function getInitials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

/** Avatar gradient color keyed by lead source */
const AVATAR_GRADIENTS = {
  drevo_enquiry: 'linear-gradient(135deg,#1d4ed8,#60a5fa)',
  walk_in:       'linear-gradient(135deg,#6d28d9,#a78bfa)',
  referral:      'linear-gradient(135deg,#15803d,#4ade80)',
  whatsapp:      'linear-gradient(135deg,#065f46,#34d399)',
  mudah:         'linear-gradient(135deg,#c2410c,#fb923c)',
  carlist:       'linear-gradient(135deg,#854d0e,#fbbf24)',
  facebook:      'linear-gradient(135deg,#1e40af,#93c5fd)',
  tiktok:        'linear-gradient(135deg,#9d174d,#f9a8d4)',
  instagram:     'linear-gradient(135deg,#7c3aed,#f472b6)',
  other:         'linear-gradient(135deg,#374151,#9ca3af)',
};
export function avatarGradient(source) {
  return AVATAR_GRADIENTS[source] || 'linear-gradient(135deg,#374151,#9ca3af)';
}

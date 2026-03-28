// ─── Stage config ─────────────────────────────────────────────────────────────

export const STAGE_ORDER = [
  'new', 'contacted', 'test_drive', 'negotiating', 'closed_won', 'closed_lost',
];

export const STAGE_CONFIG = {
  new:          { label: 'New',          color: 'text-sky-400',     bg: 'rgba(56,189,248,0.10)',   border: 'rgba(56,189,248,0.22)',  headerBorder: '#38bdf8' },
  contacted:    { label: 'Contacted',    color: 'text-violet-400',  bg: 'rgba(167,139,250,0.10)',  border: 'rgba(167,139,250,0.22)', headerBorder: '#a78bfa' },
  test_drive:   { label: 'Test Drive',   color: 'text-amber-400',   bg: 'rgba(251,191,36,0.10)',   border: 'rgba(251,191,36,0.22)',  headerBorder: '#fbbf24' },
  negotiating:  { label: 'Negotiating',  color: 'text-orange-400',  bg: 'rgba(251,146,60,0.10)',   border: 'rgba(251,146,60,0.22)',  headerBorder: '#fb923c' },
  closed_won:   { label: 'Closed Won ✓', color: 'text-emerald-400', bg: 'rgba(52,211,153,0.07)',   border: 'rgba(52,211,153,0.20)',  headerBorder: '#34d399' },
  closed_lost:  { label: 'Closed Lost ✗',color: 'text-red-400',     bg: 'rgba(248,113,113,0.07)',  border: 'rgba(248,113,113,0.20)', headerBorder: '#f87171' },
};

// ─── Lead source config ────────────────────────────────────────────────────────

export const SOURCE_CONFIG = {
  drevo_enquiry: { label: 'Drevo Enquiry', bg: 'bg-blue-900/50',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  walk_in:       { label: 'Walk-In',       bg: 'bg-purple-900/50',  text: 'text-purple-400',  border: 'border-purple-500/30' },
  referral:      { label: 'Referral',      bg: 'bg-green-900/50',   text: 'text-green-400',   border: 'border-green-500/30' },
  whatsapp:      { label: 'WhatsApp',      bg: 'bg-emerald-900/50', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

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
export function formatWhatsAppURL(phone = '') {
  let clean = phone.replace(/[\s\-\(\)\+]/g, '');
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

/** Dot color class for urgency indicator */
export function ageDotColor(days) {
  if (days < 3)  return 'bg-emerald-500';
  if (days <= 7) return 'bg-amber-400';
  return 'bg-red-500';
}

/** Text color for age label */
export function ageTextColor(days) {
  if (days < 3)  return 'text-emerald-400';
  if (days <= 7) return 'text-amber-400';
  return 'text-red-400';
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
};
export function avatarGradient(source) {
  return AVATAR_GRADIENTS[source] || 'linear-gradient(135deg,#374151,#9ca3af)';
}

// ─── Stage config ─────────────────────────────────────────────────────────────
import { Sparkles, Phone, Calendar, MessageSquare, DollarSign, Trophy, XCircle, Car } from 'lucide-react';

export const STAGE_ORDER = [
  'new', 'contacted', 'viewing_booked', 'negotiating', 'deposit_taken', 'won', 'lost',
];

export const STAGE_CONFIG = {
  new:            { label: 'New',             icon: Sparkles,       color: 'text-sky-400',     bg: 'rgba(56,189,248,0.10)',   border: 'rgba(56,189,248,0.22)',   headerBorder: '#38bdf8' },
  contacted:      { label: 'Contacted',       icon: Phone,          color: 'text-violet-400',  bg: 'rgba(167,139,250,0.10)',  border: 'rgba(167,139,250,0.22)',  headerBorder: '#a78bfa' },
  viewing_booked: { label: 'Viewing Booked',  icon: Calendar,       color: 'text-amber-400',   bg: 'rgba(251,191,36,0.10)',   border: 'rgba(251,191,36,0.22)',   headerBorder: '#fbbf24' },
  negotiating:    { label: 'Negotiating',     icon: MessageSquare,  color: 'text-orange-400',  bg: 'rgba(251,146,60,0.10)',   border: 'rgba(251,146,60,0.22)',   headerBorder: '#fb923c' },
  deposit_taken:  { label: 'Deposit Taken',   icon: DollarSign,     color: 'text-teal-400',    bg: 'rgba(45,212,191,0.10)',   border: 'rgba(45,212,191,0.22)',   headerBorder: '#2dd4bf' },
  won:            { label: 'Won',             icon: Trophy,         color: 'text-emerald-400', bg: 'rgba(52,211,153,0.07)',   border: 'rgba(52,211,153,0.20)',   headerBorder: '#34d399' },
  lost:           { label: 'Lost',            icon: XCircle,        color: 'text-red-400',     bg: 'rgba(248,113,113,0.07)',  border: 'rgba(248,113,113,0.20)',  headerBorder: '#f87171' },
  // Legacy aliases kept so old DB data still renders
  test_drive:     { label: 'Test Drive',      icon: Car,            color: 'text-amber-400',   bg: 'rgba(251,191,36,0.10)',   border: 'rgba(251,191,36,0.22)',   headerBorder: '#fbbf24' },
  closed_won:     { label: 'Closed Won',      icon: Trophy,         color: 'text-emerald-400', bg: 'rgba(52,211,153,0.07)',   border: 'rgba(52,211,153,0.20)',   headerBorder: '#34d399' },
  closed_lost:    { label: 'Closed Lost',     icon: XCircle,        color: 'text-red-400',     bg: 'rgba(248,113,113,0.07)',  border: 'rgba(248,113,113,0.20)',  headerBorder: '#f87171' },
};

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

// ─── Lead source config ────────────────────────────────────────────────────────

export const SOURCE_CONFIG = {
  drevo_enquiry: { label: 'XDrive Enquiry', bg: 'bg-blue-900/50',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  walk_in:       { label: 'Walk-In',        bg: 'bg-purple-900/50',  text: 'text-purple-400',  border: 'border-purple-500/30' },
  mudah:         { label: 'Mudah',          bg: 'bg-orange-900/50',  text: 'text-orange-400',  border: 'border-orange-500/30' },
  carlist:       { label: 'Carlist',        bg: 'bg-yellow-900/50',  text: 'text-yellow-400',  border: 'border-yellow-500/30' },
  facebook:      { label: 'Facebook',       bg: 'bg-blue-900/50',    text: 'text-blue-300',    border: 'border-blue-400/30' },
  tiktok:        { label: 'TikTok',         bg: 'bg-pink-900/50',    text: 'text-pink-400',    border: 'border-pink-500/30' },
  instagram:     { label: 'Instagram',      bg: 'bg-rose-900/50',    text: 'text-rose-400',    border: 'border-rose-500/30' },
  whatsapp:      { label: 'WhatsApp',       bg: 'bg-emerald-900/50', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  referral:      { label: 'Referral',       bg: 'bg-green-900/50',   text: 'text-green-400',   border: 'border-green-500/30' },
  other:         { label: 'Other',          bg: 'bg-gray-800/60',    text: 'text-gray-400',    border: 'border-gray-600/30' },
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

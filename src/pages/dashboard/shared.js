// Styles and constants shared by the dashboard tabs (one copy; each tab file imports from here).
export const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";

import { premiumLight as PL } from '../../theme/tokens';

// premiumLight (owner, 2026-11-16: "check the Overview tab, that's how it is now"): a card is white, floats on
// PL.shadow, has no border and 20px corners. Same recipe as OwnerMoney's card. Dividers inside a card use PL.line.
export const T = {
  card: {
    position: 'relative',
    background: PL.card,
    border: 'none',
    borderRadius: PL.radius.card,
    boxShadow: PL.shadow,
  },
  cardDark: {
    position: 'relative',
    background: PL.card,
    border: 'none',
    borderRadius: PL.radius.card,
    boxShadow: PL.shadow,
  },
  modal: {
    position: 'relative',
    background: '#FFFFFF',
    border: 'none',
    borderRadius: PL.radius.card,
    boxShadow: '0 20px 60px rgba(15,23,42,0.22)',
  },
  divider: { borderBottom: `1px solid ${PL.line}` },
  btnRed: {
    background: '#DC2626',
    boxShadow: '0 1px 4px rgba(220,38,38,0.3)',
    border: 'none',
  },
};

export const iCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all";
export const taCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all resize-none";

export function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

// Styles and constants shared by the dashboard tabs (one copy; each tab file imports from here).
export const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";

export const T = {
  card: {
    position: 'relative',
    background: '#FFFFFF',
    border: '1px solid #EAECF0',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
  },
  cardDark: {
    position: 'relative',
    background: '#F7F8FA',
    border: '1px solid #EAECF0',
    borderRadius: 12,
  },
  modal: {
    position: 'relative',
    background: '#FFFFFF',
    border: '1px solid #EAECF0',
    boxShadow: '0 20px 60px rgba(15,23,42,0.15)',
  },
  divider: { borderBottom: '1px solid #EAECF0' },
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

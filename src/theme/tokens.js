export const color = {
  appBg:     '#F7F8FA',
  surface:   '#FFFFFF',
  ink:       '#0F172A',
  accent:    '#DC2626',
  textMuted: '#9AA1AD',
};

// Public storefront (dealer subdomain) dark theme — single source for the dark
// surfaces so storefront components don't hardcode hexes. Mirrors DESIGN.md.
export const storefront = {
  pageBg:       '#08090f',
  surface:      '#0d1117',
  surface2:     'rgba(255,255,255,0.04)',
  text:         '#f3f4f6',
  textSec:      'rgba(255,255,255,0.60)',
  textMuted:    'rgba(255,255,255,0.40)',
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  line:         'rgba(255,255,255,0.06)',
  accent:       '#dc2626',
  win:          '#4ade80',
};
export const border = {
  default: '1px solid #EAECF0',
  strong:  '1px solid #D1D5DB',
};
export const radius = { md: 7, lg: 12 };
export const font = {
  family: "'DM Sans', sans-serif",
  size: { xs: 10, sm: 13, base: 14, lg: 15, xl: 20, '2xl': 26, '3xl': 34 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
};
export const stageColors = {
  Negotiating:   { bg: '#FEF9EC', text: '#92400E', bar: '#F59E0B' },
  'Test Drive':  { bg: '#EFF6FF', text: '#1E40AF', bar: '#3B82F6' },
  'Deposit Paid':{ bg: '#F0FDF4', text: '#065F46', bar: '#10B981' },
  Enquiry:       { bg: '#F8FAFC', text: '#475569', bar: '#94A3B8' },
};
export const activityDot = {
  enquiry:  '#DC2626',
  listing:  '#10B981',
  booking:  '#3B82F6',
  alert:    '#F59E0B',
  closed:   '#10B981',
};

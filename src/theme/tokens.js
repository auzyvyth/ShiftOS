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
// ── Salesman panel (dark) ───────────────────────────────────────────────────
// Single source for the dark salesman surfaces (Salesman Lite / Premium /
// dealer-linked panel). Three themes exist in this app and must never be mixed:
//   `color`      → dealer dashboard (LIGHT)
//   `storefront` → public dealer subdomain (dark, marketing)
//   `panel`      → salesman working panel (dark, dense, data-heavy)  ← this one
//
// Text is FOUR roles only. If something seems to need a fifth grey, that's a
// hierarchy smell — fold it into the nearest role instead of adding a hex.
export const panel = {
  // Surfaces
  bg:            '#080a12',
  surface:       '#0d1117',
  surfaceRaised: '#161b22',
  fillSubtle:    'rgba(255,255,255,0.02)',
  fill:          'rgba(255,255,255,0.04)',
  fillStrong:    'rgba(255,255,255,0.06)',

  // Lines — three weights, not the seven that were in use
  line:         'rgba(255,255,255,0.05)',  // row dividers inside a card
  border:       'rgba(255,255,255,0.07)',  // card edge
  borderStrong: 'rgba(255,255,255,0.12)',  // inputs, focused controls

  // Text — four roles, brightest to faintest
  text:      '#f1f5f9',  // values, names, headings
  textSec:   '#94a3b8',  // supporting sentences
  textMuted: '#64748b',  // eyebrows, labels, meta
  textDim:   '#475569',  // disabled / placeholder only

  // Brand + state. The base hex is for FILLS, bars and icons; the `*Text`
  // variant is the lighter tint that stays legible as TEXT on a dark surface.
  accent:      '#dc2626',
  danger:      '#ef4444',
  dangerText:  '#f87171',
  success:     '#22c55e',
  successText: '#4ade80',
  info:        '#3b82f6',
  infoText:    '#60a5fa',
  // One step brighter than infoText — an intentional second tier for
  // escalating emphasis (e.g. a higher listing-price band), not a general
  // color. Never use this as a plain "info" text color.
  infoTextHi:  '#93c5fd',
  warn:        '#eab308',
  warnText:    '#fbbf24',
  onAccent:    '#ffffff',
};

// Pipeline-stage hues for the dark panel. Colour-codes a lead row by where it
// sits in the funnel. TODO: SalesmanLite's own STAGE_COLOR map (pill bg/border/
// text for the leads board) still lives inline — fold it in here on the leads
// pass so "won green" is defined once.
export const panelStageHue = {
  new:            '#3b82f6',
  contacted:      '#eab308',
  viewing_booked: '#a78bfa',
  test_drive:     '#34d399',
  negotiating:    '#fb923c',
  deposit_taken:  '#22c55e',
  won:            '#22c55e',
  closed_won:     '#22c55e',
  lost:           '#6b7280',
  closed_lost:    '#6b7280',
  fallback:       '#94a3b8',
};

// Type scale for the dark panel. Eight steps, down from the fifteen that were
// in use (9 / 9.5 / 10 / 10.5 / 11 / 12 ... were all live at once — sizes a
// reader cannot tell apart are not hierarchy levels, they're noise).
// Weight is the scarce signal: body stays `normal`, only labels go `semibold`
// and only numbers/headings go `bold`. Nothing is heavier than 700.
export const panelType = {
  size: {
    xs:     10,  // eyebrow / uppercase label / badge
    sm:     11,  // meta, secondary line
    base:   13,  // body, names
    lg:     16,  // inputs, emphasis body
    xl:     20,  // card headline
    stat:   22,  // KPI number
    statLg: 26,  // hero KPI number
    hero:   30,  // the one headline number on the page
  },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  track:  { tight: '-0.03em', label: '0.08em' },
};

export const panelRadius = { sm: 6, md: 8, lg: 14, pill: 99 };

// rgba() from a token hex + alpha, so tinted fills stay tied to their token
// instead of being re-typed as a raw rgba() literal that nothing can find.
// withAlpha(panel.danger, 0.12) -> 'rgba(239, 68, 68, 0.12)'
export const withAlpha = (hex, a) => {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const border = {
  default: '1px solid #EAECF0',
  strong:  '1px solid #D1D5DB',
};
export const radius = { md: 7, lg: 12 };
export const font = {
  family: "system-ui, sans-serif",
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

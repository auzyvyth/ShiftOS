// ─── ShiftOS design tokens ───────────────────────────────────────────────────
// Premium-light theme. Single source of truth for the enterprise dashboard UI.
//
// Principles:
//   - Soft off-white app background, pure-white surfaces, separated by SPACE and
//     subtle SHADOW rather than heavy borders.
//   - Calm near-black ("ink") primary for actions/active states.
//   - Brand red is RESERVED for destructive actions and alerts only (~5% of UI).
//   - One typeface (DM Sans) at varied weights. No display/poster font.
//
// Consumed by the primitives in src/components/ui/* via inline styles so the
// look is identical no matter what surrounds it during the migration.

export const color = {
  // Surfaces
  appBg:        '#F7F8FA',
  surface:      '#FFFFFF',
  surfaceMuted: '#F4F5F7',
  surfaceSunken:'#FBFBFC',

  // Hairlines (used sparingly)
  border:       '#ECEDF0',
  borderStrong: '#E2E4E9',

  // Text — three tiers
  ink:          '#0F172A', // primary text / near-black
  text:         '#1F2733',
  textSecondary:'#5B6472',
  textMuted:    '#9AA1AD',

  // Primary action (calm near-black navy)
  primary:      '#0F172A',
  primaryHover: '#1E293B',
  primaryText:  '#FFFFFF',

  // Brand / accent — reserved for destructive + alert
  accent:       '#DC2626',
  danger:       '#DC2626',
  dangerBg:     '#FEF2F2',
  dangerBorder: '#FECACA',

  // Status
  success:      '#16A34A',
  successBg:    '#F0FDF4',
  warning:      '#D97706',
  warningBg:    '#FFFBEB',
  info:         '#2563EB',
  infoBg:       '#EFF6FF',
};

export const shadow = {
  xs: '0 1px 2px rgba(16,24,40,0.05)',
  sm: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
  md: '0 4px 8px -2px rgba(16,24,40,0.08), 0 2px 4px -2px rgba(16,24,40,0.04)',
  lg: '0 12px 24px -6px rgba(16,24,40,0.10), 0 4px 8px -4px rgba(16,24,40,0.06)',
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48,
};

export const font = {
  family: "'DM Sans', system-ui, -apple-system, sans-serif",
  size: {
    xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 20, '2xl': 26, '3xl': 32,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  // Use for any numeric/metric value so figures align in columns.
  numeric: { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' },
};

export const tokens = { color, shadow, radius, space, font };
export default tokens;

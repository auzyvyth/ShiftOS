// The live presenter's accent colour (the "#N" badge, picked tenure row,
// "Comment #N" bar, next button). The seller picks it; this file keeps it
// readable. White text sits on the accent, and a phone camera filming a
// monitor washes colours out, so a colour too light for white text is
// darkened until it passes 3:1 (WCAG AA, bold text) — at the LIGHT end of the
// gradient too, not just the middle.

export const LIVE_ACCENT_KEY = 'xd_live_accent';
export const DEFAULT_ACCENT = '#E8341B';
export const ACCENT_PRESETS = ['#E8341B', '#C2410C', '#15803D', '#0F766E', '#1D4ED8', '#7C3AED', '#DB2777', '#1F2937'];

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const mix = (rgb, to, t) => rgb.map((c, i) => c + (to[i] - c) * t);

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrastWithWhite = (rgb) => 1.05 / (luminance(rgb) + 0.05);

const LIGHT_MIX = 0.12; // gradient light end = accent mixed 12% toward white
const DARK_MIX = 0.22;  // gradient dark end = accent mixed 22% toward black
const MIN_CONTRAST = 3; // WCAG AA for large / bold text: everything on the accent is bold

// Any input (preset, picker, junk) -> the readable accent and its gradient stops.
export function accentTheme(hex) {
  let base = hexToRgb(hex) || hexToRgb(DEFAULT_ACCENT);
  for (let i = 0; i < 40 && contrastWithWhite(mix(base, [255, 255, 255], LIGHT_MIX)) < MIN_CONTRAST; i++) {
    base = mix(base, [0, 0, 0], 0.06);
  }
  base = base.map(clamp);
  return {
    accent: toHex(base),
    light: toHex(mix(base, [255, 255, 255], LIGHT_MIX)),
    dark: toHex(mix(base, [0, 0, 0], DARK_MIX)),
    rgb: base.join(','),
  };
}

export function initialLiveAccent() {
  try {
    const saved = window.localStorage.getItem(LIVE_ACCENT_KEY);
    if (hexToRgb(saved)) return saved;
  } catch { /* storage blocked */ }
  return DEFAULT_ACCENT;
}
export function saveLiveAccent(hex) {
  try { window.localStorage.setItem(LIVE_ACCENT_KEY, hex); } catch { /* storage blocked */ }
}

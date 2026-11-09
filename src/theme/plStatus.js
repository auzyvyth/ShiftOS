// premiumLight status pills: ONE grey fill, the WORD carries the colour (owner,
// 2026-11-09: "get rid of these colours"). Old screens pass the hex they used to
// tint a whole pill with; this maps it to the two meaning colours we keep.
import { premiumLight as PL } from './tokens';

const GOOD = new Set(['#22c55e', '#16a34a', '#059669', '#10b981', '#34d399', '#047857', '#6ee7b7']);
const BAD = new Set(['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#f59e0b', '#f97316', '#fbbf24', '#d97706', '#b45309', '#ea580c']);

export function plWord(hex) {
  const h = String(hex || '').toLowerCase();
  if (GOOD.has(h)) return PL.up;
  if (BAD.has(h)) return PL.accentText;
  return PL.textSec;
}

export const plPill = (hex) => ({
  fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: PL.radius.pill,
  background: PL.raised, border: 'none', color: plWord(hex), cursor: 'pointer', fontFamily: 'inherit',
});

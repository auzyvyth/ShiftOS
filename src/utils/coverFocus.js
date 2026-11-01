// Which part of a seller's cover photo shows, top to bottom (BANNER-FOCUS,
// 2026-11-01). The cover is cut to a wide strip in three places: the agent page
// (/s/:slug), Premium's page preview and the link-preview picture WhatsApp /
// Facebook show (api/agent-card.js). The share picture used to let the server
// guess the "interesting" part (sharp `attention`) and the page showed the
// middle, so the banner sat at a different height on every platform.
//
// The seller now picks it in Settings (CoverAdjuster), and the choice rides on
// the cover URL itself as `fy=<0..100>`: no database column, no migration, and
// every reader of `cover_url` (incl. get_salesman_by_slug) already has it.
// 0 = top of the photo, 50 = middle (the default), 100 = bottom. It means the
// same as CSS `object-position: 50% <fy>%` everywhere, the share picture included.

export const COVER_FOCUS_DEFAULT = 50;

const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));

export function coverFocusY(url) {
  if (!url || typeof url !== "string") return COVER_FOCUS_DEFAULT;
  const m = url.match(/[?&]fy=(\d{1,3})(?:&|#|$)/);
  return m ? clamp(Number(m[1])) : COVER_FOCUS_DEFAULT;
}

export function withCoverFocus(url, y) {
  if (!url || typeof url !== "string") return url;
  const fy = clamp(Number.isFinite(Number(y)) ? Number(y) : COVER_FOCUS_DEFAULT);
  const [base, hash] = url.split("#");
  const stripped = base.replace(/([?&])fy=\d{1,3}(&|$)/, (_, sep, tail) => (tail ? sep : "")).replace(/[?&]$/, "");
  const out = `${stripped}${stripped.includes("?") ? "&" : "?"}fy=${fy}`;
  return hash !== undefined ? `${out}#${hash}` : out;
}

// CSS for an <img object-fit: cover> showing the cover.
export const coverObjectPosition = (url) => `50% ${coverFocusY(url)}%`;

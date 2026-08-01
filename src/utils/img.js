// Free on-the-fly image resizer (weserv.nl). Dealer photos are uploaded raw
// (2-5 MB) and served full-resolution from Supabase storage, which dominates
// LCP on image-heavy pages. cdnImg() routes our public storage images through
// weserv to get a resized WebP. Only rewrites our own storage URLs; everything
// else is returned untouched. Always pair with an <img onError> that restores
// the original URL so there is zero regression if the proxy is ever unavailable.
export function cdnImg(url, w = 1280, q = 70) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('/storage/v1/object/public/')) return url;
  const stripped = url.replace(/^https?:\/\//, '');
  return `https://wsrv.nl/?url=${encodeURIComponent('ssl:' + stripped)}&w=${w}&q=${q}&output=webp&we`;
}

// Responsive srcset for the same weserv resizer. A single fixed src (w=640)
// over-fetches on phones — marketplace cards render ~180-380px CSS wide, so a
// 640px image is ~1.8x oversized on a 2x mobile screen. Emitting a srcset lets
// the browser pick the width that matches the card's rendered size (paired with
// the <img sizes> hint). Only rewrites our own storage URLs; returns undefined
// otherwise so the caller falls back to a plain src with no srcset.
export function cdnSrcSet(url, widths = [320, 380, 480, 640, 760, 960], q = 72) {
  if (!url || typeof url !== 'string') return undefined;
  if (!url.includes('/storage/v1/object/public/')) return undefined;
  return widths.map((w) => `${cdnImg(url, w, q)} ${w}w`).join(', ');
}

// onError handler factory: fall back to the original URL once, then give up.
export const imgFallback = (original) => (e) => {
  if (e.currentTarget.dataset.fellBack) return;
  e.currentTarget.dataset.fellBack = '1';
  e.currentTarget.src = original;
};

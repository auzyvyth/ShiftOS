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

// onError handler factory: fall back to the original URL once, then give up.
export const imgFallback = (original) => (e) => {
  if (e.currentTarget.dataset.fellBack) return;
  e.currentTarget.dataset.fellBack = '1';
  e.currentTarget.src = original;
};

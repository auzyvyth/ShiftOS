import { detectChannel } from './detectChannel';

export function captureRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem('ref_slug', ref);
    sessionStorage.setItem('ref_captured_at', Date.now());
  }
  // Share-channel attribution. An explicit ?src= from a tagged share button
  // always wins; otherwise auto-detect the platform from the in-app browser UA
  // (and referrer) so a single untagged link still self-attributes. Anything we
  // can't classify stays unset and is reported as "Direct". Captured on landing
  // so every later in-app event can carry it. Only overwrite a stored channel
  // when we have a fresh, non-null signal — don't clobber it with a blank
  // in-app navigation that carries no UA marker.
  const src = params.get('src') || detectChannel();
  if (src) {
    sessionStorage.setItem('share_src', String(src).slice(0, 24));
    sessionStorage.setItem('share_src_at', Date.now());
  }
}

// The share channel the visitor arrived through (24h window), or null.
export function getShareChannel() {
  const src = sessionStorage.getItem('share_src');
  const at = sessionStorage.getItem('share_src_at');
  if (src && at && Date.now() - Number(at) < 86400000) return src;
  sessionStorage.removeItem('share_src');
  sessionStorage.removeItem('share_src_at');
  return null;
}

export function getRef() {
  const ref = sessionStorage.getItem('ref_slug');
  const capturedAt = sessionStorage.getItem('ref_captured_at');
  // Expire after 24 hours
  if (ref && capturedAt && Date.now() - capturedAt < 86400000) return ref;
  sessionStorage.removeItem('ref_slug');
  sessionStorage.removeItem('ref_captured_at');
  return null;
}

export function clearRef() {
  sessionStorage.removeItem('ref_slug');
  sessionStorage.removeItem('ref_captured_at');
}

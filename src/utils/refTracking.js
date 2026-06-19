export function captureRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem('ref_slug', ref);
    sessionStorage.setItem('ref_captured_at', Date.now());
  }
  // Share-channel attribution: ?src=whatsapp|facebook|tiktok|copy from a tagged
  // share link. Captured here on landing so every later in-app event can carry it.
  const src = params.get('src');
  if (src) {
    sessionStorage.setItem('share_src', src.slice(0, 24));
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

export function captureRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem('ref_slug', ref);
    sessionStorage.setItem('ref_captured_at', Date.now());
  }
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

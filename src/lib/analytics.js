// Ref-slug helpers. Writing an event is src/utils/analytics.js
// trackEvent, which posts to /api/track; there is no second writer here.

const REF_KEY = 'shiftos_ref';

export function setRef(slug) {
  if (slug) sessionStorage.setItem(REF_KEY, slug);
}

export function getRef() {
  return sessionStorage.getItem(REF_KEY);
}

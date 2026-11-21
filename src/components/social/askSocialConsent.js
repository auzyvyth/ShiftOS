// A seller who submitted a car for approval is asked ONE question: may Drevo feature it on its own
// Facebook Page and TikTok once the owner approves it? (SOCIAL-1, 2026-11-13). The form (CarForm) fires
// this event after the car is saved; SocialConsentHost, mounted once in App.jsx, shows the question. It is a
// window event because the form's modal closes the moment the car is saved, and anything rendered inside it
// would close with it.
export const ASK_SOCIAL_EVENT = 'drevo:ask-social-consent';

// One car: { id, title }. Many cars at once (bulk publish): { ids, title: '12 cars' }, one question, one answer
// stored on each car.
export function askSocialConsent({ id, ids, title }) {
  const list = ids?.length ? ids : id ? [id] : [];
  if (!list.length || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ASK_SOCIAL_EVENT, { detail: { id: list[0], ids: list, title: title || 'your car' } }));
}

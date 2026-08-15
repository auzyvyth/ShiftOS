import React, { lazy, Suspense } from 'react';

// GoogleOneTap no-ops entirely without VITE_GOOGLE_CLIENT_ID (see ACT-4 in
// TODO.md — the env var is not set yet), but a static import still shipped the
// component AND the Google Identity bootstrap to every marketplace/storefront
// visitor to do nothing.
//
// This slot is the guard: the env check is a build-time constant, so when the
// client ID is absent the dynamic import below is never called and the chunk is
// never fetched. When it IS set, One Tap loads out of band — it is a login
// prompt, never part of first paint.
const HAS_CLIENT_ID = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const GoogleOneTap = lazy(() => import('./GoogleOneTap'));

export default function GoogleOneTapSlot() {
  if (!HAS_CLIENT_ID) return null;
  return (
    <Suspense fallback={null}>
      <GoogleOneTap />
    </Suspense>
  );
}

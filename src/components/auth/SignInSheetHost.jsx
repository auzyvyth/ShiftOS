import React, { lazy, Suspense, useEffect, useState } from 'react';

// Mounted once in App.jsx. Listens for requestBuyerSignIn() (lib/buyerAuth.js)
// and opens the in-page sign-in sheet. The sheet's code only loads the first
// time someone actually needs to sign in.
const SignInSheet = lazy(() => import('./SignInSheet'));

export default function SignInSheetHost() {
  const [req, setReq] = useState(null);

  useEffect(() => {
    const onRequest = (e) => {
      e.detail.handled = true;
      setReq((prev) => {
        if (prev) prev.resolve(false); // a newer ask replaces an open one
        return e.detail;
      });
    };
    window.addEventListener('xdrive:request-signin', onRequest);
    return () => window.removeEventListener('xdrive:request-signin', onRequest);
  }, []);

  if (!req) return null;
  return (
    <Suspense fallback={null}>
      <SignInSheet
        reason={req.reason}
        returnUrl={req.returnUrl}
        onDone={(ok) => { req.resolve(ok); setReq(null); }}
      />
    </Suspense>
  );
}

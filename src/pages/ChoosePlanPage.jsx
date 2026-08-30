import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanPickerModal from '../components/onboarding/PlanPickerModal';
import { supabase } from '../supabaseClient';
import { ensureBuyerProfile } from '../lib/buyerAuth';

// Landing chooser for someone who signed in with Google WITHOUT picking a plan
// first (the /login "Continue with Google" button). The auth callback routes both
// a brand-new account and a bare, un-onboarded stub here. Dealers self-serve via
// the explicit Dealer CTA, so only the salesman plans are shown (salesmanOnly).
//
// The buyer exit below matters because of what the trigger does: handle_new_user
// stamps role='dealer' on any signup that carries no account_type metadata, so a
// shopper who simply signed in with Google arrives here holding a seller stub and
// every visible option asks them to pick a SELLING plan. Without an out, the only
// escape was closing the page — which leaves the bogus dealer stub in place, and
// that stub is what routes them into seller surfaces afterwards. Taking the exit
// rewrites the stub to a real buyer via ensureBuyerProfile.
export default function ChoosePlanPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const continueAsBuyer = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) await ensureBuyerProfile(data.session.user);
    } catch {
      /* fall through — /account's own guard re-checks and will bounce if needed */
    }
    // Full navigation, not navigate(): the header resolves the role once on
    // mount, and this call just changed it.
    window.location.href = '/account';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080C14' }}>
      <PlanPickerModal
        salesmanOnly
        onClose={() => navigate('/')}
        footer={
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 18, paddingTop: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
              Not selling anything?
            </p>
            <button
              type="button"
              onClick={continueAsBuyer}
              disabled={busy}
              style={{
                marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 9, padding: '9px 16px', color: '#E8EDF5', fontSize: 12.5,
                fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'system-ui,sans-serif',
              }}
            >
              {busy ? 'One moment…' : "I'm just here to buy a car →"}
            </button>
          </div>
        }
      />
    </div>
  );
}

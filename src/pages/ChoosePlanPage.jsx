import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlanPickerModal from '../components/onboarding/PlanPickerModal';

// Landing chooser for a brand-new seller who signed in with Google WITHOUT picking
// a plan first (e.g. the /login "Continue with Google" button). The auth callback
// routes such a bare, un-onboarded account here so they choose a salesman plan
// instead of being dropped into the dealer flow. Dealers self-serve via the
// explicit Dealer CTA, so only the salesman plans are shown (salesmanOnly).
export default function ChoosePlanPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#080C14' }}>
      <PlanPickerModal salesmanOnly onClose={() => navigate('/')} />
    </div>
  );
}

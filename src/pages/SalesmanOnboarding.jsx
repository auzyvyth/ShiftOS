import React, { useState, useEffect, useRef } from 'react';
import { NEW_CAR_BRANDS } from '../utils/newCars';
import LeadAlertsStep from '../components/onboarding/LeadAlertsStep';
import { useStarterModels } from '../components/newcar/StarterModelPicker';
import { SELLS_OPTIONS, sellsFromDb, sellsToDb, toggleSells } from '../utils/sellsHow';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LegalContent from '../components/onboarding/LegalContent';
import PlanPickerModal from '../components/onboarding/PlanPickerModal';
import { isAdultFromIC } from '../utils/icAge';
import { MY_STATES, cityOptionsFor } from '../utils/locations';
import useAuthCaptcha from '../hooks/useAuthCaptcha';
import { emailActionGate, EMAIL_ACTIONS } from '../utils/authThrottle';
import { advanceOnEnter } from '../utils/onboardingKeys';
import { PLAN_CONFIG } from '../utils/planConfig';
import { SALESMAN_PREMIUM_FEATURES } from '../utils/plans';
import { isInAppBrowser, GOOGLE_IN_APP_MESSAGE } from '../utils/installPrompt';
import PhoneInput from '../components/ui/PhoneInput';
import { toPlus60, isValidMyPhone } from '../lib/phone';
import { compressImageFile } from '../utils/compressImage';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.eo-root{min-height:100vh;min-height:100dvh;background:#f4f5f7;font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);color:#111827;display:flex;flex-direction:column;}
.eo-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;max-width:1040px;width:100%;margin:0 auto;}
.eo-logo{display:flex;align-items:center;}
.eo-logo-img{height:20px;width:auto;display:block;}
.eo-plan-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border-radius:999px;font-size:12px;font-weight:600;color:#374151;box-shadow:0 1px 2px rgba(17,24,39,0.06),0 2px 8px rgba(17,24,39,0.05);}
.eo-changeplan{background:none;border:none;padding:4px 2px;font-size:12px;font-weight:600;color:#dc2626;cursor:pointer;font-family:inherit;}
.eo-changeplan:hover{text-decoration:underline;}
.eo-main{flex:1;display:flex;flex-direction:column;align-items:center;padding:8px 16px 48px;}
.eo-form{width:100%;max-width:500px;background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 1px 2px rgba(17,24,39,0.05),0 8px 28px rgba(17,24,39,0.07);animation:eo-up 0.25s ease both;}
@keyframes eo-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.eo-progress-track{height:4px;background:#e5e7eb;border-radius:99px;overflow:hidden;width:100%;max-width:500px;margin:0 auto 14px;}
.eo-progress-fill{height:100%;background:#dc2626;border-radius:99px;transition:width 0.35s ease;}
.eo-stepline{width:100%;max-width:500px;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:10px;}
.eo-eyebrow{font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;}
.eo-heading{font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);font-size:clamp(24px,3.4vw,28px);font-weight:700;letter-spacing:-0.01em;color:#111827;line-height:1.2;margin-bottom:8px;}
.eo-sub{font-size:14.5px;color:#4b5563;line-height:1.6;margin-bottom:22px;}
.eo-label{display:block;font-size:13px;font-weight:600;color:#111827;margin-bottom:6px;margin-top:18px;}
.eo-inp{width:100%;height:50px;background:#f4f5f7;border:1.5px solid transparent;border-radius:12px;color:#111827;font-family:inherit;font-size:16px;padding:0 14px;outline:none;transition:border-color 0.15s,background 0.15s;}
.eo-inp:focus{border-color:#111827;background:#fff;}
.eo-inp::placeholder{color:#9ca3af;}
.eo-select{width:100%;height:50px;background:#f4f5f7;border:1.5px solid transparent;border-radius:12px;color:#111827;font-family:inherit;font-size:16px;padding:0 14px;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
.eo-select:focus{border-color:#111827;background-color:#fff;}
.eo-select:disabled{opacity:0.55;cursor:not-allowed;}
.eo-btn{width:100%;height:52px;background:linear-gradient(180deg,#ef4444,#dc2626);border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 2px 0 #991b1b,0 6px 14px rgba(220,38,38,0.28);transition:transform 0.08s,box-shadow 0.08s,opacity 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:24px;}
.eo-btn:active:not(:disabled){transform:translateY(2px);box-shadow:0 0 0 #991b1b,0 2px 6px rgba(220,38,38,0.28);}
.eo-btn:disabled{opacity:0.4;cursor:not-allowed;box-shadow:none;}
.eo-ghost{width:100%;height:48px;background:#f4f5f7;border:none;border-radius:12px;color:#374151;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
.eo-ghost:hover:not(:disabled){background:#eceef1;}
.eo-ghost:disabled{opacity:0.4;cursor:not-allowed;}
.eo-divider{display:flex;align-items:center;gap:14px;margin:18px 0;color:#9ca3af;font-size:12px;font-weight:600;}
.eo-divider::before,.eo-divider::after{content:'';flex:1;height:1px;background:#e5e7eb;}
.eo-legal-wrap{background:#f4f5f7;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;margin-top:14px;height:300px;}
.eo-legal-scroll{flex:1;overflow-y:auto;padding:18px;scrollbar-width:thin;color:#374151;}
.eo-check{display:flex;gap:11px;align-items:flex-start;margin-top:14px;cursor:pointer;font-size:13px;line-height:1.55;color:#4b5563;}
.eo-check input{width:18px;height:18px;margin-top:1px;flex-shrink:0;accent-color:#dc2626;cursor:pointer;}
.eo-check a{color:#dc2626;text-decoration:none;font-weight:600;}
.eo-check a:hover{text-decoration:underline;}
.eo-link{color:#dc2626;text-decoration:none;font-weight:600;}
.eo-error{font-size:13px;color:#b91c1c;margin-top:14px;padding:11px 14px;background:#f4f5f7;border-radius:10px;line-height:1.5;font-weight:500;}
.eo-hint{font-size:12.5px;color:#6b7280;margin-top:7px;line-height:1.6;}
.eo-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;}
.eo-chip{flex:1 1 140px;min-width:0;text-align:left;padding:12px 14px;border-radius:12px;cursor:pointer;background:#f4f5f7;border:1.5px solid transparent;font-family:inherit;color:#111827;}
.eo-chip b{display:block;font-size:14px;font-weight:700;}
.eo-chip span{display:block;margin-top:2px;font-size:12px;color:#6b7280;}
.eo-chip.on{background:#111827;}
.eo-chip.on b{color:#fff;}
.eo-chip.on span{color:rgba(255,255,255,0.7);}
.eo-chip.sm{flex:1 1 72px;text-align:center;padding:10px 8px;font-size:13.5px;font-weight:700;}
.eo-chip.sm.on{color:#fff;}
.eo-features{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px;}
.eo-feature-pill{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#374151;background:#f4f5f7;border-radius:99px;padding:6px 12px;}
.eo-pw-rule{display:flex;align-items:center;gap:8px;font-size:12.5px;}
.eo-slug-wrap{position:relative;}
.eo-slug-status{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:12px;font-weight:700;}
.eo-preview{margin-top:18px;background:#f4f5f7;border-radius:14px;padding:16px;display:flex;align-items:center;gap:14px;}
.eo-preview-av{width:48px;height:48px;border-radius:50%;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0;}
.eo-preview-name{font-size:17px;font-weight:700;color:#111827;word-break:break-all;}
.eo-preview-sub{font-size:12.5px;color:#6b7280;margin-top:2px;}
.eo-hello{display:block;margin:-32px -28px 24px;padding:15px 28px;border-radius:20px 20px 0 0;background:linear-gradient(180deg,#ef4444,#dc2626);color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.005em;animation:eo-pop 0.45s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes eo-pop{0%{opacity:0;transform:translateY(8px) scale(.85)}100%{opacity:1;transform:none}}
.eo-preview-av{position:relative;overflow:hidden;cursor:pointer;border:none;padding:0;font-family:inherit;}
.eo-preview-av img{width:100%;height:100%;object-fit:cover;display:block;}
.eo-preview-add{margin-top:6px;background:none;border:none;padding:0;font-size:12.5px;font-weight:600;color:#dc2626;cursor:pointer;font-family:inherit;}
.eo-done-av{width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:20px;animation:eo-pop 0.5s cubic-bezier(.34,1.56,.64,1) both;}
@media(prefers-reduced-motion:reduce){.eo-hello,.eo-done-av{animation:none;}}
.eo-done-root,.eo-resume-root{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;background:#f4f5f7;text-align:center;padding:40px 24px;font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);}
.eo-resume-card{width:min(440px,100%);background:#fff;border-radius:20px;padding:32px 26px;box-shadow:0 1px 2px rgba(17,24,39,0.05),0 8px 28px rgba(17,24,39,0.07);}
.eo-done-ring{width:64px;height:64px;border-radius:50%;background:#111827;display:flex;align-items:center;justify-content:center;margin-bottom:24px;}
.eo-done-title{font-size:clamp(28px,6vw,36px);font-weight:700;letter-spacing:-0.01em;color:#111827;line-height:1.2;margin-bottom:8px;}
.eo-done-sub{font-size:14px;color:#6b7280;}
@media(max-width:560px){
  .eo-top{padding:14px 16px;}
  .eo-form{padding:24px 18px;border-radius:18px;}
  .eo-hello{margin:-24px -18px 20px;padding:14px 18px;border-radius:18px 18px 0 0;font-size:15px;}
}
`;

// SIGNUP-1: the phone number and page-link steps write nothing until
// Activate, so a phone that died on step 4 or 5 lost both. They are kept as a
// DRAFT ON THIS DEVICE (not the database: saving the page link early would let
// an abandoned signup hold that link forever), keyed by account, along with the
// step reached, and put back when the person resumes. No password, no IC.
const DRAFT_FIELDS = ['phone', 'brand', 'slug', 'state', 'city'];
const draftKey = (uid) => `xd_signup_draft_${uid}`;
function readDraft(uid) {
  if (!uid) return null;
  try { return JSON.parse(localStorage.getItem(draftKey(uid)) || 'null'); } catch { return null; }
}
function clearDraft(uid) {
  if (!uid) return;
  try { localStorage.removeItem(draftKey(uid)); } catch { /* non-fatal */ }
}

const STEPS = [
  { label: 'TERMS', sub: 'Required agreement' },
  { label: 'ACCOUNT', sub: 'Email or Google' },
  { label: 'DETAILS', sub: 'Your name' },
  { label: 'PHONE', sub: 'Contact number' },
  { label: 'PAGE', sub: 'Your public page' },
];

const TIERS = {
  lite: {
    label: 'SALESMAN LITE',
    price: 'FREE',
    features: [
      'Up to 10 active listings',
      'Auto-published to drevo.my',
      'Direct WhatsApp enquiries',
      'Basic performance analytics',
      'No credit card required',
    ],
  },
  premium: {
    label: 'SALESMAN PREMIUM',
    price: 'First 7 days free, then RM 35 / mo',
    // One list, shared with /plans and /for-salesmen (src/utils/plans.js).
    features: [`Up to ${PLAN_CONFIG.salesman_full.listingCap} active listings`, ...SALESMAN_PREMIUM_FEATURES],
  },
};


export default function SalesmanOnboarding() {
  // AUTH-6: signUp and resend both hit captcha-guarded auth endpoints.
  const { getToken } = useAuthCaptcha();
  const navigate = useNavigate();
  const { tier: tierParam } = useParams();
  const PREMIUM_ENABLED = true;
  const requestedTier = ['lite', 'premium'].includes(tierParam) ? tierParam : 'lite';
  const tier = requestedTier === 'premium' && !PREMIUM_ENABLED ? 'lite' : requestedTier;

  const [step, setStep] = useState(0);
  const [alertsStep, setAlertsStep] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState(null);
  // AUTH-1: set when we drop a guest (anonymous) session on the way in, so the
  // signup form can say why they are being asked to create an account.
  const [guestNotice, setGuestNotice] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePdpa, setAgreePdpa] = useState(false);
  const [showResumeChoice, setShowResumeChoice] = useState(false);
  // Distinguishes a genuine buyer's real account (never agreed to salesman Terms,
  // so "continue" must still route through step 0) from a resumed in-progress
  // salesman signup (already agreed last time — safe to skip straight to step 2).
  const [resumeIsBuyer, setResumeIsBuyer] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [done, setDone] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  // The handle whose availability answer we hold. Continue needs it to equal the
  // typed handle: the check runs 450ms after typing, and a stale "available" for
  // an earlier value let a taken handle through to a raw duplicate-key error.
  const [slugCheckedFor, setSlugCheckedFor] = useState('');
  // Once the seller types in the handle box, the brand name stops filling it.
  const [, setSlugEdited] = useState(false);

  const [showPw, setShowPw] = useState(false);
  // Optional profile photo, picked on the last step and uploaded only when the page is created.
  const [avatarBlob, setAvatarBlob] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInput = useRef(null);
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    fullName: '', icNumber: '',
    phone: '+60',
    brand: '', slug: '', state: '', city: '',
    // Defaults to the framing this product has always used for a standalone
    // signup (commission-first dashboard, "Agent" badge) — private is an
    // opt-in distinction, not a behavior change for anyone who skips this.
    sells: ['broker'],
    // Only when sells includes 'new_car' (NEWCAR-1): which brand's price list their
    // page shows. Prices come from the platform table, never typed by the seller.
    newCarBrand: '',
    // NEWCAR-2: the models they tick get a card each, with the platform's photos.
    newCarModels: [],
  });

  const slugTimer = useRef(null);
  const slugLatest = useRef('');

  const upd = (k) => (val) => setForm(p => ({ ...p, [k]: val }));
  const starterModels = useStarterModels(form.sells.includes('new_car') ? form.newCarBrand : '');

  // SIGNUP-1: keep what they typed on steps 3-5 on this device as they go.
  useEffect(() => {
    if (!userId || done || step < 3) return;
    const draft = { step };
    DRAFT_FIELDS.forEach((k) => { draft[k] = form[k]; });
    try { localStorage.setItem(draftKey(userId), JSON.stringify(draft)); } catch { /* non-fatal */ }
  }, [userId, done, step, form.phone, form.brand, form.slug, form.state, form.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // ...and put it back once we know who this is. Only fills blanks, so it never
  // overwrites anything the saved profile already holds.
  const draftStep = useRef(null);
  useEffect(() => {
    const draft = readDraft(userId);
    if (!draft) return;
    draftStep.current = [3, 4, 5].includes(draft.step) ? Math.min(draft.step, 4) : null;
    setForm((p) => {
      const next = { ...p };
      DRAFT_FIELDS.forEach((k) => {
        const blank = !p[k] || (k === 'phone' && p[k] === '+60');
        if (blank && typeof draft[k] === 'string' && draft[k]) next[k] = draft[k];
      });
      return next;
    });
    // The link may have been taken by someone else since; re-check it.
    if (draft.slug) { setSlugEdited(true); checkSlug(draft.slug); }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Catch-all: the handle step never waits on an answer nobody asked for (a
  // restored handle, or a check that errored). Continue needs slugCheckedFor.
  useEffect(() => {
    if (step !== 4 || form.slug.length < 3 || slugCheckedFor === form.slug) return;
    if (slugLatest.current === form.slug && slugChecking) return;
    const id = setTimeout(() => checkSlug(form.slug), 450);
    return () => clearTimeout(id);
  }, [step, form.slug, slugCheckedFor, slugChecking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror Supabase's password policy (8+ chars + one of each class) so users
  // never hit an opaque server-side rejection on sign-up.
  const pwChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'A lowercase letter (a-z)', ok: /[a-z]/.test(form.password) },
    { label: 'An uppercase letter (A-Z)', ok: /[A-Z]/.test(form.password) },
    { label: 'A number (0-9)', ok: /[0-9]/.test(form.password) },
    { label: 'A symbol (!@#$%…)', ok: /[^a-zA-Z0-9]/.test(form.password) },
  ];
  const pwValid = pwChecks.every(c => c.ok);
  const pwMatch = form.password.length > 0 && form.password === form.confirmPassword;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // AUTH-1. A guest buyer browsing the marketplace holds an ANONYMOUS
      // session (that is how in-app chat works without an account). Adopting it
      // here is what converted one of those guests into a salesman account with
      // no email address -- a live storefront nobody can ever sign back into,
      // because there is no address to send a password reset to. The DB now
      // refuses that write (prevent_profile_privilege_escalation), so adopting
      // the session would only fail later with a raw error mid-form.
      //
      // Drop the guest session instead and let them create a real account. This
      // does end their guest chats, which is the honest trade: a seller account
      // has to be something they can log back into.
      if (session.user?.is_anonymous) {
        await supabase.auth.signOut();
        setGuestNotice(true);
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || '');

      // Resume the plan they picked. signUp() stamps it into user_metadata.tier,
      // which survives the email-confirm round trip and a closed PWA; the bare
      // /salesman-onboarding URL (what a reopened app or the dashboard guard
      // lands on) carries no tier, and defaulting it to Lite silently
      // downgraded a Premium signup. An explicit /:tier in the URL still wins.
      const savedTier = session.user?.user_metadata?.tier;
      if (!tierParam && savedTier === 'premium') {
        navigate('/salesman-onboarding/premium', { replace: true });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, full_name, phone, ic_number, slug, role, seller_type, new_car_brand')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.onboarding_complete && profile?.role === 'salesman') {
        // A seller who already has an account and picked Premium wants to
        // upgrade, not sign up again: open Lite's Premium section (Lite
        // forwards them on if they already have Premium).
        navigate(tier === 'premium' ? '/salesman-lite/settings?section=premium' : '/salesman');
        return;
      }

      // Google (or any OAuth) hands back a display name — use it when the profile
      // doesn't already carry one, so a Google user doesn't retype what we have.
      const metaName = (session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || '').trim();

      // Only offer "resume or start over" when there's actual saved progress. A
      // bare stub (the handle_new_user default dealer row, or a Google sign-in that
      // never filled anything in) has nothing to resume — treat it as a fresh start
      // instead of prompting over an empty form. A real buyer account always gets
      // the chooser too — they already have a live login, so the ACCOUNT step's
      // "create a password" form is nonsensical for them either way.
      const hasProgress = !!(profile && (profile.full_name || profile.slug || profile.ic_number || profile.phone));
      const isBuyer = profile?.role === 'buyer';
      if (profile && (hasProgress || isBuyer)) {
        setForm(p => ({
          ...p,
          fullName: profile.full_name || metaName || p.fullName,
          icNumber: profile.ic_number || p.icNumber,
          phone: profile.phone || p.phone,
          slug: profile.slug || p.slug,
          sells: profile.seller_type ? sellsFromDb(profile.seller_type, profile.new_car_brand) : p.sells,
          newCarBrand: profile.new_car_brand || p.newCarBrand,
        }));
        // A restored handle is the seller's own pick: check it (Continue waits on
        // that answer) and stop the brand name from overwriting it.
        if (profile.slug) { setSlugEdited(true); checkSlug(profile.slug); }
        setResumeIsBuyer(isBuyer);
        setShowResumeChoice(true);
        return;
      }

      // No profile, or a bare stub with zero progress → fresh start. Prefill the
      // Google display name and go to the flow (Terms unless already agreed).
      if (metaName) setForm(p => ({ ...p, fullName: p.fullName || metaName }));
      // Two independent signals, either is enough: sessionStorage (same-tab resume)
      // OR the durable `consent` flag stamped into user_metadata at signUp() below
      // (survives the email-confirm link opening in a NEW tab/app, which has its
      // own empty sessionStorage — this was the actual bug: every email-confirm
      // signup has no ob_agreed in the new tab and got bounced back to Terms even
      // though they'd already agreed to reach the signup form in the first place).
      const agreedThisTab = sessionStorage.getItem('ob_agreed') === '1';
      const agreedOnAccount = session.user?.user_metadata?.consent === true;
      setStep((agreedThisTab || agreedOnAccount) ? 2 : 0);
    };
    init();
  }, []);

  const agreeLegal = () => {
    if (!agreeTerms || !agreePdpa) return;
    sessionStorage.setItem('ob_agreed', '1');
    setErr('');
    // Already have a live session (a buyer continuing with their existing email) —
    // skip the ACCOUNT step's email/password form entirely, straight to DETAILS.
    setStep(userId ? 2 : 1);
  };

  const signInWithGoogle = async () => {
    if (isInAppBrowser()) { setErr(GOOGLE_IN_APP_MESSAGE); return; }
    sessionStorage.setItem('ob_plan_slug', tier);
    sessionStorage.setItem('ob_account_type', 'salesman');
    sessionStorage.setItem('ob_agreed', '1');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signUp = async () => {
    setErr('');
    if (!pwValid) { setErr('Password needs 8+ characters with an uppercase, lowercase, number and symbol.'); return; }
    if (form.password !== form.confirmPassword) { setErr('Passwords do not match.'); return; }
    setLoading(true);
    try {
      // Persist onboarding context so the post-confirmation callback (which runs
      // in a fresh page load, no React state) knows to resume salesman onboarding
      // instead of defaulting to the dealer flow.
      sessionStorage.setItem('ob_plan_slug', tier);
      sessionStorage.setItem('ob_account_type', 'salesman');
      const captchaToken = await getToken();
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        // Persist onboarding context on the ACCOUNT (user_metadata), not just
        // sessionStorage — so confirming the email on a different device still
        // resumes the correct (salesman) flow at the right tier.
        options: {
          captchaToken,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // consent: true is the durable backup for the sessionStorage 'ob_agreed'
          // flag read in the init() resume check above — this one lives on the
          // account itself, so it's still there when the email-confirm link opens
          // in a different tab/device than the one that filled out this form.
          data: { account_type: 'salesman', tier, consent: true },
        },
      });
      if (error) throw error;
      // Supabase returns a user with an empty identities array (and no error)
      // when the email is already registered — anti-enumeration. Detect it so we
      // don't silently advance into a broken signup.
      if (data?.user && (data.user.identities?.length ?? 0) === 0) {
        setErr('An account with this email already exists. Please log in instead.');
        return;
      }
      // Email confirmation is required — Supabase returns a user but no session,
      // so there's no JWT to write the profile row with yet. Wait for the click.
      if (data?.user && !data.session) {
        setUserEmail(data.user.email);
        setAwaitingConfirm(true);
        return;
      }
      if (data?.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email);
        setStep(2);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setResendMsg('');
    try {
      // AUTH-5: this was the last auth-email sender with no app-level cap on it.
      // Same 3-per-15-minutes bucket as the resend on /login.
      const gate = await emailActionGate(form.email, EMAIL_ACTIONS.RESEND);
      if (!gate.allowed) { setResendMsg(gate.message); return; }
      const captchaToken = await getToken();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: form.email,
        options: { captchaToken },
      });
      if (error) throw error;
      setResendMsg('Sent. Check your inbox (and spam folder).');
    } catch (e) {
      setResendMsg(e.message);
    }
  };

  // No ID at signup (owner, 2026-10-12): national ID upfront was the biggest
  // cold-signup drop-off, and asking for it in three places read as shady. The
  // one place is the step-by-step "Get verified" flow in the panel's Profile
  // settings (src/components/kyc/GetVerifiedFlow.jsx). Full name is still
  // saved here (it's their display identity, low-sensitivity).
  const skipIdentity = async () => {
    setErr('');
    if (!form.fullName.trim()) { setErr('Full name is required'); return; }
    if (form.sells.includes('new_car') && !form.newCarBrand) { setErr('Pick the brand you sell'); return; }
    setLoading(true);
    try {
      if (userId) {
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: form.fullName.trim(),
          role: 'salesman',
          ...sellsToDb(form.sells, form.newCarBrand),
          onboarding_complete: false,
        }, { onConflict: 'id' });
        if (error) throw error;
      }
      setStep(3);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please pick a photo (JPG or PNG).'); return; }
    setErr('');
    try {
      const blob = await compressImageFile(file, { maxDim: 800 });
      setAvatarBlob(blob);
      setAvatarPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch { setErr('That photo could not be read. Try another one.'); }
  };

  const checkSlug = async (slug) => {
    slugLatest.current = slug;
    if (!slug || slug.length < 3) { setSlugTaken(false); setSlugChecking(false); return; }
    setSlugChecking(true);
    try {
      // SECURITY DEFINER RPC — profiles RLS hides other dealers' rows, so a plain
      // select would wrongly report every taken slug as available.
      const { data: available, error } = await supabase.rpc('is_slug_available', { p_slug: slug });
      if (slugLatest.current !== slug) return; // a newer handle was typed meanwhile
      if (!error) { setSlugTaken(available === false); setSlugCheckedFor(slug); }
    } finally {
      if (slugLatest.current === slug) setSlugChecking(false);
    }
  };

  const handleSlugChange = (val, fromBrand = false) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (!fromBrand) setSlugEdited(true);
    upd('slug')(clean);
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(() => checkSlug(clean), 450);
  };

  const activate = async () => {
    setErr('');
    // If an IC was provided (here or at the identity step), enforce 18+ from it.
    if (form.icNumber && isAdultFromIC(form.icNumber) === false) {
      setErr('You must be at least 18 years old to sell on Drevo.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        full_name: form.fullName.trim(),
        phone: toPlus60(form.phone),
        // The storefront, WhatsApp enquiry buttons and CarDetail contact card all
        // read whatsapp_number — the onboarding phone is useless unless we also
        // seed it here, otherwise buyers get "dealer hasn't added a WhatsApp number".
        whatsapp_number: toPlus60(form.phone),
        // IC is deferred-friendly: signing up no longer requires it. When provided,
        // it's hashed right after this upsert via set_my_ic (never stored plaintext).
        // When skipped we stamp a soft deadline; the panel hard-enforces at 1 week.
        role: 'salesman',
        slug: form.slug,
        // Public name = the page username (PUBLIC-NAME-1). Never the legal name.
        dealership: form.slug,
        state: form.state || null,
        city: form.city || null,
        is_active: true,
        onboarding_complete: true,
        plan: tier === 'premium' ? 'salesman_full' : 'salesman_lite',
        // Premium's first 7 days are free (subscription_status/trial_ends_at set
        // by the DB trigger prevent_profile_privilege_escalation, which forces
        // payment_status to NULL for this exact signup-completing write —
        // whatever we send here is overridden, the DB decides). After 7 days
        // the panel gates behind the same manual DuitNow QR flow dealers use
        // (admin marks payment_status='received' in /platform).
        payment_status: null,
        pdpa_consent: true,
        pdpa_consent_at: new Date().toISOString(),
        ic_deadline: null,
      }, { onConflict: 'id' });
      if (error) throw error;
      // Hash + persist the IC (never plaintext) once the profile row exists.
      const icDigits = (form.icNumber || '').replace(/\D/g, '');
      if (icDigits.length === 12) {
        const { error: icErr } = await supabase.rpc('set_my_ic', { p_ic: icDigits });
        if (icErr) throw icErr;
      }
      // Optional photo. Never blocks the signup: a failure here just means no photo yet
      // (they can add it from Settings). Same path + column as the Settings upload.
      if (avatarBlob) {
        try {
          const path = `${userId}/avatar.jpg`;
          const up = await supabase.storage.from('avatars').upload(path, avatarBlob, { upsert: true, contentType: 'image/jpeg' });
          if (!up.error) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
            await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('id', userId);
          }
        } catch { /* added later from Settings */ }
      }
      // NEWCAR-2 / NEWCAR-3: every model of the chosen brand becomes a card now
      // that state/city are saved (the price is per area), so nobody fills their
      // page by hand. Models with no photos or no price for the area are skipped
      // by the function itself. A failure here never blocks the signup: the
      // seller can add them from Settings > New cars.
      const ticked = form.sells.includes('new_car') ? (starterModels || []).map((m) => m.model) : [];
      if (ticked.length) {
        try { await supabase.rpc('new_car_add_cards', { p_models: ticked }); } catch { /* added later from Settings */ }
      }
      sessionStorage.removeItem('ob_agreed');
      sessionStorage.removeItem('ob_plan_slug');
      sessionStorage.removeItem('ob_account_type');
      clearDraft(userId);
      // PUSH-ONBOARD: the account is saved; lead alerts are the last screen
      // (LeadAlertsStep), and only then ACTIVATED + the panel.
      setAlertsStep(true);
    } catch (e) {
      // Someone took the handle between the check and this save: back to the
      // handle step with a plain message, never the raw constraint name.
      if (/profiles_slug_unique/.test(e.message || '')) {
        setSlugTaken(true); setSlugCheckedFor(form.slug); setStep(4);
        setErr('That page link was just taken. Pick another one.');
      } else setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAndStart = async () => {
    clearDraft(userId);
    await supabase.auth.signOut();
    setShowResumeChoice(false);
    setUserId(null);
    setUserEmail('');
    setSlugEdited(false); setSlugCheckedFor('');
    setForm({ email: '', password: '', confirmPassword: '', fullName: '', icNumber: '', phone: '+60', brand: '', slug: '', state: '', city: '', sells: ['broker'], newCarBrand: '', newCarModels: [] });
    setStep(0);
  };

  if (showResumeChoice) return (
    <>
      <style>{CSS}</style>
      <div className="eo-resume-root">
        <div className="eo-resume-card">
          <div className="eo-logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" className="eo-logo-img" />
          </div>
          <div className="eo-heading" style={{ textAlign: 'center' }}>
            {resumeIsBuyer ? 'Continue with this email?' : 'Welcome back'}
          </div>
          <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 4, textAlign: 'center' }}>
            {resumeIsBuyer ? 'Your Drevo account is signed in as' : 'You have an unfinished sign-up as'}
          </p>
          <p style={{ color: '#111827', fontWeight: 600, fontSize: 15, marginBottom: 28, textAlign: 'center', wordBreak: 'break-all' }}>{userEmail}</p>
          <button className="eo-btn" style={{ marginTop: 0 }} onClick={() => { setShowResumeChoice(false); setStep(resumeIsBuyer ? 0 : (draftStep.current || 2)); }}>
            {resumeIsBuyer ? 'Continue with this email' : 'Continue sign-up'}
          </button>
          <button className="eo-ghost" onClick={resetAndStart}>{resumeIsBuyer ? 'Use another email' : 'Use a different account'}</button>
          {!resumeIsBuyer && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
              <a href="/login" className="eo-link">Sign in to an existing account</a>
            </p>
          )}
        </div>
      </div>
    </>
  );

  if (awaitingConfirm) return (
    <>
      <style>{CSS}</style>
      <div className="eo-resume-root">
        <div className="eo-resume-card">
          <div className="eo-logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" className="eo-logo-img" />
          </div>
          <div className="eo-heading" style={{ textAlign: 'center' }}>Check your email</div>
          <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 4, textAlign: 'center' }}>We sent a confirmation link to</p>
          <p style={{ color: '#111827', fontWeight: 600, fontSize: 15, marginBottom: 20, textAlign: 'center', wordBreak: 'break-all' }}>{userEmail}</p>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
            Click the link to verify your account — it'll bring you straight back here to finish signing up.
          </p>
          <button className="eo-ghost" style={{ marginTop: 0 }} onClick={resendConfirmation}>Resend email</button>
          {resendMsg && <div className="eo-hint" style={{ textAlign: 'center', marginTop: 10 }}>{resendMsg}</div>}
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
            <a href="/login" className="eo-link">Sign in to an existing account</a>
          </p>
        </div>
      </div>
    </>
  );

  if (alertsStep && !done) return (
    <LeadAlertsStep
      userId={userId}
      onDone={() => {
        setDone(true);
        setTimeout(() => navigate(tier === 'premium' ? '/salesman-premium' : '/salesman'), 1500);
      }}
    />
  );

  if (done) return (
    <>
      <style>{CSS}</style>
      <div className="eo-done-root">
        {avatarPreview
          ? <img className="eo-done-av" src={avatarPreview} alt="" />
          : <div className="eo-done-ring">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>}
        <div className="eo-done-title">Tahniah, page anda dah siap!</div>
        <p className="eo-done-sub">Opening your dashboard...</p>
      </div>
    </>
  );

  const canSlugContinue = form.slug.length >= 3 && !slugTaken && !slugChecking && slugCheckedFor === form.slug;

  const cfg = TIERS[tier] || TIERS.lite;
  // A short, friendly line per step (Malay, the way sellers talk). It names where they are,
  // so the form feels like a conversation and not a form.
  const HELLO = [
    'Hai, selamat datang ke Drevo!',
    'Jom, buat akaun dulu.',
    'Hampir siap!! Ceritalah sikit pasal diri anda.',
    'Satu lagi je, nombor WhatsApp anda.',
    'Last sekali! Pilih nama page anda.',
  ][step] || '';

  return (
    <>
      <style>{CSS}</style>
      {showPlans && <PlanPickerModal currentTier={tier} onClose={() => setShowPlans(false)} />}
      <div className="eo-root">
        <div className="eo-top">
          <a href="/" className="eo-logo" aria-label="Drevo">
            <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" className="eo-logo-img" />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eo-plan-badge">{tier === 'premium' ? 'Premium' : 'Lite'}</span>
            <button type="button" className="eo-changeplan" onClick={() => setShowPlans(true)}>Change plan</button>
          </div>
        </div>
        <div className="eo-main">
          <div className="eo-progress-track">
            <div className="eo-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <p className="eo-stepline">Step {step + 1} of {STEPS.length}</p>
          <div className="eo-form" key={step} onKeyDown={advanceOnEnter}>
            {HELLO && <div className="eo-hello" role="status">{HELLO}</div>}

            {step === 0 && (
              <>
                <p className="eo-eyebrow">Required by PDPA 2010</p>
                <div className="eo-heading">Before we start</div>
                <p className="eo-sub">{cfg.price === 'FREE' ? 'Free to start. No card needed.' : 'No card needed to start.'} Read the terms below and tick to continue.</p>
                <div className="eo-features">
                  {cfg.features.slice(0, 4).map((f, i) => <span key={i} className="eo-feature-pill">{f}</span>)}
                </div>
                <div className="eo-legal-wrap">
                  <div className="eo-legal-scroll">
                    <LegalContent />
                  </div>
                </div>
                <label className="eo-check">
                  <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} />
                  <span>I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and Data Processing Agreement.</span>
                </label>
                <label className="eo-check">
                  <input type="checkbox" checked={agreePdpa} onChange={e => setAgreePdpa(e.target.checked)} />
                  <span>I consent to Drevo collecting and processing my personal data (including my IC) for account verification and marketplace listings, in accordance with the PDPA 2010.</span>
                </label>
                <button className="eo-btn" onClick={agreeLegal} disabled={!agreeTerms || !agreePdpa}>
                  I agree, continue
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <div className="eo-heading">Create your account</div>
                <p className="eo-sub">Use Google, or your email and a password.</p>
                <button className="eo-ghost" style={{ marginTop: 0 }} onClick={signInWithGoogle} disabled={loading}>
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="eo-divider">or</div>
                <label className="eo-label">Email</label>
                <input className="eo-inp" type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => upd('email')(e.target.value)} autoComplete="email" />
                <label className="eo-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="eo-inp" type={showPw ? 'text' : 'password'} placeholder="Create a strong password" value={form.password}
                    onChange={e => upd('password')(e.target.value)} autoComplete="new-password" style={{ paddingRight: 62 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                {form.password.length > 0 && !pwValid && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pwChecks.map(c => (
                      <div key={c.label} className="eo-pw-rule" style={{ color: c.ok ? '#15803d' : '#6b7280' }}>
                        <span style={{ width: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.ok
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            : <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#9ca3af' }} />}
                        </span>
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
                <label className="eo-label">Confirm password</label>
                <input className="eo-inp" type={showPw ? 'text' : 'password'} placeholder="Re-enter your password" value={form.confirmPassword}
                  onChange={e => upd('confirmPassword')(e.target.value)} autoComplete="new-password" />
                {form.confirmPassword.length > 0 && !pwMatch && (
                  <div className="eo-hint" style={{ color: '#b91c1c', marginTop: 6 }}>Passwords don't match</div>
                )}
                {guestNotice && (
                  <div className="eo-hint" style={{ marginTop: 12 }}>
                    You were browsing as a guest. Selling needs a real account with
                    an email and password, so you can sign back in later.
                  </div>
                )}
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={signUp} disabled={loading || !form.email || !pwValid || !pwMatch}>
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#6b7280' }}>
                  Already have an account?{' '}
                  <a href="/login" className="eo-link">Sign in</a>
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <div className="eo-heading">About you</div>
                <p className="eo-sub">
                  Your full name stays private. Buyers see the page name you pick on the last step.
                </p>

                <label className="eo-label" style={{ marginTop: 0 }}>How do you sell cars? Pick one or two</label>
                <div className="eo-chips">
                  {SELLS_OPTIONS.map((opt) => (
                    <button key={opt.key} type="button" aria-pressed={form.sells.includes(opt.key)} onClick={() => upd('sells')(toggleSells(form.sells, opt.key))}
                      className={`eo-chip${form.sells.includes(opt.key) ? ' on' : ''}`}>
                      <b>{opt.title}</b>
                      <span>{opt.sub}</span>
                    </button>
                  ))}
                </div>
                {form.sells.includes('new_car') ? (
                  <div style={{ marginBottom: 18 }}>
                    <label className="eo-label" style={{ marginTop: 10 }}>Which brand do you sell?</label>
                    <div className="eo-chips">
                      {NEW_CAR_BRANDS.map((b) => {
                        const on = form.newCarBrand === b;
                        return (
                          <button key={b} type="button" className={`eo-chip sm${on ? ' on' : ''}`}
                            onClick={() => { upd('newCarBrand')(b); if (b !== form.newCarBrand) upd('newCarModels')([]); }}>
                            {b}
                          </button>
                        );
                      })}
                    </div>
                    {starterModels?.length ? (
                      <p className="eo-hint" style={{ marginTop: 10 }}>
                        Every {form.newCarBrand} model ({starterModels.length}) goes on your page with photos, ready to share. The official price for your area fills in by itself. Take off any you don't sell, or add your own photos, any time from Settings.
                      </p>
                    ) : (
                      <p className="eo-hint" style={{ marginTop: 6 }}>
                        You add the {form.newCarBrand || 'brand'} models you sell from Add car. The official price for your area fills in by itself.
                      </p>
                    )}
                  </div>
                ) : (
                <p className="eo-hint" style={{ marginBottom: 18 }}>
                  Already work at a dealership? Ask them to send you an invite instead. Your dealership then shows on your page, verified.
                </p>
                )}

                <label className="eo-label">Full name (as per IC), kept private</label>
                <input className="eo-inp" type="text" placeholder="Ahmad bin Abdullah" value={form.fullName}
                  onChange={e => upd('fullName')(e.target.value)} autoComplete="name" />
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" onClick={skipIdentity}
                  disabled={loading || !form.fullName.trim()}>
                  {loading ? 'Saving...' : 'Continue'}
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="eo-heading">Your WhatsApp number</div>
                <p className="eo-sub">Buyers tap a WhatsApp button to reach you. Your number is not printed on the page.</p>
                <label className="eo-label" style={{ marginTop: 0 }}>WhatsApp / mobile number</label>
                <PhoneInput mobileOnly className="eo-inp" value={form.phone} onChange={upd('phone')} />
                <p className="eo-hint">Malaysian numbers only (+60). We also use it for account alerts.</p>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn"
                  onClick={() => { setErr(''); setStep(4); }}
                  disabled={!isValidMyPhone(form.phone, { mobileOnly: true })}>
                  Continue
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(2); }}>
                  Back
                </button>
              </>
            )}

            {step === 4 && (
              <>
                <div className="eo-heading">Pick your page name</div>
                <p className="eo-sub">This is the name buyers see, and your page link. Your full name is not shown.</p>
                <label className="eo-label" style={{ marginTop: 0 }}>Page name</label>
                <div className="eo-slug-wrap">
                  <input className="eo-inp" type="text" placeholder="e.g. sirhonda" value={form.slug}
                    onChange={e => handleSlugChange(e.target.value)} style={{ paddingRight: 96 }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                  {form.slug.length >= 3 && (
                    <span className="eo-slug-status" style={{ color: slugTaken ? '#b91c1c' : slugChecking ? '#9ca3af' : '#15803d' }}>
                      {slugChecking ? 'Checking' : slugTaken ? 'Taken' : 'Available'}
                    </span>
                  )}
                </div>
                <p className="eo-hint">Letters and numbers only, 3 to 20. You can't change it later, so pick one buyers will remember.</p>
                <div className="eo-preview">
                  <button type="button" className="eo-preview-av" onClick={() => avatarInput.current?.click()} aria-label="Add a profile photo">
                    {avatarPreview ? <img src={avatarPreview} alt="" /> : (form.slug[0] || 'D').toUpperCase()}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div className="eo-preview-name">{form.slug || 'yourname'}</div>
                    <div className="eo-preview-sub">drevo.my/s/{form.slug || 'yourname'}</div>
                    <button type="button" className="eo-preview-add" onClick={() => avatarInput.current?.click()}>
                      {avatarPreview ? 'Change photo' : 'Add a photo (optional)'}
                    </button>
                  </div>
                  <input ref={avatarInput} type="file" accept="image/*" onChange={pickAvatar} style={{ display: 'none' }} />
                </div>
                {/* Public: this is the page header, the Google title and the advisor
                    list. People typed their HOME here (owner, 2026-10-23), so it
                    asks for where buyers meet them. */}
                <label className="eo-label">State where you sell</label>
                <select className="eo-select" value={form.state}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value, city: '' }))}>
                  <option value="">Select state</option>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="eo-label">
                  Area where you sell <span style={{ color: '#9ca3af', fontWeight: 500 }}>(optional)</span>
                </label>
                <select className="eo-select" value={form.city} disabled={!form.state}
                  onChange={e => upd('city')(e.target.value)}>
                  <option value="">{form.state ? 'Select city / area' : 'Select a state first'}</option>
                  {cityOptionsFor(form.state, form.city).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="eo-hint">Your showroom or office, where buyers meet you. Shown on your page and on Google, so never your home.</p>
                {err && <div className="eo-error">{err}</div>}
                <button className="eo-btn" disabled={!canSlugContinue || loading} onClick={activate}>
                  {loading ? 'Creating your page...' : 'Create my page'}
                </button>
                <button className="eo-ghost" onClick={() => { setErr(''); setStep(3); }} disabled={loading}>
                  Back
                </button>
                <p className="eo-hint" style={{ textAlign: 'center', marginTop: 16 }}>
                  {tier === 'premium'
                    ? 'Premium is free for 7 days, no card. After that you stay on free Lite unless you choose to pay.'
                    : 'Free, no card.'}{' '}
                  By continuing you agree to our Terms, Privacy Policy and DPA.
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

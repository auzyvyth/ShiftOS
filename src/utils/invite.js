// Seller referral invites (REFER-1).
//
// An invite link is any xdrive.my URL with ?invite=<inviter's slug>. It is a
// separate parameter from ?ref=, which already means "the salesman a BUYER
// came from" (refTracking.js) - mixing the two would credit a rep with a
// seller signup every time a buyer they sent later became a seller.
//
// Captured at module load (main.jsx), BEFORE routing: /signup and /register
// are <Navigate> redirects that drop the query string. Stored in
// localStorage, not sessionStorage, because sign-up confirms by email and
// the new seller usually comes back in a different tab.
//
// The browser can never set profiles.referred_by itself
// (trg_guard_profile_referral); claim_referral() decides everything.
import { supabase } from '../supabaseClient';

const KEY = 'xd_invite';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function captureInvite() {
  try {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code) return;
    const clean = code.trim().toLowerCase().slice(0, 64);
    if (!/^[a-z0-9-]+$/.test(clean)) return;
    localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch { /* storage blocked: the invite is simply not remembered */ }
}

export function readInvite() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw?.code || Date.now() - raw.at > MAX_AGE_MS) return null;
    return raw.code;
  } catch { return null; }
}

function clearInvite() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

let inFlight = false;

// Called once a seller panel has its profile. Any definitive answer from the
// server clears the stored code, so it is tried at most once per account;
// a network failure keeps it for the next load.
export async function claimStoredInvite() {
  const code = readInvite();
  if (!code || inFlight) return null;
  inFlight = true;
  try {
    const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
    if (error) return null;
    clearInvite();
    return data;
  } finally {
    inFlight = false;
  }
}

export function inviteUrl(slug) {
  return slug ? `https://xdrive.my/plans?invite=${encodeURIComponent(slug)}` : null;
}

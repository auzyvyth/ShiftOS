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

// What claim_referral's answer means, in words a seller can act on.
export const CLAIM_MESSAGES = {
  ok: 'Done. You joined through their invite.',
  self: "That's your own link name.",
  unknown_code: "No seller uses that link name. Check the spelling.",
  already_set: 'Your invite is already set.',
  too_late: 'Invites can only be added in your first 14 days, before your first payment.',
  rate_limited: 'Too many tries. Try again tomorrow.',
  not_eligible: 'Only independent sellers can join through an invite.',
};

// The "Invited by" box (ReferralCard). Takes a bare link name or a whole
// pasted invite link.
export async function claimInviteCode(input) {
  let code = String(input || '').trim();
  try {
    const u = new URL(code);
    code = u.searchParams.get('invite') || u.pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    // "xdrive.my/s/name" without https:// is not a URL to the parser.
    const m = code.match(/invite=([A-Za-z0-9-]+)/);
    code = m ? m[1] : code.split('?')[0].split('/').filter(Boolean).pop() || '';
  }
  if (!/^[A-Za-z0-9-]+$/.test(code)) {
    return { result: 'unknown_code', message: CLAIM_MESSAGES.unknown_code };
  }
  code = code.toLowerCase().slice(0, 64);
  const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
  if (error) return { result: 'error', message: "Couldn't save. Check your connection and try again." };
  if (data === 'ok') clearInvite();
  return { result: data, message: CLAIM_MESSAGES[data] || 'Something went wrong.' };
}

export function inviteUrl(slug) {
  return slug ? `https://xdrive.my/plans?invite=${encodeURIComponent(slug)}` : null;
}

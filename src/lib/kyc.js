// Client helpers for the user identity-approval (KYC) flow.
//
// Plain version: free accounts (salesman Lite) hand over just their IC NUMBER
// (already captured + hashed at onboarding via set_my_ic). Paid accounts
// ("premium" — dealers and salesman Premium) additionally upload three ID
// photos (front, back, selfie-with-IC) into a PRIVATE bucket only the superadmin
// reviewer can open. The images are purged the moment the reviewer decides, so
// this module never keeps them around either.
import { supabase } from '../supabaseClient';

const BUCKET = 'kyc-docs';

// The only plans that skip document upload. Everything else — every dealer tier
// and salesman Premium — is treated as 'premium' and must upload photos. A null
// plan defaults to the stricter side (ask for documents) rather than waving it
// through.
const FREE_PLANS = new Set(['salesman_lite']);

export function kycTierForProfile(profile) {
  return FREE_PLANS.has(profile?.plan) ? 'free' : 'premium';
}

export const KYC_KINDS = ['front', 'back', 'selfie'];

export const KYC_LABELS = {
  front: 'IC front',
  back: 'IC back',
  selfie: 'Selfie holding your IC',
};

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024; // mirrors the bucket's file_size_limit

// Read the first bytes and confirm the file really is the image type it claims.
// A renamed .exe or a PDF with a .jpg extension is rejected here, before any
// upload — the same magic-byte guard the stock importer uses.
async function sniffImage(file) {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const is = (sig, off = 0) => sig.every((b, i) => buf[off + i] === b);
  const jpeg = is([0xff, 0xd8, 0xff]);
  const png = is([0x89, 0x50, 0x4e, 0x47]);
  const webp = is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8);
  return jpeg || png || webp;
}

export async function validateKycImage(file) {
  if (!file) return { ok: false, error: 'No file selected.' };
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'Use a JPG, PNG or WebP image.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Image must be under 8 MB.' };
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  if (!(await sniffImage(file))) {
    return { ok: false, error: "That file isn't a real image." };
  }
  return { ok: true };
}

// Uploads one validated image to {userId}/{kind}.jpg. The path is built entirely
// from the authenticated user id + a fixed kind — never from the file name — so
// there is no way to write outside your own folder (the storage RLS enforces
// that too). Returns the storage path on success.
export async function uploadKycImage(userId, kind, file) {
  if (!KYC_KINDS.includes(kind)) throw new Error('bad_kind');
  const v = await validateKycImage(file);
  if (!v.ok) throw new Error(v.error);
  const path = `${userId}/${kind}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

// Free tier: no images, just marks the account submitted for review.
export async function submitFreeKyc() {
  const { error } = await supabase.rpc('submit_kyc', { p_tier: 'free' });
  if (error) throw error;
}

// Premium tier: uploads the three images, then records the submission. Paths are
// re-derived server-side checks in submit_kyc (must be inside the caller's
// folder), so a tampered path is rejected at the DB.
export async function submitPremiumKyc(userId, files) {
  const front = await uploadKycImage(userId, 'front', files.front);
  const back = await uploadKycImage(userId, 'back', files.back);
  const selfie = await uploadKycImage(userId, 'selfie', files.selfie);
  const { error } = await supabase.rpc('submit_kyc', {
    p_tier: 'premium',
    p_front: front,
    p_back: back,
    p_selfie: selfie,
  });
  if (error) throw error;
}

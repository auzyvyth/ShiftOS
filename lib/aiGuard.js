/* eslint-env node */
// Shared AI request guard for Path-B proxies (Vercel /api/ai-messages and the
// Express /ai/messages twin). Mirrors the policy enforced in the Supabase
// ai-proxy edge function: auth → resolve dealer scope → pin model/max_tokens
// per feature → enforce shared per-dealer daily quota → inject role context.
//
// All sub-roles under a dealer (salesman, manager, admin, accountant,
// fi_officer) share ONE quota pool and ONE assistant with their parent dealer —
// resolveDealerId() is the single source of truth for that scoping.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://lemdkdizdlcirhbzqlos.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const DAILY_QUOTA = 400;

// Server-pinned model/max_tokens per feature — never trust client-supplied values.
export const FEATURES = {
  stock_import: { model: 'claude-sonnet-4-20250514', maxTokens: 16000, stream: true },
  tiktok_studio: { model: 'claude-sonnet-4-6', maxTokens: 1000, stream: false },
  sales_manager: { model: 'claude-sonnet-4-20250514', maxTokens: 1000, stream: false },
  crm_assist: { model: 'claude-sonnet-4-20250514', maxTokens: 1000, stream: false },
  accountant: { model: 'claude-sonnet-4-20250514', maxTokens: 1024, stream: true },
  general: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, stream: false },
};

const ROLE_LABELS = {
  dealer: 'the dealership owner',
  owner: 'the dealership owner',
  superadmin: 'a super-admin',
  manager: 'a manager',
  admin: 'an admin',
  salesman: 'a salesman',
  accountant: 'an accountant',
  fi_officer: 'an F&I (finance & insurance) officer',
};

// Mirrors getDealerIdFromProfile, extended to cover every sub-role under a dealer:
// dealer/owner/superadmin own their pool (profile.id); every other role under a
// dealer (salesman, manager, admin, accountant, fi_officer) shares the parent's pool.
function resolveDealerId(profile) {
  if (['dealer', 'owner', 'superadmin'].includes(profile.role)) return profile.id;
  return profile.dealer_id || profile.id;
}

// Authenticates the request, resolves dealer scope, pins model/max_tokens for
// the requested feature, enforces the shared per-dealer daily quota, and
// returns everything the caller needs to build the upstream Anthropic request.
//
// Returns either { ok: true, model, maxTokens, stream, system } or
// { ok: false, status, error }.
export async function guardAiRequest(req, featureKey) {
  if (!SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, error: 'Server missing SUPABASE_ANON_KEY' };
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, dealer_id, dealership, site_name')
    .eq('id', user.id)
    .single();
  if (profileErr || !profile) {
    return { ok: false, status: 403, error: 'profile not found' };
  }

  const dealerId = resolveDealerId(profile);
  if (!dealerId) {
    return { ok: false, status: 403, error: 'no dealer scope' };
  }

  const feature = FEATURES[featureKey] ? featureKey : 'general';
  const { model, maxTokens, stream } = FEATURES[feature];

  const { data: usageCount, error: usageErr } = await supabase.rpc('record_ai_request', {
    p_dealer_id: dealerId,
    p_user_id: user.id,
    p_role: profile.role,
    p_feature: feature,
    p_model: model,
    p_max_tokens: maxTokens,
  });
  if (usageErr) {
    console.error('[aiGuard] usage error:', usageErr);
  } else if (typeof usageCount === 'number' && usageCount > DAILY_QUOTA) {
    return { ok: false, status: 429, error: 'daily AI quota reached for this dealership. Try again tomorrow.' };
  }

  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const dealerName = profile.dealership || profile.site_name || 'this dealership';
  const roleContext = `You are assisting ${roleLabel} working at ${dealerName} inside ShiftOS, a car dealership management platform. ` +
    `All accounts under this dealership (salesmen, managers, admins, accountants, F&I officers and the owner) share the same AI assistant and quota. ` +
    `Tailor your answer to what someone in this role would need.`;

  return { ok: true, model, maxTokens, stream, roleContext };
}

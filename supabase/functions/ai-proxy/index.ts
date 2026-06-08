import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

// Daily request cap shared by a dealer and every sub-account under them
// (salesman, manager, admin, fi_officer, accountant all draw from one pool).
const DAILY_QUOTA = 400;

// Server-pinned model/max_tokens per feature — never trust client-supplied values.
const FEATURES: Record<string, { model: string; maxTokens: number }> = {
  caption: { model: "claude-haiku-4-5-20251001", maxTokens: 512 },
  wa_reply: { model: "claude-haiku-4-5-20251001", maxTokens: 1024 },
  lead_score: { model: "claude-haiku-4-5-20251001", maxTokens: 512 },
  followup: { model: "claude-haiku-4-5-20251001", maxTokens: 512 },
  sales_manager: { model: "claude-sonnet-4-20250514", maxTokens: 1000 },
  crm_assist: { model: "claude-sonnet-4-20250514", maxTokens: 1000 },
  general: { model: "claude-haiku-4-5-20251001", maxTokens: 1024 },
};

const ROLE_LABELS: Record<string, string> = {
  dealer: "the dealership owner",
  owner: "the dealership owner",
  superadmin: "a super-admin",
  manager: "a manager",
  admin: "an admin",
  salesman: "a salesman",
  accountant: "an accountant",
  fi_officer: "an F&I (finance & insurance) officer",
};

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, baggage, sentry-trace",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Mirrors getDealerIdFromProfile, extended to cover every sub-role under a dealer:
// dealer/owner/superadmin own their pool (profile.id); every other role under a
// dealer (salesman, manager, admin, accountant, fi_officer) shares the parent's pool.
function resolveDealerId(profile: { id: string; role: string; dealer_id: string | null }) {
  if (["dealer", "owner", "superadmin"].includes(profile.role)) return profile.id;
  return profile.dealer_id || profile.id;
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401, origin);
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return jsonResponse({ error: "unauthorized" }, 401, origin);
    }

    const { data: profile, error: profileErr } = await anonClient
      .from("profiles")
      .select("id, role, dealer_id, dealership, site_name")
      .eq("id", user.id)
      .single();
    if (profileErr || !profile) {
      return jsonResponse({ error: "profile not found" }, 403, origin);
    }

    const dealerId = resolveDealerId(profile);
    if (!dealerId) {
      return jsonResponse({ error: "no dealer scope" }, 403, origin);
    }

    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const systemPrompt: string = typeof body?.system === "string" ? body.system : "";
    const featureKey: string = typeof body?.feature === "string" && FEATURES[body.feature]
      ? body.feature
      : "general";
    if (!prompt) {
      return jsonResponse({ error: "missing prompt" }, 400, origin);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "AI not configured" }, 500, origin);
    }

    const { model, maxTokens } = FEATURES[featureKey];

    // Shared per-dealer daily quota — every sub-role draws from the same pool.
    // record_ai_request is SECURITY DEFINER: bumps ai_usage and writes the
    // per-role/feature breakdown row in one atomic call, no service-role key needed.
    const { data: usageCount, error: usageErr } = await anonClient.rpc("record_ai_request", {
      p_dealer_id: dealerId,
      p_user_id: user.id,
      p_role: profile.role,
      p_feature: featureKey,
      p_model: model,
      p_max_tokens: maxTokens,
    });
    if (usageErr) {
      console.error("ai-proxy usage error:", usageErr);
    } else if (typeof usageCount === "number" && usageCount > DAILY_QUOTA) {
      return jsonResponse(
        { error: "daily AI quota reached for this dealership. Try again tomorrow." },
        429,
        origin,
      );
    }

    const roleLabel = ROLE_LABELS[profile.role] || profile.role;
    const dealerName = profile.dealership || profile.site_name || "this dealership";
    const roleContext = `You are assisting ${roleLabel} working at ${dealerName} inside ShiftOS, a car dealership management platform. ` +
      `All accounts under this dealership (salesmen, managers, admins, accountants, F&I officers and the owner) share the same AI assistant and quota. ` +
      `Tailor your answer to what someone in this role would need.`;
    const finalSystem = systemPrompt ? `${roleContext}\n\n${systemPrompt}` : roleContext;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: finalSystem,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return jsonResponse({ error: "AI request failed" }, 502, origin);
    }

    const json = await res.json();
    const reply = json.content?.[0]?.text ?? "";

    return jsonResponse({ reply }, 200, origin);
  } catch (e) {
    console.error("ai-proxy error:", e);
    return jsonResponse({ error: "internal error" }, 500, origin);
  }
});

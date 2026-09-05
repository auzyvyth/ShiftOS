import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// chat-assist — AI help for a seller inside an in-app buyer conversation.
//
// WHY THIS IS A SERVER FUNCTION AND NOT A CLIENT PROMPT:
// the browser holds the raw message text because it renders it, so a
// client-built prompt could always slip a buyer's phone number to the model by
// accident. Here the caller sends only a thread id; this function fetches the
// transcript itself, from the `chat_messages_ai` view, which does not have a
// `body` column at all. Raw contact details cannot reach the model even if this
// file is edited carelessly later. Do not add a read of `chat_messages`.
//
// Trust boundary: output is a DRAFT for the salesman to read and send himself,
// or an answer addressed to the salesman. Nothing here messages a buyer.

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 700;
const MAX_TURNS = 40;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, baggage, sentry-trace",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function resolveDealerId(p: { id: string; role: string; dealer_id: string | null }) {
  if (["dealer", "owner", "superadmin"].includes(p.role)) return p.id;
  return p.dealer_id || p.id;
}

const SYSTEM = `You are helping a Malaysian used-car salesman handle a live chat with a buyer inside ShiftOS.

The transcript you are given is REDACTED: phone numbers, IC numbers and emails appear as [number hidden] or [contact hidden]. That is deliberate and correct. Never ask for them, never guess what they were, and never comment on the redaction.

Hard rules:
- Never invent or imply a price, discount, deposit, instalment, trade-in value, loan rate, financing approval, delivery date or availability guarantee. If a number is needed, tell the salesman to confirm it himself.
- You are writing FOR the salesman, not AS the platform. Your reply drafts must sound like a person.
- The salesman always reads and sends the message himself. Never claim a message has been sent.
- Write in casual Malaysian English with light Bahasa Malaysia mixing, matching how the buyer writes.

Modes:
- "suggest": reply with ONLY the draft message text the salesman could send. No preamble, no options, no quotes around it.
- "ask": answer the salesman's question about this conversation directly and briefly. Give him the read and the next move. Max 120 words.`;

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, origin);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // Caller-scoped client: every read below is still subject to RLS, so a user
    // cannot pull a thread they are not part of.
    const db = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await createClient(supabaseUrl, anonKey).auth.getUser(token);
    if (authErr || !user) return json({ error: "unauthorized" }, 401, origin);

    const body = await req.json().catch(() => ({}));
    const threadId: string | undefined = body?.thread_id;
    const mode: string = body?.mode === "ask" ? "ask" : "suggest";
    const question: string = typeof body?.question === "string" ? body.question.slice(0, 500) : "";
    if (!threadId) return json({ error: "missing thread_id" }, 400, origin);

    const { data: profile } = await db
      .from("profiles").select("id, role, dealer_id, dealership, site_name")
      .eq("id", user.id).single();
    if (!profile) return json({ error: "profile not found" }, 403, origin);

    // Only the seller side gets AI assistance. A buyer calling this gets nothing.
    const { data: threadRole } = await db.rpc("chat_thread_role", { p_thread_id: threadId });
    if (threadRole !== "seller") return json({ error: "forbidden" }, 403, origin);

    const { data: thread } = await db
      .from("chat_threads")
      .select("buyer_label, listing:listing_id(brand, model, year, variant, mileage, transmission, colour, selling_price)")
      .eq("id", threadId).single();

    // REDACTED VIEW ONLY. chat_messages_ai has no `body` column.
    const { data: msgs, error: msgErr } = await db
      .from("chat_messages_ai")
      .select("sender_role, body_ai, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(MAX_TURNS);
    if (msgErr) return json({ error: "could not read conversation" }, 500, origin);
    if (!msgs?.length) return json({ error: "no messages yet" }, 400, origin);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "AI not configured" }, 500, origin);

    // Shared per-dealer daily quota, same pool as every other AI feature.
    const dealerId = resolveDealerId(profile);
    const { data: usage, error: usageErr } = await db.rpc("record_ai_request", {
      p_dealer_id: dealerId, p_user_id: user.id, p_role: profile.role,
      p_feature: "crm_assist", p_model: MODEL, p_max_tokens: MAX_TOKENS,
    });
    // The quota is the cost control on a paid API. A record that did not happen
    // is a refusal, not something to log past — swallowing this error is how
    // ai-proxy ran unmetered.
    if (usageErr) {
      console.error("chat-assist usage error:", usageErr);
      return json({ error: "could not record AI usage" }, 500, origin);
    }
    if (typeof usage === "number" && usage > 400) {
      return json({ error: "daily AI quota reached for this dealership. Try again tomorrow." }, 429, origin);
    }

    const car = thread?.listing;
    const carLine = car
      ? [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ") +
        (car.selling_price ? ` — asking RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "") +
        [car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null, car.transmission, car.colour]
          .filter(Boolean).map((x) => `, ${x}`).join("")
      : "an unspecified car";

    const transcript = msgs
      .map((m) => `${m.sender_role === "buyer" ? "BUYER" : "SALESMAN"}: ${m.body_ai}`)
      .join("\n");

    const task = mode === "ask"
      ? `The salesman asks: "${question || "What should I do with this one?"}"`
      : `Draft the salesman's next reply.`;

    const prompt = `Car being discussed: ${carLine}
Buyer shows as: ${thread?.buyer_label || "a guest"}

Conversation so far:
${transcript}

Mode: ${mode}
${task}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("chat-assist anthropic error:", res.status, await res.text());
      return json({ error: "AI unavailable right now" }, 502, origin);
    }

    const data = await res.json();
    const reply = data?.content?.[0]?.text?.trim();
    if (!reply) return json({ error: "empty AI response" }, 502, origin);

    return json({ reply, mode }, 200, origin);
  } catch (err) {
    console.error("chat-assist:", err);
    return json({ error: "unexpected error" }, 500, origin);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();
    // Support two call formats:
    // Simple: { prompt: "..." }
    // Chat:   { system: "...", messages: [...], max_tokens: N }
    const { prompt, system, messages, max_tokens } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    let anthropicBody: Record<string, unknown>;
    if (messages && Array.isArray(messages)) {
      // Multi-turn chat format
      anthropicBody = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: max_tokens || 1024,
        ...(system ? { system } : {}),
        messages,
      };
    } else if (prompt) {
      // Simple prompt format
      anthropicBody = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      };
    } else {
      return new Response(JSON.stringify({ error: "missing prompt or messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const json = await res.json();
    const reply = json.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    console.error("ai-proxy error:", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});

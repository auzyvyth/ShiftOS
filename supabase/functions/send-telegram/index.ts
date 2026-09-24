import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Origin allowlist lives in ../_shared/cors.ts (MOBILE-4) — one list for every function.

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("unauthorized", { status: 401, headers: cors });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the JWT and get the user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return new Response("unauthorized", { status: 401, headers: cors });

    const { dealer_id, channel_id, message } = await req.json();
    if (!channel_id || !message) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Resolve the caller's OWN dealer scope server-side. The body's dealer_id is
    // not trusted to pick whose bot token gets used: this endpoint verified the
    // JWT but never checked that the caller had anything to do with the
    // dealer_id they named, so any authenticated user — including an anonymous
    // guest buyer, since anonymous sign-in is enabled — could name any dealer
    // and send Telegram messages through THAT dealer's bot token, and harvest
    // the bot's @username off the not_started path. Deriving the id instead of
    // validating it means there is no version of this call that can get it
    // wrong. Mirrors getDealerIdFromProfile / ai-proxy's resolveDealerId.
    const { data: caller, error: callerErr } = await supabase
      .from("profiles")
      .select("id, role, dealer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const callerDealerId = ["dealer", "owner", "superadmin"].includes(caller.role)
      ? caller.id
      : (caller.dealer_id || caller.id);

    // Existing callers all pass their own resolved dealer id, so a mismatch is
    // either a bug or an attempt to borrow someone else's bot — say so loudly
    // rather than quietly falling back to the caller's own token.
    if (dealer_id && dealer_id !== callerDealerId) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Only sellers send from here. A buyer — and every anonymous guest created by
    // the in-app chat flow — has a valid JWT and a profile row, which was enough
    // to reach the platform-bot fallback below.
    if (!caller.role || caller.role === "buyer") {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // The DESTINATION has to belong to the caller too, not just the bot token.
    // Scoping the token alone left this an open relay: any account without a bot
    // token of its own falls through to the platform bot below, so a caller could
    // name any chat_id and have arbitrary text delivered from the official XDrive
    // bot — phishing our own sellers from our own brand. A destination is legal
    // only if it is one of the two ids the caller has already saved on a profile
    // they own: their personal chat (reminders) or their dealership's channel
    // (auto-posts). Every caller saves the id before it tests it, so this is the
    // same set the UI already writes.
    const { data: destRow } = await supabase
      .from("profiles")
      .select("telegram_chat_id, telegram_channel_id")
      .eq("id", user.id)
      .maybeSingle();
    const { data: dealerDest } = callerDealerId === user.id
      ? { data: null }
      : await supabase
          .from("profiles")
          .select("telegram_channel_id")
          .eq("id", callerDealerId)
          .maybeSingle();
    const allowedDestinations = [
      destRow?.telegram_chat_id,
      destRow?.telegram_channel_id,
      dealerDest?.telegram_channel_id,
    ]
      .map((v) => (v || "").trim())
      .filter(Boolean);
    if (!allowedDestinations.includes(String(channel_id).trim())) {
      return new Response(JSON.stringify({ ok: false, error: "unknown_destination" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Fetch the dealer's own bot token server-side — never sent to the browser.
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token")
      .eq("id", callerDealerId)
      .maybeSingle();

    // Solo salesmen (Salesman Lite/Premium) resolve dealer_id to their OWN profile,
    // which has no bot token and no UI to set one. Fall back to the platform bot so
    // they get reminders without being asked to create a BotFather bot.
    const dealerToken = (profile?.telegram_bot_token || "").trim();
    const platformToken = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim();
    const token = dealerToken || platformToken;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "no_token" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel_id, text: message }),
    });
    const tgData = await tgRes.json();

    // A Telegram bot cannot open a conversation — the user must press Start first.
    // Until they do, sendMessage fails with "chat not found" (400) or, after a block,
    // 403. Both read as a wrong Chat ID to the user, so name the real cause and hand
    // the UI the bot's @username to link to. getMe is only called on this failure
    // path, and only the username is returned — the token never leaves the server.
    if (!tgData?.ok && (tgData?.error_code === 400 || tgData?.error_code === 403)) {
      let botUsername: string | null = null;
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meData = await meRes.json();
        botUsername = meData?.result?.username || null;
      } catch { /* username is a nicety — the error below still stands without it */ }
      return new Response(JSON.stringify({
        ...tgData,
        error: "not_started",
        bot_username: botUsername,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(tgData), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "server_error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

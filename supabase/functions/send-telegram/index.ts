import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    if (!dealer_id || !channel_id || !message) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Fetch token server-side — never sent to the browser
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token")
      .eq("id", dealer_id)
      .maybeSingle();

    const token = (profile?.telegram_bot_token || "").trim();
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "no_token" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel_id, text: message }),
    });
    const tgData = await tgRes.json();

    return new Response(JSON.stringify(tgData), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "server_error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

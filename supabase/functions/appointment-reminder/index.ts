import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (!botToken) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set" }), {
      status: 500, headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Window: remind_at is between now-2min and now (catches this cron tick)
  const now = new Date();
  const windowStart = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const windowEnd = now.toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, buyer_name, buyer_phone, appointment_date, salesman_id, car_listings(brand, model, year)")
    .eq("remind_sent", false)
    .not("remind_at", "is", null)
    .gte("remind_at", windowStart)
    .lte("remind_at", windowEnd);

  if (error) {
    console.error("appointments query:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  if (!appointments?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
  }

  let sent = 0;
  for (const apt of appointments) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", apt.salesman_id)
      .single();

    if (!profile?.telegram_chat_id) continue;

    const aptDate = new Date(apt.appointment_date);
    const dateStr = aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
    const car = (apt as any).car_listings;
    const carLine = car ? `🚗 ${[car.year, car.brand, car.model].filter(Boolean).join(" ")}\n` : "";

    const message =
      `⏰ *Appointment in 1 Hour!*\n\n` +
      `👤 *${apt.buyer_name || "Customer"}*\n` +
      carLine +
      `📅 ${dateStr} at ${timeStr}` +
      (apt.buyer_phone ? `\n📞 ${apt.buyer_phone}` : "");

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: message, parse_mode: "Markdown" }),
      },
    );

    if (tgRes.ok) {
      await supabase.from("appointments").update({ remind_sent: true }).eq("id", apt.id);
      sent++;
    } else {
      const err = await tgRes.json();
      console.error("telegram send failed:", err);
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

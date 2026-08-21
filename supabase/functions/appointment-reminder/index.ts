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

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let telegramSent = 0;
  let unconfirmedNags = 0;

  // ─── Job 1: Telegram "1 hour before" reminder for CONFIRMED bookings ────
  // Opt-in — only fires for appointments where the salesman explicitly set
  // remind_at via "Schedule Telegram Reminder" in the Bookings tab.
  if (!botToken) {
    console.error("appointment-reminder: TELEGRAM_BOT_TOKEN not set — skipping Job 1");
  } else {
    // Window: remind_at is between now-10min and now. The lookback covers the cron
    // cadence (every 5 min) plus one missed tick, so a coarser schedule never drops
    // a reminder. The remind_sent=false filter guarantees each appointment is only
    // notified once even though 2 consecutive ticks may both see it in-window.
    const now = new Date();
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const windowEnd = now.toISOString();

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, buyer_name, buyer_phone, appointment_date, salesman_id, car_listings(brand, model, year)")
      .eq("remind_sent", false)
      .not("remind_at", "is", null)
      .gte("remind_at", windowStart)
      .lte("remind_at", windowEnd);

    if (error) {
      console.error("appointments query (Job 1):", error);
    } else {
      for (const apt of appointments ?? []) {
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
          telegramSent++;
        } else {
          const err = await tgRes.json();
          console.error("telegram send failed:", err);
        }
      }
    }
  }

  // ─── Job 2: Push nag for UNCONFIRMED bookings coming up soon ─────────────
  // A booking a buyer requested (status='pending') that the salesman never
  // confirmed is the actual failure mode we're guarding against — the buyer
  // may show up to nothing. Window is -2h (still nag a bit after the slot
  // passed, since an unconfirmed booking that came and went is exactly what
  // the salesman needs to know about) to +5h (start nagging once the slot is
  // close enough to matter). Runs every tick this function fires (every 5 min
  // per the pg_cron schedule), so dedup is by ref_id existing in
  // salesman_notifications rather than a time window — each pending booking
  // gets exactly one nag, not one per tick.
  //
  // Inserting into salesman_notifications is enough to deliver a real PWA
  // push — trg_push_on_salesman_notification (DB trigger) fans this out via
  // push_to_users()/send-push automatically. Do not also call send-push here,
  // that would double-send.
  const now2 = new Date();
  const nagWindowStart = new Date(now2.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const nagWindowEnd = new Date(now2.getTime() + 5 * 60 * 60 * 1000).toISOString();

  const { data: pendingAppts, error: pendingErr } = await supabase
    .from("appointments")
    .select("id, salesman_id, buyer_name, appointment_date")
    .eq("status", "pending")
    .not("salesman_id", "is", null)
    .gte("appointment_date", nagWindowStart)
    .lte("appointment_date", nagWindowEnd);

  if (pendingErr) {
    console.error("appointments query (Job 2):", pendingErr);
  } else {
    for (const apt of pendingAppts ?? []) {
      const { data: existing } = await supabase
        .from("salesman_notifications")
        .select("id")
        .eq("type", "booking_unconfirmed")
        .eq("ref_id", apt.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const aptDate = new Date(apt.appointment_date);
      const dateStr = aptDate.toLocaleDateString("en-MY", {
        weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur",
      });
      const timeStr = aptDate.toLocaleTimeString("en-MY", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur",
      });

      const { error: insErr } = await supabase.from("salesman_notifications").insert({
        salesman_id: apt.salesman_id,
        title: "Booking not confirmed",
        body: `${apt.buyer_name || "Lead"} — booking not confirmed for ${dateStr}, ${timeStr}`,
        type: "booking_unconfirmed",
        ref_id: apt.id,
        is_read: false,
      });

      if (!insErr) unconfirmedNags++;
      else console.error("salesman_notifications insert (Job 2):", insErr);
    }
  }

  return new Response(
    JSON.stringify({ sent: telegramSent, unconfirmed_nags: unconfirmedNags }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

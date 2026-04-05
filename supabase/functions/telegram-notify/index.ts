import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const payload = await req.json();
    const listing = payload.record;
    if (!listing) return new Response("no record", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_channel_id, telegram_auto_post, dealership, whatsapp_number")
      .eq("id", listing.dealer_id)
      .maybeSingle();

    if (!profile?.telegram_auto_post) return new Response("auto-post off", { status: 200 });
    if (!profile?.telegram_bot_token || !profile?.telegram_channel_id)
      return new Response("missing creds", { status: 200 });

    const l = listing;
    const discount = l.original_price && l.selling_price && l.original_price > l.selling_price
      ? `\n🔥 *Hot Deal* — Save RM ${(l.original_price - l.selling_price).toLocaleString()} (${Math.round(((l.original_price - l.selling_price) / l.original_price) * 100)}% off)`
      : "";

    const lines = [
      `🚗 *${l.year || ""} ${l.brand} ${l.model}${l.variant ? " " + l.variant : ""}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📋 *DETAILS*`,
      l.mileage ? `• Mileage: ${Number(l.mileage).toLocaleString()} km` : null,
      l.engine_cc ? `• Engine: ${Number(l.engine_cc).toLocaleString()} cc` : null,
      l.transmission ? `• Transmission: ${l.transmission}` : null,
      l.colour ? `• Colour: ${l.colour}` : null,
      l.condition ? `• Condition: ${l.condition.charAt(0).toUpperCase() + l.condition.slice(1)}` : null,
      l.city || l.state ? `• Location: ${[l.city, l.state].filter(Boolean).join(", ")}` : null,
      ``,
      `💰 *PRICE: RM ${(l.selling_price || 0).toLocaleString()}*`,
      l.original_price && l.original_price > l.selling_price
        ? `~Was: RM ${l.original_price.toLocaleString()}~` : null,
      discount || null,
      l.features ? `\n✨ *FEATURES*\n${l.features}` : null,
      l.specs ? `\n🔧 *SPECS*\n${l.specs}` : null,
      l.options ? `\n📝 *ABOUT*\n${l.options}` : null,
      ``,
      profile.whatsapp_number
        ? `📲 *Enquire:* https://wa.me/60${profile.whatsapp_number.replace(/\D/g, "")}`
        : null,
      ``,
      [l.brand, l.model, l.condition, l.state, "UsedCars", "Malaysia", "CarForSale"]
        .filter(Boolean)
        .map((t) => `#${t.replace(/\s+/g, "")}`)
        .join(" "),
    ].filter((x) => x !== null).join("\n");

    const hasPhoto = l.images && l.images.length > 0;
    const telegramUrl = `https://api.telegram.org/bot${profile.telegram_bot_token}/${hasPhoto ? "sendPhoto" : "sendMessage"}`;

    const body = hasPhoto
      ? { chat_id: profile.telegram_channel_id, photo: l.images[0], caption: lines, parse_mode: "Markdown" }
      : { chat_id: profile.telegram_channel_id, text: lines, parse_mode: "Markdown" };

    const tgRes = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) console.error("Telegram error:", tgData);

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 200 });
  }
});

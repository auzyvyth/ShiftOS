import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";

webpush.setVapidDetails(
  "mailto:support@xdrive.my",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const WARM_STAGES = ["contacted", "viewing_booked", "test_drive", "negotiating", "deposit_taken"];
const STALE_DAYS = 3;

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Find stale warm leads and their dealers
  const { data: staleLeads } = await supabase
    .from("leads")
    .select("dealer_id, buyer_name, stage, updated_at")
    .in("stage", WARM_STAGES)
    .eq("is_deleted", false)
    .lt("updated_at", cutoff);

  if (!staleLeads || staleLeads.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }));
  }

  // Group by dealer_id
  const byDealer: Record<string, { count: number; stages: string[] }> = {};
  for (const lead of staleLeads) {
    if (!lead.dealer_id) continue;
    if (!byDealer[lead.dealer_id]) byDealer[lead.dealer_id] = { count: 0, stages: [] };
    byDealer[lead.dealer_id].count++;
    if (!byDealer[lead.dealer_id].stages.includes(lead.stage)) {
      byDealer[lead.dealer_id].stages.push(lead.stage);
    }
  }

  const dealerIds = Object.keys(byDealer);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription")
    .in("user_id", dealerIds);

  if (!subs || subs.length === 0) return new Response(JSON.stringify({ notified: 0 }));

  let notified = 0;
  await Promise.allSettled(
    subs.map(async (row) => {
      const info = byDealer[row.user_id];
      if (!info) return;
      const payload = JSON.stringify({
        title: `${info.count} lead${info.count > 1 ? "s" : ""} going cold`,
        body: `${info.count} warm lead${info.count > 1 ? "s haven't" : " hasn't"} moved in ${STALE_DAYS}+ days. Time to follow up.`,
        url: "/dashboard",
        tag: "warm-leads-cold",
      });
      try {
        await webpush.sendNotification(row.subscription, payload);
        notified++;
      } catch { /* silent */ }
    }),
  );

  return new Response(JSON.stringify({ notified }));
});

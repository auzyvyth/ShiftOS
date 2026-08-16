import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";

// NOTE: deployed on Supabase for months without ever being committed here. This
// is the deployed v11 source plus the caller guard below. Diff against
// `mcp__Supabase__get_edge_function` before redeploying.

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:support@xdrive.my",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const WARM_STAGES = ["contacted", "viewing_booked", "test_drive", "negotiating", "deposit_taken"];
const STALE_DAYS = 3;

serve(async (req) => {
  // This is a cron job, not a user-facing endpoint, but it shipped with
  // verify_jwt=false and no auth — so anyone who knew the URL could re-trigger
  // the "leads going cold" push at will and spam every dealer. Same shared
  // secret as send-push; fails closed when unset.
  const sharedSecret = (Deno.env.get("PUSH_SHARED_SECRET") || "").trim();
  const presented = (req.headers.get("x-push-secret") || "").trim();
  if (sharedSecret.length === 0 || presented !== sharedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleLeads } = await supabase
    .from("leads")
    .select("dealer_id, buyer_name, stage, updated_at")
    .in("stage", WARM_STAGES)
    .eq("is_deleted", false)
    .lt("updated_at", cutoff);

  if (!staleLeads || staleLeads.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }));
  }

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

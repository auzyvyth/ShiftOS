import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Daily cron (00:00 UTC = 8am KL). Deployed v12 was ahead of this file (dealer
// escalation + Telegram); this is that version, merged and fixed 2026-09-24:
//
// - salesman_notifications has NO dealer_id column. The deployed job filtered
//   and inserted on it, so every salesman "handover overdue" alert was a 400
//   (157 a day) and the salesman — the step's primary owner — never heard.
// - It alerted once PER OVERDUE STEP: one dealer got 53 pushes in a morning.
//   An alert that arrives 53 times is muted, not read. Overdue steps now roll up
//   into ONE notification per person per day (every row IS a push via
//   trg_push_on_*_notification).
// - Telegram only goes out when the notification row was actually written.

const STEP_LABELS: Record<string, string> = {
  loan_settlement: "Settle outstanding loan",
  insurance: "Buyer insurance / cover note",
  puspakom_b5: "Puspakom B5 inspection",
  puspakom_b7: "Puspakom B7",
  jpj_transfer: "JPJ ownership transfer",
  road_tax: "Road tax renewal",
  geran_collection: "Collect new geran / VOC",
  handover: "Vehicle handover",
};

// Days a step must be overdue before the DEALER hears about it. The salesman
// owns the step and hears from day 1.
const ESCALATE_DAYS = 3;

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

async function sendTelegram(chatId: string | null | undefined, text: string) {
  if (!chatId || !botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (_e) {
    // best-effort — never block the notification bell
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  });
}

type Overdue = { buyer: string; step: string; days: number; leadId: string };

// "3 handover steps overdue across 2 deals" + the worst few, oldest first.
function summarise(items: Overdue[]) {
  items.sort((a, b) => b.days - a.days);
  const deals = new Set(items.map((i) => i.leadId)).size;
  const title = `${items.length} handover step${items.length === 1 ? "" : "s"} overdue` +
    (deals > 1 ? ` across ${deals} deals` : "");
  const top = items.slice(0, 3).map((i) => `${i.buyer}: ${i.step} (${i.days}d)`);
  const more = items.length > 3 ? ` +${items.length - 3} more` : "";
  return { title, body: top.join(" · ") + more };
}

serve(async (_req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const in7 = toDateString(addDays(today, 7));
  const in30 = toDateString(addDays(today, 30));
  const todayStr = toDateString(today);
  const oneDayAgo = new Date(today.getTime() - 86400000).toISOString();
  const todayIso = today.toISOString();

  let reminders_sent = 0;
  let handover_alerts = 0;
  let dealer_escalations = 0;
  const errors: string[] = [];

  // ── 1. Road tax / insurance expiry reminders (dealer bell) ─────────────────
  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, dealer_id, name, car_brand, car_model, car_plate, road_tax_expiry, insurance_expiry");
  if (custErr) errors.push(`customers: ${custErr.message}`);

  for (const c of customers ?? []) {
    for (const { field, title, label } of [
      { field: "road_tax_expiry" as const, title: "Road Tax Expiring", label: "road tax" },
      { field: "insurance_expiry" as const, title: "Insurance Expiring", label: "insurance" },
    ]) {
      const expiry: string | null = c[field];
      if (!expiry) continue;
      const expiryDate = expiry.slice(0, 10);
      if (expiryDate !== in7 && expiryDate !== in30) continue;
      const { data: ex } = await supabase.from("dealer_notifications").select("id")
        .eq("dealer_id", c.dealer_id).eq("type", "expiry_reminder").eq("ref_id", c.id).eq("title", title)
        .gte("created_at", oneDayAgo).limit(1);
      if (ex && ex.length > 0) continue;
      const body = `${c.name} · ${c.car_brand ?? ""} ${c.car_model ?? ""} ${c.car_plate ?? ""} — ${label} expires ${formatDate(expiryDate)}`.trim();
      const { error } = await supabase.from("dealer_notifications")
        .insert({ dealer_id: c.dealer_id, title, body, type: "expiry_reminder", ref_id: c.id, is_read: false });
      if (error) errors.push(`expiry: ${error.message}`);
      else reminders_sent++;
    }
  }

  // ── 2. Overdue handover steps — one roll-up per salesman, one per dealer ───
  const { data: tasks, error: tasksErr } = await supabase
    .from("post_sale_tasks")
    .select("id, dealer_id, step_key, due_date, leads!inner ( id, salesman_id, buyer_name )")
    .in("status", ["pending", "in_progress"]).not("due_date", "is", null).lt("due_date", todayStr);
  if (tasksErr) errors.push(`tasks: ${tasksErr.message}`);

  const bySalesman = new Map<string, Overdue[]>();
  const byDealer = new Map<string, Overdue[]>();
  for (const task of tasks ?? []) {
    const lead = Array.isArray(task.leads) ? task.leads[0] : task.leads;
    const salesmanId: string | null = lead?.salesman_id ?? null;
    const item: Overdue = {
      buyer: lead?.buyer_name ?? "Unknown buyer",
      step: STEP_LABELS[task.step_key] ?? task.step_key,
      days: Math.max(1, Math.floor((today.getTime() - new Date(task.due_date).getTime()) / 86400000)),
      leadId: lead?.id ?? task.id,
    };
    if (salesmanId) {
      if (!bySalesman.has(salesmanId)) bySalesman.set(salesmanId, []);
      bySalesman.get(salesmanId)!.push(item);
    }
    // Dealer: after ESCALATE_DAYS, or at once when nobody owns the deal. Not
    // when the dealer IS the salesman (owner-operator already got the ping).
    const escalate = !salesmanId || item.days >= ESCALATE_DAYS;
    if (escalate && salesmanId !== task.dealer_id) {
      if (!byDealer.has(task.dealer_id)) byDealer.set(task.dealer_id, []);
      byDealer.get(task.dealer_id)!.push(item);
    }
  }

  for (const [salesmanId, items] of bySalesman) {
    const { data: ex, error: exErr } = await supabase.from("salesman_notifications").select("id")
      .eq("salesman_id", salesmanId).eq("type", "handover_overdue").gte("created_at", todayIso).limit(1);
    if (exErr) { errors.push(`salesman dedup: ${exErr.message}`); continue; }
    if (ex && ex.length > 0) continue;
    const { title, body } = summarise(items);
    const { error } = await supabase.from("salesman_notifications")
      .insert({ salesman_id: salesmanId, title, body, type: "handover_overdue", is_read: false });
    if (error) { errors.push(`salesman insert: ${error.message}`); continue; }
    handover_alerts++;
    const { data: sp } = await supabase.from("profiles").select("telegram_chat_id").eq("id", salesmanId).single();
    await sendTelegram(sp?.telegram_chat_id, `*${title}*\n\n${body}\n\nOpen Handover to clear them.`);
  }

  for (const [dealerId, items] of byDealer) {
    const { data: ex, error: exErr } = await supabase.from("dealer_notifications").select("id")
      .eq("dealer_id", dealerId).eq("type", "handover_overdue").gte("created_at", todayIso).limit(1);
    if (exErr) { errors.push(`dealer dedup: ${exErr.message}`); continue; }
    if (ex && ex.length > 0) continue;
    const { title, body } = summarise(items);
    const { error } = await supabase.from("dealer_notifications")
      .insert({ dealer_id: dealerId, title, body, type: "handover_overdue", link_to: "handover", is_read: false });
    if (error) { errors.push(`dealer insert: ${error.message}`); continue; }
    dealer_escalations++;
    const { data: dp } = await supabase.from("profiles").select("telegram_chat_id").eq("id", dealerId).single();
    await sendTelegram(dp?.telegram_chat_id, `*${title}*\n\n${body}\n\nYour team hasn't cleared these yet.`);
  }

  if (errors.length) console.error("[expiry-reminders]", errors.join(" | "));
  return new Response(
    JSON.stringify({ ok: errors.length === 0, jobs: { reminders_sent, handover_alerts, dealer_escalations }, errors }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

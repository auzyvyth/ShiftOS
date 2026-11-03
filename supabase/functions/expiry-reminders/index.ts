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

serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // verify_jwt is off, and this had no check at all: anyone with the URL could
  // run it on demand and fire pushes + Telegram at every dealer. Only the
  // pg_cron job (jobid 5) holds the key; cron_key_matches answers yes/no and
  // never returns it. Same gate as notify-seller-unread.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let authorised = false;
  if (bearer) {
    const { data } = await supabase.rpc("cron_key_matches", { p_key: bearer });
    authorised = data === true;
  }
  if (!authorised) return new Response("unauthorized", { status: 401 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const in30 = toDateString(addDays(today, 30));
  const todayStr = toDateString(today);
  const todayIso = today.toISOString();

  let reminders_sent = 0;
  let handover_alerts = 0;
  let dealer_escalations = 0;
  const errors: string[] = [];

  // ── 1. Road tax / insurance renewals: 30 days out, then 7 days out ─────────
  // Fixed 2026-11-03:
  // - It wrote only to dealer_notifications. A solo seller's phone still got
  //   the push, but Lite/Premium read salesman_notifications, so it never showed
  //   in their bell and tapping it led nowhere. Now the SELLER gets a
  //   salesman_notifications row (ref_id = customer, the bell opens that buyer);
  //   a real dealer still gets their own row.
  // - It sent only when the expiry was EXACTLY 30 or 7 days away, so one missed
  //   daily run lost the reminder. Now each window (30..8 days, 7..0 days) sends
  //   once, on the first run inside it; the dedup looks back to the window start.
  // - Renewals are a Premium tool (the Sold tab). Lite sellers get no row: a
  //   push they cannot act on teaches them to block notifications.
  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, dealer_id, lead_id, name, car_brand, car_model, car_plate, road_tax_expiry, insurance_expiry")
    .or(`and(road_tax_expiry.gte.${todayStr},road_tax_expiry.lte.${in30}),and(insurance_expiry.gte.${todayStr},insurance_expiry.lte.${in30})`);
  if (custErr) errors.push(`customers: ${custErr.message}`);
  const custRows = customers ?? [];

  // Who sold each car (the lead's rep) and what each account is.
  const leadIds = [...new Set(custRows.map((c) => c.lead_id).filter(Boolean))];
  const repByLead = new Map<string, string | null>();
  if (leadIds.length) {
    const { data: leads, error } = await supabase.from("leads").select("id, salesman_id").in("id", leadIds);
    if (error) errors.push(`leads: ${error.message}`);
    for (const l of leads ?? []) repByLead.set(l.id, l.salesman_id);
  }
  const accountIds = [...new Set([...custRows.map((c) => c.dealer_id), ...repByLead.values()].filter(Boolean))] as string[];
  const accounts = new Map<string, Record<string, unknown>>();
  if (accountIds.length) {
    const { data: profs, error } = await supabase.from("profiles")
      .select("id, role, dealer_id, plan, plan_expires_at, payment_status, is_active").in("id", accountIds);
    if (error) errors.push(`profiles: ${error.message}`);
    for (const p of profs ?? []) accounts.set(p.id, p);
  }
  // Same rule as push_home_path: dealer-linked reps, or a paid-up Premium seller.
  const hasRenewals = (p?: Record<string, unknown>) => !!p && p.role === "salesman" && (
    p.dealer_id != null ||
    (p.is_active === true && p.plan === "salesman_full" &&
      ((p.plan_expires_at && new Date(p.plan_expires_at as string) > new Date()) || p.payment_status === "received"))
  );

  for (const c of custRows) {
    const owner = accounts.get(c.dealer_id);
    const rep = (c.lead_id && repByLead.get(c.lead_id)) || (owner?.role === "salesman" ? c.dealer_id : null);
    for (const { field, label } of [
      { field: "road_tax_expiry" as const, label: "Road tax" },
      { field: "insurance_expiry" as const, label: "Insurance" },
    ]) {
      const expiry: string | null = c[field];
      if (!expiry) continue;
      const expiryDate = expiry.slice(0, 10);
      const days = Math.round((new Date(`${expiryDate}T00:00:00Z`).getTime() - today.getTime()) / 86400000);
      if (days < 0 || days > 30) continue;
      const windowStart = addDays(new Date(`${expiryDate}T00:00:00Z`), days <= 7 ? -7 : -30).toISOString();
      const title = days === 0 ? `${label} expires today` : `${label} due in ${days} day${days === 1 ? "" : "s"}`;
      const car = [c.car_brand, c.car_model, c.car_plate].filter(Boolean).join(" ");
      const body = `${c.name ?? "Your buyer"}${car ? ` · ${car}` : ""} · expires ${formatDate(expiryDate)}. Send them a reminder.`;

      if (rep && hasRenewals(accounts.get(rep))) {
        const { data: ex, error: exErr } = await supabase.from("salesman_notifications").select("id")
          .eq("salesman_id", rep).eq("type", "expiry_reminder").eq("ref_id", c.id)
          .ilike("title", `${label}%`).gte("created_at", windowStart).limit(1);
        if (exErr) errors.push(`expiry dedup: ${exErr.message}`);
        else if (!ex?.length) {
          const { error } = await supabase.from("salesman_notifications")
            .insert({ salesman_id: rep, title, body, type: "expiry_reminder", ref_id: c.id, is_read: false });
          if (error) errors.push(`expiry salesman: ${error.message}`);
          else reminders_sent++;
        }
      }

      // A real dealer's own bell (never a solo seller: they ARE the rep above).
      if (owner && owner.role !== "salesman") {
        const { data: ex, error: exErr } = await supabase.from("dealer_notifications").select("id")
          .eq("dealer_id", c.dealer_id).eq("type", "expiry_reminder").eq("ref_id", c.id)
          .ilike("title", `${label}%`).gte("created_at", windowStart).limit(1);
        if (exErr) errors.push(`expiry dedup: ${exErr.message}`);
        else if (!ex?.length) {
          const { error } = await supabase.from("dealer_notifications")
            .insert({ dealer_id: c.dealer_id, title, body, type: "expiry_reminder", ref_id: c.id, link_to: "customers", is_read: false });
          if (error) errors.push(`expiry dealer: ${error.message}`);
          else reminders_sent++;
        }
      }
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

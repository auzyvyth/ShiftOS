import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD or full ISO string
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const in7 = toDateString(addDays(today, 7));
  const in30 = toDateString(addDays(today, 30));
  const todayStr = toDateString(today);
  const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

  let reminders_sent = 0;
  let handover_alerts = 0;

  // ─── Job 1: Road tax & insurance expiry reminders ────────────────────────

  const { data: customers, error: custErr } = await supabase
    .from("customers")
    .select("id, dealer_id, name, car_brand, car_model, car_plate, road_tax_expiry, insurance_expiry");

  if (custErr) {
    return new Response(JSON.stringify({ ok: false, error: custErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const customer of customers ?? []) {
    const checks: Array<{ field: "road_tax_expiry" | "insurance_expiry"; title: string }> = [
      { field: "road_tax_expiry", title: "Road Tax Expiring" },
      { field: "insurance_expiry", title: "Insurance Expiring" },
    ];

    for (const { field, title } of checks) {
      const expiry: string | null = customer[field];
      if (!expiry) continue;

      const expiryDate = expiry.slice(0, 10);
      if (expiryDate !== in7 && expiryDate !== in30) continue;

      const type = "expiry_reminder";
      const ref_id = customer.id;

      // Dedup: skip if already notified in the last 24 h with same type+ref_id+title
      const { data: existing } = await supabase
        .from("dealer_notifications")
        .select("id")
        .eq("dealer_id", customer.dealer_id)
        .eq("type", type)
        .eq("ref_id", ref_id)
        .eq("title", title)
        .gte("created_at", oneDayAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const label = field === "road_tax_expiry" ? "road tax" : "insurance";
      const body = `${customer.name} · ${customer.car_brand ?? ""} ${customer.car_model ?? ""} ${customer.car_plate ?? ""} — ${label} expires ${formatDate(expiryDate)}`.trim();

      const { error: insErr } = await supabase.from("dealer_notifications").insert({
        dealer_id: customer.dealer_id,
        title,
        body,
        type,
        ref_id,
        is_read: false,
      });

      if (!insErr) reminders_sent++;
    }
  }

  // ─── Job 2: Overdue handover step reminders ──────────────────────────────

  const { data: tasks, error: tasksErr } = await supabase
    .from("post_sale_tasks")
    .select(`
      id,
      dealer_id,
      step_key,
      due_date,
      leads!inner (
        id,
        salesman_id,
        buyer_name
      )
    `)
    .in("status", ["pending", "in_progress"])
    .not("due_date", "is", null)
    .lt("due_date", todayStr);

  if (tasksErr) {
    return new Response(JSON.stringify({ ok: false, error: tasksErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const task of tasks ?? []) {
    const lead = Array.isArray(task.leads) ? task.leads[0] : task.leads;
    const buyerName: string = lead?.buyer_name ?? "Unknown buyer";
    const salesmanId: string | null = lead?.salesman_id ?? null;
    const stepLabel = STEP_LABELS[task.step_key] ?? task.step_key;
    const type = "handover_overdue";
    const ref_id = task.id;
    const body = `${stepLabel} — ${buyerName} is overdue`;

    // Dedup dealer notification
    const { data: existingDealer } = await supabase
      .from("dealer_notifications")
      .select("id")
      .eq("dealer_id", task.dealer_id)
      .eq("type", type)
      .eq("ref_id", ref_id)
      .gte("created_at", oneDayAgo)
      .limit(1);

    if (!existingDealer || existingDealer.length === 0) {
      const { error: dInsErr } = await supabase.from("dealer_notifications").insert({
        dealer_id: task.dealer_id,
        title: "Handover Step Overdue",
        body,
        type,
        ref_id,
        is_read: false,
      });

      if (!dInsErr) handover_alerts++;
    }

    // Salesman notification (if task has a salesman)
    if (salesmanId) {
      const { data: existingSalesman } = await supabase
        .from("salesman_notifications")
        .select("id")
        .eq("dealer_id", task.dealer_id)
        .eq("salesman_id", salesmanId)
        .eq("type", type)
        .eq("ref_id", ref_id)
        .gte("created_at", oneDayAgo)
        .limit(1);

      if (!existingSalesman || existingSalesman.length === 0) {
        await supabase.from("salesman_notifications").insert({
          dealer_id: task.dealer_id,
          salesman_id: salesmanId,
          title: "Handover Step Overdue",
          body,
          type,
          ref_id,
          is_read: false,
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, jobs: { reminders_sent, handover_alerts } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

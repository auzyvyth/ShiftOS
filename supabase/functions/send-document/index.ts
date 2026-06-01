import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://xdrive.my",
  "https://www.xdrive.my",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".xdrive.my"))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function fmtRM(n: number | null | undefined) {
  return "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
}

// deno-lint-ignore no-explicit-any
function buildHtml(doc: Record<string, any>, dealership: string): string {
  const isHC = doc.doc_type === "Handover Checklist";
  const isDR = doc.doc_type === "Deposit Receipt";

  const checklist: string[] = Array.isArray(doc.metadata?.handover_items)
    ? doc.metadata.handover_items
    : [];

  const services: { name: string; selling_price?: number }[] = Array.isArray(doc.included_services_snapshot)
    ? doc.included_services_snapshot
    : [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${doc.doc_type} — ${doc.doc_ref || ""}</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f5;margin:0;padding:24px 0;}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);}
  .header{background:#111827;padding:28px 32px;color:#fff;}
  .header h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;}
  .header p{margin:6px 0 0;font-size:13px;color:#9ca3af;}
  .ref{display:inline-block;margin-top:10px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#fbbf24;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);border-radius:6px;padding:3px 10px;}
  .body{padding:28px 32px;}
  .section{margin-bottom:24px;}
  .section-title{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;}
  .field label{font-size:11px;color:#9ca3af;display:block;margin-bottom:2px;}
  .field p{font-size:14px;color:#111827;font-weight:500;margin:0;}
  .divider{height:1px;background:#e5e7eb;margin:20px 0;}
  .amount-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;}
  .amount-box .label{font-size:12px;color:#6b7280;}
  .amount-box .value{font-size:22px;font-weight:800;color:#111827;}
  .checklist{list-style:none;padding:0;margin:0;}
  .checklist li{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;}
  .checklist li:last-child{border-bottom:none;}
  .check{width:16px;height:16px;border-radius:4px;border:1.5px solid #d1d5db;display:inline-block;flex-shrink:0;}
  .footer{background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;}
  .footer p{font-size:11px;color:#9ca3af;margin:0;}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <p style="font-size:12px;color:#6b7280;margin:0 0 4px">${dealership}</p>
    <h1>${doc.doc_type}</h1>
    <p>Issued ${fmtDate(doc.issued_at)}</p>
    ${doc.doc_ref ? `<span class="ref">${doc.doc_ref}</span>` : ""}
  </div>
  <div class="body">

    <!-- Vehicle -->
    <div class="section">
      <p class="section-title">Vehicle</p>
      <div class="grid">
        <div class="field"><label>Make / Model</label><p>${[doc.car_brand, doc.car_model, doc.car_year].filter(Boolean).join(" ") || "—"}</p></div>
        <div class="field"><label>Colour</label><p>${doc.car_colour || "—"}</p></div>
        <div class="field"><label>Plate Number</label><p>${doc.car_plate || "—"}</p></div>
        <div class="field"><label>VIN / Chassis</label><p>${doc.car_vin || "—"}</p></div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Buyer -->
    <div class="section">
      <p class="section-title">Buyer</p>
      <div class="grid">
        <div class="field"><label>Name</label><p>${doc.buyer_name || "—"}</p></div>
        <div class="field"><label>IC Number</label><p>${doc.buyer_ic || "—"}</p></div>
        <div class="field"><label>Phone</label><p>${doc.buyer_phone || "—"}</p></div>
        <div class="field"><label>Address</label><p>${doc.buyer_address || "—"}</p></div>
      </div>
    </div>

    <div class="divider"></div>

    ${isHC ? `
    <!-- Handover checklist -->
    <div class="section">
      <p class="section-title">Handover Items</p>
      <ul class="checklist">
        ${checklist.map((item: string) => `<li><span class="check"></span>${item}</li>`).join("")}
      </ul>
    </div>
    ` : `
    <!-- Financials -->
    <div class="section">
      <p class="section-title">${isDR ? "Deposit Details" : "Sale Details"}</p>
      <div style="margin-bottom:12px">
        <div class="amount-box">
          <div>
            <p class="label">${isDR ? "Deposit Amount" : "Sale Price"}</p>
            <p class="value">${fmtRM(isDR ? doc.deposit_amount : doc.sale_price)}</p>
          </div>
          ${!isDR && doc.deposit_amount ? `
          <div style="text-align:right">
            <p class="label">Deposit Paid</p>
            <p style="font-size:16px;font-weight:700;color:#374151">${fmtRM(doc.deposit_amount)}</p>
          </div>` : ""}
        </div>
      </div>
      ${!isDR && doc.balance_amount ? `
      <div class="grid">
        <div class="field"><label>Balance Due</label><p style="color:#dc2626;font-weight:700">${fmtRM(doc.balance_amount)}</p></div>
        ${doc.metadata?.payment_deadline ? `<div class="field"><label>Payment Deadline</label><p>${fmtDate(doc.metadata.payment_deadline)}</p></div>` : ""}
        ${doc.metadata?.payment_method ? `<div class="field"><label>Payment Method</label><p>${doc.metadata.payment_method}</p></div>` : ""}
      </div>` : ""}
      ${doc.financing_bank ? `
      <div class="divider"></div>
      <p class="section-title" style="margin-top:16px">Financing</p>
      <div class="grid">
        <div class="field"><label>Bank</label><p>${doc.financing_bank}</p></div>
        <div class="field"><label>Loan Amount</label><p>${fmtRM(doc.loan_amount)}</p></div>
        <div class="field"><label>Tenure</label><p>${doc.loan_tenure_months ? doc.loan_tenure_months + " months" : "—"}</p></div>
        <div class="field"><label>Monthly Payment</label><p>${fmtRM(doc.monthly_payment)}</p></div>
      </div>` : ""}
    </div>
    `}

    ${services.length > 0 ? `
    <div class="divider"></div>
    <div class="section">
      <p class="section-title">Included Services</p>
      <ul class="checklist">
        ${services.map((svc) => `<li><span class="check" style="border-color:#34d399;background:rgba(52,211,153,0.1)"></span>${svc.name}${svc.selling_price ? ` — ${fmtRM(svc.selling_price)}` : ""}</li>`).join("")}
      </ul>
    </div>` : ""}

  </div>
  <div class="footer">
    <p>This document was generated by ${dealership} via ShiftOS.</p>
    <p style="margin-top:4px">Please retain this document for your records.</p>
  </div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // Verify caller is authenticated
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401, origin);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify the token belongs to a real user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, origin);

  let body: { doc_id: string; dealer_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  const { doc_id, dealer_id } = body;
  if (!doc_id || !dealer_id) return json({ error: "doc_id and dealer_id required" }, 400, origin);

  // Fetch document
  const { data: doc, error: docErr } = await supabase
    .from("dealer_documents")
    .select("*")
    .eq("id", doc_id)
    .eq("dealer_id", dealer_id)
    .single();

  if (docErr || !doc) return json({ error: "Document not found" }, 404, origin);
  if (doc.doc_status !== "issued") return json({ error: "Only issued documents can be emailed" }, 400, origin);
  if (!doc.buyer_email) return json({ error: "No buyer email on document" }, 400, origin);

  // Fetch dealer profile for dealership name and from-email
  const { data: dealer } = await supabase
    .from("profiles")
    .select("dealership, email")
    .eq("id", dealer_id)
    .single();

  const dealership = dealer?.dealership || "Your Dealer";

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return json({ error: "Email service not configured — RESEND_API_KEY not set" }, 500, origin);

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const subject = `${doc.doc_type}${doc.doc_ref ? ` — ${doc.doc_ref}` : ""} from ${dealership}`;
  const html = buildHtml(doc, dealership);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${dealership} <${fromEmail}>`,
      to: [doc.buyer_email],
      reply_to: dealer?.email ? [dealer.email] : undefined,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    console.error("[send-document] Resend error:", err);
    return json({ error: (err as { message?: string }).message || "Email send failed" }, 502, origin);
  }

  // Stamp sent timestamp
  await supabase
    .from("dealer_documents")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", doc_id);

  return json({ ok: true }, 200, origin);
});

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const ACCENT = "#22c55e";
const ANTH_MODEL = "claude-sonnet-4-20250514";

const DEAL_STATUS_COLORS = {
  pending:   { bg: "rgba(234,179,8,0.15)",  color: "#fbbf24" },
  disbursed: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  complete:  { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  flagged:   { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
};

const inp = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "#e5e7eb",
  fontSize: 12,
  padding: "5px 8px",
  outline: "none",
  width: "100%",
  fontFamily: "'DM Sans',sans-serif",
  boxSizing: "border-box",
};

const label11 = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const rm = (n) => `RM ${(n || 0).toLocaleString()}`;
const fmtMonth = (d) => d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const EXPENSE_CATS = ["rent", "salary", "advertising", "utilities", "repairs", "transport", "misc"];

const EXPENSE_CAT_COLORS = {
  rent:        { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  salary:      { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  advertising: { bg: "rgba(234,179,8,0.15)",  color: "#fbbf24" },
  utilities:   { bg: "rgba(20,184,166,0.15)", color: "#2dd4bf" },
  repairs:     { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
  transport:   { bg: "rgba(249,115,22,0.15)", color: "#fb923c" },
  misc:        { bg: "rgba(107,114,128,0.15)",color: "#9ca3af" },
};

const ADVISOR_PRESETS = [
  "Which salesman has the highest GP this month?",
  "Which units sold at a loss?",
  "What is our average recon cost this month?",
  "Show me deals with unpaid commissions",
  "What are our top expense categories?",
];

async function streamAnthropic(messages, systemPrompt, onChunk) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!key) { onChunk("[No VITE_ANTHROPIC_API_KEY set]"); return; }
  const body = { model: ANTH_MODEL, max_tokens: 1024, stream: true, messages };
  if (systemPrompt) body.system = systemPrompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) { onChunk(`[API error ${res.status}]`); return; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          onChunk(parsed.delta.text);
        }
      } catch { /* skip */ }
    }
  }
}

export default function AccountantPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("overview");

  // ── Overview ──────────────────────────────────────────────────
  const [overviewStats, setOverviewStats] = useState(null);
  const [overviewRows, setOverviewRows] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  // ── Deals ─────────────────────────────────────────────────────
  const [dealsRows, setDealsRows] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [expandedDealId, setExpandedDealId] = useState(null);
  const [dealDrafts, setDealDrafts] = useState({});
  const [dealSaving, setDealSaving] = useState({});

  // ── Commissions ───────────────────────────────────────────────
  const [commSubTab, setCommSubTab] = useState("rules");
  const [commRules, setCommRules] = useState([]);
  const [commRulesLoading, setCommRulesLoading] = useState(false);
  const [newRule, setNewRule] = useState({ label: "", basis: "gross_profit", rate_type: "percent", rate_value: "", min_gp: "" });
  const [commRuleSaving, setCommRuleSaving] = useState(false);
  const [commLedger, setCommLedger] = useState([]);
  const [commLedgerLoading, setCommLedgerLoading] = useState(false);

  // ── Expenses ──────────────────────────────────────────────────
  const [expenseRows, setExpenseRows] = useState([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "misc", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10), listing_ref: "" });
  const [expenseSaving, setExpenseSaving] = useState(false);

  // ── Month Close ───────────────────────────────────────────────
  const [closeMonth, setCloseMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [closeData, setCloseData] = useState(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeSaving, setCloseSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ── Advisor ───────────────────────────────────────────────────
  const [advisorMessages, setAdvisorMessages] = useState([]);
  const [advisorInput, setAdvisorInput] = useState("");
  const [advisorSending, setAdvisorSending] = useState(false);
  const advisorEndRef = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
      if (!p || p.role !== "accountant") { navigate("/login"); return; }
      setProfile(p);
      setLoading(false);
    });
  }, [navigate]);

  // ── Overview fetch ────────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "overview" || !profile?.dealer_id) return;
    setOverviewLoading(true);
    const start = new Date(viewMonth);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    supabase.from("stock_units")
      .select("purchase_price,recon_cost,sold_price,gross_profit,days_in_stock,sold_date,car_listings(brand,model,year)")
      .eq("dealer_id", profile.dealer_id).eq("status", "sold")
      .gte("sold_date", start.toISOString()).lt("sold_date", end.toISOString())
      .order("sold_date", { ascending: false })
      .then(({ data }) => {
        const rows = data || [];
        const totalRevenue = rows.reduce((s, r) => s + (r.sold_price || 0), 0);
        const totalGP = rows.reduce((s, r) => s + (r.gross_profit || 0), 0);
        const unitsSold = rows.length;
        const avgMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
        setOverviewStats({ totalRevenue, totalGP, unitsSold, avgMargin });
        setOverviewRows(rows);
        setOverviewLoading(false);
      });
  }, [activeNav, profile, viewMonth]);

  // ── Deals fetch ───────────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "deals" || !profile?.dealer_id) return;
    setDealsLoading(true);
    supabase.from("deal_financials")
      .select("*, car_listings(brand,model,year), profiles!salesman_id(full_name)")
      .eq("dealer_id", profile.dealer_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDealsRows(data || []); setDealsLoading(false); });
  }, [activeNav, profile]);

  const setDealField = useCallback((id, field, value) => {
    setDealDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  }, []);

  const saveDeal = useCallback(async (row) => {
    const draft = dealDrafts[row.id] || {};
    if (!Object.keys(draft).length) return;
    setDealSaving((p) => ({ ...p, [row.id]: true }));
    await supabase.from("deal_financials").update(draft).eq("id", row.id);
    setDealsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...draft } : r)));
    setDealDrafts((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
    setDealSaving((p) => ({ ...p, [row.id]: false }));
  }, [dealDrafts]);

  // ── Commissions fetch ─────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "commissions" || !profile?.dealer_id) return;
    setCommRulesLoading(true);
    setCommLedgerLoading(true);
    supabase.from("commission_rules")
      .select("*").eq("dealer_id", profile.dealer_id).order("created_at")
      .then(({ data }) => { setCommRules(data || []); setCommRulesLoading(false); });
    supabase.from("deal_financials")
      .select("*, car_listings(brand,model,year), profiles(full_name)")
      .eq("dealer_id", profile.dealer_id)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCommLedger(data || []); setCommLedgerLoading(false); });
  }, [activeNav, profile]);

  const toggleRule = useCallback(async (rule) => {
    const next = !rule.is_active;
    await supabase.from("commission_rules").update({ is_active: next }).eq("id", rule.id);
    setCommRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)));
  }, []);

  const addRule = useCallback(async () => {
    if (!newRule.label || !newRule.rate_value) return;
    setCommRuleSaving(true);
    const { data } = await supabase.from("commission_rules").insert({
      dealer_id: profile.dealer_id,
      label: newRule.label,
      basis: newRule.basis,
      rate_type: newRule.rate_type,
      rate_value: parseFloat(newRule.rate_value) || 0,
      min_gp: parseFloat(newRule.min_gp) || 0,
      is_active: true,
    }).select().single();
    if (data) setCommRules((prev) => [...prev, data]);
    setNewRule({ label: "", basis: "gross_profit", rate_type: "percent", rate_value: "", min_gp: "" });
    setCommRuleSaving(false);
  }, [newRule, profile]);

  const toggleCommPaid = useCallback(async (row) => {
    const next = !row.commission_paid;
    await supabase.from("deal_financials").update({
      commission_paid: next,
      commission_paid_at: next ? new Date().toISOString() : null,
    }).eq("id", row.id);
    setCommLedger((prev) => prev.map((r) => (r.id === row.id ? { ...r, commission_paid: next } : r)));
  }, []);

  // ── Expenses fetch ────────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "expenses" || !profile?.dealer_id) return;
    setExpenseLoading(true);
    supabase.from("expense_entries")
      .select("*").eq("dealer_id", profile.dealer_id)
      .order("expense_date", { ascending: false })
      .then(({ data }) => { setExpenseRows(data || []); setExpenseLoading(false); });
  }, [activeNav, profile]);

  const addExpense = useCallback(async () => {
    if (!newExpense.amount || !newExpense.description) return;
    setExpenseSaving(true);
    const payload = {
      dealer_id: profile.dealer_id,
      created_by: profile.id,
      category: newExpense.category,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount) || 0,
      expense_date: newExpense.expense_date,
    };
    if (newExpense.listing_ref.trim()) payload.listing_ref = newExpense.listing_ref.trim();
    const { data } = await supabase.from("expense_entries").insert(payload).select().single();
    if (data) setExpenseRows((prev) => [data, ...prev]);
    setNewExpense({ category: "misc", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10), listing_ref: "" });
    setExpenseSaving(false);
  }, [newExpense, profile]);

  const deleteExpense = useCallback(async (id) => {
    await supabase.from("expense_entries").delete().eq("id", id);
    setExpenseRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Month Close fetch ─────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "close" || !profile?.dealer_id) return;
    setCloseLoading(true);
    const mk = monthKey(closeMonth);
    const start = new Date(closeMonth);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    (async () => {
      // ensure row exists without overwriting existing state
      await supabase.from("month_close_checklist").upsert({
        dealer_id: profile.dealer_id,
        month: mk,
        commissions_approved: false,
        ar_reviewed: false,
        expenses_posted: false,
        status: "open",
      }, { onConflict: "dealer_id,month", ignoreDuplicates: true });

      const [{ data }, { count: uncostedCount }] = await Promise.all([
        supabase.from("month_close_checklist")
          .select("*").eq("dealer_id", profile.dealer_id).eq("month", mk).maybeSingle(),
        // count sold units missing purchase_price this month
        supabase.from("stock_units")
          .select("id", { count: "exact", head: true })
          .eq("dealer_id", profile.dealer_id).eq("status", "sold")
          .gte("sold_date", start.toISOString()).lt("sold_date", end.toISOString())
          .or("purchase_price.is.null,purchase_price.eq.0"),
      ]);

      setCloseData(data ? { ...data, _uncostedCount: uncostedCount || 0 } : null);
      setAiSummary(data?.ai_summary || "");
      setCloseLoading(false);
    })();
  }, [activeNav, profile, closeMonth]);

  const toggleCloseItem = useCallback(async (field) => {
    if (!closeData) return;
    const next = !closeData[field];
    const mk = monthKey(closeMonth);
    const update = { ...closeData, [field]: next };
    delete update._soldCount;
    await supabase.from("month_close_checklist").upsert(update, { onConflict: "dealer_id,month" });
    setCloseData((prev) => ({ ...prev, [field]: next }));
  }, [closeData, closeMonth]);

  const doCloseMonth = useCallback(async () => {
    if (!closeData || closeData.status === "closed") return;
    setCloseSaving(true);
    const update = { ...closeData, status: "closed", closed_at: new Date().toISOString() };
    delete update._uncostedCount;
    await supabase.from("month_close_checklist").upsert(update, { onConflict: "dealer_id,month" });
    setCloseData((prev) => ({ ...prev, status: "closed" }));
    setCloseSaving(false);
  }, [closeData]);

  const generateAiSummary = useCallback(async () => {
    if (closeData?.status !== "closed" || aiGenerating) return;
    setAiGenerating(true);
    setAiSummary("");
    const mk = monthKey(closeMonth);
    const start = new Date(closeMonth);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);

    const [{ data: soldRaw }, { data: dealRaw }, { data: expRaw }] = await Promise.all([
      supabase.from("stock_units")
        .select("gross_profit,days_in_stock,car_listings(brand,model,year,assigned_to,profiles!assigned_to(full_name))")
        .eq("dealer_id", profile.dealer_id).eq("status", "sold")
        .gte("sold_date", start.toISOString()).lt("sold_date", end.toISOString()),
      supabase.from("deal_financials")
        .select("commission_amount,commission_paid,commission_paid_at,status")
        .eq("dealer_id", profile.dealer_id),
      supabase.from("expense_entries")
        .select("category,amount").eq("dealer_id", profile.dealer_id)
        .gte("expense_date", mk + "-01").lte("expense_date", mk + "-31"),
    ]);

    const sold = soldRaw || [];
    const deals = dealRaw || [];
    const exps = expRaw || [];

    const totalGP = sold.reduce((s, r) => s + (r.gross_profit || 0), 0);
    const avgDays = sold.length ? (sold.reduce((s, r) => s + (r.days_in_stock || 0), 0) / sold.length).toFixed(1) : 0;
    const totalCommPaid = deals.filter((d) => d.commission_paid).reduce((s, d) => s + (d.commission_amount || 0), 0);
    const flaggedDeals = deals.filter((d) => d.status === "flagged").length;
    const totalExp = exps.reduce((s, r) => s + (r.amount || 0), 0);
    const expByCategory = exps.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + r.amount; return acc; }, {});

    const salesmanMap = {};
    sold.forEach((r) => {
      const name = r.car_listings?.profiles?.full_name || "Unassigned";
      if (!salesmanMap[name]) salesmanMap[name] = { units: 0, gross_profit: 0 };
      salesmanMap[name].units += 1;
      salesmanMap[name].gross_profit += r.gross_profit || 0;
    });

    const payload = {
      month: fmtMonth(closeMonth),
      units_sold: sold.length,
      total_gross_profit: totalGP,
      avg_days_in_stock: parseFloat(avgDays),
      total_expenses: totalExp,
      expenses_by_category: expByCategory,
      total_commissions_paid: totalCommPaid,
      flagged_deals: flaggedDeals,
      per_salesman: Object.entries(salesmanMap).map(([name, v]) => ({ name, ...v })),
    };

    const system = "You are a dealership financial advisor. Write a concise month-end summary in 3 short paragraphs: performance, commissions & expenses, and one recommendation. Use RM for currency. Be direct.";

    let full = "";
    await streamAnthropic([{ role: "user", content: JSON.stringify(payload) }], system, (chunk) => {
      full += chunk;
      setAiSummary(full);
    });

    const saveUpdate = { ...closeData, ai_summary: full, ai_generated_at: new Date().toISOString() };
    delete saveUpdate._uncostedCount;
    await supabase.from("month_close_checklist").upsert(saveUpdate, { onConflict: "dealer_id,month" });
    setAiGenerating(false);
  }, [closeData, closeMonth, profile, aiGenerating]);

  // ── Advisor ───────────────────────────────────────────────────
  const sendAdvisor = useCallback(async (text) => {
    const msg = (text || advisorInput).trim();
    if (!msg || advisorSending) return;
    setAdvisorInput("");
    setAdvisorMessages((prev) => [...prev, { role: "user", content: msg }]);
    setAdvisorSending(true);

    // fetch current month context
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [{ data: soldRaw }, { data: dealRaw }, { data: expRaw }] = await Promise.all([
      supabase.from("stock_units")
        .select("gross_profit,days_in_stock,recon_cost,car_listings(brand,model,year,assigned_to,profiles!assigned_to(full_name))")
        .eq("dealer_id", profile.dealer_id).eq("status", "sold")
        .gte("sold_date", start.toISOString()).lt("sold_date", end.toISOString()),
      supabase.from("deal_financials")
        .select("commission_amount,commission_paid,status,profiles!salesman_id(full_name)")
        .eq("dealer_id", profile.dealer_id),
      supabase.from("expense_entries")
        .select("category,amount")
        .eq("dealer_id", profile.dealer_id)
        .gte("expense_date", mk + "-01").lte("expense_date", mk + "-31"),
    ]);

    const sold = soldRaw || [];
    const deals = dealRaw || [];
    const exps = expRaw || [];

    const salesmanGP = {};
    sold.forEach((r) => {
      const name = r.car_listings?.profiles?.full_name || "Unassigned";
      salesmanGP[name] = (salesmanGP[name] || 0) + (r.gross_profit || 0);
    });

    const ctx = {
      month: now.toLocaleDateString("en-MY", { month: "long", year: "numeric" }),
      units_sold: sold.length,
      total_gp: sold.reduce((s, r) => s + (r.gross_profit || 0), 0),
      avg_days_in_stock: sold.length ? +(sold.reduce((s, r) => s + (r.days_in_stock || 0), 0) / sold.length).toFixed(1) : 0,
      avg_recon_cost: sold.length ? +(sold.reduce((s, r) => s + (r.recon_cost || 0), 0) / sold.length).toFixed(0) : 0,
      units_sold_at_loss: sold.filter((r) => (r.gross_profit || 0) < 0).map((r) => ({
        car: r.car_listings ? `${r.car_listings.year} ${r.car_listings.brand} ${r.car_listings.model}` : "Unknown",
        gp: r.gross_profit,
      })),
      salesman_gp: salesmanGP,
      unpaid_commissions: deals.filter((d) => !d.commission_paid).map((d) => ({
        salesman: d.profiles?.full_name || "Unknown",
        amount: d.commission_amount,
      })),
      flagged_deals: deals.filter((d) => d.status === "flagged").length,
      expenses_by_category: exps.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + (r.amount || 0); return acc; }, {}),
      total_expenses: exps.reduce((s, r) => s + (r.amount || 0), 0),
    };

    let ctxStr = JSON.stringify(ctx);
    if (ctxStr.length > 2000) ctxStr = ctxStr.slice(0, 2000) + "…";

    // build API history: previous clean turns (max 9) + new turn with context
    const prevTurns = advisorMessages.slice(-18); // 9 turns × 2 messages
    const apiMessages = [
      ...prevTurns,
      { role: "user", content: `[Context: ${ctxStr}]\n\n${msg}` },
    ];

    const system = "You are a dealership accountant AI. Answer questions about the dealer's financial data. Use RM for currency. Be concise and direct. If data is empty, say so.";

    let reply = "";
    setAdvisorMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    await streamAnthropic(apiMessages, system, (chunk) => {
      reply += chunk;
      setAdvisorMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: reply };
        return copy;
      });
    });

    // enforce 10-turn (20 message) cap
    setAdvisorMessages((prev) => prev.length > 20 ? prev.slice(-20) : prev);
    setAdvisorSending(false);
  }, [advisorInput, advisorMessages, advisorSending, profile]);

  useEffect(() => {
    advisorEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [advisorMessages]);

  // ─────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div style={{ minHeight: "100vh", background: "#05070e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6b7280", fontFamily: "'DM Sans',sans-serif" }}>Loading...</p>
      </div>
    );

  const NAV = [
    { id: "overview",     label: "P&L Overview" },
    { id: "deals",        label: "Deal Tracker" },
    { id: "commissions",  label: "Commissions" },
    { id: "expenses",     label: "Expenses" },
    { id: "close",        label: "Month Close" },
    { id: "advisor",      label: "AI Advisor" },
  ];

  const tbl = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
  const th = (left) => ({ padding: "10px 14px", textAlign: left ? "left" : "right", color: "#6b7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" });
  const td = (right) => ({ padding: "9px 14px", textAlign: right ? "right" : "left" });
  const tblWrap = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" };
  const tblRow = (alt) => ({ borderBottom: "1px solid rgba(255,255,255,0.04)", background: alt ? "rgba(255,255,255,0.01)" : "transparent" });

  // Commissions: calculate commission due per row (rule-based or fallback)
  const calcCommDue = (row) => {
    const rule = commRules.find((r) => r.id === row.commission_rule_id);
    if (rule) {
      const base = rule.basis === "gross_profit" ? (row.gross_profit || 0) : (row.selling_price || 0);
      return base * (rule.rate_value || 0) / 100;
    }
    return row.commission_amount || 0;
  };
  const unpaidTotal = commLedger.filter((r) => !r.commission_paid).reduce((s, r) => s + calcCommDue(r), 0);

  // Expenses: group by month
  const expByMonth = {};
  expenseRows.forEach((r) => {
    const mk = r.expense_date?.slice(0, 7) || "unknown";
    if (!expByMonth[mk]) expByMonth[mk] = [];
    expByMonth[mk].push(r);
  });

  // Close: all 4 items checked?
  const costsOk = closeData ? (closeData._uncostedCount === 0) : false;
  const isClosed = closeData?.status === "closed";
  const allChecked = costsOk && !!closeData?.commissions_approved && !!closeData?.ar_reviewed && !!closeData?.expenses_posted;

  return (
    <div style={{ minHeight: "100vh", background: "#05070e", fontFamily: "'DM Sans',sans-serif", color: "#f0f2f5" }}>
      {/* Header */}
      <header style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT }} />
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: ACCENT }}>ACCOUNTS</span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>{profile?.full_name}</span>
        <button onClick={() => supabase.auth.signOut().then(() => navigate("/login"))} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Logout</button>
      </header>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", display: "flex", gap: 0 }}>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setActiveNav(n.id)} style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: activeNav === n.id ? `2px solid ${ACCENT}` : "2px solid transparent", color: activeNav === n.id ? ACCENT : "#6b7280", fontSize: 13, fontWeight: activeNav === n.id ? 600 : 400, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s" }}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

        {/* ── OVERVIEW ── */}
        {activeNav === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#9ca3af", cursor: "pointer", fontSize: 16, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", minWidth: 120, textAlign: "center" }}>{fmtMonth(viewMonth)}</span>
              <button onClick={() => setViewMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#9ca3af", cursor: "pointer", fontSize: 16, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {[
                { label: "Total Revenue", value: overviewLoading || !overviewStats ? "—" : `RM ${overviewStats.totalRevenue.toLocaleString()}`, sub: "Sold this period" },
                { label: "Gross Profit",  value: overviewLoading || !overviewStats ? "—" : `RM ${overviewStats.totalGP.toLocaleString()}`, sub: "This period" },
                { label: "Units Sold",    value: overviewLoading || !overviewStats ? "—" : overviewStats.unitsSold, sub: "This period" },
                { label: "Avg Margin",    value: overviewLoading || !overviewStats ? "—" : `${overviewStats.avgMargin.toFixed(1)}%`, sub: "GP / Revenue" },
              ].map((c) => (
                <div key={c.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px" }}>
                  <p style={{ fontSize: 10, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{c.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb", marginBottom: 2 }}>{c.value}</p>
                  <p style={{ fontSize: 11, color: "#374151" }}>{c.sub}</p>
                </div>
              ))}
            </div>
            <div style={tblWrap}>
              <table style={tbl}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Car","Purchase","Recon","Sold","GP","Margin %","Days"].map((h) => (
                      <th key={h} style={th(h === "Car")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overviewLoading ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#374151" }}>Loading…</td></tr>
                  ) : overviewRows.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#374151" }}>No sold units this period</td></tr>
                  ) : overviewRows.map((r, i) => {
                    const car = r.car_listings;
                    const gp = r.gross_profit || 0;
                    const margin = r.sold_price > 0 ? (gp / r.sold_price) * 100 : 0;
                    const gpColor = gp < 0 ? "#f87171" : gp > 0 ? "#4ade80" : "#6b7280";
                    return (
                      <tr key={i} style={tblRow(i % 2)}>
                        <td style={{ ...td(false), color: "#e5e7eb" }}>{car ? `${car.year} ${car.brand} ${car.model}` : "—"}</td>
                        <td style={{ ...td(true), color: "#9ca3af" }}>{rm(r.purchase_price)}</td>
                        <td style={{ ...td(true), color: "#9ca3af" }}>{rm(r.recon_cost)}</td>
                        <td style={{ ...td(true), color: "#e5e7eb" }}>{rm(r.sold_price)}</td>
                        <td style={{ ...td(true), fontWeight: 600, color: gpColor }}>{rm(gp)}</td>
                        <td style={{ ...td(true), color: gpColor }}>{margin.toFixed(1)}%</td>
                        <td style={{ ...td(true), color: "#6b7280" }}>{r.days_in_stock ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEALS ── */}
        {activeNav === "deals" && (
          <div style={tblWrap}>
            <table style={tbl}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Car","Salesman","Selling Price","Deposit","Loan Bank","Disbursed","Status",""].map((h) => (
                    <th key={h} style={th(["Car","Salesman","Loan Bank",""].includes(h))}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealsLoading ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#374151" }}>Loading…</td></tr>
                ) : dealsRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#374151" }}>No deals found</td></tr>
                ) : dealsRows.map((row) => {
                  const car = row.car_listings;
                  const sc = DEAL_STATUS_COLORS[row.status] || DEAL_STATUS_COLORS.pending;
                  const isOpen = expandedDealId === row.id;
                  const draft = dealDrafts[row.id] || {};
                  const val = (f) => f in draft ? draft[f] : row[f];
                  return (
                    <React.Fragment key={row.id}>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: isOpen ? "rgba(255,255,255,0.03)" : "transparent" }} onClick={() => setExpandedDealId(isOpen ? null : row.id)}>
                        <td style={{ ...td(false), color: "#e5e7eb" }}>{car ? `${car.year} ${car.brand} ${car.model}` : "—"}</td>
                        <td style={{ ...td(false), color: "#9ca3af" }}>{row.profiles?.full_name || "—"}</td>
                        <td style={{ ...td(true), color: "#e5e7eb" }}>{rm(row.selling_price)}</td>
                        <td style={{ ...td(true), color: "#9ca3af" }}>{rm(row.deposit_received)}</td>
                        <td style={{ ...td(false), color: "#9ca3af" }}>{row.loan_bank || "—"}</td>
                        <td style={{ ...td(true), color: row.loan_disbursed ? "#4ade80" : "#6b7280" }}>{row.loan_disbursed ? "Yes" : "No"}</td>
                        <td style={td(true)}><span style={{ background: sc.bg, color: sc.color, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{row.status || "pending"}</span></td>
                        <td style={{ ...td(false), color: "#6b7280", fontSize: 14 }}>{isOpen ? "▲" : "▼"}</td>
                      </tr>
                      {isOpen && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <td colSpan={8} style={{ padding: "16px 20px", background: "rgba(0,0,0,0.2)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                              {[
                                { label: "Deposit Received (RM)", field: "deposit_received", type: "number" },
                                { label: "Deposit Date", field: "deposit_date", type: "date" },
                                { label: "Loan Amount (RM)", field: "loan_amount", type: "number" },
                                { label: "Loan Bank", field: "loan_bank", type: "text" },
                                { label: "Cash Balance (RM)", field: "cash_balance", type: "number" },
                                { label: "Commission (RM)", field: "commission_amount", type: "number" },
                              ].map(({ label, field, type }) => (
                                <div key={field}>
                                  <p style={label11}>{label}</p>
                                  <input type={type} value={val(field) ?? ""} onChange={(e) => setDealField(row.id, field, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} style={inp} />
                                </div>
                              ))}
                              <div>
                                <p style={label11}>Status</p>
                                <select value={val("status") || "pending"} onChange={(e) => setDealField(row.id, "status", e.target.value)} style={inp}>
                                  {["pending","disbursed","complete","flagged"].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 18 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
                                  <input type="checkbox" checked={!!val("loan_disbursed")} onChange={(e) => setDealField(row.id, "loan_disbursed", e.target.checked)} />
                                  Loan Disbursed
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
                                  <input type="checkbox" checked={!!val("commission_paid")} onChange={(e) => setDealField(row.id, "commission_paid", e.target.checked)} />
                                  Comm. Paid
                                </label>
                              </div>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <p style={label11}>Notes</p>
                                <textarea value={val("notes") ?? ""} onChange={(e) => setDealField(row.id, "notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
                              </div>
                            </div>
                            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                              <button onClick={() => saveDeal(row)} disabled={dealSaving[row.id]} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 6, padding: "6px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: dealSaving[row.id] ? 0.6 : 1 }}>
                                {dealSaving[row.id] ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── COMMISSIONS ── */}
        {activeNav === "commissions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["rules","ledger"].map((t) => (
                <button key={t} onClick={() => setCommSubTab(t)} style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: commSubTab === t ? `2px solid ${ACCENT}` : "2px solid transparent", color: commSubTab === t ? ACCENT : "#6b7280", fontSize: 12, fontWeight: commSubTab === t ? 600 : 400, cursor: "pointer", textTransform: "capitalize", fontFamily: "'DM Sans',sans-serif" }}>
                  {t === "rules" ? "Commission Rules" : "Ledger"}
                </button>
              ))}
            </div>

            {commSubTab === "rules" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Add rule form */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Add Rule</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                    <div>
                      <p style={label11}>Label</p>
                      <input value={newRule.label} onChange={(e) => setNewRule((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Standard GP" style={inp} />
                    </div>
                    <div>
                      <p style={label11}>Basis</p>
                      <select value={newRule.basis} onChange={(e) => setNewRule((p) => ({ ...p, basis: e.target.value }))} style={inp}>
                        <option value="gross_profit">Gross Profit</option>
                        <option value="selling_price">Selling Price</option>
                      </select>
                    </div>
                    <div>
                      <p style={label11}>Type</p>
                      <select value={newRule.rate_type} onChange={(e) => setNewRule((p) => ({ ...p, rate_type: e.target.value }))} style={inp}>
                        <option value="percent">Percent (%)</option>
                        <option value="flat">Flat (RM)</option>
                      </select>
                    </div>
                    <div>
                      <p style={label11}>Rate</p>
                      <input type="number" value={newRule.rate_value} onChange={(e) => setNewRule((p) => ({ ...p, rate_value: e.target.value }))} placeholder={newRule.rate_type === "percent" ? "e.g. 10" : "e.g. 500"} style={inp} />
                    </div>
                    <div>
                      <p style={label11}>Min GP (RM)</p>
                      <input type="number" value={newRule.min_gp} onChange={(e) => setNewRule((p) => ({ ...p, min_gp: e.target.value }))} placeholder="0" style={inp} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button onClick={addRule} disabled={commRuleSaving} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", opacity: commRuleSaving ? 0.6 : 1 }}>
                        {commRuleSaving ? "Adding…" : "Add Rule"}
                      </button>
                    </div>
                  </div>
                </div>
                {/* Rules list */}
                <div style={tblWrap}>
                  <table style={tbl}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Label","Basis","Type","Rate","Min GP","Active"].map((h) => (
                          <th key={h} style={th(h === "Label")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {commRulesLoading ? (
                        <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#374151" }}>Loading…</td></tr>
                      ) : commRules.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#374151" }}>No rules yet</td></tr>
                      ) : commRules.map((r, i) => (
                        <tr key={r.id} style={tblRow(i % 2)}>
                          <td style={{ ...td(false), color: "#e5e7eb" }}>{r.label}</td>
                          <td style={{ ...td(true), color: "#9ca3af", textTransform: "capitalize" }}>{r.basis?.replace("_", " ")}</td>
                          <td style={{ ...td(true), color: "#9ca3af", textTransform: "capitalize" }}>{r.rate_type}</td>
                          <td style={{ ...td(true), color: "#e5e7eb" }}>{r.rate_type === "percent" ? `${r.rate_value}%` : rm(r.rate_value)}</td>
                          <td style={{ ...td(true), color: "#9ca3af" }}>{rm(r.min_gp)}</td>
                          <td style={td(true)}>
                            <button onClick={() => toggleRule(r)} style={{ background: r.is_active ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)", color: r.is_active ? "#4ade80" : "#6b7280", border: "none", borderRadius: 4, padding: "2px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              {r.is_active ? "Active" : "Off"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {commSubTab === "ledger" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={tblWrap}>
                  <table style={tbl}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Car","Salesman","GP","Rule Applied","Commission Due","Paid?"].map((h) => (
                          <th key={h} style={th(["Car","Salesman","Rule Applied"].includes(h))}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {commLedgerLoading ? (
                        <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#374151" }}>Loading…</td></tr>
                      ) : commLedger.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#374151" }}>No settled deals</td></tr>
                      ) : commLedger.map((r, i) => {
                        const car = r.car_listings;
                        const rule = commRules.find((ru) => ru.id === r.commission_rule_id);
                        const commDue = calcCommDue(r);
                        const gpColor = (r.gross_profit || 0) < 0 ? "#f87171" : "#4ade80";
                        return (
                          <tr key={r.id} style={tblRow(i % 2)}>
                            <td style={{ ...td(false), color: "#e5e7eb" }}>{car ? `${car.year} ${car.brand} ${car.model}` : "—"}</td>
                            <td style={{ ...td(false), color: "#9ca3af" }}>{r.profiles?.full_name || "—"}</td>
                            <td style={{ ...td(true), fontWeight: 600, color: gpColor }}>{rm(r.gross_profit)}</td>
                            <td style={{ ...td(false), color: "#9ca3af", fontSize: 11 }}>{rule ? rule.label : <span style={{ color: "#374151" }}>—</span>}</td>
                            <td style={{ ...td(true), fontWeight: 600, color: "#e5e7eb" }}>{rm(commDue)}</td>
                            <td style={td(true)}>
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, cursor: "pointer" }}>
                                <input type="checkbox" checked={!!r.commission_paid} onChange={() => toggleCommPaid(r)} />
                                <span style={{ fontSize: 11, color: r.commission_paid ? "#4ade80" : "#6b7280" }}>{r.commission_paid ? "Paid" : "Unpaid"}</span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                      {!commLedgerLoading && commLedger.length > 0 && (
                        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
                          <td colSpan={4} style={{ ...td(false), color: "#6b7280", fontSize: 11 }}>Total unpaid commissions</td>
                          <td style={{ ...td(true), fontWeight: 700, color: "#f87171" }}>{rm(unpaidTotal)}</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES ── */}
        {activeNav === "expenses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Add form */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Add Expense</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <p style={label11}>Category</p>
                  <select value={newExpense.category} onChange={(e) => setNewExpense((p) => ({ ...p, category: e.target.value }))} style={inp}>
                    {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <p style={label11}>Description</p>
                  <input value={newExpense.description} onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Office rent May" style={inp} />
                </div>
                <div>
                  <p style={label11}>Amount (RM)</p>
                  <input type="number" value={newExpense.amount} onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))} placeholder="0" style={inp} />
                </div>
                <div>
                  <p style={label11}>Date</p>
                  <input type="date" value={newExpense.expense_date} onChange={(e) => setNewExpense((p) => ({ ...p, expense_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <p style={label11}>Linked Listing (optional)</p>
                  <input value={newExpense.listing_ref} onChange={(e) => setNewExpense((p) => ({ ...p, listing_ref: e.target.value }))} placeholder="e.g. Honda Civic plate" style={inp} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button onClick={addExpense} disabled={expenseSaving} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", opacity: expenseSaving ? 0.6 : 1 }}>
                    {expenseSaving ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            </div>

            {/* Grouped table */}
            {expenseLoading ? (
              <p style={{ color: "#374151", textAlign: "center", padding: 24, fontSize: 13 }}>Loading…</p>
            ) : Object.keys(expByMonth).length === 0 ? (
              <p style={{ color: "#374151", textAlign: "center", padding: 24, fontSize: 13 }}>No expenses yet</p>
            ) : Object.keys(expByMonth).sort().reverse().map((mk) => {
              const rows = expByMonth[mk];
              const subtotal = rows.reduce((s, r) => s + (r.amount || 0), 0);
              const [yr, mo] = mk.split("-");
              const moLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
              return (
                <div key={mk} style={tblWrap}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{moLabel}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Subtotal: <strong style={{ color: "#e5e7eb" }}>{rm(subtotal)}</strong></span>
                  </div>
                  <table style={tbl}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Date","Category","Description","Amount",""].map((h) => (
                          <th key={h} style={th(["Date","Category","Description"].includes(h))}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const catCfg = EXPENSE_CAT_COLORS[r.category] || EXPENSE_CAT_COLORS.misc;
                        return (
                          <tr key={r.id} style={tblRow(i % 2)}>
                            <td style={{ ...td(false), color: "#6b7280", fontSize: 11, whiteSpace: "nowrap", width: 90 }}>{r.expense_date}</td>
                            <td style={{ ...td(false), width: 110 }}>
                              <span style={{ background: catCfg.bg, color: catCfg.color, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize", whiteSpace: "nowrap" }}>{r.category}</span>
                            </td>
                            <td style={{ ...td(false), color: "#e5e7eb" }}>
                              {r.description}
                              {r.listing_ref && <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280" }}>· {r.listing_ref}</span>}
                            </td>
                            <td style={{ ...td(true), fontWeight: 600, color: "#e5e7eb", whiteSpace: "nowrap" }}>{rm(r.amount)}</td>
                            <td style={{ ...td(true), width: 36 }}>
                              <button onClick={() => deleteExpense(r.id)} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }} title="Delete">×</button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
                        <td colSpan={3} style={{ ...td(false), color: "#6b7280", fontSize: 11 }}>Month subtotal</td>
                        <td style={{ ...td(true), fontWeight: 700, color: "#e5e7eb" }}>{rm(subtotal)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
            {/* Grand total */}
            {!expenseLoading && expenseRows.length > 0 && (
              <div style={{ textAlign: "right", fontSize: 13, color: "#9ca3af", paddingRight: 4 }}>
                Grand total: <strong style={{ color: "#e5e7eb" }}>{rm(expenseRows.reduce((s, r) => s + (r.amount || 0), 0))}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── MONTH CLOSE ── */}
        {activeNav === "close" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Month selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setCloseMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#9ca3af", cursor: "pointer", fontSize: 16, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", minWidth: 120, textAlign: "center" }}>{fmtMonth(closeMonth)}</span>
              <button onClick={() => setCloseMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#9ca3af", cursor: "pointer", fontSize: 16, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              {closeData?.closed && <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, marginLeft: 8 }}>✓ CLOSED</span>}
            </div>

            {closeLoading ? (
              <p style={{ color: "#374151", fontSize: 13 }}>Loading…</p>
            ) : (
              <>
                {/* Checklist */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
                  <p style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Pre-Close Checklist</p>
                  {[
                    {
                      key: "costs",
                      label: "All sold units have costs posted",
                      auto: true,
                      checked: costsOk,
                      sub: costsOk
                        ? "All sold units have purchase price posted"
                        : `${closeData?._uncostedCount || 0} unit(s) missing purchase price`,
                    },
                    { key: "commissions_approved", label: "Commissions reviewed",                  auto: false },
                    { key: "ar_reviewed",           label: "Outstanding receivables reviewed",      auto: false },
                    { key: "expenses_posted",       label: "Expenses posted",                       auto: false },
                  ].map(({ key, label, auto, checked: forcedCheck, sub }, idx, arr) => {
                    const isChecked = auto ? forcedCheck : !!closeData?.[key];
                    const isLast = idx === arr.length - 1;
                    return (
                      <div
                        key={key}
                        onClick={auto || isClosed ? undefined : () => toggleCloseItem(key)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 14,
                          padding: "14px 0",
                          borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
                          cursor: auto || isClosed ? "default" : "pointer",
                        }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isChecked ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                          border: `2px solid ${isChecked ? ACCENT : "rgba(255,255,255,0.12)"}`,
                        }}>
                          {isChecked && <span style={{ color: ACCENT, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: isChecked ? "#e5e7eb" : "#6b7280", marginBottom: sub ? 3 : 0 }}>{label}</p>
                          {sub && <p style={{ fontSize: 11, color: isChecked ? "#4ade80" : "#f87171" }}>{sub}</p>}
                          {auto && !sub && <p style={{ fontSize: 10, color: "#374151" }}>Auto-validated</p>}
                        </div>
                        {!auto && !isClosed && (
                          <span style={{ fontSize: 11, color: isChecked ? "#4ade80" : "#374151", alignSelf: "center", minWidth: 40, textAlign: "right" }}>
                            {isChecked ? "Done" : "Mark"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {!isClosed && (
                    <button
                      onClick={doCloseMonth}
                      disabled={!allChecked || closeSaving}
                      style={{ alignSelf: "flex-start", marginTop: 16, background: allChecked ? ACCENT : "rgba(255,255,255,0.05)", color: allChecked ? "#000" : "#374151", border: "none", borderRadius: 8, padding: "8px 24px", fontSize: 13, fontWeight: 700, cursor: allChecked ? "pointer" : "not-allowed", transition: "all 0.2s" }}
                    >
                      {closeSaving ? "Closing…" : "Close Month"}
                    </button>
                  )}
                </div>

                {/* AI Summary */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: 2 }}>AI Month Summary</p>
                      {closeData?.ai_generated_at && !aiGenerating && (
                        <p style={{ fontSize: 10, color: "#374151", marginTop: 3 }}>
                          Generated {new Date(closeData.ai_generated_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={generateAiSummary}
                      disabled={!isClosed || aiGenerating}
                      style={{ background: isClosed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", color: isClosed ? ACCENT : "#374151", border: `1px solid ${isClosed ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: isClosed && !aiGenerating ? "pointer" : "not-allowed" }}
                    >
                      {aiGenerating ? "Generating…" : !isClosed ? "Close month first" : aiSummary ? "Regenerate" : "Generate Summary"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={aiSummary || (isClosed ? "Click Generate Summary to create an AI summary of this month." : "Month must be closed before generating a summary.")}
                    rows={10}
                    style={{ ...inp, resize: "vertical", color: aiSummary ? "#e5e7eb" : "#374151", cursor: "default", lineHeight: 1.7 }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ADVISOR ── */}
        {activeNav === "advisor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
            {/* Presets — 2-col grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ADVISOR_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendAdvisor(p)}
                  disabled={advisorSending}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#9ca3af", fontSize: 12, padding: "9px 14px", cursor: advisorSending ? "not-allowed" : "pointer", textAlign: "left", lineHeight: 1.4, opacity: advisorSending ? 0.5 : 1, transition: "background 0.15s" }}
                  onMouseEnter={(e) => { if (!advisorSending) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Chat window */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, minHeight: 360, maxHeight: 520, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {advisorMessages.length === 0 ? (
                <p style={{ color: "#374151", fontSize: 13, textAlign: "center", margin: "auto" }}>Ask a question or pick a preset above.</p>
              ) : advisorMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "82%", background: m.role === "user" ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)", border: `1px solid ${m.role === "user" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)"}`, borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 14px", fontSize: 13, color: m.role === "user" ? "#86efac" : "#e5e7eb", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                    {m.content || <span style={{ color: "#374151" }}>…</span>}
                  </div>
                </div>
              ))}
              <div ref={advisorEndRef} />
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={advisorInput}
                onChange={(e) => setAdvisorInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendAdvisor())}
                placeholder="Ask about this month's finances…"
                disabled={advisorSending}
                style={{ ...inp, flex: 1, padding: "9px 12px", fontSize: 13 }}
              />
              <button onClick={() => sendAdvisor()} disabled={advisorSending || !advisorInput.trim()} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 8, padding: "0 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: advisorSending || !advisorInput.trim() ? 0.5 : 1 }}>
                {advisorSending ? "…" : "Send"}
              </button>
              {advisorMessages.length > 0 && !advisorSending && (
                <button onClick={() => setAdvisorMessages([])} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#374151", fontSize: 12, padding: "0 12px", cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

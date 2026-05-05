import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "../supabaseClient";

const ACCENT = "#22c55e";
const ANTH_MODEL = "claude-sonnet-4-20250514";

const DEAL_STATUS_COLORS = {
  pending: { bg: "rgba(234,179,8,0.15)", color: "#fbbf24" },
  disbursed: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  complete: { bg: "rgba(34,197,94,0.15)", color: "#4ade80" },
  flagged: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
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

const label11 = {
  fontSize: 10,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 4,
};
const rm = (n) => `RM ${(n || 0).toLocaleString()}`;
const fmtMonth = (d) =>
  d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const EXPENSE_CATS = [
  "rent",
  "salary",
  "advertising",
  "utilities",
  "repairs",
  "transport",
  "misc",
];

const EXPENSE_CAT_COLORS = {
  rent: { bg: "rgba(139,92,246,0.15)", color: "#a78bfa" },
  salary: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  advertising: { bg: "rgba(234,179,8,0.15)", color: "#fbbf24" },
  utilities: { bg: "rgba(20,184,166,0.15)", color: "#2dd4bf" },
  repairs: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  transport: { bg: "rgba(249,115,22,0.15)", color: "#fb923c" },
  misc: { bg: "rgba(107,114,128,0.15)", color: "#9ca3af" },
};

const ADVISOR_PRESETS = [
  "Which salesman has the highest GP this month?",
  "Which units sold at a loss?",
  "What is our average recon cost this month?",
  "Show me deals with unpaid commissions",
  "What are our top expense categories?",
];

const MY_BANK_RATES = {
  "Maybank":            2.42,
  "CIMB":               2.42,
  "Public Bank":        2.28,
  "RHB":                2.40,
  "Hong Leong Bank":    2.35,
  "AmBank":             2.50,
  "Bank Islam":         2.72,
  "Bank Rakyat":        2.65,
  "Affin Bank":         2.50,
  "Alliance Bank":      2.45,
  "OCBC":               2.40,
  "Standard Chartered": 2.38,
  "BSN":                2.25,
  "Other":              2.50,
};

async function streamAnthropic(messages, systemPrompt, onChunk) {
  const AI_PROXY =
    "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/ai/messages";
  const body = { model: ANTH_MODEL, max_tokens: 1024, stream: true, messages };
  if (systemPrompt) body.system = systemPrompt;
  const res = await fetch(AI_PROXY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    onChunk(`[API error ${res.status}]`);
    return;
  }
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
      } catch {
        /* skip */
      }
    }
  }
}

export default function AccountantPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("overview");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Overview ──────────────────────────────────────────────────
  const [overviewStats, setOverviewStats] = useState(null);
  const [overviewRows, setOverviewRows] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewKey, setOverviewKey] = useState(0);
  const [netProfitData, setNetProfitData] = useState({
    expenses: 0,
    commPaid: 0,
  });

  // ── Inline grid editing ───────────────────────────────────────
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, field }
  const [cellDraft, setCellDraft] = useState("");
  const [cellSaving, setCellSaving] = useState(false);
  const cellInputRef = useRef(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
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
  const [newRule, setNewRule] = useState({
    label: "",
    basis: "gp",
    rate_type: "percent",
    rate_value: "",
    min_gp: "",
  });
  const [commRuleSaving, setCommRuleSaving] = useState(false);
  const [commLedger, setCommLedger] = useState([]);
  const [commLedgerLoading, setCommLedgerLoading] = useState(false);

  // ── Expenses ──────────────────────────────────────────────────
  const [expenseRows, setExpenseRows] = useState([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: "misc",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    listing_ref: "",
  });
  const [expenseSaving, setExpenseSaving] = useState(false);

  // ── Month Close ───────────────────────────────────────────────
  const [closeMonth, setCloseMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
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

  // ── Accounts Receivable ───────────────────────────────────────
  const [arRows, setArRows] = useState([]);
  const [arLoading, setArLoading] = useState(false);
  const [arDisbursing, setArDisbursing] = useState({});

  // ── Stock Valuation ───────────────────────────────────────────
  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockStats, setStockStats] = useState(null);

  // ── KPI Dashboard ─────────────────────────────────────────────
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiMonthly, setKpiMonthly] = useState([]);
  const [kpiSalesmen, setKpiSalesmen] = useState([]);
  const [kpiSummary, setKpiSummary] = useState(null);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) {
        navigate("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!p || p.role !== "accountant") {
        navigate("/login");
        return;
      }
      setProfile(p);
      setLoading(false);
      const loadNotifs = () =>
        supabase
          .from("salesman_notifications")
          .select("*")
          .eq("salesman_id", p.id)
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data: d }) => setNotifications(d || []));
      loadNotifs();
      const ch = supabase
        .channel("acct_notifs_" + p.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "salesman_notifications",
            filter: `salesman_id=eq.${p.id}`,
          },
          loadNotifs,
        )
        .subscribe();
      return () => supabase.removeChannel(ch);
    });
  }, [navigate]);

  // ── Overview fetch ────────────────────────────────────────────
  // Primary: car_listings (source of truth for sold cars)
  // Enrichment: stock_units (purchase price, days in stock, GP)
  useEffect(() => {
    if (activeNav !== "overview" || !profile?.dealer_id) return;
    setOverviewLoading(true);
    setNetProfitData({ expenses: 0, commPaid: 0 });
    const dealerId = profile.dealer_id;
    const start = new Date(viewMonth);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    Promise.all([
      supabase
        .from("car_listings")
        .select("id,brand,model,year,selling_price,recon_cost,sold_at")
        .eq("dealer_id", dealerId)
        .eq("status", "sold")
        .gte("sold_at", start.toISOString())
        .lt("sold_at", end.toISOString())
        .order("sold_at", { ascending: false }),
      supabase
        .from("stock_units")
        .select(
          "id,listing_id,purchase_price,recon_cost,sold_price,gross_profit,days_in_stock,included_services_cost",
        )
        .eq("dealer_id", dealerId),
      supabase
        .from("expense_entries")
        .select("amount")
        .eq("dealer_id", dealerId)
        .gte("expense_date", start.toISOString().slice(0, 10))
        .lt("expense_date", end.toISOString().slice(0, 10)),
      supabase
        .from("deal_financials")
        .select("commission_amount")
        .eq("dealer_id", dealerId)
        .eq("commission_paid", true)
        .gte("commission_paid_at", start.toISOString())
        .lt("commission_paid_at", end.toISOString()),
    ]).then(
      ([
        { data: cars },
        { data: units },
        { data: expData },
        { data: commData },
      ]) => {
        const unitMap = {};
        (units || []).forEach((u) => {
          unitMap[u.listing_id] = u;
        });

        const rows = (cars || []).map((car) => {
          const unit = unitMap[car.id] || {};
          const purchase = unit.purchase_price || 0;
          const recon = unit.recon_cost ?? car.recon_cost ?? 0;
          const sold = unit.sold_price || car.selling_price || 0;
          const services = unit.included_services_cost ?? 0;
          const gp =
            unit.gross_profit != null
              ? unit.gross_profit
              : sold - purchase - recon - services;
          return {
            car_listing_id: car.id,
            stock_unit_id: unit.id || null,
            car_listings: {
              year: car.year,
              brand: car.brand,
              model: car.model,
            },
            purchase_price: purchase,
            recon_cost: recon,
            sold_price: sold,
            gross_profit: gp,
            days_in_stock: unit.days_in_stock ?? null,
            services_cost: services,
          };
        });

        const totalRevenue = rows.reduce((s, r) => s + (r.sold_price || 0), 0);
        const totalGP = rows.reduce((s, r) => s + (r.gross_profit || 0), 0);
        const unitsSold = rows.length;
        const avgMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
        const totalServicesCost = rows.reduce(
          (s, r) => s + (r.services_cost || 0),
          0,
        );
        setOverviewStats({
          totalRevenue,
          totalGP,
          unitsSold,
          avgMargin,
          totalServicesCost,
        });
        const totalExpenses = (expData || []).reduce(
          (s, r) => s + (r.amount || 0),
          0,
        );
        const totalCommPaid = (commData || []).reduce(
          (s, r) => s + (r.commission_amount || 0),
          0,
        );
        setNetProfitData({ expenses: totalExpenses, commPaid: totalCommPaid });
        setOverviewRows(rows);
        setOverviewLoading(false);
      },
    );
  }, [activeNav, profile, viewMonth, overviewKey]);

  // ── Overview realtime ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.dealer_id) return;
    const dealerId = profile.dealer_id;
    const bump = () => setOverviewKey((k) => k + 1);
    const ch = supabase
      .channel("acct_overview_" + dealerId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "car_listings",
          filter: `dealer_id=eq.${dealerId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_units",
          filter: `dealer_id=eq.${dealerId}`,
        },
        bump,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile]);

  // ── Save inline cell edit ─────────────────────────────────────
  const saveCellEdit = useCallback(async () => {
    if (!editingCell || cellSaving) return;
    const { rowIdx, field } = editingCell;
    const row = overviewRows[rowIdx];
    if (!row) return;
    const numVal = parseFloat(cellDraft) || 0;
    const purchase =
      field === "purchase_price" ? numVal : row.purchase_price || 0;
    const recon = field === "recon_cost" ? numVal : row.recon_cost || 0;
    const sold = field === "sold_price" ? numVal : row.sold_price || 0;
    const newGP = sold - purchase - recon - (row.services_cost || 0);

    // optimistic update + live summary recalc
    setOverviewRows((prev) => {
      const updated = prev.map((r, i) => {
        if (i !== rowIdx) return r;
        return { ...r, [field]: numVal, gross_profit: newGP };
      });
      const totalRevenue = updated.reduce((s, r) => s + (r.sold_price || 0), 0);
      const totalGP = updated.reduce((s, r) => s + (r.gross_profit || 0), 0);
      const totalServicesCost = updated.reduce(
        (s, r) => s + (r.services_cost || 0),
        0,
      );
      const unitsSold = updated.length;
      const avgMargin = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
      setOverviewStats({
        totalRevenue,
        totalGP,
        unitsSold,
        avgMargin,
        totalServicesCost,
      });
      return updated;
    });
    setEditingCell(null);
    setCellSaving(true);

    if (row.stock_unit_id) {
      // existing stock_unit — just update it
      await supabase
        .from("stock_units")
        .update({ [field]: numVal, gross_profit: newGP })
        .eq("id", row.stock_unit_id);
    } else {
      // no stock_unit yet — create one scoped to this listing
      const { data: newUnit } = await supabase
        .from("stock_units")
        .insert({
          dealer_id: profile.dealer_id,
          listing_id: row.car_listing_id,
          status: "sold",
          sold_price: row.sold_price,
          recon_cost: row.recon_cost,
          [field]: numVal,
          gross_profit: newGP,
        })
        .select("id")
        .single();
      if (newUnit) {
        setOverviewRows((prev) =>
          prev.map((r, i) =>
            i === rowIdx ? { ...r, stock_unit_id: newUnit.id } : r,
          ),
        );
      }
    }

    // Keep car_listings in sync for the two fields it stores
    if (field === "sold_price") {
      await supabase
        .from("car_listings")
        .update({ selling_price: numVal })
        .eq("id", row.car_listing_id);
    }
    if (field === "recon_cost") {
      await supabase
        .from("car_listings")
        .update({ recon_cost: numVal })
        .eq("id", row.car_listing_id);
    }

    setCellSaving(false);
  }, [editingCell, cellDraft, overviewRows, cellSaving, profile]);

  useEffect(() => {
    if (editingCell) cellInputRef.current?.select();
  }, [editingCell]);

  // ── Deals fetch ───────────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "deals" || !profile?.dealer_id) return;
    setDealsLoading(true);
    supabase
      .from("deal_financials")
      .select(
        "*, car_listings(brand,model,year), profiles!salesman_id(full_name)",
      )
      .eq("dealer_id", profile.dealer_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDealsRows(data || []);
        setDealsLoading(false);
      });
  }, [activeNav, profile]);

  const setDealField = useCallback((id, field, value) => {
    setDealDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  }, []);

  const saveDeal = useCallback(
    async (row) => {
      const draft = dealDrafts[row.id] || {};
      if (!Object.keys(draft).length) return;
      setDealSaving((p) => ({ ...p, [row.id]: true }));
      await supabase.from("deal_financials").update(draft).eq("id", row.id);
      setDealsRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...draft } : r)),
      );
      setDealDrafts((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      setDealSaving((p) => ({ ...p, [row.id]: false }));
    },
    [dealDrafts],
  );

  // ── Commissions fetch ─────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "commissions" || !profile?.dealer_id) return;
    setCommRulesLoading(true);
    setCommLedgerLoading(true);
    supabase
      .from("commission_rules")
      .select("*")
      .eq("dealer_id", profile.dealer_id)
      .order("created_at")
      .then(({ data }) => {
        setCommRules(data || []);
        setCommRulesLoading(false);
      });
    supabase
      .from("deal_financials")
      .select("*, car_listings(brand,model,year), profiles(full_name)")
      .eq("dealer_id", profile.dealer_id)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCommLedger(data || []);
        setCommLedgerLoading(false);
      });
  }, [activeNav, profile]);

  const toggleRule = useCallback(async (rule) => {
    const next = !rule.is_active;
    await supabase
      .from("commission_rules")
      .update({ is_active: next })
      .eq("id", rule.id);
    setCommRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)),
    );
  }, []);

  const addRule = useCallback(async () => {
    if (!newRule.label || !newRule.rate_value) return;
    setCommRuleSaving(true);
    const { data } = await supabase
      .from("commission_rules")
      .insert({
        dealer_id: profile.dealer_id,
        label: newRule.label,
        basis: newRule.basis,
        rate_type: newRule.rate_type,
        rate_value: parseFloat(newRule.rate_value) || 0,
        min_gp: parseFloat(newRule.min_gp) || 0,
        is_active: true,
      })
      .select()
      .single();
    if (data) setCommRules((prev) => [...prev, data]);
    setNewRule({
      label: "",
      basis: "gp",
      rate_type: "percent",
      rate_value: "",
      min_gp: "",
    });
    setCommRuleSaving(false);
  }, [newRule, profile]);

  const toggleCommPaid = useCallback(async (row) => {
    const next = !row.commission_paid;
    await supabase
      .from("deal_financials")
      .update({
        commission_paid: next,
        commission_paid_at: next ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    setCommLedger((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, commission_paid: next } : r)),
    );
  }, []);

  // ── Expenses fetch ────────────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "expenses" || !profile?.dealer_id) return;
    setExpenseLoading(true);
    supabase
      .from("expense_entries")
      .select("*")
      .eq("dealer_id", profile.dealer_id)
      .order("expense_date", { ascending: false })
      .then(({ data }) => {
        setExpenseRows(data || []);
        setExpenseLoading(false);
      });
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
    if (newExpense.listing_ref.trim())
      payload.listing_ref = newExpense.listing_ref.trim();
    const { data } = await supabase
      .from("expense_entries")
      .insert(payload)
      .select()
      .single();
    if (data) setExpenseRows((prev) => [data, ...prev]);
    setNewExpense({
      category: "misc",
      description: "",
      amount: "",
      expense_date: new Date().toISOString().slice(0, 10),
      listing_ref: "",
    });
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
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    (async () => {
      // ensure row exists without overwriting existing state
      await supabase.from("month_close_checklist").upsert(
        {
          dealer_id: profile.dealer_id,
          period_year: closeMonth.getFullYear(),
          period_month: closeMonth.getMonth() + 1,
          commissions_approved: false,
          ar_reviewed: false,
          expenses_posted: false,
          status: "open",
        },
        {
          onConflict: "dealer_id,period_year,period_month",
          ignoreDuplicates: true,
        },
      );

      const [{ data }, { count: uncostedCount }] = await Promise.all([
        supabase
          .from("month_close_checklist")
          .select("*")
          .eq("dealer_id", profile.dealer_id)
          .eq("period_year", closeMonth.getFullYear())
          .eq("period_month", closeMonth.getMonth() + 1)
          .maybeSingle(),
        // count sold units missing purchase_price this month
        supabase
          .from("stock_units")
          .select("id", { count: "exact", head: true })
          .eq("dealer_id", profile.dealer_id)
          .eq("status", "sold")
          .gte("sold_date", start.toISOString())
          .lt("sold_date", end.toISOString())
          .or("purchase_price.is.null,purchase_price.eq.0"),
      ]);

      setCloseData(
        data ? { ...data, _uncostedCount: uncostedCount || 0 } : null,
      );
      setAiSummary(data?.ai_summary || "");
      setCloseLoading(false);
    })();
  }, [activeNav, profile, closeMonth]);

  const toggleCloseItem = useCallback(
    async (field) => {
      if (!closeData) return;
      const next = !closeData[field];
      const mk = monthKey(closeMonth);
      const update = { ...closeData, [field]: next };
      delete update._soldCount;
      await supabase
        .from("month_close_checklist")
        .upsert(update, { onConflict: "dealer_id,period_year,period_month" });
      setCloseData((prev) => ({ ...prev, [field]: next }));
    },
    [closeData, closeMonth],
  );

  const doCloseMonth = useCallback(async () => {
    if (!closeData || closeData.status === "closed") return;
    setCloseSaving(true);
    const update = {
      ...closeData,
      status: "closed",
      closed_at: new Date().toISOString(),
    };
    delete update._uncostedCount;
    await supabase
      .from("month_close_checklist")
      .upsert(update, { onConflict: "dealer_id,period_year,period_month" });
    setCloseData((prev) => ({ ...prev, status: "closed" }));
    setCloseSaving(false);
  }, [closeData]);

  const generateAiSummary = useCallback(async () => {
    if (closeData?.status !== "closed" || aiGenerating) return;
    setAiGenerating(true);
    setAiSummary("");
    const mk = monthKey(closeMonth);
    const start = new Date(closeMonth);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const [{ data: soldRaw }, { data: dealRaw }, { data: expRaw }] =
      await Promise.all([
        supabase
          .from("stock_units")
          .select(
            "gross_profit,days_in_stock,car_listings(brand,model,year,assigned_to,profiles!assigned_to(full_name))",
          )
          .eq("dealer_id", profile.dealer_id)
          .eq("status", "sold")
          .gte("sold_date", start.toISOString())
          .lt("sold_date", end.toISOString()),
        supabase
          .from("deal_financials")
          .select("commission_amount,commission_paid,commission_paid_at,status")
          .eq("dealer_id", profile.dealer_id),
        supabase
          .from("expense_entries")
          .select("category,amount")
          .eq("dealer_id", profile.dealer_id)
          .gte("expense_date", mk + "-01")
          .lt(
            "expense_date",
            (() => {
              const n = new Date(
                closeMonth.getFullYear(),
                closeMonth.getMonth() + 1,
                1,
              );
              return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
            })(),
          ),
      ]);

    const sold = soldRaw || [];
    const deals = dealRaw || [];
    const exps = expRaw || [];

    const totalGP = sold.reduce((s, r) => s + (r.gross_profit || 0), 0);
    const avgDays = sold.length
      ? (
          sold.reduce((s, r) => s + (r.days_in_stock || 0), 0) / sold.length
        ).toFixed(1)
      : 0;
    const totalCommPaid = deals
      .filter((d) => d.commission_paid)
      .reduce((s, d) => s + (d.commission_amount || 0), 0);
    const flaggedDeals = deals.filter((d) => d.status === "flagged").length;
    const totalExp = exps.reduce((s, r) => s + (r.amount || 0), 0);
    const expByCategory = exps.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + r.amount;
      return acc;
    }, {});

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
      per_salesman: Object.entries(salesmanMap).map(([name, v]) => ({
        name,
        ...v,
      })),
    };

    const system =
      "You are a dealership financial advisor. Write a concise month-end summary in 3 short paragraphs: performance, commissions & expenses, and one recommendation. Use RM for currency. Be direct.";

    let full = "";
    await streamAnthropic(
      [{ role: "user", content: JSON.stringify(payload) }],
      system,
      (chunk) => {
        full += chunk;
        setAiSummary(full);
      },
    );

    const saveUpdate = {
      ...closeData,
      ai_summary: full,
      ai_generated_at: new Date().toISOString(),
    };
    delete saveUpdate._uncostedCount;
    await supabase
      .from("month_close_checklist")
      .upsert(saveUpdate, { onConflict: "dealer_id,period_year,period_month" });
    setAiGenerating(false);
  }, [closeData, closeMonth, profile, aiGenerating]);

  // ── Advisor ───────────────────────────────────────────────────
  const sendAdvisor = useCallback(
    async (text) => {
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

      const [{ data: soldRaw }, { data: dealRaw }, { data: expRaw }] =
        await Promise.all([
          supabase
            .from("stock_units")
            .select(
              "gross_profit,days_in_stock,recon_cost,car_listings(brand,model,year,assigned_to,profiles!assigned_to(full_name))",
            )
            .eq("dealer_id", profile.dealer_id)
            .eq("status", "sold")
            .gte("sold_date", start.toISOString())
            .lt("sold_date", end.toISOString()),
          supabase
            .from("deal_financials")
            .select(
              "commission_amount,commission_paid,status,profiles!salesman_id(full_name)",
            )
            .eq("dealer_id", profile.dealer_id),
          supabase
            .from("expense_entries")
            .select("category,amount")
            .eq("dealer_id", profile.dealer_id)
            .gte("expense_date", mk + "-01")
            .lte("expense_date", mk + "-31"),
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
        month: now.toLocaleDateString("en-MY", {
          month: "long",
          year: "numeric",
        }),
        units_sold: sold.length,
        total_gp: sold.reduce((s, r) => s + (r.gross_profit || 0), 0),
        avg_days_in_stock: sold.length
          ? +(
              sold.reduce((s, r) => s + (r.days_in_stock || 0), 0) / sold.length
            ).toFixed(1)
          : 0,
        avg_recon_cost: sold.length
          ? +(
              sold.reduce((s, r) => s + (r.recon_cost || 0), 0) / sold.length
            ).toFixed(0)
          : 0,
        units_sold_at_loss: sold
          .filter((r) => (r.gross_profit || 0) < 0)
          .map((r) => ({
            car: r.car_listings
              ? `${r.car_listings.year} ${r.car_listings.brand} ${r.car_listings.model}`
              : "Unknown",
            gp: r.gross_profit,
          })),
        salesman_gp: salesmanGP,
        unpaid_commissions: deals
          .filter((d) => !d.commission_paid)
          .map((d) => ({
            salesman: d.profiles?.full_name || "Unknown",
            amount: d.commission_amount,
          })),
        flagged_deals: deals.filter((d) => d.status === "flagged").length,
        expenses_by_category: exps.reduce((acc, r) => {
          acc[r.category] = (acc[r.category] || 0) + (r.amount || 0);
          return acc;
        }, {}),
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

      const system =
        "You are a dealership accountant AI. Answer questions about the dealer's financial data. Use RM for currency. Be concise and direct. If data is empty, say so.";

      let reply = "";
      setAdvisorMessages((prev) => [
        ...prev,
        { role: "assistant", content: "" },
      ]);
      await streamAnthropic(apiMessages, system, (chunk) => {
        reply += chunk;
        setAdvisorMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: reply };
          return copy;
        });
      });

      // enforce 10-turn (20 message) cap
      setAdvisorMessages((prev) => (prev.length > 20 ? prev.slice(-20) : prev));
      setAdvisorSending(false);
    },
    [advisorInput, advisorMessages, advisorSending, profile],
  );

  useEffect(() => {
    advisorEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [advisorMessages]);

  // ── Accounts Receivable fetch ─────────────────────────────────
  useEffect(() => {
    if (activeNav !== "ar" || !profile?.dealer_id) return;
    setArLoading(true);
    supabase
      .from("deal_financials")
      .select("*, car_listings(brand,model,year,selling_price,sold_at), profiles!salesman_id(full_name)")
      .eq("dealer_id", profile.dealer_id)
      .eq("loan_disbursed", false)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setArRows(data || []);
        setArLoading(false);
      });
  }, [activeNav, profile]);

  const markDisbursed = useCallback(async (row) => {
    setArDisbursing((p) => ({ ...p, [row.id]: true }));
    await supabase
      .from("deal_financials")
      .update({ loan_disbursed: true, status: "disbursed" })
      .eq("id", row.id);
    setArRows((prev) => prev.filter((r) => r.id !== row.id));
    setArDisbursing((p) => ({ ...p, [row.id]: false }));
  }, []);

  // ── Stock Valuation fetch ─────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "stock" || !profile?.dealer_id) return;
    setStockLoading(true);
    const dealerId = profile.dealer_id;
    Promise.all([
      supabase
        .from("car_listings")
        .select("id,brand,model,year,selling_price,condition,created_at,status")
        .eq("dealer_id", dealerId)
        .in("status", ["active", "reserved"])
        .order("created_at", { ascending: true }),
      supabase
        .from("stock_units")
        .select("listing_id,purchase_price,recon_cost")
        .eq("dealer_id", dealerId),
    ]).then(([{ data: cars }, { data: units }]) => {
      const unitMap = {};
      (units || []).forEach((u) => { if (u.listing_id) unitMap[u.listing_id] = u; });
      const today = Date.now();
      const rows = (cars || []).map((car) => {
        const unit = unitMap[car.id] || {};
        const purchase = unit.purchase_price || 0;
        const recon    = unit.recon_cost    || 0;
        const selling  = car.selling_price  || 0;
        const days     = Math.floor((today - new Date(car.created_at).getTime()) / 86400000);
        const interest = +(purchase * 0.04 / 365 * days).toFixed(2);
        const margin   = selling > 0 ? ((selling - purchase - recon) / selling) * 100 : 0;
        return { ...car, purchase_price: purchase, recon_cost: recon, days, interest, margin };
      });
      const totalFloor = rows.reduce((s, r) => s + r.purchase_price, 0);
      setStockStats({
        total: rows.length,
        totalFloor,
        monthlyInterest: Math.round(totalFloor * 0.04 / 12),
        stale: rows.filter((r) => r.days > 60).length,
      });
      setStockRows(rows);
      setStockLoading(false);
    });
  }, [activeNav, profile]);

  // ── KPI Dashboard fetch ───────────────────────────────────────
  useEffect(() => {
    if (activeNav !== "kpi" || !profile?.dealer_id) return;
    setKpiLoading(true);
    const dealerId = profile.dealer_id;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    cutoff.setDate(1);
    Promise.all([
      supabase
        .from("stock_units")
        .select("gross_profit,days_in_stock,sold_price,included_services_cost,sold_date,car_listings(assigned_to,profiles!assigned_to(full_name))")
        .eq("dealer_id", dealerId)
        .eq("status", "sold")
        .gte("sold_date", cutoff.toISOString())
        .not("sold_date", "is", null)
        .order("sold_date"),
      supabase
        .from("expense_entries")
        .select("amount,expense_date")
        .eq("dealer_id", dealerId)
        .gte("expense_date", cutoff.toISOString().slice(0, 10)),
    ]).then(([{ data: soldRaw }, { data: expRaw }]) => {
      const sold = soldRaw || [];
      const exps = expRaw || [];

      const byMonth = {};
      sold.forEach((r) => {
        const mk = (r.sold_date || "").slice(0, 7);
        if (!mk) return;
        if (!byMonth[mk]) byMonth[mk] = { gp: 0, units: 0, services: 0, days: 0 };
        byMonth[mk].gp       += r.gross_profit           || 0;
        byMonth[mk].units    += 1;
        byMonth[mk].services += r.included_services_cost || 0;
        byMonth[mk].days     += r.days_in_stock          || 0;
      });
      const expByMonth = {};
      exps.forEach((r) => {
        const mk = (r.expense_date || "").slice(0, 7);
        expByMonth[mk] = (expByMonth[mk] || 0) + (r.amount || 0);
      });

      const monthly = Object.keys(byMonth).sort().map((mk) => ({
        month: mk,
        units:   byMonth[mk].units,
        totalGP: byMonth[mk].gp,
        gpu:     byMonth[mk].units > 0 ? byMonth[mk].gp / byMonth[mk].units : 0,
        services: byMonth[mk].services,
        expenses: expByMonth[mk] || 0,
        net:     byMonth[mk].gp - (expByMonth[mk] || 0),
        avgDays: byMonth[mk].units > 0 ? byMonth[mk].days / byMonth[mk].units : 0,
      }));

      const smap = {};
      sold.forEach((r) => {
        const name = r.car_listings?.profiles?.full_name || "Unassigned";
        if (!smap[name]) smap[name] = { gp: 0, units: 0 };
        smap[name].gp    += r.gross_profit || 0;
        smap[name].units += 1;
      });
      const salesmen = Object.entries(smap)
        .map(([name, v]) => ({ name, ...v, gpu: v.units ? v.gp / v.units : 0 }))
        .sort((a, b) => b.gp - a.gp);

      const latest    = monthly[monthly.length - 1];
      const avgGpu    = sold.length > 0 ? sold.reduce((s, r) => s + (r.gross_profit || 0), 0) / sold.length : 0;
      const avgDays   = sold.length > 0 ? sold.reduce((s, r) => s + (r.days_in_stock || 0), 0) / sold.length : 0;
      const breakEven = latest && latest.gpu > 0 ? Math.ceil(latest.expenses / latest.gpu) : null;

      setKpiMonthly(monthly);
      setKpiSalesmen(salesmen);
      setKpiSummary({ avgGpu, avgDays, breakEven, latestNet: latest?.net ?? 0, latestExpenses: latest?.expenses ?? 0, totalUnits: sold.length });
      setKpiLoading(false);
    });
  }, [activeNav, profile]);

  // ─────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#05070e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#6b7280", fontFamily: "'DM Sans',sans-serif" }}>
          Loading...
        </p>
      </div>
    );

  const NAV = [
    { id: "overview",     label: "P&L Overview" },
    { id: "deals",        label: "Deal Tracker" },
    { id: "commissions",  label: "Commissions" },
    { id: "expenses",     label: "Expenses" },
    { id: "close",        label: "Month Close" },
    { id: "ar",           label: "Receivables" },
    { id: "stock",        label: "Stock Value" },
    { id: "kpi",          label: "KPIs" },
    { id: "advisor",      label: "AI Advisor" },
  ];

  // ── Excel-style grid helpers ─────────────────────────────────
  const XL = {
    // width: auto so table uses natural column widths and scrolls horizontally
    tbl: {
      width: "auto",
      minWidth: "100%",
      borderCollapse: "collapse",
      fontSize: 12,
    },
    // col size hints — callers can override minWidth per column type
    th: (left, minW = 110) => ({
      padding: "6px 10px",
      textAlign: left ? "left" : "right",
      color: "#6b7280",
      fontWeight: 600,
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.07)",
      borderBottom: "2px solid rgba(34,197,94,0.25)",
      position: "sticky",
      top: 0,
      zIndex: 2,
      minWidth: minW,
    }),
    thN: {
      width: 40,
      minWidth: 40,
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.07)",
      borderBottom: "2px solid rgba(34,197,94,0.25)",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    td: (right, minW = 110) => ({
      padding: "6px 10px",
      textAlign: right ? "right" : "left",
      border: "1px solid rgba(255,255,255,0.07)",
      fontSize: 12,
      minWidth: minW,
    }),
    tdN: {
      padding: "5px 8px",
      textAlign: "right",
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRight: "1px solid rgba(255,255,255,0.1)",
      color: "#4b5563",
      fontFamily: "'Courier New',monospace",
      fontSize: 11,
      userSelect: "none",
      width: 40,
      minWidth: 40,
    },
    row: (i) => ({
      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.018)",
    }),
  };

  const monthNavBtn = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 3,
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 14,
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans',sans-serif",
  };

  const tbBtn = (active) => ({
    background: active ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 4,
    color: active ? ACCENT : "#9ca3af",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    padding: "3px 10px",
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
    letterSpacing: 0.3,
  });

  // Commissions: calculate commission due per row (rule-based or fallback)
  const calcCommDue = (row) => {
    const rule = commRules.find((r) => r.id === row.commission_rule_id);
    if (rule) {
      const base =
        rule.basis === "gross_profit"
          ? row.gross_profit || 0
          : row.selling_price || 0;
      return (base * (rule.rate_value || 0)) / 100;
    }
    return row.commission_amount || 0;
  };
  const unpaidTotal = commLedger
    .filter((r) => !r.commission_paid)
    .reduce((s, r) => s + calcCommDue(r), 0);

  // Expenses: group by month
  const expByMonth = {};
  expenseRows.forEach((r) => {
    const mk = r.expense_date?.slice(0, 7) || "unknown";
    if (!expByMonth[mk]) expByMonth[mk] = [];
    expByMonth[mk].push(r);
  });

  // Close: all 4 items checked?
  const costsOk = closeData ? closeData._uncostedCount === 0 : false;
  const isClosed = closeData?.status === "closed";
  const allChecked =
    costsOk &&
    !!closeData?.commissions_approved &&
    !!closeData?.ar_reviewed &&
    !!closeData?.expenses_posted;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#080C14",
        fontFamily: "'DM Sans',sans-serif",
        color: "#f0f2f5",
      }}
    >
      {/* ── LEFT SIDEBAR ── */}
      <div
        className="acct-sidebar"
        style={{
          width: 220,
          flexShrink: 0,
          background: "#080e19",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Logo */}
        <div
          className="acct-sidebar-logo"
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 6,
                height: 6,
                background: ACCENT,
                borderRadius: "50%",
              }}
            />
            <span
              style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 17,
                letterSpacing: 3,
                color: ACCENT,
              }}
            >
              ACCOUNTS
            </span>
          </div>
          <p
            style={{
              fontSize: 9,
              color: "#1e293b",
              marginTop: 3,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              margin: "3px 0 0",
            }}
          >
            ShiftOS Financial
          </p>
        </div>

        {/* Sheet tabs */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 0",
            scrollbarWidth: "none",
          }}
        >
          {NAV.map((n, idx) => {
            const active = activeNav === n.id;
            return (
              <button
                key={n.id}
                className={`acct-tab-btn${active ? " active" : ""}`}
                onClick={() => setActiveNav(n.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 14px 9px 13px",
                  background: active ? "rgba(34,197,94,0.07)" : "transparent",
                  border: "none",
                  borderLeft: active
                    ? `3px solid ${ACCENT}`
                    : "3px solid transparent",
                  color: active ? "#e5e7eb" : "#4b5563",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'DM Sans',sans-serif",
                  transition: "all 0.12s",
                }}
              >
                <span
                  className="acct-cellref"
                  style={{
                    fontFamily: "'Courier New',monospace",
                    fontSize: 9,
                    color: active ? ACCENT : "#1e293b",
                    minWidth: 18,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + idx)}1
                </span>
                <span className="acct-tab-label">{n.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notification bell + user + logout */}
        <div
          className="acct-sidebar-bottom"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 14px",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", marginBottom: 8 }}>
            <button
              onClick={() => setNotifOpen((p) => !p)}
              style={{
                width: "100%",
                padding: "5px 8px",
                borderRadius: 5,
                background: notifications.some((n) => !n.is_read)
                  ? "rgba(34,197,94,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: notifications.some((n) => !n.is_read)
                  ? "1px solid rgba(34,197,94,0.22)"
                  : "1px solid rgba(255,255,255,0.06)",
                color: notifications.some((n) => !n.is_read)
                  ? "#4ade80"
                  : "#6b7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <Bell style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span>Notifications</span>
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    width: 15,
                    height: 15,
                    background: ACCENT,
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: 700,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {notifications.filter((n) => !n.is_read).length > 9
                    ? "9+"
                    : notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div
                  onClick={() => setNotifOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "110%",
                    left: 0,
                    zIndex: 50,
                    width: 290,
                    maxHeight: 340,
                    overflowY: "auto",
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#f3f4f6",
                      }}
                    >
                      Notifications
                    </span>
                    {notifications.some((n) => !n.is_read) && (
                      <button
                        onClick={async () => {
                          const ids = notifications
                            .filter((n) => !n.is_read)
                            .map((n) => n.id);
                          await supabase
                            .from("salesman_notifications")
                            .update({ is_read: true })
                            .in("id", ids);
                          setNotifications((p) =>
                            p.map((n) => ({ ...n, is_read: true })),
                          );
                        }}
                        style={{
                          fontSize: 10,
                          color: "#4ade80",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      No messages yet
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.is_read) {
                            await supabase
                              .from("salesman_notifications")
                              .update({ is_read: true })
                              .eq("id", n.id);
                            setNotifications((p) =>
                              p.map((x) =>
                                x.id === n.id ? { ...x, is_read: true } : x,
                              ),
                            );
                          }
                        }}
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: n.is_read
                            ? "transparent"
                            : "rgba(34,197,94,0.04)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", gap: 7 }}>
                          {!n.is_read && (
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                background: ACCENT,
                                borderRadius: "50%",
                                flexShrink: 0,
                                marginTop: 5,
                              }}
                            />
                          )}
                          <div>
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#f3f4f6",
                                margin: "0 0 2px",
                              }}
                            >
                              {n.title || "Message from Owner"}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                margin: 0,
                              }}
                            >
                              {n.body}
                            </p>
                            <p
                              style={{
                                fontSize: 10,
                                color: "#4b5563",
                                marginTop: 2,
                              }}
                            >
                              {n.created_at
                                ? new Date(n.created_at).toLocaleDateString(
                                    "en-MY",
                                  )
                                : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <p
            style={{
              fontSize: 11,
              color: "#374151",
              marginBottom: 5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {profile?.full_name}
          </p>
          <button
            onClick={() =>
              supabase.auth.signOut().then(() => navigate("/login"))
            }
            style={{
              fontSize: 11,
              color: "#1e293b",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      {/* end sidebar */}

      {/* ── MAIN CONTENT AREA ── */}
      <style>{`
        @media (max-width: 767px) {
          .acct-sidebar { width: 40px !important; min-width: 40px !important; }
          .acct-sidebar .acct-sidebar-logo,
          .acct-sidebar .acct-sidebar-label,
          .acct-sidebar .acct-sidebar-bottom { display: none !important; }
          .acct-sidebar .acct-tab-label { display: none !important; }
          .acct-sidebar .acct-tab-btn {
            padding: 10px 0 !important;
            justify-content: center !important;
            border-left-width: 0 !important;
            border-bottom: 2px solid transparent !important;
          }
          .acct-sidebar .acct-tab-btn.active {
            background: rgba(34,197,94,0.15) !important;
          }
          .acct-sidebar .acct-cellref {
            font-size: 10px !important;
            min-width: unset !important;
            writing-mode: vertical-rl !important;
          }
        }
      `}</style>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: "100vh",
        }}
      >
        {/* FORMULA BAR */}
        <div
          style={{
            height: 34,
            background: "#0a0f1a",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "#060b14",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 3,
              padding: "2px 10px",
              fontFamily: "'Courier New',monospace",
              fontSize: 11,
              color: ACCENT,
              minWidth: 36,
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            {String.fromCharCode(65 + NAV.findIndex((n) => n.id === activeNav))}
            1
          </div>
          <div
            style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#374151",
              fontFamily: "'Courier New',monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {"ShiftOS Accounts › "}
            {NAV.find((n) => n.id === activeNav)?.label}
            {activeNav === "overview"
              ? ` › ${fmtMonth(viewMonth)}`
              : activeNav === "close"
                ? ` › ${fmtMonth(closeMonth)}`
                : ""}
          </span>
          {cellSaving && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: ACCENT,
                letterSpacing: 1,
                flexShrink: 0,
              }}
            >
              SAVING…
            </span>
          )}
        </div>

        {/* PER-SHEET TOOLBAR */}
        <div
          style={{
            height: 36,
            background: "#090e1a",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 8,
            flexShrink: 0,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {activeNav === "overview" && (
            <>
              <button
                style={monthNavBtn}
                onClick={() =>
                  setViewMonth((m) => {
                    const d = new Date(m);
                    d.setMonth(d.getMonth() - 1);
                    return d;
                  })
                }
              >
                ‹
              </button>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  minWidth: 110,
                  textAlign: "center",
                }}
              >
                {fmtMonth(viewMonth)}
              </span>
              <button
                style={monthNavBtn}
                onClick={() =>
                  setViewMonth((m) => {
                    const d = new Date(m);
                    d.setMonth(d.getMonth() + 1);
                    return d;
                  })
                }
              >
                ›
              </button>
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "rgba(255,255,255,0.07)",
                  margin: "0 4px",
                }}
              />
              <button
                onClick={async () => {
                  /* eslint-disable import/no-unresolved */
                  const { utils, writeFile } =
                    await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
                  /* eslint-enable import/no-unresolved */
                  const rows = overviewRows.map((r) => ({
                    Car: r.car_listings
                      ? `${r.car_listings.year} ${r.car_listings.brand} ${r.car_listings.model}`
                      : "—",
                    "Purchase (RM)": r.purchase_price || 0,
                    "Recon (RM)": r.recon_cost || 0,
                    "Sold (RM)": r.sold_price || 0,
                    "GP (RM)": r.gross_profit || 0,
                    "Margin %":
                      r.sold_price > 0
                        ? +((r.gross_profit / r.sold_price) * 100).toFixed(2)
                        : 0,
                    "Days in Stock": r.days_in_stock ?? "",
                  }));
                  const ws = utils.json_to_sheet(rows);
                  const wb = utils.book_new();
                  utils.book_append_sheet(wb, ws, fmtMonth(viewMonth));
                  writeFile(wb, `ShiftOS_PL_${monthKey(viewMonth)}.xlsx`);
                }}
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 3,
                  color: "#4ade80",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 10px",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                ↓ Export .xlsx
              </button>
            </>
          )}
          {activeNav === "deals" && (
            <span style={{ fontSize: 11, color: "#374151" }}>
              Click a row to expand · {dealsRows.length} deals
            </span>
          )}
          {activeNav === "commissions" && (
            <>
              <button
                style={tbBtn(commSubTab === "rules")}
                onClick={() => setCommSubTab("rules")}
              >
                Commission Rules
              </button>
              <button
                style={tbBtn(commSubTab === "ledger")}
                onClick={() => setCommSubTab("ledger")}
              >
                Ledger
              </button>
              {commSubTab === "ledger" && unpaidTotal > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "#f87171",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 3,
                    padding: "2px 8px",
                  }}
                >
                  Unpaid: {rm(unpaidTotal)}
                </span>
              )}
            </>
          )}
          {activeNav === "expenses" && (
            <span style={{ fontSize: 11, color: "#4b5563" }}>
              Total:{" "}
              <strong style={{ color: "#e5e7eb" }}>
                {rm(expenseRows.reduce((s, r) => s + (r.amount || 0), 0))}
              </strong>
            </span>
          )}
          {activeNav === "close" && (
            <>
              <button
                style={monthNavBtn}
                onClick={() =>
                  setCloseMonth((m) => {
                    const d = new Date(m);
                    d.setMonth(d.getMonth() - 1);
                    return d;
                  })
                }
              >
                ‹
              </button>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  minWidth: 110,
                  textAlign: "center",
                }}
              >
                {fmtMonth(closeMonth)}
              </span>
              <button
                style={monthNavBtn}
                onClick={() =>
                  setCloseMonth((m) => {
                    const d = new Date(m);
                    d.setMonth(d.getMonth() + 1);
                    return d;
                  })
                }
              >
                ›
              </button>
              {isClosed && (
                <span
                  style={{
                    fontSize: 10,
                    color: "#4ade80",
                    fontWeight: 700,
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 3,
                    padding: "2px 8px",
                    letterSpacing: 0.5,
                  }}
                >
                  ✓ CLOSED
                </span>
              )}
            </>
          )}
          {activeNav === "ar" && (
            <span style={{ fontSize: 11, color: "#4b5563" }}>
              {arLoading ? "Loading…" : (
                <>{arRows.length} deal{arRows.length !== 1 ? "s" : ""} awaiting disbursement · Outstanding:{" "}
                <strong style={{ color: "#f87171" }}>
                  {rm(arRows.reduce((s, r) => s + (r.loan_amount || 0), 0))}
                </strong></>
              )}
            </span>
          )}
          {activeNav === "stock" && (
            <span style={{ fontSize: 11, color: "#4b5563" }}>
              {stockLoading ? "Loading…" : stockStats ? (
                <>Floor plan: <strong style={{ color: "#e5e7eb" }}>{rm(stockStats.totalFloor)}</strong>
                {" · "}Est. monthly interest: <strong style={{ color: "#fbbf24" }}>{rm(stockStats.monthlyInterest)}</strong>
                {stockStats.stale > 0 && <> · <strong style={{ color: "#f87171" }}>{stockStats.stale} stale (&gt;60d)</strong></>}</>
              ) : null}
            </span>
          )}
          {activeNav === "kpi" && (
            <span style={{ fontSize: 11, color: "#4b5563" }}>
              {kpiLoading ? "Loading…" : kpiSummary ? (
                <>6-month avg GPU: <strong style={{ color: "#4ade80" }}>{rm(Math.round(kpiSummary.avgGpu))}</strong>
                {kpiSummary.breakEven !== null && <> · Break-even: <strong style={{ color: "#e5e7eb" }}>{kpiSummary.breakEven} units/mo</strong></>}</>
              ) : null}
            </span>
          )}
          {activeNav === "advisor" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {ADVISOR_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendAdvisor(p)}
                  disabled={advisorSending}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    color: "#9ca3af",
                    fontSize: 11,
                    padding: "3px 10px",
                    cursor: advisorSending ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "'DM Sans',sans-serif",
                    flexShrink: 0,
                    opacity: advisorSending ? 0.5 : 1,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GRID AREA */}
        <div
          style={{
            flex: 1,
            overflow: activeNav === "advisor" ? "hidden" : "auto",
            background: "#080C14",
            scrollbarWidth: "thin",
            scrollbarColor: "#1a2030 transparent",
          }}
        >
          {/* ── P&L OVERVIEW ── */}
          {activeNav === "overview" && (
            <div>
              {/* Pinned summary row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6,1fr)",
                  borderBottom: "2px solid rgba(34,197,94,0.15)",
                  background: "rgba(34,197,94,0.03)",
                }}
              >
                {[
                  {
                    label: "Total Revenue",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : `RM ${overviewStats.totalRevenue.toLocaleString()}`,
                  },
                  {
                    label: "Gross Profit",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : `RM ${overviewStats.totalGP.toLocaleString()}`,
                  },
                  {
                    label: "Units Sold",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : overviewStats.unitsSold,
                  },
                  {
                    label: "Avg Margin",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : `${overviewStats.avgMargin.toFixed(1)}%`,
                  },
                  {
                    label: "Services Revenue",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : `RM ${overviewStats.totalServicesCost.toLocaleString()}`,
                    accent: "#4ade80",
                  },
                  {
                    label: "Net Profit",
                    value:
                      overviewLoading || !overviewStats
                        ? "—"
                        : `RM ${(overviewStats.totalGP - netProfitData.expenses - netProfitData.commPaid).toLocaleString()}`,
                    accent: overviewStats
                      ? overviewStats.totalGP -
                          netProfitData.expenses -
                          netProfitData.commPaid >=
                        0
                        ? "#4ade80"
                        : "#f87171"
                      : ACCENT,
                    breakdown:
                      overviewLoading || !overviewStats
                        ? null
                        : `GP ${rm(overviewStats.totalGP)} − Exp ${rm(netProfitData.expenses)} − Comm ${rm(netProfitData.commPaid)}`,
                  },
                ].map((c, i) => (
                  <div
                    key={c.label}
                    style={{
                      padding: "10px 16px",
                      borderRight:
                        i < 5 ? "1px solid rgba(255,255,255,0.07)" : "none",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 9,
                        color: "#334155",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                        margin: "0 0 4px",
                      }}
                    >
                      {c.label}
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: c.accent || ACCENT,
                        margin: 0,
                        fontFamily: "'Bebas Neue',sans-serif",
                        letterSpacing: 1,
                      }}
                    >
                      {c.value}
                    </p>
                    {c.breakdown && (
                      <p
                        style={{
                          fontSize: 9,
                          color: "#374151",
                          margin: "4px 0 0",
                          lineHeight: 1.4,
                        }}
                      >
                        {c.breakdown}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {/* Data table */}
              <div style={{ overflowX: "auto" }}>
                <table style={XL.tbl}>
                  <thead>
                    <tr>
                      <th style={XL.thN} />
                      {[
                        "Car",
                        "Purchase ✎",
                        "Recon ✎",
                        "Services",
                        "Sold ✎",
                        "GP",
                        "Margin %",
                        "Days",
                      ].map((h) => (
                        <th
                          key={h}
                          style={XL.th(
                            h === "Car",
                            h === "Car" ? 200 : h === "Days" ? 80 : 110,
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overviewLoading ? (
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            padding: 20,
                            textAlign: "center",
                            color: "#374151",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          Loading…
                        </td>
                      </tr>
                    ) : overviewRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            padding: 20,
                            textAlign: "center",
                            color: "#374151",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          No sold units this period
                        </td>
                      </tr>
                    ) : (
                      overviewRows.map((r, i) => {
                        const car = r.car_listings;
                        const gp = r.gross_profit || 0;
                        const margin =
                          r.sold_price > 0 ? (gp / r.sold_price) * 100 : 0;
                        const gpColor =
                          gp < 0 ? "#f87171" : gp > 0 ? "#4ade80" : "#6b7280";

                        const EditableCell = ({
                          rowIdx,
                          field,
                          value,
                          color,
                        }) => {
                          const isEditing =
                            editingCell?.rowIdx === rowIdx &&
                            editingCell?.field === field;
                          if (isEditing) {
                            return (
                              <td
                                style={{
                                  ...XL.td(true),
                                  padding: "3px 6px",
                                  boxShadow: "inset 0 0 0 2px #22c55e",
                                  background: "rgba(34,197,94,0.06)",
                                }}
                              >
                                <input
                                  ref={cellInputRef}
                                  type="number"
                                  value={cellDraft}
                                  onChange={(e) => setCellDraft(e.target.value)}
                                  onBlur={saveCellEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveCellEdit();
                                    }
                                    if (e.key === "Escape")
                                      setEditingCell(null);
                                    if (e.key === "Tab") {
                                      e.preventDefault();
                                      saveCellEdit();
                                      const fields = [
                                        "purchase_price",
                                        "recon_cost",
                                        "sold_price",
                                      ];
                                      const nextField =
                                        fields[
                                          (fields.indexOf(field) + 1) %
                                            fields.length
                                        ];
                                      const nextRowIdx =
                                        fields.indexOf(field) ===
                                        fields.length - 1
                                          ? rowIdx + 1
                                          : rowIdx;
                                      setTimeout(() => {
                                        const targetIdx =
                                          nextRowIdx < overviewRows.length
                                            ? nextRowIdx
                                            : 0;
                                        setEditingCell({
                                          rowIdx: targetIdx,
                                          field: nextField,
                                        });
                                        setCellDraft(
                                          String(
                                            overviewRows[targetIdx]?.[
                                              nextField
                                            ] || 0,
                                          ),
                                        );
                                      }, 0);
                                    }
                                  }}
                                  style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    color: "#86efac",
                                    fontSize: 12,
                                    textAlign: "right",
                                    outline: "none",
                                    fontFamily: "'Courier New',monospace",
                                    boxSizing: "border-box",
                                    padding: "2px 0",
                                  }}
                                />
                              </td>
                            );
                          }
                          return (
                            <td
                              style={{
                                ...XL.td(true),
                                color: color || "#9ca3af",
                                cursor: "cell",
                                userSelect: "none",
                              }}
                              onDoubleClick={() => {
                                setEditingCell({ rowIdx, field });
                                setCellDraft(String(value || 0));
                              }}
                              title="Double-click to edit"
                            >
                              {rm(value)}
                            </td>
                          );
                        };

                        return (
                          <tr
                            key={i}
                            style={XL.row(i)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(34,197,94,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                i % 2 === 0
                                  ? "transparent"
                                  : "rgba(255,255,255,0.018)";
                            }}
                          >
                            <td style={XL.tdN}>{i + 1}</td>
                            <td
                              style={{ ...XL.td(false, 200), color: "#e5e7eb" }}
                            >
                              {car
                                ? `${car.year} ${car.brand} ${car.model}`
                                : "—"}
                            </td>
                            <EditableCell
                              rowIdx={i}
                              field="purchase_price"
                              value={r.purchase_price}
                            />
                            <EditableCell
                              rowIdx={i}
                              field="recon_cost"
                              value={r.recon_cost}
                            />
                            <td style={{ ...XL.td(true), color: "#9ca3af" }}>
                              {rm(r.services_cost)}
                            </td>
                            <EditableCell
                              rowIdx={i}
                              field="sold_price"
                              value={r.sold_price}
                              color="#e5e7eb"
                            />
                            <td
                              style={{
                                ...XL.td(true),
                                fontWeight: 600,
                                color: gpColor,
                              }}
                            >
                              {rm(gp)}
                            </td>
                            <td style={{ ...XL.td(true), color: gpColor }}>
                              {margin.toFixed(1)}%
                            </td>
                            <td style={{ ...XL.td(true), color: "#6b7280" }}>
                              {r.days_in_stock ?? "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DEALS ── */}
          {activeNav === "deals" && (
            <div style={{ overflowX: "auto" }}>
              <table style={XL.tbl}>
                <thead>
                  <tr>
                    <th style={XL.thN} />
                    {[
                      "Car",
                      "Salesman",
                      "Selling Price",
                      "Deposit",
                      "Loan Bank",
                      "Disbursed",
                      "Status",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={XL.th(
                          ["Car", "Salesman", "Loan Bank", ""].includes(h),
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dealsLoading ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "#374151",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : dealsRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "#374151",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        No deals found
                      </td>
                    </tr>
                  ) : (
                    dealsRows.map((row, idx) => {
                      const car = row.car_listings;
                      const sc =
                        DEAL_STATUS_COLORS[row.status] ||
                        DEAL_STATUS_COLORS.pending;
                      const isOpen = expandedDealId === row.id;
                      const draft = dealDrafts[row.id] || {};
                      const val = (f) => (f in draft ? draft[f] : row[f]);
                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            style={{ ...XL.row(idx), cursor: "pointer" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "rgba(34,197,94,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                idx % 2 === 0
                                  ? "transparent"
                                  : "rgba(255,255,255,0.018)";
                            }}
                            onClick={() =>
                              setExpandedDealId(isOpen ? null : row.id)
                            }
                          >
                            <td style={XL.tdN}>{idx + 1}</td>
                            <td
                              style={{ ...XL.td(false, 200), color: "#e5e7eb" }}
                            >
                              {car
                                ? `${car.year} ${car.brand} ${car.model}`
                                : "—"}
                            </td>
                            <td style={{ ...XL.td(false), color: "#9ca3af" }}>
                              {row.profiles?.full_name || "—"}
                            </td>
                            <td style={{ ...XL.td(true), color: "#e5e7eb" }}>
                              {rm(row.selling_price)}
                            </td>
                            <td style={{ ...XL.td(true), color: "#9ca3af" }}>
                              {rm(row.deposit_received)}
                            </td>
                            <td style={{ ...XL.td(false), color: "#9ca3af" }}>
                              {row.loan_bank || "—"}
                            </td>
                            <td
                              style={{
                                ...XL.td(true),
                                color: row.loan_disbursed
                                  ? "#4ade80"
                                  : "#6b7280",
                              }}
                            >
                              {row.loan_disbursed ? "Yes" : "No"}
                            </td>
                            <td style={XL.td(true)}>
                              <span
                                style={{
                                  background: sc.bg,
                                  color: sc.color,
                                  borderRadius: 3,
                                  padding: "1px 7px",
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                              >
                                {row.status || "pending"}
                              </span>
                            </td>
                            <td
                              style={{
                                ...XL.td(false),
                                color: "#6b7280",
                                fontSize: 11,
                              }}
                            >
                              {isOpen ? "▲" : "▼"}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                              <td
                                style={{ ...XL.tdN, background: "#090e18" }}
                              />
                              <td
                                colSpan={9}
                                style={{
                                  padding: "14px 16px",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                  background: "rgba(0,0,0,0.15)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fill, minmax(160px, 1fr))",
                                    gap: 10,
                                  }}
                                >
                                  {[
                                    {
                                      label: "Deposit Received (RM)",
                                      field: "deposit_received",
                                      type: "number",
                                    },
                                    {
                                      label: "Deposit Date",
                                      field: "deposit_date",
                                      type: "date",
                                    },
                                    {
                                      label: "Loan Amount (RM)",
                                      field: "loan_amount",
                                      type: "number",
                                      defaultVal: () => val("loan_amount") || Math.max(0, (row.selling_price || 0) - (val("deposit_received") || 0)) || "",
                                    },
                                    {
                                      label: "Cash Balance (RM)",
                                      field: "cash_balance",
                                      type: "number",
                                    },
                                    {
                                      label: "Commission (RM)",
                                      field: "commission_amount",
                                      type: "number",
                                    },
                                  ].map(({ label, field, type, defaultVal }) => (
                                    <div key={field}>
                                      <p style={label11}>{label}</p>
                                      <input
                                        type={type}
                                        value={defaultVal ? defaultVal() : (val(field) ?? "")}
                                        onChange={(e) =>
                                          setDealField(
                                            row.id,
                                            field,
                                            type === "number"
                                              ? parseFloat(e.target.value) || 0
                                              : e.target.value,
                                          )
                                        }
                                        style={inp}
                                      />
                                    </div>
                                  ))}
                                  {/* Loan Bank selector */}
                                  {(() => {
                                    const MY_BANKS = [
                                      "Maybank",
                                      "CIMB",
                                      "Public Bank",
                                      "RHB",
                                      "Hong Leong Bank",
                                      "AmBank",
                                      "Bank Islam",
                                      "Bank Rakyat",
                                      "Affin Bank",
                                      "Alliance Bank",
                                      "OCBC",
                                      "Standard Chartered",
                                      "BSN",
                                      "Other",
                                    ];
                                    const cur = val("loan_bank") || "";
                                    const selectVal = MY_BANKS.includes(cur)
                                      ? cur
                                      : cur
                                        ? "Other"
                                        : "";
                                    return (
                                      <div>
                                        <p style={label11}>Loan Bank</p>
                                        <select
                                          value={selectVal}
                                          onChange={(e) => {
                                            if (e.target.value !== "Other") {
                                              setDealField(row.id, "loan_bank", e.target.value);
                                              const rate = MY_BANK_RATES[e.target.value];
                                              if (rate) setDealField(row.id, "loan_interest_rate", rate);
                                            } else {
                                              setDealField(row.id, "loan_bank", "");
                                            }
                                          }}
                                          style={inp}
                                        >
                                          <option value="">
                                            — Select bank —
                                          </option>
                                          {MY_BANKS.map((b) => (
                                            <option key={b} value={b}>
                                              {b}
                                            </option>
                                          ))}
                                        </select>
                                        {selectVal === "Other" && (
                                          <input
                                            type="text"
                                            value={cur}
                                            onChange={(e) =>
                                              setDealField(
                                                row.id,
                                                "loan_bank",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Enter bank name"
                                            style={{ ...inp, marginTop: 4 }}
                                          />
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {/* Interest rate */}
                                  <div>
                                    <p style={label11}>
                                      Interest Rate (% p.a.)
                                    </p>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={val("loan_interest_rate") ?? ""}
                                      onChange={(e) =>
                                        setDealField(
                                          row.id,
                                          "loan_interest_rate",
                                          parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      style={inp}
                                    />
                                  </div>
                                  {/* Tenure */}
                                  <div>
                                    <p style={label11}>Tenure (months)</p>
                                    <input
                                      type="number"
                                      value={val("loan_tenure_months") || 84}
                                      onChange={(e) =>
                                        setDealField(
                                          row.id,
                                          "loan_tenure_months",
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                      style={inp}
                                    />
                                  </div>
                                  {/* Monthly instalment — read-only computed */}
                                  {(() => {
                                    const amt =
                                      parseFloat(val("loan_amount")) || 0;
                                    const rate =
                                      parseFloat(val("loan_interest_rate")) ||
                                      0;
                                    const tenure =
                                      parseInt(val("loan_tenure_months")) || 0;
                                    const monthly =
                                      tenure > 0
                                        ? (amt +
                                            amt *
                                              (rate / 100) *
                                              (tenure / 12)) /
                                          tenure
                                        : 0;
                                    return (
                                      <div>
                                        <p style={label11}>
                                          Monthly Instalment (RM)
                                        </p>
                                        <div
                                          style={{
                                            ...inp,
                                            background: "rgba(74,222,128,0.06)",
                                            border: "1px solid rgba(74,222,128,0.15)",
                                            cursor: "default",
                                          }}
                                        >
                                          {tenure > 0 ? (
                                            <div>
                                              <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13 }}>
                                                RM {monthly.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo
                                              </div>
                                              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                                                Total: RM {(monthly * tenure).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                {" · "}Interest: RM {(monthly * tenure - amt).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                              </div>
                                            </div>
                                          ) : "—"}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  {(() => {
                                    const loanAmt = parseFloat(val("loan_amount")) || 0;
                                    const sellPrice = row.selling_price || 0;
                                    const ltv = sellPrice > 0 ? (loanAmt / sellPrice) * 100 : 0;
                                    const margin = sellPrice > 0 ? ((sellPrice - loanAmt) / sellPrice) * 100 : 0;
                                    if (!loanAmt || !sellPrice) return null;
                                    return (
                                      <div>
                                        <p style={label11}>Loan-to-Value</p>
                                        <div style={{
                                          ...inp,
                                          color: ltv > 90 ? "#f87171" : ltv > 70 ? "#fbbf24" : "#4ade80",
                                          fontWeight: 600,
                                          background: "rgba(255,255,255,0.03)",
                                          cursor: "default",
                                          fontSize: 11,
                                        }}>
                                          {ltv.toFixed(1)}% LTV · {margin.toFixed(1)}% margin
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  <div>
                                    <p style={label11}>Status</p>
                                    <select
                                      value={val("status") || "pending"}
                                      onChange={(e) =>
                                        setDealField(
                                          row.id,
                                          "status",
                                          e.target.value,
                                        )
                                      }
                                      style={inp}
                                    >
                                      {[
                                        "pending",
                                        "disbursed",
                                        "complete",
                                        "flagged",
                                      ].map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 14,
                                      paddingTop: 18,
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!val("loan_disbursed")}
                                        onChange={(e) =>
                                          setDealField(
                                            row.id,
                                            "loan_disbursed",
                                            e.target.checked,
                                          )
                                        }
                                      />
                                      Loan Disbursed
                                    </label>
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 11,
                                        color: "#9ca3af",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!val("commission_paid")}
                                        onChange={(e) =>
                                          setDealField(
                                            row.id,
                                            "commission_paid",
                                            e.target.checked,
                                          )
                                        }
                                      />
                                      Comm. Paid
                                    </label>
                                  </div>
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <p style={label11}>Notes</p>
                                    <textarea
                                      value={val("notes") ?? ""}
                                      onChange={(e) =>
                                        setDealField(
                                          row.id,
                                          "notes",
                                          e.target.value,
                                        )
                                      }
                                      rows={2}
                                      style={{ ...inp, resize: "vertical" }}
                                    />
                                  </div>
                                </div>
                                <div
                                  style={{
                                    marginTop: 10,
                                    display: "flex",
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    onClick={() => saveDeal(row)}
                                    disabled={dealSaving[row.id]}
                                    style={{
                                      background: ACCENT,
                                      color: "#000",
                                      border: "none",
                                      borderRadius: 4,
                                      padding: "5px 16px",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      opacity: dealSaving[row.id] ? 0.6 : 1,
                                    }}
                                  >
                                    {dealSaving[row.id] ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COMMISSIONS ── */}
          {activeNav === "commissions" && (
            <div>
              {commSubTab === "rules" && (
                <>
                  {/* Inline add-rule form */}
                  <div
                    style={{
                      background: "rgba(34,197,94,0.03)",
                      borderBottom: "2px solid rgba(34,197,94,0.12)",
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 130 }}>
                        <p style={label11}>Label</p>
                        <input
                          value={newRule.label}
                          onChange={(e) =>
                            setNewRule((p) => ({ ...p, label: e.target.value }))
                          }
                          placeholder="e.g. Standard GP"
                          style={{ ...inp, width: 130 }}
                        />
                      </div>
                      <div style={{ minWidth: 110 }}>
                        <p style={label11}>Basis</p>
                        <select
                          value={newRule.basis}
                          onChange={(e) =>
                            setNewRule((p) => ({ ...p, basis: e.target.value }))
                          }
                          style={{ ...inp, width: 110 }}
                        >
                          <option value="gp">Gross Profit</option>
                          <option value="selling_price">Selling Price</option>
                        </select>
                      </div>
                      <div style={{ minWidth: 90 }}>
                        <p style={label11}>Type</p>
                        <select
                          value={newRule.rate_type}
                          onChange={(e) =>
                            setNewRule((p) => ({
                              ...p,
                              rate_type: e.target.value,
                            }))
                          }
                          style={{ ...inp, width: 90 }}
                        >
                          <option value="percent">%</option>
                          <option value="fixed">RM flat</option>
                        </select>
                      </div>
                      <div style={{ minWidth: 80 }}>
                        <p style={label11}>Rate</p>
                        <input
                          type="number"
                          value={newRule.rate_value}
                          onChange={(e) =>
                            setNewRule((p) => ({
                              ...p,
                              rate_value: e.target.value,
                            }))
                          }
                          placeholder={
                            newRule.rate_type === "percent" ? "10" : "500"
                          }
                          style={{ ...inp, width: 80 }}
                        />
                      </div>
                      <div style={{ minWidth: 90 }}>
                        <p style={label11}>Min GP (RM)</p>
                        <input
                          type="number"
                          value={newRule.min_gp}
                          onChange={(e) =>
                            setNewRule((p) => ({
                              ...p,
                              min_gp: e.target.value,
                            }))
                          }
                          placeholder="0"
                          style={{ ...inp, width: 90 }}
                        />
                      </div>
                      <button
                        onClick={addRule}
                        disabled={commRuleSaving}
                        style={{
                          background: ACCENT,
                          color: "#000",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 14px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: commRuleSaving ? 0.6 : 1,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {commRuleSaving ? "Adding…" : "+ Add Rule"}
                      </button>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={XL.tbl}>
                      <thead>
                        <tr>
                          <th style={XL.thN} />
                          {[
                            "Label",
                            "Basis",
                            "Type",
                            "Rate",
                            "Min GP",
                            "Active",
                          ].map((h) => (
                            <th key={h} style={XL.th(h === "Label")}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {commRulesLoading ? (
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                padding: 20,
                                textAlign: "center",
                                color: "#374151",
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              Loading…
                            </td>
                          </tr>
                        ) : commRules.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                padding: 20,
                                textAlign: "center",
                                color: "#374151",
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              No rules yet
                            </td>
                          </tr>
                        ) : (
                          commRules.map((r, i) => (
                            <tr key={r.id} style={XL.row(i)}>
                              <td style={XL.tdN}>{i + 1}</td>
                              <td style={{ ...XL.td(false), color: "#e5e7eb" }}>
                                {r.label}
                              </td>
                              <td
                                style={{
                                  ...XL.td(true),
                                  color: "#9ca3af",
                                  textTransform: "capitalize",
                                }}
                              >
                                {r.basis?.replace("_", " ")}
                              </td>
                              <td
                                style={{
                                  ...XL.td(true),
                                  color: "#9ca3af",
                                  textTransform: "capitalize",
                                }}
                              >
                                {r.rate_type}
                              </td>
                              <td style={{ ...XL.td(true), color: "#e5e7eb" }}>
                                {r.rate_type === "percent"
                                  ? `${r.rate_value}%`
                                  : rm(r.rate_value)}
                              </td>
                              <td style={{ ...XL.td(true), color: "#9ca3af" }}>
                                {rm(r.min_gp)}
                              </td>
                              <td style={XL.td(true)}>
                                <button
                                  onClick={() => toggleRule(r)}
                                  style={{
                                    background: r.is_active
                                      ? "rgba(34,197,94,0.15)"
                                      : "rgba(107,114,128,0.15)",
                                    color: r.is_active ? "#4ade80" : "#6b7280",
                                    border: "none",
                                    borderRadius: 3,
                                    padding: "1px 8px",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  {r.is_active ? "Active" : "Off"}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {commSubTab === "ledger" && (
                <div style={{ overflowX: "auto" }}>
                  <table style={XL.tbl}>
                    <thead>
                      <tr>
                        <th style={XL.thN} />
                        {[
                          "Car",
                          "Salesman",
                          "GP",
                          "Rule Applied",
                          "Commission Due",
                          "Paid?",
                        ].map((h) => (
                          <th
                            key={h}
                            style={XL.th(
                              ["Car", "Salesman", "Rule Applied"].includes(h),
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {commLedgerLoading ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              padding: 20,
                              textAlign: "center",
                              color: "#374151",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            Loading…
                          </td>
                        </tr>
                      ) : commLedger.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              padding: 20,
                              textAlign: "center",
                              color: "#374151",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            No settled deals
                          </td>
                        </tr>
                      ) : (
                        <>
                          {commLedger.map((r, i) => {
                            const car = r.car_listings;
                            const rule = commRules.find(
                              (ru) => ru.id === r.commission_rule_id,
                            );
                            const commDue = calcCommDue(r);
                            const gpColor =
                              (r.gross_profit || 0) < 0 ? "#f87171" : "#4ade80";
                            return (
                              <tr key={r.id} style={XL.row(i)}>
                                <td style={XL.tdN}>{i + 1}</td>
                                <td
                                  style={{ ...XL.td(false), color: "#e5e7eb" }}
                                >
                                  {car
                                    ? `${car.year} ${car.brand} ${car.model}`
                                    : "—"}
                                </td>
                                <td
                                  style={{ ...XL.td(false), color: "#9ca3af" }}
                                >
                                  {r.profiles?.full_name || "—"}
                                </td>
                                <td
                                  style={{
                                    ...XL.td(true),
                                    fontWeight: 600,
                                    color: gpColor,
                                  }}
                                >
                                  {rm(r.gross_profit)}
                                </td>
                                <td
                                  style={{
                                    ...XL.td(false),
                                    color: "#9ca3af",
                                    fontSize: 11,
                                  }}
                                >
                                  {rule ? (
                                    rule.label
                                  ) : (
                                    <span style={{ color: "#374151" }}>—</span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...XL.td(true),
                                    fontWeight: 600,
                                    color: "#e5e7eb",
                                  }}
                                >
                                  {rm(commDue)}
                                </td>
                                <td style={XL.td(true)}>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "flex-end",
                                      gap: 5,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!r.commission_paid}
                                      onChange={() => toggleCommPaid(r)}
                                    />
                                    <span
                                      style={{
                                        fontSize: 10,
                                        color: r.commission_paid
                                          ? "#4ade80"
                                          : "#6b7280",
                                      }}
                                    >
                                      {r.commission_paid ? "Paid" : "Unpaid"}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                          <tr
                            style={{
                              background: "rgba(0,0,0,0.2)",
                              borderTop: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <td style={XL.tdN} />
                            <td
                              colSpan={4}
                              style={{
                                ...XL.td(false),
                                color: "#6b7280",
                                fontSize: 11,
                              }}
                            >
                              Total unpaid commissions
                            </td>
                            <td
                              style={{
                                ...XL.td(true),
                                fontWeight: 700,
                                color: "#f87171",
                              }}
                            >
                              {rm(unpaidTotal)}
                            </td>
                            <td
                              style={{
                                border: "1px solid rgba(255,255,255,0.07)",
                              }}
                            />
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── EXPENSES ── */}
          {activeNav === "expenses" && (
            <div>
              {/* Inline add-expense row */}
              <div
                style={{
                  background: "rgba(34,197,94,0.03)",
                  borderBottom: "2px solid rgba(34,197,94,0.12)",
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 100 }}>
                    <p style={label11}>Category</p>
                    <select
                      value={newExpense.category}
                      onChange={(e) =>
                        setNewExpense((p) => ({
                          ...p,
                          category: e.target.value,
                        }))
                      }
                      style={{ ...inp, width: 100 }}
                    >
                      {EXPENSE_CATS.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <p style={label11}>Description</p>
                    <input
                      value={newExpense.description}
                      onChange={(e) =>
                        setNewExpense((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="e.g. Office rent May"
                      style={inp}
                    />
                  </div>
                  <div style={{ minWidth: 90 }}>
                    <p style={label11}>Amount (RM)</p>
                    <input
                      type="number"
                      value={newExpense.amount}
                      onChange={(e) =>
                        setNewExpense((p) => ({ ...p, amount: e.target.value }))
                      }
                      placeholder="0"
                      style={{ ...inp, width: 90 }}
                    />
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <p style={label11}>Date</p>
                    <input
                      type="date"
                      value={newExpense.expense_date}
                      onChange={(e) =>
                        setNewExpense((p) => ({
                          ...p,
                          expense_date: e.target.value,
                        }))
                      }
                      style={{ ...inp, width: 110 }}
                    />
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <p style={label11}>Listing ref (opt.)</p>
                    <input
                      value={newExpense.listing_ref}
                      onChange={(e) =>
                        setNewExpense((p) => ({
                          ...p,
                          listing_ref: e.target.value,
                        }))
                      }
                      placeholder="e.g. Honda Civic"
                      style={{ ...inp, width: 120 }}
                    />
                  </div>
                  <button
                    onClick={addExpense}
                    disabled={expenseSaving}
                    style={{
                      background: ACCENT,
                      color: "#000",
                      border: "none",
                      borderRadius: 4,
                      padding: "6px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: expenseSaving ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {expenseSaving ? "Adding…" : "+ Add"}
                  </button>
                </div>
              </div>
              {expenseLoading ? (
                <p
                  style={{
                    color: "#374151",
                    textAlign: "center",
                    padding: 24,
                    fontSize: 13,
                  }}
                >
                  Loading…
                </p>
              ) : Object.keys(expByMonth).length === 0 ? (
                <p
                  style={{
                    color: "#374151",
                    textAlign: "center",
                    padding: 24,
                    fontSize: 13,
                  }}
                >
                  No expenses yet
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={XL.tbl}>
                    <thead>
                      <tr>
                        <th style={XL.thN} />
                        {[
                          "Date",
                          "Month",
                          "Category",
                          "Description",
                          "Amount",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            style={XL.th(
                              [
                                "Date",
                                "Month",
                                "Category",
                                "Description",
                              ].includes(h),
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(expByMonth)
                        .sort()
                        .reverse()
                        .map((mk) => {
                          const rows = expByMonth[mk];
                          const subtotal = rows.reduce(
                            (s, r) => s + (r.amount || 0),
                            0,
                          );
                          const [yr, mo] = mk.split("-");
                          const moLabel = new Date(
                            parseInt(yr),
                            parseInt(mo) - 1,
                            1,
                          ).toLocaleDateString("en-MY", {
                            month: "long",
                            year: "numeric",
                          });
                          return (
                            <React.Fragment key={mk}>
                              <tr style={{ background: "#0a1020" }}>
                                <td style={XL.tdN} />
                                <td
                                  colSpan={4}
                                  style={{
                                    ...XL.td(false),
                                    fontWeight: 600,
                                    color: "#e5e7eb",
                                    fontSize: 11,
                                  }}
                                >
                                  {moLabel}
                                </td>
                                <td
                                  style={{
                                    ...XL.td(true),
                                    fontWeight: 700,
                                    color: "#e5e7eb",
                                  }}
                                >
                                  {rm(subtotal)}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid rgba(255,255,255,0.07)",
                                  }}
                                />
                              </tr>
                              {rows.map((r, i) => {
                                const catCfg =
                                  EXPENSE_CAT_COLORS[r.category] ||
                                  EXPENSE_CAT_COLORS.misc;
                                return (
                                  <tr key={r.id} style={XL.row(i)}>
                                    <td style={XL.tdN}>{i + 1}</td>
                                    <td
                                      style={{
                                        ...XL.td(false),
                                        color: "#6b7280",
                                        fontSize: 11,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {r.expense_date}
                                    </td>
                                    <td
                                      style={{
                                        ...XL.td(false),
                                        color: "#374151",
                                        fontSize: 10,
                                      }}
                                    >
                                      {moLabel}
                                    </td>
                                    <td style={XL.td(false)}>
                                      <span
                                        style={{
                                          background: catCfg.bg,
                                          color: catCfg.color,
                                          borderRadius: 3,
                                          padding: "1px 7px",
                                          fontSize: 10,
                                          fontWeight: 600,
                                          textTransform: "capitalize",
                                        }}
                                      >
                                        {r.category}
                                      </span>
                                    </td>
                                    <td
                                      style={{
                                        ...XL.td(false),
                                        color: "#e5e7eb",
                                      }}
                                    >
                                      {r.description}
                                      {r.listing_ref && (
                                        <span
                                          style={{
                                            marginLeft: 6,
                                            fontSize: 10,
                                            color: "#6b7280",
                                          }}
                                        >
                                          · {r.listing_ref}
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        ...XL.td(true),
                                        fontWeight: 600,
                                        color: "#e5e7eb",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {rm(r.amount)}
                                    </td>
                                    <td style={{ ...XL.td(true), width: 36 }}>
                                      <button
                                        onClick={() => deleteExpense(r.id)}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#374151",
                                          cursor: "pointer",
                                          fontSize: 14,
                                          padding: 0,
                                          lineHeight: 1,
                                        }}
                                        title="Delete"
                                      >
                                        ×
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      {expenseRows.length > 0 && (
                        <tr
                          style={{
                            background: "rgba(0,0,0,0.25)",
                            borderTop: "2px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <td style={XL.tdN} />
                          <td
                            colSpan={4}
                            style={{
                              ...XL.td(false),
                              fontWeight: 700,
                              color: "#6b7280",
                              fontSize: 11,
                            }}
                          >
                            Grand Total
                          </td>
                          <td
                            style={{
                              ...XL.td(true),
                              fontWeight: 700,
                              color: "#e5e7eb",
                            }}
                          >
                            {rm(
                              expenseRows.reduce(
                                (s, r) => s + (r.amount || 0),
                                0,
                              ),
                            )}
                          </td>
                          <td
                            style={{
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── MONTH CLOSE ── */}
          {activeNav === "close" && (
            <div style={{ padding: 20, maxWidth: 720 }}>
              {closeLoading ? (
                <p style={{ color: "#374151", fontSize: 13 }}>Loading…</p>
              ) : (
                <>
                  <div style={{ overflowX: "auto", marginBottom: 20 }}>
                    <table style={XL.tbl}>
                      <thead>
                        <tr>
                          <th style={XL.thN} />
                          {["Checklist Item", "Status", "Action"].map((h) => (
                            <th key={h} style={XL.th(h !== "Action")}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            key: "costs",
                            label: "All sold units have costs posted",
                            auto: true,
                            checked: costsOk,
                            sub: costsOk
                              ? "All units posted"
                              : `${closeData?._uncostedCount || 0} unit(s) missing purchase price`,
                          },
                          {
                            key: "commissions_approved",
                            label: "Commissions reviewed",
                            auto: false,
                          },
                          {
                            key: "ar_reviewed",
                            label: "Outstanding receivables reviewed",
                            auto: false,
                          },
                          {
                            key: "expenses_posted",
                            label: "Expenses posted",
                            auto: false,
                          },
                        ].map(
                          (
                            { key, label, auto, checked: forcedCheck, sub },
                            idx,
                          ) => {
                            const isChecked = auto
                              ? forcedCheck
                              : !!closeData?.[key];
                            return (
                              <tr
                                key={key}
                                style={{
                                  ...XL.row(idx),
                                  cursor:
                                    auto || isClosed ? "default" : "pointer",
                                }}
                                onClick={
                                  auto || isClosed
                                    ? undefined
                                    : () => toggleCloseItem(key)
                                }
                              >
                                <td style={XL.tdN}>{idx + 1}</td>
                                <td
                                  style={{
                                    ...XL.td(false),
                                    color: isChecked ? "#e5e7eb" : "#6b7280",
                                  }}
                                >
                                  {label}
                                  {sub && (
                                    <div
                                      style={{
                                        fontSize: 10,
                                        color: isChecked
                                          ? "#4ade80"
                                          : "#f87171",
                                        marginTop: 2,
                                      }}
                                    >
                                      {sub}
                                    </div>
                                  )}
                                  {auto && !sub && (
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "#374151",
                                        marginTop: 2,
                                      }}
                                    >
                                      Auto-validated
                                    </div>
                                  )}
                                </td>
                                <td style={XL.td(true)}>
                                  <span
                                    style={{
                                      background: isChecked
                                        ? "rgba(34,197,94,0.15)"
                                        : "rgba(255,255,255,0.05)",
                                      color: isChecked ? "#4ade80" : "#374151",
                                      borderRadius: 3,
                                      padding: "1px 8px",
                                      fontSize: 10,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {isChecked
                                      ? "✓ Done"
                                      : auto
                                        ? "—"
                                        : "Pending"}
                                  </span>
                                </td>
                                <td style={{ ...XL.td(true), width: 70 }}>
                                  {!auto && !isClosed && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCloseItem(key);
                                      }}
                                      style={{
                                        background: isChecked
                                          ? "rgba(34,197,94,0.12)"
                                          : "rgba(255,255,255,0.05)",
                                        color: isChecked
                                          ? "#4ade80"
                                          : "#9ca3af",
                                        border: `1px solid ${isChecked ? "rgba(34,197,94,0.28)" : "rgba(255,255,255,0.08)"}`,
                                        borderRadius: 3,
                                        padding: "2px 8px",
                                        fontSize: 10,
                                        cursor: "pointer",
                                        fontFamily: "'DM Sans',sans-serif",
                                      }}
                                    >
                                      {isChecked ? "Uncheck" : "Check"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!isClosed && (
                    <button
                      onClick={doCloseMonth}
                      disabled={!allChecked || closeSaving}
                      style={{
                        background: allChecked
                          ? ACCENT
                          : "rgba(255,255,255,0.05)",
                        color: allChecked ? "#000" : "#374151",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 24px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: allChecked ? "pointer" : "not-allowed",
                        marginBottom: 20,
                        transition: "all 0.2s",
                      }}
                    >
                      {closeSaving ? "Closing…" : "Close Month"}
                    </button>
                  )}

                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 10,
                            color: ACCENT,
                            textTransform: "uppercase",
                            letterSpacing: 2,
                            margin: 0,
                          }}
                        >
                          AI Month Summary
                        </p>
                        {closeData?.ai_generated_at && !aiGenerating && (
                          <p
                            style={{
                              fontSize: 9,
                              color: "#374151",
                              marginTop: 2,
                            }}
                          >
                            Generated{" "}
                            {new Date(
                              closeData.ai_generated_at,
                            ).toLocaleDateString("en-MY", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={generateAiSummary}
                        disabled={!isClosed || aiGenerating}
                        style={{
                          background: isClosed
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(255,255,255,0.04)",
                          color: isClosed ? ACCENT : "#374151",
                          border: `1px solid ${isClosed ? "rgba(34,197,94,0.28)" : "rgba(255,255,255,0.06)"}`,
                          borderRadius: 4,
                          padding: "4px 12px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor:
                            isClosed && !aiGenerating
                              ? "pointer"
                              : "not-allowed",
                        }}
                      >
                        {aiGenerating
                          ? "Generating…"
                          : !isClosed
                            ? "Close month first"
                            : aiSummary
                              ? "Regenerate"
                              : "Generate Summary"}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={
                        aiSummary ||
                        (isClosed
                          ? "Click Generate Summary to create an AI summary of this month."
                          : "Month must be closed before generating a summary.")
                      }
                      rows={10}
                      style={{
                        ...inp,
                        resize: "vertical",
                        color: aiSummary ? "#e5e7eb" : "#374151",
                        cursor: "default",
                        lineHeight: 1.7,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── AI ADVISOR ── */}
          {activeNav === "advisor" && (
            <div style={{ display: "flex", height: "100%" }}>
              {/* Left 60%: chat panel */}
              <div
                style={{
                  flex: 3,
                  display: "flex",
                  flexDirection: "column",
                  borderRight: "1px solid rgba(255,255,255,0.07)",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {advisorMessages.length === 0 ? (
                    <p
                      style={{
                        color: "#374151",
                        fontSize: 13,
                        textAlign: "center",
                        margin: "auto",
                      }}
                    >
                      Ask a question or use a preset from the right panel.
                    </p>
                  ) : (
                    advisorMessages.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent:
                            m.role === "user" ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "82%",
                            background:
                              m.role === "user"
                                ? "rgba(34,197,94,0.10)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${m.role === "user" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.07)"}`,
                            borderRadius:
                              m.role === "user"
                                ? "10px 10px 3px 10px"
                                : "10px 10px 10px 3px",
                            padding: "9px 13px",
                            fontSize: 13,
                            color: m.role === "user" ? "#86efac" : "#e5e7eb",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.65,
                          }}
                        >
                          {m.content || (
                            <span style={{ color: "#374151" }}>…</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={advisorEndRef} />
                </div>
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    padding: "10px 14px",
                    display: "flex",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <input
                    value={advisorInput}
                    onChange={(e) => setAdvisorInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      (e.preventDefault(), sendAdvisor())
                    }
                    placeholder="Ask about this month's finances…"
                    disabled={advisorSending}
                    style={{ ...inp, flex: 1, padding: "8px 12px" }}
                  />
                  <button
                    onClick={() => sendAdvisor()}
                    disabled={advisorSending || !advisorInput.trim()}
                    style={{
                      background: ACCENT,
                      color: "#000",
                      border: "none",
                      borderRadius: 6,
                      padding: "0 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: advisorSending || !advisorInput.trim() ? 0.5 : 1,
                    }}
                  >
                    {advisorSending ? "…" : "Send"}
                  </button>
                  {advisorMessages.length > 0 && !advisorSending && (
                    <button
                      onClick={() => setAdvisorMessages([])}
                      style={{
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        color: "#374151",
                        fontSize: 11,
                        padding: "0 10px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Right 40%: presets sidebar */}
              <div
                style={{
                  flex: 2,
                  padding: 14,
                  overflowY: "auto",
                  background: "#080e18",
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  Preset Questions
                </p>
                {ADVISOR_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendAdvisor(p)}
                    disabled={advisorSending}
                    style={{
                      width: "100%",
                      display: "block",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 4,
                      color: "#9ca3af",
                      fontSize: 12,
                      padding: "9px 12px",
                      cursor: advisorSending ? "not-allowed" : "pointer",
                      textAlign: "left",
                      lineHeight: 1.4,
                      marginBottom: 6,
                      fontFamily: "'DM Sans',sans-serif",
                      opacity: advisorSending ? 0.5 : 1,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* ── ACCOUNTS RECEIVABLE ── */}
          {activeNav === "ar" && (
            <div>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "2px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.02)" }}>
                {[
                  { label: "Awaiting Disbursement", value: arLoading ? "—" : String(arRows.filter(r => !r.loan_disbursed).length) },
                  { label: "Total Outstanding", value: arLoading ? "—" : rm(arRows.reduce((s,r) => s + (r.loan_amount||0), 0)), color: "#f87171" },
                  { label: "Avg Days Outstanding", value: arLoading || !arRows.length ? "—" : `${Math.round(arRows.reduce((s,r) => s + Math.floor((Date.now()-new Date(r.created_at).getTime())/86400000),0)/arRows.length)} days` },
                  { label: "Deposits Collected", value: arLoading ? "—" : rm(arRows.reduce((s,r) => s + (r.deposit_received||0), 0)), color: "#4ade80" },
                ].map((c, i) => (
                  <div key={c.label} style={{ padding: "10px 16px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                    <p style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, margin: "0 0 4px" }}>{c.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: c.color || ACCENT, margin: 0, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{c.value}</p>
                  </div>
                ))}
              </div>
              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={XL.tbl}>
                  <thead>
                    <tr>
                      <th style={XL.thN} />
                      {["Car","Salesman","Selling Price","Deposit Received","Loan Amount","Bank","Days Since Sale","Status",""].map((h) => (
                        <th key={h} style={XL.th(["Car","Salesman","Bank",""].includes(h), h === "Car" ? 200 : 110)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arLoading ? (
                      <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#374151", border: "1px solid rgba(255,255,255,0.07)" }}>Loading…</td></tr>
                    ) : arRows.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#4ade80", border: "1px solid rgba(255,255,255,0.07)" }}>✓ All loans disbursed — no outstanding receivables</td></tr>
                    ) : arRows.map((row, i) => {
                      const car = row.car_listings;
                      const days = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000);
                      const ageColor = days > 14 ? "#f87171" : days > 7 ? "#fbbf24" : "#4ade80";
                      const sc = DEAL_STATUS_COLORS[row.status] || DEAL_STATUS_COLORS.pending;
                      return (
                        <tr key={row.id} style={XL.row(i)} onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.04)"} onMouseLeave={e => e.currentTarget.style.background = i%2===0?"transparent":"rgba(255,255,255,0.018)"}>
                          <td style={XL.tdN}>{i + 1}</td>
                          <td style={{ ...XL.td(false, 200), color: "#e5e7eb" }}>{car ? `${car.year} ${car.brand} ${car.model}` : "—"}</td>
                          <td style={{ ...XL.td(false), color: "#9ca3af" }}>{row.profiles?.full_name || "—"}</td>
                          <td style={{ ...XL.td(true), color: "#e5e7eb" }}>{rm(row.selling_price)}</td>
                          <td style={{ ...XL.td(true), color: "#9ca3af" }}>{rm(row.deposit_received)}</td>
                          <td style={{ ...XL.td(true), color: "#fbbf24" }}>{rm(row.loan_amount)}</td>
                          <td style={{ ...XL.td(false), color: "#9ca3af" }}>{row.loan_bank || "—"}</td>
                          <td style={{ ...XL.td(true), color: ageColor, fontWeight: 600 }}>{days}d</td>
                          <td style={XL.td(true)}>
                            <span style={{ background: sc.bg, color: sc.color, borderRadius: 3, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>
                              {row.status || "pending"}
                            </span>
                          </td>
                          <td style={{ ...XL.td(false), padding: "4px 8px" }}>
                            <button
                              onClick={() => markDisbursed(row)}
                              disabled={!!arDisbursing[row.id]}
                              style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 4, color: "#60a5fa", fontSize: 10, fontWeight: 600, padding: "3px 10px", cursor: "pointer", opacity: arDisbursing[row.id] ? 0.5 : 1, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}
                            >
                              {arDisbursing[row.id] ? "Saving…" : "Mark Disbursed"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STOCK VALUATION ── */}
          {activeNav === "stock" && (
            <div>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "2px solid rgba(234,179,8,0.15)", background: "rgba(234,179,8,0.02)" }}>
                {[
                  { label: "Units in Stock", value: stockLoading ? "—" : String(stockStats?.total ?? 0) },
                  { label: "Floor Plan Exposure", value: stockLoading ? "—" : rm(stockStats?.totalFloor ?? 0), color: "#e5e7eb" },
                  { label: "Est. Monthly Interest (4% p.a.)", value: stockLoading ? "—" : rm(stockStats?.monthlyInterest ?? 0), color: "#fbbf24" },
                  { label: "Stale Units (>60 days)", value: stockLoading ? "—" : String(stockStats?.stale ?? 0), color: (stockStats?.stale ?? 0) > 0 ? "#f87171" : "#4ade80" },
                ].map((c, i) => (
                  <div key={c.label} style={{ padding: "10px 16px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                    <p style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, margin: "0 0 4px" }}>{c.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: c.color || ACCENT, margin: 0, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{c.value}</p>
                  </div>
                ))}
              </div>
              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={XL.tbl}>
                  <thead>
                    <tr>
                      <th style={XL.thN} />
                      {["Car","Cond.","Status","Days","Purchase","Recon","Asking","Margin %","Est. Interest"].map((h) => (
                        <th key={h} style={XL.th(["Car","Cond.","Status"].includes(h), h==="Car"?200:h==="Days"||h==="Cond."||h==="Status"?80:110)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockLoading ? (
                      <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#374151", border: "1px solid rgba(255,255,255,0.07)" }}>Loading…</td></tr>
                    ) : stockRows.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#374151", border: "1px solid rgba(255,255,255,0.07)" }}>No active stock</td></tr>
                    ) : stockRows.map((r, i) => {
                      const ageColor = r.days > 60 ? "#f87171" : r.days > 30 ? "#fbbf24" : "#4ade80";
                      const marginColor = r.margin < 5 ? "#f87171" : r.margin < 10 ? "#fbbf24" : "#4ade80";
                      return (
                        <tr key={r.id} style={XL.row(i)} onMouseEnter={e => e.currentTarget.style.background="rgba(234,179,8,0.04)"} onMouseLeave={e => e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.018)"}>
                          <td style={XL.tdN}>{i + 1}</td>
                          <td style={{ ...XL.td(false, 200), color: "#e5e7eb" }}>{r.year} {r.brand} {r.model}</td>
                          <td style={{ ...XL.td(false, 80), color: "#9ca3af", textTransform: "capitalize" }}>{r.condition || "—"}</td>
                          <td style={{ ...XL.td(false, 80) }}>
                            <span style={{ background: r.status==="reserved"?"rgba(251,191,36,0.12)":"rgba(74,222,128,0.12)", color: r.status==="reserved"?"#fbbf24":"#4ade80", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{r.status}</span>
                          </td>
                          <td style={{ ...XL.td(true, 80), color: ageColor, fontWeight: 600 }}>{r.days}d</td>
                          <td style={{ ...XL.td(true), color: r.purchase_price ? "#9ca3af" : "#374151" }}>{r.purchase_price ? rm(r.purchase_price) : "—"}</td>
                          <td style={{ ...XL.td(true), color: "#9ca3af" }}>{r.recon_cost ? rm(r.recon_cost) : "—"}</td>
                          <td style={{ ...XL.td(true), color: "#e5e7eb" }}>{rm(r.selling_price)}</td>
                          <td style={{ ...XL.td(true), color: marginColor, fontWeight: 600 }}>{r.purchase_price ? `${r.margin.toFixed(1)}%` : "—"}</td>
                          <td style={{ ...XL.td(true), color: r.interest > 500 ? "#f87171" : "#6b7280" }}>{r.purchase_price ? rm(Math.round(r.interest)) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── KPI DASHBOARD ── */}
          {activeNav === "kpi" && (
            <div style={{ padding: 16 }}>
              {kpiLoading ? (
                <p style={{ textAlign: "center", color: "#374151", padding: 40 }}>Loading…</p>
              ) : !kpiSummary ? null : (
                <>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "6-Month Avg GPU", value: rm(Math.round(kpiSummary.avgGpu)), color: "#4ade80" },
                      { label: "Avg Days in Stock", value: `${kpiSummary.avgDays.toFixed(1)} days`, color: kpiSummary.avgDays > 60 ? "#f87171" : kpiSummary.avgDays > 30 ? "#fbbf24" : "#4ade80" },
                      { label: "Break-Even (this mo.)", value: kpiSummary.breakEven !== null ? `${kpiSummary.breakEven} units` : "—", color: "#e5e7eb" },
                      { label: "Latest Month Net", value: rm(Math.round(kpiSummary.latestNet)), color: kpiSummary.latestNet >= 0 ? "#4ade80" : "#f87171" },
                    ].map((c) => (
                      <div key={c.label} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 16px" }}>
                        <p style={{ fontSize: 9, color: "#334155", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, margin: "0 0 6px" }}>{c.label}</p>
                        <p style={{ fontSize: 20, fontWeight: 700, color: c.color, margin: 0, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{c.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly trend */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {/* Monthly table */}
                    <div>
                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Monthly Trend (6 months)</p>
                      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6 }}>
                        <table style={{ ...XL.tbl, fontSize: 11 }}>
                          <thead>
                            <tr>
                              {["Month","Units","Total GP","Avg GPU","Expenses","Net"].map(h => (
                                <th key={h} style={{ ...XL.th(h==="Month", 80), fontSize: 9 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {kpiMonthly.length === 0 ? (
                              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#374151", border: "1px solid rgba(255,255,255,0.07)" }}>No data</td></tr>
                            ) : kpiMonthly.map((m, i) => {
                              const [yr, mo] = m.month.split("-");
                              const label = new Date(+yr, +mo - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
                              return (
                                <tr key={m.month} style={XL.row(i)}>
                                  <td style={{ ...XL.td(false, 80), color: "#e5e7eb", fontWeight: 600 }}>{label}</td>
                                  <td style={{ ...XL.td(true, 60), color: "#9ca3af" }}>{m.units}</td>
                                  <td style={{ ...XL.td(true), color: "#4ade80" }}>{rm(Math.round(m.totalGP))}</td>
                                  <td style={{ ...XL.td(true), color: "#22c55e", fontWeight: 600 }}>{rm(Math.round(m.gpu))}</td>
                                  <td style={{ ...XL.td(true), color: "#f87171" }}>{rm(Math.round(m.expenses))}</td>
                                  <td style={{ ...XL.td(true), color: m.net >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{rm(Math.round(m.net))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Salesman ranking */}
                    <div>
                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Salesman GP Ranking (6 months)</p>
                      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, overflow: "hidden" }}>
                        <table style={{ ...XL.tbl, fontSize: 11 }}>
                          <thead>
                            <tr>
                              {["#","Name","Units","Total GP","Avg GPU"].map(h => (
                                <th key={h} style={{ ...XL.th(h==="Name", h==="#"?40:110), fontSize: 9 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {kpiSalesmen.length === 0 ? (
                              <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#374151", border: "1px solid rgba(255,255,255,0.07)" }}>No data</td></tr>
                            ) : kpiSalesmen.map((s, i) => (
                              <tr key={s.name} style={XL.row(i)}>
                                <td style={{ ...XL.tdN, color: i === 0 ? "#fbbf24" : "#4b5563" }}>{i + 1}</td>
                                <td style={{ ...XL.td(false), color: "#e5e7eb", fontWeight: i === 0 ? 700 : 400 }}>{s.name}</td>
                                <td style={{ ...XL.td(true, 60), color: "#9ca3af" }}>{s.units}</td>
                                <td style={{ ...XL.td(true), color: "#4ade80" }}>{rm(Math.round(s.gp))}</td>
                                <td style={{ ...XL.td(true), color: "#22c55e", fontWeight: 600 }}>{rm(Math.round(s.gpu))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Break-even analysis */}
                  {kpiSummary.breakEven !== null && (
                    <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 18px" }}>
                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10 }}>Break-Even Analysis (current month)</p>
                      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                        <div>
                          <p style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Monthly Expenses</p>
                          <p style={{ fontSize: 16, color: "#f87171", fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif" }}>{rm(Math.round(kpiSummary.latestExpenses))}</p>
                        </div>
                        <div style={{ color: "#374151", fontSize: 20, alignSelf: "center" }}>÷</div>
                        <div>
                          <p style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Avg GPU</p>
                          <p style={{ fontSize: 16, color: "#4ade80", fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif" }}>{rm(Math.round(kpiSummary.avgGpu))}</p>
                        </div>
                        <div style={{ color: "#374151", fontSize: 20, alignSelf: "center" }}>=</div>
                        <div>
                          <p style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Units to Break Even</p>
                          <p style={{ fontSize: 22, color: "#e5e7eb", fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{kpiSummary.breakEven} units</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
        {/* end grid area */}
      </div>
      {/* end main content */}
    </div>
  );
}

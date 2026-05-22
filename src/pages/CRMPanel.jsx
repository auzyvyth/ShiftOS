import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, MessageCircle, Save, FileText, PlusCircle, Trash2, Plus, Bell, MapPin, Calendar, Phone, User } from "lucide-react";
import { supabase } from "../supabaseClient";
import LeadsPage from "./LeadsPage";

// ─── Shared style tokens (mirror DashboardPage) ────────────────────────────────
const T = {
  card: {
    position: "relative",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008))",
    border: "1px solid rgba(255,255,255,0.055)",
    backdropFilter: "blur(12px)",
  },
  btnRed: {
    background: "linear-gradient(135deg,#dc2626,#b91c1c)",
    boxShadow: "0 2px 10px rgba(220,38,38,0.28)",
    border: "none",
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all";
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none";

// ─── EnquiriesTab ─────────────────────────────────────────────────────────────
const DEFAULT_ENQUIRY_TEMPLATE = `Hi {{buyer_name}}, thank you for your enquiry about the {{car_name}}! 😊\n\nWe'd love to help you with more details or arrange a viewing. When would be a good time for you?\n\nBest regards,\n{{dealer_name}} — {{dealership}}`;

function EnquiriesTab({ userId, onOpenDoc }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [waTemplate, setWaTemplate] = useState(DEFAULT_ENQUIRY_TEMPLATE);
  const [editedMsg, setEditedMsg] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [stockData, setStockData] = useState(null);
  const [dealerProfile, setDealerProfile] = useState(null);

  const statusMeta = {
    new: {
      color: "#60a5fa",
      bg: "rgba(96,165,250,0.12)",
      border: "rgba(96,165,250,0.3)",
    },
    contacted: {
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.12)",
      border: "rgba(251,191,36,0.3)",
    },
    qualified: {
      color: "#34d399",
      bg: "rgba(52,211,153,0.12)",
      border: "rgba(52,211,153,0.3)",
    },
    lost: {
      color: "#6b7280",
      bg: "rgba(107,114,128,0.1)",
      border: "rgba(107,114,128,0.25)",
    },
  };

  const fetchEnquiries = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("whatsapp_enquiries")
      .select(`*, listing:public_car_listings(brand, model, variant, selling_price)`)
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false });
    if (err) {
      console.error("[EnquiriesTab] fetch error:", err.message, err);
      setLoading(false);
      return;
    }
    const rows = data || [];

    /* Auto-progress enquiries stuck in "new" for > 2 days */
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const staleIds = rows
      .filter(e => (!e.status || e.status === "new") && Date.now() - new Date(e.created_at).getTime() > TWO_DAYS)
      .map(e => e.id);
    if (staleIds.length) {
      await supabase.from("whatsapp_enquiries").update({ status: "contacted" }).in("id", staleIds);
      staleIds.forEach(id => {
        const row = rows.find(e => e.id === id);
        if (row) row.status = "contacted";
      });
    }

    setEnquiries(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchEnquiries();
    const ch = supabase
      .channel("enquiries_live_" + userId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_enquiries",
          filter: `dealer_id=eq.${userId}`,
        },
        () => fetchEnquiries(),
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, dealership, enquiry_wa_template, whatsapp_number")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setDealerProfile(data);
          if (data.enquiry_wa_template) setWaTemplate(data.enquiry_wa_template);
        }
      });
  }, [userId]);

  const populateTemplate = (tmpl, enq, dp) => {
    const listing = enq.listing;
    return (tmpl || DEFAULT_ENQUIRY_TEMPLATE)
      .replace(/\{\{buyer_name\}\}/g, enq.buyer_name || "there")
      .replace(
        /\{\{car_name\}\}/g,
        listing ? `${listing.brand} ${listing.model}` : "the car",
      )
      .replace(/\{\{dealer_name\}\}/g, dp?.full_name || "")
      .replace(/\{\{dealership\}\}/g, dp?.dealership || "");
  };

  const updateStatus = async (id, status) => {
    await supabase.from("whatsapp_enquiries").update({ status }).eq("id", id);
    setEnquiries((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
    if (selected?.id === id) setSelected((p) => ({ ...p, status }));
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    await supabase
      .from("whatsapp_enquiries")
      .update({ notes })
      .eq("id", selected.id);
    setEnquiries((p) =>
      p.map((e) => (e.id === selected.id ? { ...e, notes } : e)),
    );
    setSavingNotes(false);
  };

  const handleWhatsApp = async (enq) => {
    const phone = (enq.buyer_phone || "").replace(/\D/g, "");
    if (!phone) return;
    await supabase
      .from("whatsapp_enquiries")
      .update({ status: "contacted" })
      .eq("id", enq.id);
    setEnquiries((p) =>
      p.map((e) => (e.id === enq.id ? { ...e, status: "contacted" } : e)),
    );
    if (selected?.id === enq.id)
      setSelected((p) => ({ ...p, status: "contacted" }));
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(editedMsg)}`,
      "_blank",
    );
  };

  const saveTemplate = async () => {
    setTemplateSaving(true);
    await supabase
      .from("profiles")
      .update({ enquiry_wa_template: editedMsg })
      .eq("id", userId);
    setWaTemplate(editedMsg);
    setTemplateSaving(false);
    toast.success("Default template saved ✓");
  };

  useEffect(() => {
    if (selected)
      setEditedMsg(populateTemplate(waTemplate, selected, dealerProfile));
  }, [selected?.id, waTemplate, dealerProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected?.listing_id) { setStockData(null); return; }
    supabase
      .from('stock_units')
      .select('purchase_price, recon_cost, asking_price, status')
      .eq('listing_id', selected.listing_id)
      .maybeSingle()
      .then(({ data }) => setStockData(data || null));
  }, [selected?.listing_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const StatusBadge = ({ status }) => {
    const m = statusMeta[status] || statusMeta.new;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: m.color,
          background: m.bg,
          border: `1px solid ${m.border}`,
          borderRadius: 6,
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {status || "new"}
      </span>
    );
  };

  function buildCoachPrompt(enquiry, stock, dealer) {
    const car = enquiry.listing;
    const carLabel = car ? `${car.brand} ${car.model}` : 'this car';
    const askingPrice = car?.selling_price || stock?.asking_price || 0;
    const costPrice = (stock?.purchase_price || 0) + (stock?.recon_cost || 0);
    const gpRoom = askingPrice && costPrice ? askingPrice - costPrice : null;
    const daysSinceEnquiry = enquiry.created_at
      ? Math.floor((Date.now() - new Date(enquiry.created_at)) / 86400000)
      : 0;

    return `You are a Negotiation Coach whispering advice to a Malaysian car salesman mid-deal.

Deal context:
- Car: ${carLabel}
- Asking price: RM${askingPrice.toLocaleString()}
- Cost basis (purchase + recon): ${costPrice ? `RM${costPrice.toLocaleString()}` : 'unknown'}
- Gross profit room: ${gpRoom ? `RM${gpRoom.toLocaleString()}` : 'unknown'}
- Buyer name: ${enquiry.buyer_name || 'unknown'}
- Buyer message: "${enquiry.buyer_message || 'none'}"
- Enquiry notes: "${enquiry.notes || 'none'}"
- Days since enquiry: ${daysSinceEnquiry}
- Current status: ${enquiry.status || 'new'}
- Dealer: ${dealer?.dealership || 'dealer'}

Your job:
1. Read the situation and give the salesman a sharp tactical edge
2. If GP room is known, suggest specific RM concessions — never go below cost
3. Identify buyer signals from the message and notes
4. Suggest exact words the salesman can say or WhatsApp
5. If the lead is cold (2+ days), suggest a re-engagement line
6. Speak directly to the salesman — "you", not "the salesman"
7. Be concise. Max 80 words unless asked to elaborate.
8. Casual tone — like a senior colleague whispering, not a textbook

Never reveal the cost basis or GP room to the buyer. That's internal only.`;
  }

  const sendCoachMessage = async (userMsg) => {
    if (!selected || coachLoading) return;
    const newHistory = [...coachMessages, { role: 'user', content: userMsg }];
    setCoachMessages(newHistory);
    setCoachLoading(true);
    try {
      const AI_PROXY = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/ai/messages`;
      const res = await fetch(AI_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildCoachPrompt(selected, stockData, dealerProfile),
          messages: newHistory,
        }),
      });
      const data = await res.json();
      const reply = data?.content?.[0]?.text ?? 'Could not load advice.';
      setCoachMessages([...newHistory, { role: 'assistant', content: reply }]);
    } catch {
      setCoachMessages([...newHistory, { role: 'assistant', content: 'Connection error.' }]);
    }
    setCoachLoading(false);
  };

  const openDetail = (e) => {
    setSelected(e);
    setNotes(e.notes || "");
    setCoachOpen(false);
    setCoachMessages([]);
    setTimeout(() => { setCoachOpen(true); }, 300);
  };

  useEffect(() => {
    if (!coachOpen || !selected || coachMessages.length > 0) return;
    sendCoachMessage('Read this enquiry and give me your quick read of the situation and what I should do next.');
  }, [coachOpen, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={T.card}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#f3f4f6",
                margin: 0,
              }}
            >
              Enquiries
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              {enquiries.length} total · tap a row to view details
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#60a5fa",
              background: "rgba(96,165,250,0.1)",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: 6,
              padding: "3px 10px",
            }}
          >
            {enquiries.filter((e) => (e.status || "new") === "new").length} new
          </span>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm p-6">Loading...</p>
        ) : enquiries.length === 0 ? (
          <p className="text-gray-600 text-sm p-6">
            No enquiries yet. They'll appear here once buyers contact you
            through the storefront.
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden">
              {enquiries.map((e) => {
                const m = statusMeta[e.status || "new"];
                const carLabel = e.listing
                  ? `${e.listing.brand} ${e.listing.model}`
                  : e.car_info || "General enquiry";
                return (
                  <div
                    key={e.id}
                    onClick={() => openDetail(e)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#f3f4f6",
                        }}
                      >
                        {e.buyer_name || "Unknown buyer"}
                      </span>
                      <StatusBadge status={e.status || "new"} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "#9ca3af",
                          flex: 1,
                          marginRight: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {carLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          flexShrink: 0,
                        }}
                      >
                        {e.created_at
                          ? new Date(e.created_at).toLocaleDateString("en-MY")
                          : "—"}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.buyer_phone && (
                        <button
                          onClick={() => {
                            openDetail(e);
                            setTimeout(() => handleWhatsApp(e), 80);
                          }}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            padding: "8px",
                            background: "rgba(37,211,102,0.08)",
                            border: "1px solid rgba(37,211,102,0.2)",
                            borderRadius: 8,
                            color: "#4ade80",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "'DM Sans',sans-serif",
                          }}
                        >
                          <MessageCircle style={{ width: 13, height: 13 }} />{" "}
                          WhatsApp
                        </button>
                      )}
                      <select
                        value={e.status || "new"}
                        onChange={(ev) => updateStatus(e.id, ev.target.value)}
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 600,
                          background: m?.bg,
                          color: m?.color,
                          border: `1px solid ${m?.border}`,
                          borderRadius: 8,
                          padding: "8px 6px",
                          cursor: "pointer",
                          outline: "none",
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        {Object.keys(statusMeta).map((s) => (
                          <option
                            key={s}
                            value={s}
                            style={{ background: "#111118", color: "#fff" }}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => openDetail(e)}
                        style={{
                          padding: "8px 14px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          color: "#9ca3af",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block table-wrap">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {["Buyer", "Car", "Source", "Status", "Date", ""].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 14px",
                            fontSize: 10,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#6b7280",
                            fontWeight: 500,
                            textAlign: "left",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((e) => (
                    <tr
                      key={e.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(ev) =>
                        (ev.currentTarget.style.background =
                          "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(ev) =>
                        (ev.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        onClick={() => openDetail(e)}
                        style={{
                          padding: "12px 14px",
                          color: "#f3f4f6",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {e.buyer_name || "—"}
                      </td>
                      <td
                        onClick={() => openDetail(e)}
                        style={{
                          padding: "12px 14px",
                          color: "#9ca3af",
                          fontSize: 13,
                        }}
                      >
                        {e.listing
                          ? `${e.listing.brand} ${e.listing.model}`
                          : e.car_info || "—"}
                      </td>
                      <td
                        onClick={() => openDetail(e)}
                        style={{ padding: "12px 14px" }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          {e.lead_source || e.ref_slug || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <select
                          value={e.status || "new"}
                          onChange={(ev) => {
                            ev.stopPropagation();
                            updateStatus(e.id, ev.target.value);
                          }}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: statusMeta[e.status || "new"]?.bg,
                            color: statusMeta[e.status || "new"]?.color,
                            border: `1px solid ${statusMeta[e.status || "new"]?.border}`,
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          {Object.keys(statusMeta).map((s) => (
                            <option
                              key={s}
                              value={s}
                              style={{ background: "#111118", color: "#fff" }}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        onClick={() => openDetail(e)}
                        style={{
                          padding: "12px 14px",
                          color: "#6b7280",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.created_at
                          ? new Date(e.created_at).toLocaleDateString("en-MY")
                          : "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          onClick={() => openDetail(e)}
                          style={{
                            fontSize: 11,
                            color: "#9ca3af",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 6,
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <>
          <div
            onClick={() => setSelected(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              width: 400,
              maxWidth: "100vw",
              background: "#0d1117",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            >
              <div>
                <h3
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    margin: 0,
                  }}
                >
                  {selected.buyer_name || "Enquiry"}
                </h3>
                <p
                  style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}
                >
                  {selected.listing
                    ? `${selected.listing.brand} ${selected.listing.model}`
                    : "General enquiry"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge status={selected.status || "new"} />
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    borderRadius: 8,
                    padding: 6,
                    display: "flex",
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  ["Phone", selected.buyer_phone],
                  [
                    "Date",
                    selected.created_at
                      ? new Date(selected.created_at).toLocaleDateString(
                          "en-MY",
                        )
                      : "—",
                  ],
                  ["Source", selected.lead_source || selected.ref_slug || "—"],
                  [
                    "Price",
                    selected.listing?.selling_price
                      ? `RM ${Number(selected.listing.selling_price).toLocaleString()}`
                      : "—",
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        margin: "0 0 4px",
                      }}
                    >
                      {k}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#f3f4f6",
                        margin: 0,
                        fontWeight: 500,
                      }}
                    >
                      {v || "—"}
                    </p>
                  </div>
                ))}
              </div>
              {selected.buyer_message && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "12px",
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: "0 0 6px",
                    }}
                  >
                    Their message
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#d1d5db",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {selected.buyer_message}
                  </p>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: "0 0 6px",
                  }}
                >
                  Status
                </p>
                <select
                  value={selected.status || "new"}
                  onChange={(ev) => updateStatus(selected.id, ev.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    fontWeight: 600,
                    background: statusMeta[selected.status || "new"]?.bg,
                    color: statusMeta[selected.status || "new"]?.color,
                    border: `1px solid ${statusMeta[selected.status || "new"]?.border}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    outline: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {Object.keys(statusMeta).map((s) => (
                    <option
                      key={s}
                      value={s}
                      style={{ background: "#111118", color: "#fff" }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: "0 0 6px",
                  }}
                >
                  Notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this enquiry..."
                  className={taCls}
                />
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="mt-2 w-full px-4 py-2 rounded-xl text-sm text-white font-semibold"
                  style={T.btnRed}
                >
                  {savingNotes ? "Saving..." : "Save Notes"}
                </button>
              </div>
              {selected.buyer_phone && (
                <div
                  style={{
                    paddingTop: 16,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: "0 0 8px",
                    }}
                  >
                    Follow-up Message
                  </p>
                  <textarea
                    value={editedMsg}
                    onChange={(e) => setEditedMsg(e.target.value)}
                    rows={5}
                    placeholder="WhatsApp message…"
                    className={taCls}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => handleWhatsApp(selected)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "11px 12px",
                        background: "rgba(37,211,102,0.1)",
                        border: "1px solid rgba(37,211,102,0.25)",
                        borderRadius: 10,
                        color: "#4ade80",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <MessageCircle style={{ width: 15, height: 15 }} />
                      WhatsApp {selected.buyer_name?.split(" ")[0] || ""} ↗
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={templateSaving}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "11px 12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#9ca3af",
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <Save style={{ width: 12, height: 12 }} />
                      {templateSaving ? "Saving…" : "Save as default"}
                    </button>
                  </div>
                </div>
              )}
              {onOpenDoc && (
                <div
                  style={{
                    paddingTop: 16,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      margin: "0 0 10px",
                    }}
                  >
                    Generate Document
                  </p>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <button
                      onClick={() =>
                        onOpenDoc({
                          doc_type: "Deposit Receipt",
                          buyer_name: selected.buyer_name || "",
                          buyer_phone: selected.phone || "",
                          listing_id: selected.listing_id || "",
                        })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 14px",
                        background: "rgba(251,191,36,0.08)",
                        border: "1px solid rgba(251,191,36,0.2)",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "#fbbf24",
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <FileText style={{ width: 14, height: 14 }} /> Generate
                      Deposit Receipt
                    </button>
                    <button
                      onClick={() =>
                        onOpenDoc({
                          doc_type: "Sales Agreement",
                          buyer_name: selected.buyer_name || "",
                          buyer_phone: selected.phone || "",
                          listing_id: selected.listing_id || "",
                        })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 14px",
                        background: "rgba(96,165,250,0.08)",
                        border: "1px solid rgba(96,165,250,0.2)",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "#60a5fa",
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <FileText style={{ width: 14, height: 14 }} /> Generate
                      Sales Agreement
                    </button>
                  </div>
                </div>
              )}

              {/* ── Negotiation Coach ── */}
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
                <button
                  onClick={() => {
                    setCoachOpen(p => !p);
                    if (!coachOpen && coachMessages.length === 0) {
                      setTimeout(() => sendCoachMessage('Read this enquiry and give me your quick read of the situation and what I should do next.'), 100);
                    }
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: coachOpen ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${coachOpen ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>NC</div>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Negotiation Coach</p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>AI advice for this deal</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: '#6b7280', lineHeight: 1 }}>{coachOpen ? '−' : '+'}</span>
                </button>

                {coachOpen && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      maxHeight: 280, overflowY: 'auto',
                      display: 'flex', flexDirection: 'column', gap: 10,
                      marginBottom: 10, padding: '4px 2px',
                    }}>
                      {coachMessages.length === 0 && !coachLoading && (
                        <p style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>
                          Loading situation read...
                        </p>
                      )}
                      {coachMessages.map((m, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                          gap: 8, alignItems: 'flex-end',
                        }}>
                          {m.role === 'assistant' && (
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0,
                            }}>NC</div>
                          )}
                          <div style={{
                            maxWidth: '85%',
                            background: m.role === 'user' ? '#1d4ed8' : 'rgba(255,255,255,0.06)',
                            border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            padding: '8px 12px', fontSize: 13, lineHeight: 1.55,
                            color: m.role === 'user' ? '#fff' : '#d1d5db',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {coachLoading && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0,
                          }}>NC</div>
                          <div style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px 12px 12px 4px',
                            padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center',
                          }}>
                            {[0, 1, 2].map(i => (
                              <div key={i} style={{
                                width: 5, height: 5, borderRadius: '50%',
                                background: '#dc2626',
                                animation: 'pulse 1.2s ease-in-out infinite',
                                animationDelay: `${i * 0.2}s`,
                              }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {[
                        'How much can I drop?',
                        'Buyer is ghosting me',
                        'They said too expensive',
                        'What should I WhatsApp them?',
                      ].map(q => (
                        <button
                          key={q}
                          onClick={() => sendCoachMessage(q)}
                          disabled={coachLoading}
                          style={{
                            fontSize: 11, color: '#9ca3af',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 20, padding: '4px 10px',
                            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                            transition: 'all 0.15s',
                          }}
                        >{q}</button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        rows={2}
                        placeholder="Ask the coach..."
                        disabled={coachLoading}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const val = e.target.value.trim();
                            if (val) { sendCoachMessage(val); e.target.value = ''; }
                          }
                        }}
                        style={{
                          flex: 1, background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10, padding: '8px 12px',
                          fontSize: 13, color: '#f3f4f6',
                          fontFamily: "'DM Sans', sans-serif",
                          resize: 'none', outline: 'none', lineHeight: 1.5,
                        }}
                      />
                      <button
                        onClick={e => {
                          const ta = e.currentTarget.previousSibling;
                          const val = ta.value.trim();
                          if (val && !coachLoading) { sendCoachMessage(val); ta.value = ''; }
                        }}
                        disabled={coachLoading}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: coachLoading ? '#1f2937' : '#dc2626',
                          border: 'none', cursor: coachLoading ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.15s',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── BookingsTab ──────────────────────────────────────────────────────────────
const DEFAULT_BOOKING_TEMPLATE = `Hi {{buyer_name}}, your {{booking_type}} for the {{car_name}} is confirmed for {{booking_date}} at {{booking_time}}. 🎉\n\nPlease arrive on time. See you at {{dealership}}!\n\nReply to reschedule.`;

function BookingsTab({ userId, listings, salesmen }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    buyer_name: "",
    buyer_phone: "+60",
    listing_id: "",
    booking_type: "test_drive",
    scheduled_at: "",
    duration_minutes: 60,
    salesman_id: "",
    deposit_amount: "",
    notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [bkTemplate, setBkTemplate] = useState(DEFAULT_BOOKING_TEMPLATE);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("");
  const [bkTmplSaving, setBkTmplSaving] = useState(false);
  const [dealerBkProfile, setDealerBkProfile] = useState(null);
  const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
  const [reminderOffset, setReminderOffset] = useState("1h");
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [rescheduleAptId, setRescheduleAptId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const statusMeta = {
    pending: {
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.12)",
      border: "rgba(251,191,36,0.3)",
    },
    confirmed: {
      color: "#60a5fa",
      bg: "rgba(96,165,250,0.12)",
      border: "rgba(96,165,250,0.3)",
    },
    completed: {
      color: "#34d399",
      bg: "rgba(52,211,153,0.12)",
      border: "rgba(52,211,153,0.3)",
    },
    cancelled: {
      color: "#6b7280",
      bg: "rgba(107,114,128,0.1)",
      border: "rgba(107,114,128,0.25)",
    },
    no_show: {
      color: "#93c5fd",
      bg: "rgba(248,113,113,0.12)",
      border: "rgba(248,113,113,0.3)",
    },
  };

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "*, car_listings(brand, model, year), profiles!salesman_id(full_name)",
      )
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false });
    if (error)
      console.error("[BookingsTab] fetchBookings error:", error.message, error);
    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchBookings();
    const ch = supabase
      .channel("bookings_live_" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `dealer_id=eq.${userId}` },
        (payload) => {
          fetchBookings();
          if (payload.eventType === "INSERT") {
            toast("New booking!", { description: payload.new.buyer_name || "New appointment" });
            // Push Telegram notification if dealer has it configured
            supabase.from("profiles").select("telegram_bot_token,telegram_channel_id,dealership")
              .eq("id", userId).maybeSingle()
              .then(({ data: dp }) => {
                if (!dp?.telegram_bot_token || !dp?.telegram_channel_id) return;
                const n = payload.new;
                const d = n.appointment_date ? new Date(n.appointment_date) : null;
                const dateStr = d ? d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }) : "TBD";
                const timeStr = d ? d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "";
                const stateStr = n.buyer_state ? ` (${n.buyer_state})` : "";
                const msg = `🗓️ New Booking!\n\n*${n.buyer_name || "Customer"}*${stateStr} booked a viewing\n📅 ${dateStr}${timeStr ? ` · ${timeStr}` : ""}\n📞 ${n.buyer_phone || "—"}${n.notes ? `\n💬 "${n.notes}"` : ""}`;
                fetch(`https://api.telegram.org/bot${dp.telegram_bot_token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: dp.telegram_channel_id, text: msg, parse_mode: "Markdown" }),
                }).catch(() => {});
              });
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, dealership, booking_wa_template, telegram_bot_token, telegram_channel_id")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setDealerBkProfile(data);
          if (data.booking_wa_template) setBkTemplate(data.booking_wa_template);
        }
      });
  }, [userId]);

  const populateBkTemplate = (tmpl, booking, car) => {
    const d = booking.appointment_date
      ? new Date(booking.appointment_date)
      : null;
    return (tmpl || DEFAULT_BOOKING_TEMPLATE)
      .replace(/\{\{buyer_name\}\}/g, booking.buyer_name || "there")
      .replace(
        /\{\{car_name\}\}/g,
        car ? `${car.brand} ${car.model}` : "the vehicle",
      )
      .replace(
        /\{\{booking_type\}\}/g,
        (booking.booking_type || "appointment").replace("_", " "),
      )
      .replace(
        /\{\{booking_date\}\}/g,
        d
          ? d.toLocaleDateString("en-MY", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "—",
      )
      .replace(
        /\{\{booking_time\}\}/g,
        d
          ? d.toLocaleTimeString("en-MY", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      )
      .replace(/\{\{dealership\}\}/g, dealerBkProfile?.dealership || "");
  };

  const openReminder = (booking) => {
    setReminderTarget(booking);
    setReminderMsg(
      populateBkTemplate(bkTemplate, booking, booking.car_listings),
    );
  };

  const saveBkTemplate = async () => {
    setBkTmplSaving(true);
    await supabase
      .from("profiles")
      .update({ booking_wa_template: reminderMsg })
      .eq("id", userId);
    setBkTemplate(reminderMsg);
    setBkTmplSaving(false);
    toast.success("Default booking template saved ✓");
  };

  const handleAdd = async () => {
    setAddSaving(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        dealer_id: userId,
        salesman_id: addForm.salesman_id || null,
        car_listing_id: addForm.listing_id || null,
        appointment_date: addForm.scheduled_at,
        buyer_name: addForm.buyer_name,
        buyer_phone: addForm.buyer_phone,
        notes: addForm.notes,
        status: "pending",
      });
      if (error) throw error;
      setShowAdd(false);
      setAddForm({
        buyer_name: "",
        buyer_phone: "+60",
        listing_id: "",
        booking_type: "test_drive",
        scheduled_at: "",
        duration_minutes: 60,
        salesman_id: "",
        deposit_amount: "",
        notes: "",
      });
      fetchBookings();
    } catch (err) {
      console.error("[BookingsTab] handleAdd error:", err.message, err);
      toast.error(`Failed to save appointment: ${err.message}`);
    } finally {
      setAddSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setBookings((p) => p.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  const StatusBadge = ({ status }) => {
    const m = statusMeta[status] || statusMeta.pending;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: m.color,
          background: m.bg,
          border: `1px solid ${m.border}`,
          borderRadius: 6,
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        {status?.replace("_", " ") || "pending"}
      </span>
    );
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = new Date().toDateString();
  const todaysBookings = bookings.filter(
    (b) =>
      b.appointment_date &&
      new Date(b.appointment_date).toDateString() === todayStr,
  );
  const otherBookings = bookings.filter(
    (b) =>
      !b.appointment_date ||
      new Date(b.appointment_date).toDateString() !== todayStr,
  );

  const scheduleReminder = async (b) => {
    if (!b.appointment_date) return;
    const aptDate = new Date(b.appointment_date);
    const offsets = { "1h": -60, "2h": -120, "1d": -1440, "2d": -2880 };
    const remindAt = new Date(aptDate.getTime() + (offsets[reminderOffset] ?? -60) * 60000);
    await supabase.from("appointments").update({ remind_at: remindAt.toISOString(), remind_sent: false }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
    setReminderPickerAptId(null);
    toast.success("Telegram reminder scheduled ✓");
  };

  const clearReminder = async (b) => {
    await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, remind_at: null } : a));
  };

  const doReschedule = async (b) => {
    if (!rescheduleDate) return;
    const newDate = new Date(rescheduleDate);
    await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "confirmed", remind_at: null }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, appointment_date: newDate.toISOString(), status: "confirmed" } : a));
    setRescheduleAptId(null);
    setRescheduleDate("");
    toast.success("Rescheduled ✓");
  };

  const renderBookingRow = (b) => {
    const car = b.car_listings;
    const sm = b.profiles;
    const now = Date.now();
    const aptMs = b.appointment_date ? new Date(b.appointment_date).getTime() : null;
    const isToday = aptMs && new Date(b.appointment_date).toDateString() === todayStr;
    const isNew = now - new Date(b.created_at).getTime() < 7200000;
    const isPast = aptMs && aptMs < now && !isToday;
    const dateColor = isToday ? "#60a5fa" : isPast ? "#f87171" : "#9ca3af";
    const dateBg   = isToday ? "rgba(96,165,250,0.08)" : isPast ? "rgba(248,113,113,0.06)" : "transparent";
    const sm_meta  = statusMeta[b.status] || statusMeta.pending;
    const isReminderPicking = reminderPickerAptId === b.id;
    const isRescheduling    = rescheduleAptId === b.id;
    const isCancelConfirm   = cancelConfirmId === b.id;
    const notDone = b.status !== "cancelled" && b.status !== "completed";

    const dateDisplay = b.appointment_date
      ? new Date(b.appointment_date).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })
      : "—";

    return (
      <div key={b.id} style={{ background: "#0d1117", border: `1px solid ${isToday ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "12px 14px", boxShadow: isToday ? "0 0 0 1px rgba(96,165,250,0.1)" : "none" }}>
        {/* Header: name + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.buyer_name || "Unknown Buyer"}
          </p>
          {isNew && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", flexShrink: 0, fontWeight: 800 }}>NEW</span>}
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: sm_meta.bg, border: `1px solid ${sm_meta.border}`, color: sm_meta.color, textTransform: "capitalize" }}>
            {b.status}
          </span>
        </div>

        {/* Date — most prominent */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 7, background: dateBg, marginBottom: 6 }}>
          <Calendar size={12} color={dateColor} />
          <span style={{ fontSize: 13, fontWeight: 700, color: dateColor }}>
            {dateDisplay}
            {isToday && <span style={{ fontSize: 9, marginLeft: 6, padding: "1px 5px", borderRadius: 99, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>TODAY</span>}
          </span>
        </div>

        {/* Details row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", marginBottom: 6 }}>
          {car && <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
          {b.buyer_phone && <p style={{ margin: 0, fontSize: 11, color: "#4b5563", display:'flex', alignItems:'center', gap:4 }}><Phone size={10} /> {b.buyer_phone}</p>}
          {sm?.full_name && <p style={{ margin: 0, fontSize: 11, color: "#4b5563", display:'flex', alignItems:'center', gap:4 }}><User size={10} /> {sm.full_name}</p>}
          {b.buyer_state && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#f87171", fontWeight: 600 }}>
              <MapPin size={9} />
              {b.buyer_state}
            </span>
          )}
        </div>

        {b.notes && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4b5563", fontStyle: "italic" }}>"{b.notes}"</p>}

        {/* Telegram reminder indicator */}
        {b.remind_at && !b.remind_sent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: 8 }}>
            <Bell size={11} color="#4ade80" />
            <span style={{ fontSize: 10, color: "#4ade80", flex: 1 }}>
              Reminder: {new Date(b.remind_at).toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <button onClick={() => clearReminder(b)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 10, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
        ) : b.remind_sent ? (
          <p style={{ fontSize: 10, color: "#4b5563", margin: "0 0 8px" }}>✓ Telegram reminder sent</p>
        ) : null}

        {/* Reminder picker */}
        {isReminderPicking && (
          <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#4ade80", fontWeight: 600 }}>Schedule Telegram reminder</p>
            <select value={reminderOffset} onChange={e => setReminderOffset(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "7px 10px", marginBottom: 8, outline: "none", boxSizing: "border-box" }}>
              <option value="1h">1 hour before</option>
              <option value="2h">2 hours before</option>
              <option value="1d">1 day before (9 AM)</option>
              <option value="2d">2 days before (9 AM)</option>
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setReminderPickerAptId(null)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => scheduleReminder(b)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: "pointer", fontWeight: 600 }}>Set Reminder</button>
            </div>
          </div>
        )}

        {/* Reschedule picker */}
        {isRescheduling && (
          <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#c084fc", fontWeight: 600 }}>Choose new date & time</p>
            <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setRescheduleAptId(null); setRescheduleDate(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => doReschedule(b)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#c084fc", cursor: "pointer", fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        )}

        {/* Cancel confirm */}
        {isCancelConfirm && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "8px 10px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#fca5a5", flex: 1 }}>Cancel this appointment?</p>
            <button onClick={() => setCancelConfirmId(null)} style={{ fontSize: 10, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>No</button>
            <button onClick={() => { updateStatus(b.id, "cancelled"); setCancelConfirmId(null); }} style={{ fontSize: 10, color: "#f87171", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Yes, Cancel</button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
          {b.status === "pending" && (
            <button onClick={() => updateStatus(b.id, "confirmed")} style={{ fontSize: 10, color: "#93c5fd", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Confirm</button>
          )}
          {(b.status === "pending" || b.status === "confirmed") && (
            <button onClick={() => updateStatus(b.id, "completed")} style={{ fontSize: 10, color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Done</button>
          )}
          {notDone && (
            <button onClick={() => { setRescheduleAptId(b.id === rescheduleAptId ? null : b.id); setRescheduleDate(""); }} style={{ fontSize: 10, color: "#c084fc", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Reschedule</button>
          )}
          {notDone && !isCancelConfirm && (
            <button onClick={() => setCancelConfirmId(b.id)} style={{ fontSize: 10, color: "#9ca3af", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
          )}
          {b.buyer_phone && notDone && (
            <button onClick={() => openReminder(b)} style={{ fontSize: 10, color: "#4ade80", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>WhatsApp</button>
          )}
          {notDone && dealerBkProfile?.telegram_bot_token && (
            <button onClick={() => setReminderPickerAptId(b.id === reminderPickerAptId ? null : b.id)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: b.remind_at ? "#4ade80" : "#6b7280", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
              <Bell size={10} />{b.remind_at ? "Reminder set" : "Remind"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={T.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#f3f4f6",
              margin: 0,
            }}
          >
            Bookings & Appointments
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {["list", "week"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background:
                      view === v ? "rgba(59,130,246,0.2)" : "transparent",
                    color: view === v ? "#93c5fd" : "#9ca3af",
                    transition: "all 0.15s",
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg"
              style={T.btnRed}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Booking
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm p-6">Loading...</p>
        ) : bookings.length === 0 ? (
          <p style={{ padding: "32px", textAlign: "center", color: "#4b5563", fontSize: 13 }}>No bookings yet.</p>
        ) : view === "list" ? (
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {todaysBookings.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 6px rgba(96,165,250,0.8)", animation: "hotpulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.12em", textTransform: "uppercase" }}>Today · {todaysBookings.length}</span>
                </div>
                {todaysBookings.map(b => renderBookingRow(b))}
                {otherBookings.length > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />}
              </>
            )}
            {otherBookings.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.12em", textTransform: "uppercase" }}>Upcoming & Past · {otherBookings.length}</span>
                </div>
                {otherBookings.map(b => renderBookingRow(b))}
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap" style={{ padding: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
                gap: 8,
              }}
            >
              {weekDays.map((day) => {
                const dayStr = day.toDateString();
                const dayBookings = bookings.filter(
                  (b) =>
                    b.appointment_date &&
                    new Date(b.appointment_date).toDateString() === dayStr,
                );
                return (
                  <div
                    key={dayStr}
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 10,
                      minHeight: 100,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        margin: "0 0 4px",
                      }}
                    >
                      {day.toLocaleDateString("en-MY", { weekday: "short" })}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#f3f4f6",
                        fontWeight: 600,
                        margin: "0 0 8px",
                      }}
                    >
                      {day.getDate()}
                    </p>
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          background:
                            statusMeta[b.status]?.bg || "rgba(59,130,246,0.1)",
                          border: `1px solid ${statusMeta[b.status]?.border || "rgba(59,130,246,0.2)"}`,
                          borderRadius: 5,
                          padding: "4px 7px",
                          marginBottom: 4,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 10,
                            color: statusMeta[b.status]?.color || "#93c5fd",
                            fontWeight: 600,
                            margin: 0,
                          }}
                        >
                          {new Date(b.appointment_date).toLocaleTimeString(
                            "en-MY",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#f3f4f6",
                            margin: "1px 0 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.buyer_name || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Booking Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Add Booking</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Buyer Name
                  </label>
                  <input
                    value={addForm.buyer_name}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, buyer_name: e.target.value }))
                    }
                    placeholder="Ahmad"
                    className={iCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Buyer Phone
                  </label>
                  <div className={`flex items-center overflow-hidden ${iCls}`} style={{ padding:0 }}>
                    <span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span>
                    <input
                      type="tel"
                      value={(addForm.buyer_phone||'').replace(/^\+?60/,'')}
                      onChange={(e) => setAddForm((p) => ({ ...p, buyer_phone: '+60'+e.target.value.replace(/\D/g,'') }))}
                      placeholder="X-XXXXXXX"
                      className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Car Listing
                </label>
                <select
                  value={addForm.listing_id}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, listing_id: e.target.value }))
                  }
                  className={iCls}
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <option value="">Select listing...</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.brand} {l.model} {l.year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Booking Type
                  </label>
                  <select
                    value={addForm.booking_type}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        booking_type: e.target.value,
                      }))
                    }
                    className={iCls}
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    {["test_drive", "viewing", "handover", "follow_up"].map(
                      (t) => (
                        <option
                          key={t}
                          value={t}
                          style={{ background: "#111118" }}
                        >
                          {t.replace("_", " ")}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={addForm.duration_minutes}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        duration_minutes: e.target.value,
                      }))
                    }
                    placeholder="60"
                    className={iCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Scheduled At
                </label>
                <input
                  type="datetime-local"
                  value={addForm.scheduled_at}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, scheduled_at: e.target.value }))
                  }
                  className={iCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Salesman
                  </label>
                  <select
                    value={addForm.salesman_id}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, salesman_id: e.target.value }))
                    }
                    className={iCls}
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <option value="">Unassigned</option>
                    {salesmen.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        style={{ background: "#111118" }}
                      >
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Deposit (RM)
                  </label>
                  <input
                    type="number"
                    value={addForm.deposit_amount}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        deposit_amount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className={iCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Notes
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className={taCls}
                />
              </div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addSaving}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                {addSaving ? "Saving..." : "Book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Reminder Modal */}
      {reminderTarget && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
          onClick={() => setReminderTarget(null)}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              background: "#0f1623",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  Send Reminder
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {reminderTarget.buyer_name} · {reminderTarget.buyer_phone}
                </p>
              </div>
              <button
                onClick={() => setReminderTarget(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                rows={7}
                className={taCls}
                placeholder="WhatsApp message…"
              />
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${reminderTarget.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(reminderMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setReminderTarget(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "rgba(37,211,102,0.12)",
                    border: "1px solid rgba(37,211,102,0.3)",
                    color: "#4ade80",
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Send via WhatsApp ↗
                </a>
                <button
                  onClick={saveBkTemplate}
                  disabled={bkTmplSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-gray-500 hover:text-white transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Save className="w-3.5 h-3.5" />
                  {bkTmplSaving ? "Saving…" : "Save default"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PipelinePanel — wraps the full LeadsPage (drag-drop, search, filters) ────
function PipelinePanel() {
  return <LeadsPage />;
}

// ─── CRM tab bar styles ────────────────────────────────────────────────────────
const CRM_CSS = `
  .crm-tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 16px;
    flex-shrink: 0;
  }
  .crm-tabs::-webkit-scrollbar { display: none; }
  .crm-tab {
    flex-shrink: 0;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    color: #4b5563;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: 'DM Sans', sans-serif;
    white-space: nowrap;
    margin-bottom: -1px;
  }
  .crm-tab:hover { color: #9ca3af; }
  .crm-tab.active {
    color: #fff;
    border-bottom-color: #dc2626;
    font-weight: 600;
  }
`;

// ─── CRMPanel (exported) ──────────────────────────────────────────────────────
export default function CRMPanel({ userId, listings, salesmen, onOpenDoc }) {
  const [tab, setTab] = useState("pipeline");

  const tabs = [
    { id: "pipeline", label: "Pipeline" },
    { id: "enquiries", label: "Enquiries" },
    { id: "bookings", label: "Bookings" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{CRM_CSS}</style>

      {/* Tab bar */}
      <div className="crm-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`crm-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {tab === "pipeline" && <PipelinePanel userId={userId} />}
        {tab === "enquiries" && (
          <EnquiriesTab userId={userId} onOpenDoc={onOpenDoc} />
        )}
        {tab === "bookings" && (
          <BookingsTab
            userId={userId}
            listings={listings}
            salesmen={salesmen}
          />
        )}
      </div>
    </div>
  );
}

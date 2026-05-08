import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { X, MessageCircle, Save, FileText, PlusCircle, Trash2, Plus, UserCheck, Clock, Car as CarIcon, MapPin } from "lucide-react";
import { supabase } from "../supabaseClient";

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
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))",
    backdropFilter: "blur(8px)",
    boxShadow:
      "0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)",
    border: "1px solid rgba(255,255,255,0.12)",
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
    const { data } = await supabase
      .from("whatsapp_enquiries")
      .select(`*, listing:car_listings(brand, model, variant, selling_price)`)
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false });
    setEnquiries(data || []);
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
                          {e.source || e.ref_slug || "—"}
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
                  ["Source", selected.source || selected.ref_slug || "—"],
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `dealer_id=eq.${userId}`,
        },
        () => fetchBookings(),
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, dealership, booking_wa_template")
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

  const renderBookingRow = (b) => {
    const car = b.car_listings;
    const sm = b.profiles;
    const isToday =
      b.appointment_date &&
      new Date(b.appointment_date).toDateString() === todayStr;
    const isNew = Date.now() - new Date(b.created_at) < 7200000;
    const newBadge = isNew ? (
      <span
        style={{
          marginLeft: 6,
          fontSize: 9,
          fontWeight: 800,
          background: "rgba(59,130,246,0.15)",
          border: "1px solid rgba(59,130,246,0.3)",
          color: "#93c5fd",
          borderRadius: 4,
          padding: "1px 5px",
          letterSpacing: "0.08em",
          verticalAlign: "middle",
        }}
      >
        NEW
      </span>
    ) : null;

    const actionButtons = (
      <div className="flex flex-wrap gap-1 items-center">
        {b.status === "pending" && (
          <>
            <button
              onClick={() => updateStatus(b.id, "confirmed")}
              style={{
                fontSize: 10,
                color: "#93c5fd",
                background: "rgba(96,165,250,0.08)",
                border: "1px solid rgba(96,165,250,0.2)",
                borderRadius: 5,
                padding: "3px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => updateStatus(b.id, "cancelled")}
              style={{
                fontSize: 10,
                color: "#9ca3af",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 5,
                padding: "3px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
          </>
        )}
        {b.status === "confirmed" && (
          <>
            <button
              onClick={() => updateStatus(b.id, "completed")}
              style={{
                fontSize: 10,
                color: "#34d399",
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.2)",
                borderRadius: 5,
                padding: "3px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Done
            </button>
            <button
              onClick={() => updateStatus(b.id, "cancelled")}
              style={{
                fontSize: 10,
                color: "#9ca3af",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 5,
                padding: "3px 8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
            {b.buyer_phone && (
              <button
                key="wa"
                onClick={() => openReminder(b)}
                style={{
                  fontSize: 10,
                  color: "#4ade80",
                  background: "rgba(37,211,102,0.08)",
                  border: "1px solid rgba(37,211,102,0.2)",
                  borderRadius: 5,
                  padding: "3px 8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Remind
              </button>
            )}
          </>
        )}
        {b.status === "completed" && (
          <span style={{ fontSize: 12, color: "#34d399" }}>✓ Completed</span>
        )}
        {b.status === "cancelled" && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>Cancelled</span>
        )}
      </div>
    );

    return (
      <React.Fragment key={b.id}>
        {/* Mobile card */}
        <tr className="md:hidden">
          <td colSpan={7} style={{ padding: "4px 12px" }}>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-2">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-white text-sm">
                    {b.buyer_name || "—"}
                    {newBadge}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {b.buyer_phone || "—"}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-gray-300 text-xs mb-1">
                {car ? `${car.brand} ${car.model}` : "—"}
              </p>
              <p className="text-gray-500 text-xs mb-1">
                {b.appointment_date
                  ? new Date(b.appointment_date).toLocaleString("en-MY", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"}
                {sm?.full_name ? ` · ${sm.full_name}` : ""}
              </p>
              <div className="mt-3">{actionButtons}</div>
            </div>
          </td>
        </tr>
        {/* Desktop row */}
        <tr
          className="hidden md:table-row"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: isToday ? "rgba(59,130,246,0.03)" : "transparent",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(59,130,246,0.06)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = isToday
              ? "rgba(59,130,246,0.03)"
              : "transparent")
          }
        >
          <td
            style={{
              padding: "12px 14px",
              color: "#f3f4f6",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {b.buyer_name || "—"}
            {newBadge}
          </td>
          <td style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 13 }}>
            {b.buyer_phone || "—"}
          </td>
          <td style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 13 }}>
            {car ? `${car.brand} ${car.model}` : "—"}
          </td>
          <td
            style={{
              padding: "12px 14px",
              color: "#f3f4f6",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {b.appointment_date
              ? new Date(b.appointment_date).toLocaleString("en-MY", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—"}
          </td>
          <td style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 13 }}>
            {sm?.full_name || "—"}
          </td>
          <td style={{ padding: "12px 14px" }}>
            <StatusBadge status={b.status} />
          </td>
          <td style={{ padding: "12px 14px" }}>{actionButtons}</td>
        </tr>
      </React.Fragment>
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
        ) : view === "list" ? (
          <>
            {todaysBookings.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 20px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      boxShadow: "0 0 6px rgba(59,130,246,0.8)",
                      animation: "hotpulse 1.5s ease-in-out infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#3b82f6",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Today's Bookings
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.25)",
                      color: "#93c5fd",
                      borderRadius: 20,
                      padding: "1px 8px",
                    }}
                  >
                    {todaysBookings.length}
                  </span>
                </div>
                <div
                  style={{
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <thead className="hidden md:table-header-group">
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {[
                          "Buyer",
                          "Phone",
                          "Car",
                          "Time",
                          "Salesman",
                          "Status",
                          "Actions",
                        ].map((h) => (
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
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todaysBookings.map((b) => renderBookingRow(b))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 20px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                borderTop:
                  todaysBookings.length > 0
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "none",
                marginTop: todaysBookings.length > 0 ? 8 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                All Bookings
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#4b5563",
                  borderRadius: 20,
                  padding: "1px 8px",
                }}
              >
                {otherBookings.length}
              </span>
            </div>
            <div
              style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <thead className="hidden md:table-header-group">
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {[
                      "Buyer",
                      "Phone",
                      "Car",
                      "Scheduled",
                      "Salesman",
                      "Status",
                      "Actions",
                    ].map((h) => (
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
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otherBookings.length === 0 && todaysBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "#4b5563",
                          fontSize: 13,
                        }}
                      >
                        No bookings yet.
                      </td>
                    </tr>
                  ) : otherBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "#4b5563",
                          fontSize: 13,
                        }}
                      >
                        No other bookings.
                      </td>
                    </tr>
                  ) : (
                    otherBookings.map((b) => renderBookingRow(b))
                  )}
                </tbody>
              </table>
            </div>
          </>
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

// ─── Pipeline heatmap constants ───────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const LEAD_STAGES = [
  "new", "contacted", "viewing_booked", "test_drive",
  "negotiating", "deposit_taken", "won", "lost", "closed_won", "closed_lost",
];

const STAGE_COLOR = {
  new:           { bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  tx: "#93c5fd" },
  contacted:     { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  tx: "#fbbf24" },
  viewing_booked:{ bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", tx: "#c084fc" },
  test_drive:    { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  tx: "#34d399" },
  negotiating:   { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)",  tx: "#fb923c" },
  deposit_taken: { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   tx: "#4ade80" },
  won:           { bg: "rgba(34,197,94,0.18)",   border: "rgba(34,197,94,0.4)",   tx: "#4ade80" },
  lost:          { bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)", tx: "#9ca3af" },
};

const STAGE_WEIGHT = {
  new: 1, contacted: 2, viewing_booked: 3,
  test_drive: 4, negotiating: 5, deposit_taken: 6,
};

const LOST_REASONS = ["Price", "Timing", "Competitor", "Ghost"];

const getHeatScore = (lead) => {
  const stageWeight = STAGE_WEIGHT[lead.stage] || 0;
  const daysStale = lead.updated_at
    ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
    : 0;
  const score = stageWeight - Math.min(daysStale * 0.5, 3);
  if (score >= 4) return { score, emoji: "🔥", label: "hot",  color: "#f87171" };
  if (score >= 2) return { score, emoji: "🟡", label: "warm", color: "#fbbf24" };
  return           { score, emoji: "🧊", label: "cold", color: "#93c5fd" };
};

// ─── PipelinePanel ─────────────────────────────────────────────────────────────
function PipelinePanel({ userId }) {
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [lostOpen, setLostOpen] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({ buyer_name: "", phone: "", notes: "" });
  const [addLeadSaving, setAddLeadSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [lostPromptId, setLostPromptId] = useState(null);
  const [waModalLead, setWaModalLead] = useState(null);
  const [waModalMsg, setWaModalMessage] = useState("");
  const [collapsedStages, setCollapsedStages] = useState(new Set());
  const toggleStage = (s) => setCollapsedStages(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("leads")
      .select("*, car_listings(brand, model, year, selling_price)")
      .eq("dealer_id", userId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { setLeads(data || []); setLeadsLoading(false); });

    const ch = supabase
      .channel("crm-pipeline-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `dealer_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === "INSERT") setLeads((p) => [payload.new, ...p]);
        if (payload.eventType === "UPDATE") setLeads((p) => p.map((l) => l.id === payload.new.id ? { ...l, ...payload.new } : l));
        if (payload.eventType === "DELETE") setLeads((p) => p.filter((l) => l.id !== payload.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLeadStage = async (leadId, stage) => {
    const lead = leads.find((l) => l.id === leadId);
    await supabase.from("leads").update({ stage, updated_at: new Date().toISOString() }).eq("id", leadId);
    await supabase.from("lead_activities").insert({
      lead_id: leadId, activity_type: "stage_changed",
      from_stage: lead?.stage ?? null, to_stage: stage,
      created_by: userId, dealer_id: userId,
    });
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, stage } : l));
  };

  const handleDeleteLead = async (leadId) => {
    await supabase.from("leads").update({ is_deleted: true }).eq("id", leadId);
    setLeads((p) => p.filter((l) => l.id !== leadId));
    setDeleteConfirmId(null);
  };

  const handleLostReason = async (leadId, reason) => {
    const lead = leads.find((l) => l.id === leadId);
    const now = new Date().toISOString();
    await supabase.from("leads").update({ stage: "lost", lost_reason: reason, updated_at: now }).eq("id", leadId);
    await supabase.from("lead_activities").insert({
      lead_id: leadId, activity_type: "stage_changed",
      from_stage: lead?.stage ?? null, to_stage: "lost",
      note: `Lost reason: ${reason}`, created_by: userId, dealer_id: userId,
    });
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, stage: "lost", lost_reason: reason, updated_at: now } : l));
    setLostPromptId(null);
  };

  const handleAddLead = async () => {
    setAddLeadSaving(true);
    const { data } = await supabase
      .from("leads")
      .insert({ dealer_id: userId, buyer_name: addLeadForm.buyer_name, phone: addLeadForm.phone, notes: addLeadForm.notes, stage: "new", lead_source: "manual", is_deleted: false })
      .select().single();
    if (data) setLeads((p) => [data, ...p]);
    setAddLeadSaving(false);
    setShowAddLead(false);
    setAddLeadForm({ buyer_name: "", phone: "", notes: "" });
  };

  const activeStages = LEAD_STAGES.filter((s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won");
  const lostLeads = leads.filter((l) => l.stage === "lost" || l.stage === "closed_lost" || l.stage === "closed_won");

  const renderLeadCard = (lead) => {
    const car = lead.car_listings;
    const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
    const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
    const stageIdx = LEAD_STAGES.indexOf(lead.stage);
    const nextStage = LEAD_STAGES.filter((s) => s !== "lost" && s !== "won" && s !== "closed_won" && s !== "closed_lost")
      .find((s) => LEAD_STAGES.indexOf(s) > stageIdx);
    const heat = getHeatScore(lead);
    const isConfirmingDelete = deleteConfirmId === lead.id;
    const isPromptingLost = lostPromptId === lead.id;

    return (
      <div key={lead.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", lineHeight: 1.3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.buyer_name || "—"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span title={`${heat.label} · score ${heat.score.toFixed(1)}`} style={{ fontSize: 10, fontWeight: 600, color: heat.color, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 99, padding: "1px 6px", lineHeight: 1.4, whiteSpace: "nowrap" }}>
              {heat.emoji} {heat.score.toFixed(1)}
            </span>
            <button onClick={() => { setLostPromptId(null); setDeleteConfirmId(lead.id); }} title="Delete lead" style={{ background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "#374151" }}>Added {timeAgo(lead.created_at)}</p>
        {carName && <p style={{ margin: "0 0 1px", fontSize: 11, color: "#6b7280" }}>{carName}</p>}
        {carPrice && <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#60a5fa" }}>{carPrice}</p>}
        {lead.phone && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>📞 {lead.phone}</p>}
        {lead.notes && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4b5563", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{lead.notes}"</p>}

        {isConfirmingDelete ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
            <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>Delete?</span>
            <button onClick={() => handleDeleteLead(lead.id)} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>Yes</button>
            <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>No</button>
          </div>
        ) : isPromptingLost ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", padding: "4px 0" }}>
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginRight: 2 }}>Why lost?</span>
            {LOST_REASONS.map((r) => (
              <button key={r} onClick={() => handleLostReason(lead.id, r)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#cbd5e1", cursor: "pointer" }}>{r}</button>
            ))}
            <button onClick={() => setLostPromptId(null)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "transparent", border: "none", color: "#4b5563", cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {nextStage && lead.stage !== "won" && (
              <button onClick={() => updateLeadStage(lead.id, nextStage)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                → {nextStage.replace(/_/g, " ")}
              </button>
            )}
            {lead.stage !== "won" && lead.stage !== "deposit_taken" && (
              <button onClick={() => updateLeadStage(lead.id, "won")} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", cursor: "pointer" }}>→ Won</button>
            )}
            {lead.stage !== "won" && (
              <button onClick={() => { setDeleteConfirmId(null); setLostPromptId(lead.id); }} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.18)", color: "#9ca3af", cursor: "pointer" }}>→ Lost</button>
            )}
            {lead.phone && (
              <button onClick={() => { const car = lead.car_listings; const msg = `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${car ? `${car.brand} ${car.model}` : "kereta tu"} tu? Jom kita discuss lagi 😊`; setWaModalMessage(msg); setWaModalLead(lead); }} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}>WA</button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (leadsLoading) return <p style={{ color: "#6b7280", fontSize: 13, padding: 16 }}>Loading pipeline...</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
          Lead Pipeline ({leads.filter((l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won").length})
        </p>
        <button onClick={() => setShowAddLead(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1d4ed8", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}>
          <Plus size={13} /> Add Lead
        </button>
      </div>

      {/* ── Stage summary strip ── */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", marginBottom: 12 }}>
        {activeStages.map((stage) => {
          const sc = STAGE_COLOR[stage] || {};
          const count = leads.filter((l) => l.stage === stage).length;
          return (
            <button
              key={stage}
              onClick={() => toggleStage(stage)}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "8px 10px", minWidth: 64,
                background: collapsedStages.has(stage) ? "rgba(255,255,255,0.02)" : (sc.bg || "rgba(255,255,255,0.04)"),
                border: `1px solid ${collapsedStages.has(stage) ? "rgba(255,255,255,0.06)" : (sc.border || "rgba(255,255,255,0.1)")}`,
                borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 800, color: collapsedStages.has(stage) ? "#374151" : (sc.tx || "#e5e7eb"), lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: collapsedStages.has(stage) ? "#374151" : (sc.tx || "#6b7280"), textTransform: "capitalize", textAlign: "center", lineHeight: 1.3 }}>
                {stage.replace(/_/g, " ")}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Accordion stages ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activeStages.map((stage) => {
          const sc = STAGE_COLOR[stage] || {};
          const stageLeads = leads.filter((l) => l.stage === stage).sort((a, b) => getHeatScore(b).score - getHeatScore(a).score);
          const isCollapsed = collapsedStages.has(stage);
          return (
            <div key={stage} style={{ borderRadius: 10, border: `1px solid ${stageLeads.length > 0 ? (sc.border || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, overflow: "hidden" }}>
              {/* Stage header — always visible, click to collapse */}
              <button
                onClick={() => toggleStage(stage)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: stageLeads.length > 0 ? (sc.bg || "rgba(255,255,255,0.04)") : "rgba(255,255,255,0.02)",
                  border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.tx || "#6b7280", flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: stageLeads.length > 0 ? (sc.tx || "#e5e7eb") : "#4b5563", textTransform: "capitalize" }}>
                    {stage.replace(/_/g, " ")}
                  </span>
                  {stageLeads.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, borderRadius: 99, padding: "1px 7px" }}>
                      {stageLeads.length}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "#374151", lineHeight: 1 }}>{isCollapsed ? "▶" : "▼"}</span>
              </button>

              {/* Stage body */}
              {!isCollapsed && (
                <div style={{ padding: stageLeads.length > 0 ? "0 10px 10px" : "6px 10px 8px", background: "rgba(0,0,0,0.2)" }}>
                  {stageLeads.length === 0 ? (
                    <p style={{ fontSize: 11, color: "#374151", margin: 0, textAlign: "center", padding: "6px 0" }}>No leads here</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", paddingTop: 10 }}>
                      {stageLeads.map((lead) => renderLeadCard(lead))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lostLeads.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setLostOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>Lost ({lostLeads.length})</span>
            <span style={{ fontSize: 12, color: "#374151" }}>{lostOpen ? "▲" : "▼"}</span>
          </button>
          {lostOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {lostLeads.map((lead) => (
                <div key={lead.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", opacity: 0.65 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#9ca3af", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lead.buyer_name || "—"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {lead.lost_reason && (
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                          {lead.lost_reason}
                        </span>
                      )}
                      <button onClick={() => setDeleteConfirmId(lead.id)} title="Delete lead" style={{ background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#374151" }}>{timeAgo(lead.created_at)}</p>
                  {deleteConfirmId === lead.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>Delete?</span>
                      <button onClick={() => handleDeleteLead(lead.id)} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>No</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div onClick={() => setShowAddLead(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Add Lead</p>
                <button onClick={() => setShowAddLead(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={20} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[{ key: "buyer_name", label: "Name", placeholder: "Buyer name" }, { key: "phone", label: "Phone", placeholder: "e.g. 0123456789" }, { key: "notes", label: "Notes", placeholder: "Any notes..." }].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>{label}</label>
                    {key === "phone" ? (
                      <div style={{ display:"flex", alignItems:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, overflow:"hidden" }}>
                        <span style={{ padding:"9px 12px", color:"#6b7280", background:"rgba(255,255,255,0.03)", borderRight:"1px solid rgba(255,255,255,0.08)", fontSize:13, whiteSpace:"nowrap", flexShrink:0 }}>+60</span>
                        <input type="tel" value={(addLeadForm.phone||'').replace(/^\+?60/,'')} onChange={(e) => setAddLeadForm((p) => ({ ...p, phone: '+60'+e.target.value.replace(/\D/g,'') }))} placeholder="123456789" style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#e5e7eb", fontSize:13, padding:"9px 12px", fontFamily:"'DM Sans',sans-serif" }} />
                      </div>
                    ) : (
                      <input value={addLeadForm[key]} onChange={(e) => setAddLeadForm((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "9px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }} />
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleAddLead} disabled={!addLeadForm.buyer_name || addLeadSaving} style={{ marginTop: 20, width: "100%", padding: "10px", borderRadius: 8, background: "#2563eb", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !addLeadForm.buyer_name || addLeadSaving ? 0.6 : 1 }}>
                {addLeadSaving ? "Saving..." : "Add Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WA Modal */}
      {waModalLead && (
        <div onClick={() => setWaModalLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, width: "90%", maxWidth: 440, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>Send WA Message</p>
              <button onClick={() => setWaModalLead(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}><X size={18} /></button>
            </div>
            <textarea value={waModalMsg} onChange={(e) => setWaModalMessage(e.target.value)} rows={5} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.5 }} />
            <button
              onClick={async () => {
                const phone = (waModalLead.phone || "").replace(/\D/g, "");
                if (phone) window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`, "_blank", "noopener,noreferrer");
                const now = new Date().toISOString();
                await supabase.from("leads").update({ updated_at: now }).eq("id", waModalLead.id);
                setLeads((p) => p.map((l) => l.id === waModalLead.id ? { ...l, updated_at: now } : l));
                setWaModalLead(null);
              }}
              disabled={!waModalMsg.trim() || !waModalLead.phone}
              style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 8, background: "#16a34a", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: !waModalMsg.trim() || !waModalLead.phone ? "not-allowed" : "pointer", opacity: !waModalMsg.trim() || !waModalLead.phone ? 0.6 : 1 }}
            >Send</button>
            {!waModalLead.phone && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#f87171", textAlign: "center" }}>No phone number on this lead.</p>}
          </div>
        </div>
      )}
    </div>
  );
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

// ─── WalkInTab ────────────────────────────────────────────────────────────────
const WALKIN_EMPTY = { name: '', phone: '', car_interest: '', notes: '' };

function WalkInTab({ userId, listings }) {
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(WALKIN_EMPTY);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('leads')
      .select('id, buyer_name, phone, notes, created_at, stage')
      .eq('dealer_id', userId)
      .eq('lead_source', 'walk_in')
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs(data || []);
  }, [userId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function handleLog() {
    if (!form.name.trim()) return;
    setSaving(true);
    const notes = [form.car_interest && `Interested in: ${form.car_interest}`, form.notes].filter(Boolean).join('\n');
    await supabase.from('leads').insert({
      dealer_id: userId,
      buyer_name: form.name.trim(),
      phone: form.phone.trim() || null,
      notes: notes || null,
      stage: 'new',
      lead_source: 'walk_in',
      is_deleted: false,
    });
    toast.success('Walk-in logged!');
    setForm(WALKIN_EMPTY);
    setShowForm(false);
    setSaving(false);
    fetchLogs();
  }

  const iStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f9fafb', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' };
  const lStyle = { fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' };

  return (
    <div style={{ padding: 16, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>Walk-In Log</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4b5563' }}>Log foot traffic even if they don't convert</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          <Plus size={14} /> Log Walk-In
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lStyle}>Customer Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Full name" style={iStyle} />
            </div>
            <div>
              <label style={lStyle}>Phone</label>
              <input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="+601X-XXXXXXX" style={iStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Car Interested In</label>
            <input value={form.car_interest} onChange={e => setF('car_interest', e.target.value)} placeholder="e.g. Honda Civic 2022" style={iStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Budget, timeline, any other details…" rows={2} style={{ ...iStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#9ca3af', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
            <button onClick={handleLog} disabled={saving || !form.name.trim()} style={{ padding: '7px 16px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>{saving ? 'Saving…' : 'Log'}</button>
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#374151' }}>
          <MapPin size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p style={{ fontSize: 13, margin: 0 }}>No walk-ins logged yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCheck size={15} style={{ color: '#f87171' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>{log.buyer_name}</p>
                    {log.phone && <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0' }}>{log.phone}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4b5563', flexShrink: 0 }}>
                  <Clock size={11} />
                  {new Date(log.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {log.notes && <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0', paddingLeft: 40, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{log.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CRMPanel (exported) ──────────────────────────────────────────────────────
export default function CRMPanel({ userId, listings, salesmen, onOpenDoc }) {
  const [tab, setTab] = useState("pipeline");

  const tabs = [
    { id: "pipeline", label: "Pipeline" },
    { id: "enquiries", label: "Enquiries" },
    { id: "bookings", label: "Bookings" },
    { id: "walk_in", label: "Walk-Ins" },
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
        {tab === "walk_in" && (
          <WalkInTab userId={userId} listings={listings} />
        )}
      </div>
    </div>
  );
}

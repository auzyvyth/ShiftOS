// Linked-Premium "Incoming" tab: buyers who reached the dealership and no salesman owns yet.
// First to claim wins (claim_lead, a database function, so two reps cannot both get it).
// Moved out of the old dealer SalesmanPanel (renderIncoming / claimLead). Reading the chat
// is allowed before claiming, but answering is not: two reps must not answer one buyer.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, MessageSquare } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { liveChannel } from "../../lib/liveChannel";
import { premiumDark as PD } from "../../theme/tokens";

const SOURCE = { whatsapp: "WhatsApp", enquiry: "Enquiry", chat: "Chat", manual: "Added by dealer", find_me: "Find me", drevo_enquiry: "Enquiry" };

function ago(ts) {
  if (!ts) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(ts)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function IncomingLeads({ dealerId, onClaimed, onOpenChat, onCount }) {
  const [rows, setRows] = useState(null);
  const [threads, setThreads] = useState({});
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("leads")
      .select("id, buyer_name, phone, buyer_state, buyer_message, notes, lead_source, created_at, car_listing_id, car_listings(brand, model, year, selling_price)")
      .eq("dealer_id", dealerId).is("salesman_id", null).eq("is_deleted", false)
      .order("created_at", { ascending: false });
    if (e) { setError(true); setRows((r) => r || []); return; }
    setError(false);
    const list = data || [];
    setRows(list);
    onCount?.(list.length);
    if (!list.length) { setThreads({}); return; }
    const { data: th } = await supabase.from("chat_threads").select("id, lead_id, seller_unread, last_message_at")
      .in("lead_id", list.map((r) => r.id)).order("last_message_at", { ascending: false, nullsFirst: false });
    const map = {};
    (th || []).forEach((t) => { if (!map[t.lead_id]) map[t.lead_id] = t; });
    setThreads(map);
  }, [dealerId, onCount]);

  useEffect(() => {
    if (!dealerId) return undefined;
    load();
    // A lead a teammate claims disappears here at once.
    const ch = liveChannel(supabase, `incoming_leads_${dealerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `dealer_id=eq.${dealerId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealerId, load]);

  const claim = async (lead) => {
    if (claimingId) return;
    setClaimingId(lead.id);
    const { data, error: e } = await supabase.rpc("claim_lead", { p_lead_id: lead.id });
    setClaimingId(null);
    if (e) { toast.error("Could not claim the lead. Check your connection and try again."); return; }
    setRows((p) => (p || []).filter((l) => l.id !== lead.id));
    if (data !== true) { toast.error("Too late. Another salesman already claimed this lead."); return; }
    toast.success("Lead claimed. It's in your pipeline.");
    onClaimed?.(lead);
  };

  const card = { background: PD.card, borderRadius: PD.radius.card, padding: 16 };

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: PD.text }}>Incoming leads</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: PD.textMuted }}>Buyers nobody owns yet. Read the chat, then claim. First to claim gets the lead.</p>
      {rows === null ? (
        <div style={{ ...card, color: PD.textMuted, fontSize: 13 }}>Loading...</div>
      ) : error && rows.length === 0 ? (
        <div style={{ ...card, color: PD.accentText, fontSize: 13 }}>Could not load incoming leads. Try again in a moment.</div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: PD.textMuted, fontSize: 14, padding: "40px 16px" }}>
          <Inbox size={28} style={{ margin: "0 auto 10px", display: "block" }} />
          No unclaimed leads right now. New buyers show up here instantly.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((l) => {
            const car = l.car_listings ? [l.car_listings.year, l.car_listings.brand, l.car_listings.model].filter(Boolean).join(" ") : null;
            const th = threads[l.id];
            const quote = l.lead_source === "chat" ? "" : (l.buyer_message || l.notes || "");
            return (
              <div key={l.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: PD.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.buyer_name || "Unknown buyer"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: PD.textMuted }}>{SOURCE[l.lead_source] || "Lead"} · {ago(l.created_at)}{l.buyer_state ? ` · ${l.buyer_state}` : ""}</p>
                  </div>
                  {th?.seller_unread > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: PD.accentText, background: PD.raised, borderRadius: PD.radius.pill, padding: "3px 9px" }}>{th.seller_unread} unread</span>}
                </div>
                {car && (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: PD.textSec }}>
                    {car}{l.car_listings?.selling_price ? ` · RM ${Number(l.car_listings.selling_price).toLocaleString("en-MY")}` : ""}
                  </p>
                )}
                {quote && <p style={{ margin: "10px 0 0", padding: "8px 10px", borderRadius: PD.radius.row, background: PD.raised, fontSize: 13, lineHeight: 1.5, color: PD.textSec, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{quote}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {th && (
                    <button type="button" onClick={() => onOpenChat?.({ threadId: th.id, buyerName: l.buyer_name || "Buyer", carLabel: car, previewLead: l })}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: PD.raised, color: PD.text, border: "none", borderRadius: PD.radius.row, padding: "11px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <MessageSquare size={14} /> Read chat
                    </button>
                  )}
                  <button type="button" onClick={() => claim(l)} disabled={claimingId === l.id}
                    style={{ flex: 1, background: PD.accent, color: PD.onAccent, border: "none", borderRadius: PD.radius.row, padding: "11px 12px", fontSize: 13.5, fontWeight: 700, cursor: claimingId === l.id ? "default" : "pointer", opacity: claimingId === l.id ? 0.6 : 1, fontFamily: "inherit" }}>
                    {claimingId === l.id ? "Claiming..." : "Claim lead"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

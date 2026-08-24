import React, { useMemo, useState } from "react";
import { Check, MessageCircle, ChevronDown } from "lucide-react";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import { buildThisWeek, waLink } from "../../utils/thisWeek";

// "This week" — the single call list, top of the salesman's home screen.
//
// The point is that a salesman opens the app and is told who to contact,
// instead of having to remember to go look on four different tabs. Everything
// here already existed; this is the one place it is finally shown together.
//
// A row is a HUMAN, not a reason — someone whose insurance lapsed AND who is
// trade-up ready is one call, one row. The extra reasons ride along under it.
//
// Nothing auto-sends. "Message" opens WhatsApp with the draft in it and the
// salesman presses send himself, same rule as the nudge queue.

const PREVIEW = 6;

export default function ThisWeek({ leads = [], customers = [], nudges = [], repName = "", onContacted }) {
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState(() => new Set());

  const items = useMemo(
    () => buildThisWeek({ leads, customers, nudges, repName }),
    [leads, customers, nudges, repName],
  );
  const open = items.filter((i) => !done.has(i.id));
  const shown = showAll ? open : open.slice(0, PREVIEW);

  const markDone = (item) => {
    setDone((prev) => new Set(prev).add(item.id));
    onContacted?.(item);
  };

  const sendAndMark = (item) => {
    const url = waLink(item.phone, item.message);
    if (!url) return;
    // Opened straight from the click, before any await — a popup blocker eats
    // window.open otherwise.
    window.open(url, "_blank", "noopener");
    markDone(item);
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: T.weight.bold, color: C.text }}>This week</p>
        {open.length > 0 && (
          <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>
            <span style={{ color: C.dangerText, fontWeight: T.weight.bold }}>{open.length}</span> to contact
          </p>
        )}
      </div>

      {open.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.6 }}>
          Nothing waiting — you are on top of everyone. New enquiries show up here the moment
          they come in, and past buyers reappear when their road tax or insurance is close.
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: T.size.sm, color: C.textMuted }}>
            Most urgent first. Tap Message to open WhatsApp with the text ready.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((item) => {
              const urgent = item.kind === "never_replied";
              const canSend = !!waLink(item.phone, item.message);
              return (
                <div key={item.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 11px", borderRadius: R.md, background: C.fill, border: `1px solid ${urgent ? withAlpha(C.danger, 0.22) : C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: urgent ? C.dangerText : C.textSec }}>
                      {item.why}
                    </p>
                    {(item.sub || item.also?.length > 0) && (
                      <p style={{ margin: "2px 0 0", fontSize: T.size.xs, color: C.textMuted }}>
                        {[item.sub, ...(item.also || [])].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {canSend && (
                      <button onClick={() => sendAndMark(item)} title="Open WhatsApp with the message ready"
                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "6px 10px", borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", fontFamily: "inherit" }}>
                        <MessageCircle size={12} /> Message
                      </button>
                    )}
                    <button onClick={() => markDone(item)} title="Already handled — hide this"
                      aria-label={`Mark ${item.name} as handled`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {open.length > PREVIEW && (
            <button onClick={() => setShowAll((v) => !v)}
              style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textSec, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <ChevronDown size={13} style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              {showAll ? "Show fewer" : `Show all ${open.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

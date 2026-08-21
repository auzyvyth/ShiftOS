import { useState } from "react";
import { createPortal } from "react-dom";
import { Bug, X } from "lucide-react";

const SUPPORT_WHATSAPP = "601111521742";

// variant: "floating" = fixed circle (legacy, used in salesman lite),
//          "inline"   = small header icon button (sits next to the nav, no overlap)
export default function ReportBugButton({ context = "", userLabel = "", variant = "floating" }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    const lines = [
      "Bug report — ShiftOS",
      context ? `From: ${context}` : null,
      userLabel ? `User: ${userLabel}` : null,
      "",
      text.trim(),
    ].filter(Boolean);
    const url = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
    setText("");
  };

  return (
    <>
      {variant === "inline" ? (
        <button
          onClick={() => setOpen(true)}
          title="Report a bug"
          aria-label="Report a bug"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6b7280",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bug className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          title="Report a bug"
          className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{
            bottom: 24,
            left: 24,
            width: 48,
            height: 48,
            background: "#dc2626",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <Bug className="w-5 h-5" />
        </button>
      )}

      {open && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "#f3f4f6" }}>
                Report a bug
              </h3>
              <button onClick={() => setOpen(false)} style={{ color: "#6b7280" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: "#9ca3af" }}>
              Describe what went wrong — this opens WhatsApp with your message pre-filled so we can look into it fast.
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. The Add Listing form doesn't save photos on step 3..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f3f4f6",
                resize: "vertical",
              }}
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              className="w-full mt-3 rounded-lg py-2 text-sm font-semibold transition-opacity"
              style={{
                background: "#dc2626",
                color: "#fff",
                opacity: text.trim() ? 1 : 0.5,
                cursor: text.trim() ? "pointer" : "not-allowed",
              }}
            >
              Send via WhatsApp
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, MessageCircle, Facebook, Store, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { buildAllCaptions } from "../utils/sharePack";

// Phase-1 Share Pack: paste-ready listing copy per channel. No photos yet
// (Phase 2), no AI. Light theme to match the dealer dashboard.
const PLATFORMS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, hasTitle: false },
  { key: "facebook", label: "Facebook", icon: Facebook, hasTitle: true },
  { key: "mudah", label: "Mudah", icon: Store, hasTitle: true },
  { key: "carlist", label: "Carlist", icon: Newspaper, hasTitle: true },
];

export default function SharePackSheet({ listing, dealer = {}, onClose }) {
  const [tab, setTab] = useState("whatsapp");
  const [copied, setCopied] = useState(null); // 'title' | 'body'

  // lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const captions = buildAllCaptions(listing, dealer);
  const active = captions[tab];
  const cfg = PLATFORMS.find((p) => p.key === tab);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success(`${which === "title" ? "Title" : "Caption"} copied`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, maxHeight: "88vh", display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.25)", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #f0f0f0" }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Share Pack</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>Copy and paste to each platform</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 4 }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* platform tabs */}
        <div style={{ display: "flex", gap: 6, padding: "12px 18px 0", overflowX: "auto" }}>
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const on = tab === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setTab(p.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, whiteSpace: "nowrap", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", border: on ? "1px solid #dc2626" : "1px solid #e5e7eb", background: on ? "rgba(220,38,38,0.06)" : "#fff", color: on ? "#dc2626" : "#6b7280" }}
              >
                <Icon size={14} /> {p.label}
              </button>
            );
          })}
        </div>

        {/* body */}
        <div style={{ padding: "16px 18px", overflowY: "auto" }}>
          {cfg?.hasTitle && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af" }}>Title field</span>
                <button onClick={() => copy(active.title, "title")} style={copyBtnStyle}>
                  {copied === "title" ? <Check size={13} /> : <Copy size={13} />} {copied === "title" ? "Copied" : "Copy"}
                </button>
              </div>
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 9, padding: "10px 12px", fontSize: 13, color: "#111827", fontWeight: 600 }}>
                {active.title}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af" }}>
              {cfg?.hasTitle ? "Description" : "Message"}
            </span>
            <button onClick={() => copy(active.text, "body")} style={{ ...copyBtnStyle, background: "#dc2626", color: "#fff", border: "1px solid #dc2626" }}>
              {copied === "body" ? <Check size={13} /> : <Copy size={13} />} {copied === "body" ? "Copied" : "Copy caption"}
            </button>
          </div>
          <textarea
            readOnly
            value={active.text}
            onFocus={(e) => e.target.select()}
            rows={14}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 9, padding: "12px", fontSize: 13, lineHeight: 1.6, color: "#111827", fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}
          />
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9ca3af" }}>
            Photos and auto-watermark coming next. For now, attach the listing photos manually after pasting.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const copyBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#374151",
};

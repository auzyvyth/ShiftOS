import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { TERMS, PRIVACY, DPA, LEGAL_META } from "../legal/legalDocs";

// Light, readable popup for the legal documents, shown from public buyer forms so a
// privacy/terms link never navigates the buyer away from what they were doing.
// Off-white background, red accents. Reads the same content as /privacy and /terms
// from the shared src/legal/legalDocs.js source.
//
// Props: doc = 'privacy' | 'terms' | 'dpa' | null (null = closed); onClose().

const DOCS = {
  privacy: { title: "Privacy Policy", data: PRIVACY, withDate: true },
  terms:   { title: "Terms of Service", data: TERMS, withDate: true },
  dpa:     { title: "Data Processing Agreement", data: DPA, withDate: false },
};

export default function LegalModal({ doc, onClose }) {
  useEffect(() => {
    if (!doc) return;
    // Restore the PREVIOUS value (not "") so that when this opens over another
    // scroll-locked overlay (e.g. ContactGate), closing it keeps that lock intact.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [doc, onClose]);

  if (!doc) return null;
  const cfg = DOCS[doc];
  if (!cfg) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2147483000,
        background: "rgba(15,17,21,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 620, maxHeight: "86vh", display: "flex", flexDirection: "column",
          background: "#faf8f5", borderRadius: 16, overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)", border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "18px 20px", borderBottom: "1px solid #ece7e1", background: "#fff",
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#dc2626" }}>Legal</p>
            <p style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e0d9",
              background: "#f3efe9", color: "#6b7280", fontSize: 18, lineHeight: "30px", cursor: "pointer", fontFamily: "inherit",
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px 22px 26px" }}>
          {cfg.withDate && (
            <p style={{ margin: "0 0 14px", fontSize: 11, color: "#9ca3af" }}>
              Effective Date: {LEGAL_META.effectiveDate} · {LEGAL_META.brand}
            </p>
          )}
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#4b5563", lineHeight: 1.7 }}>{cfg.data.intro}</p>

          {cfg.data.sections.map((sec) => (
            <div key={sec.h} style={{ marginBottom: 18 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#dc2626" }}>{sec.h}</p>
              {sec.p.map((para, i) => (
                <p key={i} style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{para}</p>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #ece7e1", background: "#fff", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >Got it</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

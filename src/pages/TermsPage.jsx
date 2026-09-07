import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { TERMS, LEGAL_META } from "../legal/legalDocs";

const S = {
  page: { minHeight: "100vh", background: "#080C14", fontFamily: "system-ui, sans-serif", color: "#e8edf5" },
  header: { borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080C14", zIndex: 10 },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  dot: { width: 28, height: 28, background: "#dc2626", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#fff" },
  name: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 4, color: "#fff" },
  back: { fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none", letterSpacing: "0.05em" },
  wrap: { maxWidth: 740, margin: "0 auto", padding: "48px 24px 80px" },
  badge: { display: "inline-block", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#dc2626", fontWeight: 600, marginBottom: 12 },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: 2, color: "#fff", marginBottom: 8 },
  meta: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.07)" },
  section: { marginBottom: 40 },
  h: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, color: "#dc2626", marginBottom: 10, paddingTop: 8 },
  p: { fontSize: 13.5, color: "rgba(232,237,245,0.72)", lineHeight: 1.8, marginBottom: 12 },
  divider: { height: 1, background: "rgba(255,255,255,0.06)", margin: "32px 0" },
  footer: { marginTop: 48, padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 24, flexWrap: "wrap" },
  flink: { fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" },
};

export default function TermsPage() {
  useEffect(() => {
    document.title = "Terms of Service · ShiftOS";
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <div style={S.page}>
        <header style={S.header}>
          <Link to="/" style={S.brand}>
            <div style={S.dot}>S</div>
            <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 22, width: 'auto', display: 'block' }} />
          </Link>
          <Link to="/" style={S.back}>← Back to home</Link>
        </header>

        <div style={S.wrap}>
          <span style={S.badge}>Legal</span>
          <h1 style={S.title}>Terms of Service</h1>
          <p style={S.meta}>
            Effective Date: {LEGAL_META.effectiveDate} &nbsp;·&nbsp; {LEGAL_META.brand} &nbsp;·&nbsp;
            See also: <Link to="/privacy" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Privacy Policy</Link>
          </p>

          <div style={S.section}>
            <p style={S.p}>{TERMS.intro}</p>
          </div>

          {TERMS.sections.map((sec) => (
            <div style={S.section} key={sec.h}>
              <p style={S.h}>{sec.h}</p>
              {sec.p.map((para, i) => <p style={S.p} key={i}>{para}</p>)}
            </div>
          ))}

          <div style={S.divider} />

          <div style={S.footer}>
            <Link to="/privacy" style={S.flink}>Privacy Policy & DPA →</Link>
            <Link to="/" style={S.flink}>xdrive.my</Link>
            <span style={S.flink}>© 2026 ShiftOS. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  );
}

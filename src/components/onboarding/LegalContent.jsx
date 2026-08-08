import React from "react";
import { TERMS, PRIVACY, DPA, LEGAL_META } from "../../legal/legalDocs";

function LegalSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 18, letterSpacing: 3, color: "#E8EDF5", borderBottom: "1px solid rgba(220,38,38,0.3)", paddingBottom: 6, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function LP({ children }) {
  return <p style={{ fontSize: 12, color: "rgba(232,237,245,0.55)", lineHeight: 1.75, marginBottom: 10 }}>{children}</p>;
}

function LH({ children }) {
  return <p style={{ fontSize: 11, fontFamily: "'Azeret Mono',monospace", color: "rgba(220,38,38,0.8)", letterSpacing: 1, marginTop: 14, marginBottom: 6 }}>{children}</p>;
}

export default function LegalContent() {
  return (
    <div style={{ padding: "0 2px" }}>
      <LegalSection title="TERMS OF SERVICE — ShiftOS / xdrive.my">
        <LP>Effective Date: {LEGAL_META.effectiveDate}. {TERMS.intro}</LP>
        {TERMS.sections.map((sec) => (
          <React.Fragment key={sec.h}>
            <LH>{sec.h}</LH>
            {sec.p.map((para, i) => <LP key={i}>{para}</LP>)}
          </React.Fragment>
        ))}
      </LegalSection>

      <LegalSection title="PRIVACY POLICY — ShiftOS / xdrive.my">
        <LP>Effective Date: {LEGAL_META.effectiveDate}. {PRIVACY.intro}</LP>
        {PRIVACY.sections.map((sec) => (
          <React.Fragment key={sec.h}>
            <LH>{sec.h}</LH>
            {sec.p.map((para, i) => <LP key={i}>{para}</LP>)}
          </React.Fragment>
        ))}
      </LegalSection>

      <LegalSection title="DATA PROCESSING AGREEMENT — ShiftOS / xdrive.my">
        <LP>{DPA.intro}</LP>
        {DPA.sections.map((sec) => (
          <React.Fragment key={sec.h}>
            <LH>{sec.h}</LH>
            {sec.p.map((para, i) => <LP key={i}>{para}</LP>)}
          </React.Fragment>
        ))}
        <LP style={{ marginTop: 20, padding: "12px 14px", background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 2 }}>
          By scrolling to the bottom and clicking "I Agree — Continue", you confirm that you have read, understood, and agree to the Terms of Service, Privacy Policy, and Data Processing Agreement above. Your consent is recorded with a timestamp in compliance with the Personal Data Protection Act 2010 (Malaysia).
        </LP>
      </LegalSection>
    </div>
  );
}

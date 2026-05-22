import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const S = {
  page: { minHeight: "100vh", background: "#080C14", fontFamily: "'DM Sans', sans-serif", color: "#e8edf5" },
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <div style={S.page}>
        <header style={S.header}>
          <Link to="/" style={S.brand}>
            <div style={S.dot}>S</div>
            <span style={S.name}>SHIFTOS</span>
          </Link>
          <Link to="/" style={S.back}>← Back to home</Link>
        </header>

        <div style={S.wrap}>
          <span style={S.badge}>Legal</span>
          <h1 style={S.title}>Terms of Service</h1>
          <p style={S.meta}>
            Effective Date: 20 May 2026 &nbsp;·&nbsp; ShiftOS / xdrive.my &nbsp;·&nbsp;
            See also: <Link to="/privacy" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Privacy Policy</Link>
          </p>

          <div style={S.section}>
            <p style={S.p}>These Terms govern your access to and use of the ShiftOS platform, including the XDrive dealer dashboard and the xdrive.my marketplace. By creating an account or using the Platform, you agree to be bound by these Terms.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>1. DEFINITIONS</p>
            <p style={S.p}>"ShiftOS" / "we" / "us" refers to the Platform operated by ShiftOS (operated by Airy, sole proprietor). "Dealer" refers to a subscribed business user. "Salesman" refers to a sub-user account linked to a Dealer. "User" refers to any person accessing the Platform. "Content" refers to vehicle listings, images, descriptions, and other data uploaded. "Customer Data" refers to buyer information, leads, enquiries and other data uploaded by Dealers.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>2. ACCOUNT REGISTRATION</p>
            <p style={S.p}>To access the dealer dashboard you must register and provide accurate, complete information. You agree to: provide truthful registration information including your name, IC number, and business details; maintain the security of your login credentials and not share them with unauthorised persons; notify us immediately of any unauthorised access; ensure your use complies with all applicable Malaysian laws and regulations. We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>3. SUBSCRIPTION PLANS AND PAYMENT</p>
            <p style={S.p}>Standard Plan: RM 1,000/month. Premium Plan: RM 2,500/month. Salesman Lite: Free (limited features, subject to fair use). All prices are in MYR and exclusive of applicable taxes. New dealer accounts receive a 14-day free trial with full platform access. No payment information is required during the trial. Subscriptions are billed monthly in advance. You may cancel at any time by contacting legal@xdrive.my. Cancellation takes effect at the end of the current billing period. No refunds for partial months. Data remains accessible for 30 days after cancellation before deletion.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>4. ACCEPTABLE USE</p>
            <p style={S.p}>You agree not to: upload fraudulent, stolen, or non-existent vehicle listings; misrepresent vehicle condition, mileage, ownership history, or specifications; collect or process customer data without appropriate consent; violate any applicable Malaysian law including the Road Transport Act 1987, Consumer Protection Act 1999, or PDPA 2010; attempt to circumvent, reverse engineer, or compromise the Platform's security; use the Platform to harass, defraud, or deceive any person; upload defamatory, obscene, or intellectual-property-infringing content. Violation may result in immediate account suspension without refund.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>5. YOUR CONTENT AND DATA</p>
            <p style={S.p}>You retain ownership of all Content and Customer Data you upload. By uploading Content, you grant ShiftOS a non-exclusive, royalty-free licence to store, display, and process that Content solely for providing the Platform services. You are the data controller for your customers' personal data and are responsible for: obtaining valid consent from customers before uploading their personal data; ensuring compliance with PDPA 2010; responding to customer data access and correction requests. ShiftOS acts as a data processor on your behalf. Vehicle listings marked "available" will be publicly visible on xdrive.my.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>6. PLATFORM AVAILABILITY</p>
            <p style={S.p}>We aim to maintain 99% uptime, excluding scheduled maintenance. We will provide advance notice of planned maintenance where possible. We are not liable for downtime caused by third-party infrastructure providers, force majeure events, or circumstances beyond our reasonable control.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>7. INTELLECTUAL PROPERTY</p>
            <p style={S.p}>ShiftOS, XDrive, xdrive.my and associated branding are the intellectual property of the Platform operator. You may not use our trademarks, logos or branding without prior written consent. The Platform software, design, and underlying technology remain our exclusive property.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>8. LIMITATION OF LIABILITY</p>
            <p style={S.p}>ShiftOS is a software tool. We are not a party to any vehicle sale transaction between a dealer and a buyer. We are not liable for any loss arising from vehicle transactions facilitated by the Platform. Our total aggregate liability for any claim shall not exceed the total subscription fees paid by you in the three months preceding the claim. We exclude liability for indirect, consequential, special or punitive damages of any kind.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>9. INDEMNIFICATION</p>
            <p style={S.p}>You agree to indemnify and hold harmless ShiftOS and its operators from any claims, damages, losses or expenses (including legal fees) arising from: (a) your use of the Platform in violation of these Terms; (b) your vehicle listings or customer data; (c) your violation of any applicable law; or (d) any dispute between you and a buyer or third party.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>10. TERMINATION</p>
            <p style={S.p}>We may suspend or terminate your account immediately if you: breach any provision of these Terms; fail to pay subscription fees within 14 days of the due date; engage in fraudulent, illegal, or abusive conduct. Upon termination, access ceases and data is retained for 30 days during which you may request an export, after which it will be permanently deleted.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>11. GOVERNING LAW</p>
            <p style={S.p}>These Terms are governed by the laws of Malaysia. Any dispute shall be subject to the exclusive jurisdiction of the courts of Malaysia.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>12. CHANGES TO THESE TERMS</p>
            <p style={S.p}>We may update these Terms from time to time with at least 14 days notice of material changes via in-app notification or email. Continued use after the effective date constitutes acceptance.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>13. CONTACT</p>
            <p style={S.p}>For questions regarding these Terms: Email: legal@xdrive.my · Website: https://xdrive.my</p>
          </div>

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

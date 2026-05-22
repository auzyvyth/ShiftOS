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
  docTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "#fff", margin: "48px 0 20px", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" },
  h: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 3, color: "#dc2626", marginBottom: 10, paddingTop: 8 },
  p: { fontSize: 13.5, color: "rgba(232,237,245,0.72)", lineHeight: 1.8, marginBottom: 12 },
  notice: { background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "rgba(232,237,245,0.6)", lineHeight: 1.7, marginTop: 40 },
  divider: { height: 1, background: "rgba(255,255,255,0.06)", margin: "32px 0" },
  footer: { marginTop: 48, padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 24, flexWrap: "wrap" },
  flink: { fontSize: 12, color: "rgba(255,255,255,0.35)", textDecoration: "none" },
};

export default function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy Policy · ShiftOS";
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
          <h1 style={S.title}>Privacy Policy</h1>
          <p style={S.meta}>
            Effective Date: 20 May 2026 &nbsp;·&nbsp; ShiftOS / xdrive.my &nbsp;·&nbsp; PDPA 2010 compliant &nbsp;·&nbsp;
            See also: <Link to="/terms" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Terms of Service</Link>
          </p>

          {/* ── PRIVACY POLICY ── */}
          <div style={S.section}>
            <p style={S.p}>This Privacy Policy describes how ShiftOS collects, uses, stores, and protects personal data in connection with the ShiftOS platform and xdrive.my marketplace. Prepared in compliance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>1. WHO WE ARE</p>
            <p style={S.p}>ShiftOS (operated by Airy, sole proprietor) operates ShiftOS, a SaaS platform for independent used car dealerships in Malaysia, accessible at https://xdrive.my. For data protection enquiries: legal@xdrive.my.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>2. DATA WE COLLECT</p>
            <p style={S.p}>Dealer and Salesman accounts: full name, email address, phone number, IC (MyKad) number (for account verification), dealership name, SSM registration number, business address, profile photo, subdomain, and platform usage data.</p>
            <p style={S.p}>Customer Data uploaded by Dealers: buyer names, phone numbers, state of residence, lead and enquiry information, appointment and booking details, loan application data including IC numbers and employment details. ShiftOS processes this data on behalf of dealers. Dealers are the data controllers for their customers' data and are responsible for obtaining appropriate consent.</p>
            <p style={S.p}>Automatically collected data: analytics events (page views, WhatsApp clicks, car views — no cookies, session-based only), browser type, device information, IP address (not stored persistently), and error logs for debugging.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>3. HOW WE USE YOUR DATA</p>
            <p style={S.p}>To provide, maintain and improve the platform; to authenticate users and manage account access; to process and display vehicle listings on xdrive.my; to send in-app notifications and Telegram alerts; to generate reports, analytics and performance insights; to comply with legal obligations; to communicate service updates, billing information, and security notices. We do not use your data for advertising purposes. ShiftOS is ad-free.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>4. LEGAL BASIS FOR PROCESSING (PDPA 2010)</p>
            <p style={S.p}>Contractual necessity — to deliver subscribed services. Legitimate interests — to improve the platform and prevent fraud. Consent — for optional features such as Telegram notifications. Legal obligation — where required by Malaysian law.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>5. DATA SHARING</p>
            <p style={S.p}>We do not sell, rent or trade your personal data. We may share data with: Supabase Inc. (database and authentication infrastructure); Vercel Inc. (hosting and edge network); Telegram (if you opt in to notifications, your chat ID is used to deliver alerts); Malaysian regulatory authorities if required by law or court order. All third-party providers maintain appropriate security and confidentiality obligations.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>6. DATA RETENTION</p>
            <p style={S.p}>Account data: retained for the duration of your subscription plus 12 months after termination. Customer lead and enquiry data: retained as long as your dealer account is active. Analytics data: retained for 24 months on a rolling basis. Error logs: retained for 90 days. You may request deletion at any time by contacting legal@xdrive.my. Deletion requests will be actioned within 30 days, subject to legal retention obligations.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>7. DATA SECURITY</p>
            <p style={S.p}>We implement: Row Level Security (RLS) on all database tables; encrypted data transmission via HTTPS/TLS; access controls limiting data access to authorised roles only; regular security audits and policy reviews. No method of transmission or storage is 100% secure. You are responsible for maintaining the confidentiality of your login credentials.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>8. YOUR RIGHTS UNDER PDPA 2010</p>
            <p style={S.p}>As a data subject under the Personal Data Protection Act 2010, you have the right to: access the personal data we hold about you; correct inaccurate or incomplete personal data; withdraw consent for processing where consent is the legal basis; request deletion of your personal data (subject to legal obligations); object to processing for purposes beyond what you were informed of. To exercise these rights, contact legal@xdrive.my. We will respond within 21 days.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>9. COOKIES AND LOCAL STORAGE</p>
            <p style={S.p}>ShiftOS does not use third-party tracking cookies. We use browser localStorage to maintain your authenticated session while logged in. This data is cleared when you log out. We do not use advertising or analytics cookies.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>10. CHILDREN'S DATA</p>
            <p style={S.p}>ShiftOS is a business-to-business platform intended for use by persons aged 18 and above. We do not knowingly collect personal data from individuals under 18 years of age.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>11. CHANGES TO THIS POLICY</p>
            <p style={S.p}>We will notify registered dealers of material changes via in-app notification or email at least 14 days before changes take effect. Continued use of the platform after the effective date constitutes acceptance.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>12. CONTACT</p>
            <p style={S.p}>For questions, concerns or data access requests: Email: legal@xdrive.my · Website: https://xdrive.my</p>
          </div>

          {/* ── DATA PROCESSING AGREEMENT ── */}
          <h2 style={S.docTitle}>Data Processing Agreement</h2>

          <div style={S.section}>
            <p style={S.p}>Effective Date: 20 May 2026. This DPA forms part of the Terms of Service between ShiftOS ("Processor") and the registered Dealer ("Controller") and governs the processing of personal data by ShiftOS on behalf of the Dealer. Prepared in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>1. DEFINITIONS</p>
            <p style={S.p}>"Controller" means the Dealer who determines the purposes and means of processing Customer Data. "Processor" means ShiftOS, which processes Customer Data on behalf of the Controller. "Customer Data" means any personal data relating to the Controller's customers uploaded to the Platform. "Personal Data" has the meaning given under the PDPA 2010. "Processing" includes collecting, storing, organising, retrieving, disclosing, and deleting data. "Sub-processor" means any third party engaged by ShiftOS to assist in processing Customer Data.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>2. ROLES AND RESPONSIBILITIES</p>
            <p style={S.p}>Controller (Dealer) confirms that: it has a lawful basis for collecting and uploading Customer Data; it has provided customers with appropriate privacy notices; it has obtained necessary consents where required under PDPA 2010; it will only upload Customer Data that is accurate and relevant to its legitimate business activities; it will promptly action any customer data access, correction or deletion requests.</p>
            <p style={S.p}>ShiftOS (Processor) agrees to: process Customer Data only on documented instructions from the Controller; ensure that all staff with access to Customer Data are bound by confidentiality obligations; implement appropriate technical and organisational security measures; not engage sub-processors without informing the Controller and ensuring equivalent protections apply; assist the Controller in responding to data subject requests; notify the Controller without undue delay upon becoming aware of a personal data breach affecting Customer Data; delete or return all Customer Data upon termination of the subscription, at the Controller's request.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>3. SUB-PROCESSORS</p>
            <p style={S.p}>ShiftOS currently engages the following sub-processors: Supabase Inc. (USA) — database hosting, authentication, and file storage; Vercel Inc. (USA) — web hosting and edge delivery; Telegram Messenger Inc. — notification delivery (only where Dealer has enabled Telegram integration). ShiftOS will notify Dealers of any intended changes to sub-processors at least 14 days in advance, giving the Dealer the opportunity to object.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>4. DATA SECURITY</p>
            <p style={S.p}>ShiftOS implements and maintains: Row Level Security (RLS) ensuring each Dealer can only access their own Customer Data; encrypted transmission of all data via HTTPS/TLS; role-based access controls limiting data access within the Platform; regular security reviews and vulnerability assessments; secure deletion of data upon account termination.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>5. DATA BREACH NOTIFICATION</p>
            <p style={S.p}>In the event of a personal data breach affecting Customer Data, ShiftOS will: notify the affected Dealer within 72 hours of becoming aware of the breach; provide details of the nature of the breach, the data affected, and likely consequences; describe the measures taken or proposed to address the breach. The Dealer is responsible for determining whether notification to affected customers or the Personal Data Protection Commissioner is required under PDPA 2010.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>6. DATA SUBJECT RIGHTS</p>
            <p style={S.p}>Where a Dealer's customer exercises rights under PDPA 2010 (access, correction, deletion), ShiftOS will provide reasonable assistance to the Dealer in fulfilling those requests, including providing tools to export or delete specific customer records from the Platform.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>7. AUDITS</p>
            <p style={S.p}>The Dealer may request information from ShiftOS to verify compliance with this DPA not more than once per calendar year, with reasonable advance notice. ShiftOS will respond within 30 days.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>8. TERM AND TERMINATION</p>
            <p style={S.p}>This DPA remains in effect for the duration of the Dealer's subscription. Upon termination: ShiftOS will retain Customer Data for 30 days to allow the Dealer to export it; after 30 days, Customer Data will be permanently deleted from all active systems; backups containing Customer Data will be purged within 90 days of termination.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>9. GOVERNING LAW</p>
            <p style={S.p}>This DPA is governed by the laws of Malaysia. Any disputes shall be subject to the jurisdiction of the Malaysian courts.</p>
          </div>

          <div style={S.section}>
            <p style={S.h}>10. CONTACT FOR DATA PROTECTION MATTERS</p>
            <p style={S.p}>For any data protection queries or to exercise rights under this DPA, contact ShiftOS at legal@xdrive.my.</p>
          </div>

          <div style={S.notice}>
            By registering and clicking "I Agree — Continue" during onboarding, you confirm that you have read, understood, and agree to the Terms of Service, Privacy Policy, and Data Processing Agreement. Your consent is recorded with a timestamp in compliance with the Personal Data Protection Act 2010 (Malaysia).
          </div>

          <div style={S.divider} />

          <div style={S.footer}>
            <Link to="/terms" style={S.flink}>Terms of Service →</Link>
            <Link to="/" style={S.flink}>xdrive.my</Link>
            <span style={S.flink}>© 2026 ShiftOS. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  );
}

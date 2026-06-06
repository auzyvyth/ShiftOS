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
        <LP>Effective Date: 20 May 2026. These Terms govern your access to and use of the ShiftOS platform, including the XDrive dealer dashboard and the xdrive.my marketplace. By creating an account or using the Platform, you agree to be bound by these Terms.</LP>
        <LH>1. DEFINITIONS</LH>
        <LP>"ShiftOS" / "we" / "us" refers to the Platform operated by ShiftOS (operated by Airy, sole proprietor). "Dealer" refers to a subscribed business user. "Salesman" refers to a sub-user account linked to a Dealer. "User" refers to any person accessing the Platform. "Content" refers to vehicle listings, images, descriptions, and other data uploaded. "Customer Data" refers to buyer information, leads, enquiries and other data uploaded by Dealers.</LP>
        <LH>2. ACCOUNT REGISTRATION</LH>
        <LP>To access the dealer dashboard you must register and provide accurate, complete information. You agree to: provide truthful registration information including your name, IC number, and business details; maintain the security of your login credentials and not share them with unauthorised persons; notify us immediately of any unauthorised access; ensure your use complies with all applicable Malaysian laws and regulations. We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.</LP>
        <LH>3. SUBSCRIPTION PLANS AND PAYMENT</LH>
        <LP>Standard Plan: RM 1,000/month. Premium Plan: RM 2,500/month. Salesman Lite: Free (limited features, subject to fair use). All prices are in MYR and exclusive of applicable taxes. New dealer accounts receive a 14-day free trial with full platform access. No payment information is required during the trial. Subscriptions are billed monthly in advance. You may cancel at any time by contacting legal@xdrive.my. Cancellation takes effect at the end of the current billing period. No refunds for partial months. Data remains accessible for 30 days after cancellation before deletion.</LP>
        <LH>4. ACCEPTABLE USE</LH>
        <LP>You agree not to: upload fraudulent, stolen, or non-existent vehicle listings; misrepresent vehicle condition, mileage, ownership history, or specifications; collect or process customer data without appropriate consent; violate any applicable Malaysian law including the Road Transport Act 1987, Consumer Protection Act 1999, or PDPA 2010; attempt to circumvent, reverse engineer, or compromise the Platform's security; use the Platform to harass, defraud, or deceive any person; upload defamatory, obscene, or intellectual-property-infringing content. Violation may result in immediate account suspension without refund.</LP>
        <LH>5. YOUR CONTENT AND DATA</LH>
        <LP>You retain ownership of all Content and Customer Data you upload. By uploading Content, you grant ShiftOS a non-exclusive, royalty-free licence to store, display, and process that Content solely for providing the Platform services. You are the data controller for your customers' personal data and are responsible for: obtaining valid consent from customers before uploading their personal data; ensuring compliance with PDPA 2010; responding to customer data access and correction requests. ShiftOS acts as a data processor on your behalf. Vehicle listings marked "available" will be publicly visible on xdrive.my.</LP>
        <LH>6. PLATFORM AVAILABILITY</LH>
        <LP>We aim to maintain 99% uptime, excluding scheduled maintenance. We will provide advance notice of planned maintenance where possible. We are not liable for downtime caused by third-party infrastructure providers, force majeure events, or circumstances beyond our reasonable control.</LP>
        <LH>7. INTELLECTUAL PROPERTY</LH>
        <LP>ShiftOS, XDrive, xdrive.my and associated branding are the intellectual property of the Platform operator. You may not use our trademarks, logos or branding without prior written consent. The Platform software, design, and underlying technology remain our exclusive property.</LP>
        <LH>8. LIMITATION OF LIABILITY</LH>
        <LP>ShiftOS is a software tool. We are not a party to any vehicle sale transaction between a dealer and a buyer. We are not liable for any loss arising from vehicle transactions facilitated by the Platform. Our total aggregate liability for any claim shall not exceed the total subscription fees paid by you in the three months preceding the claim. We exclude liability for indirect, consequential, special or punitive damages of any kind.</LP>
        <LH>9. INDEMNIFICATION</LH>
        <LP>You agree to indemnify and hold harmless ShiftOS and its operators from any claims, damages, losses or expenses (including legal fees) arising from: (a) your use of the Platform in violation of these Terms; (b) your vehicle listings or customer data; (c) your violation of any applicable law; or (d) any dispute between you and a buyer or third party.</LP>
        <LH>10. TERMINATION</LH>
        <LP>We may suspend or terminate your account immediately if you: breach any provision of these Terms; fail to pay subscription fees within 14 days of the due date; engage in fraudulent, illegal, or abusive conduct. Upon termination, access ceases and data is retained for 30 days during which you may request an export, after which it will be permanently deleted.</LP>
        <LH>11. GOVERNING LAW</LH>
        <LP>These Terms are governed by the laws of Malaysia. Any dispute shall be subject to the exclusive jurisdiction of the courts of Malaysia.</LP>
        <LH>12. CHANGES TO THESE TERMS</LH>
        <LP>We may update these Terms from time to time with at least 14 days notice of material changes via in-app notification or email. Continued use after the effective date constitutes acceptance.</LP>
        <LH>13. CONTACT</LH>
        <LP>For questions regarding these Terms: Email: legal@xdrive.my</LP>
      </LegalSection>

      <LegalSection title="PRIVACY POLICY — ShiftOS / xdrive.my">
        <LP>Effective Date: 20 May 2026. This Privacy Policy describes how ShiftOS collects, uses, stores, and protects personal data in connection with the ShiftOS platform and xdrive.my marketplace. Prepared in compliance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</LP>
        <LH>1. WHO WE ARE</LH>
        <LP>ShiftOS (operated by Airy, sole proprietor) operates ShiftOS, a SaaS platform for independent used car dealerships in Malaysia. For data protection enquiries: legal@xdrive.my.</LP>
        <LH>2. DATA WE COLLECT</LH>
        <LP>Dealer and Salesman accounts: full name, email address, phone number, IC (MyKad) number (for account verification), dealership name, SSM registration number, business address, profile photo, subdomain, and platform usage data.</LP>
        <LP>Customer Data uploaded by Dealers: buyer names, phone numbers, state of residence, lead and enquiry information, appointment and booking details, loan application data. ShiftOS processes this data on behalf of dealers. Dealers are the data controllers for their customers' data and are responsible for obtaining appropriate consent.</LP>
        <LP>Automatically collected data: analytics events (page views, WhatsApp clicks, car views — no cookies, session-based only), browser type, device information, IP address (not stored persistently), and error logs for debugging.</LP>
        <LH>3. HOW WE USE YOUR DATA</LH>
        <LP>To provide, maintain and improve the platform; to authenticate users and manage account access; to process and display vehicle listings on xdrive.my; to send in-app notifications and Telegram alerts; to generate reports, analytics and performance insights; to comply with legal obligations; to communicate service updates, billing information, and security notices. We do not use your data for advertising purposes. ShiftOS is ad-free.</LP>
        <LH>4. LEGAL BASIS FOR PROCESSING (PDPA 2010)</LH>
        <LP>Contractual necessity — to deliver subscribed services. Legitimate interests — to improve the platform and prevent fraud. Consent — for optional features such as Telegram notifications. Legal obligation — where required by Malaysian law.</LP>
        <LH>5. DATA SHARING</LH>
        <LP>We do not sell, rent or trade your personal data. We may share data with: Supabase Inc. (database and authentication infrastructure); Vercel Inc. (hosting and edge network); Telegram (if you opt in to notifications); Malaysian regulatory authorities if required by law or court order.</LP>
        <LH>6. DATA RETENTION</LH>
        <LP>Account data: retained for the duration of your subscription plus 12 months after termination. Analytics data: retained for 24 months on a rolling basis. Error logs: retained for 90 days. You may request deletion at any time by contacting legal@xdrive.my. Deletion requests will be actioned within 30 days, subject to legal retention obligations.</LP>
        <LH>7. DATA SECURITY</LH>
        <LP>We implement: Row Level Security (RLS) on all database tables; encrypted data transmission via HTTPS/TLS; access controls limiting data access to authorised roles only; regular security audits and policy reviews.</LP>
        <LH>8. YOUR RIGHTS UNDER PDPA 2010</LH>
        <LP>As a data subject you have the right to: access the personal data we hold about you; correct inaccurate or incomplete personal data; withdraw consent for processing where consent is the legal basis; request deletion of your personal data (subject to legal obligations); object to processing for purposes beyond what you were informed of. To exercise these rights, contact legal@xdrive.my. We will respond within 21 days.</LP>
        <LH>9. COOKIES AND LOCAL STORAGE</LH>
        <LP>ShiftOS does not use third-party tracking cookies. We use browser localStorage to maintain your authenticated session while logged in. This data is cleared when you log out. We do not use advertising or analytics cookies.</LP>
        <LH>10. CHILDREN'S DATA</LH>
        <LP>ShiftOS is a business-to-business platform intended for use by persons aged 18 and above. We do not knowingly collect personal data from individuals under 18 years of age.</LP>
        <LH>11. CHANGES TO THIS POLICY</LH>
        <LP>We will notify registered dealers of material changes via in-app notification or email at least 14 days before changes take effect.</LP>
        <LH>12. CONTACT</LH>
        <LP>For questions, concerns or data access requests: Email: legal@xdrive.my</LP>
      </LegalSection>

      <LegalSection title="DATA PROCESSING AGREEMENT — ShiftOS / xdrive.my">
        <LP>Effective Date: 20 May 2026. This DPA forms part of the Terms of Service between ShiftOS ("Processor") and the registered Dealer ("Controller") and governs the processing of personal data by ShiftOS on behalf of the Dealer. Prepared in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.</LP>
        <LH>1. DEFINITIONS</LH>
        <LP>"Controller" means the Dealer who determines the purposes and means of processing Customer Data. "Processor" means ShiftOS, which processes Customer Data on behalf of the Controller. "Customer Data" means any personal data relating to the Controller's customers uploaded to the Platform.</LP>
        <LH>2. ROLES AND RESPONSIBILITIES</LH>
        <LP>Controller (Dealer) confirms that: it has a lawful basis for collecting and uploading Customer Data; it has provided customers with appropriate privacy notices; it has obtained necessary consents where required under PDPA 2010; it will only upload Customer Data that is accurate and relevant to its legitimate business activities.</LP>
        <LP>ShiftOS (Processor) agrees to: process Customer Data only on documented instructions from the Controller; ensure that all staff with access to Customer Data are bound by confidentiality obligations; implement appropriate technical and organisational security measures; assist the Controller in responding to data subject requests; notify the Controller without undue delay upon becoming aware of a personal data breach.</LP>
        <LH>3. SUB-PROCESSORS</LH>
        <LP>ShiftOS currently engages the following sub-processors: Supabase Inc. (USA) — database hosting, authentication, and file storage; Vercel Inc. (USA) — web hosting and edge delivery; Telegram Messenger Inc. — notification delivery (only where Dealer has enabled Telegram integration).</LP>
        <LH>4. DATA SECURITY</LH>
        <LP>ShiftOS implements and maintains: Row Level Security (RLS) ensuring each Dealer can only access their own Customer Data; encrypted transmission of all data via HTTPS/TLS; role-based access controls limiting data access within the Platform; regular security reviews and vulnerability assessments.</LP>
        <LH>5. DATA BREACH NOTIFICATION</LH>
        <LP>In the event of a personal data breach, ShiftOS will: notify the affected Dealer within 72 hours; provide details of the nature of the breach, the data affected, and likely consequences; describe the measures taken or proposed to address the breach.</LP>
        <LH>6. TERM AND TERMINATION</LH>
        <LP>This DPA remains in effect for the duration of the Dealer's subscription. Upon termination, ShiftOS will retain Customer Data for 30 days to allow export; after 30 days, Customer Data will be permanently deleted.</LP>
        <LH>7. GOVERNING LAW</LH>
        <LP>This DPA is governed by the laws of Malaysia. Any disputes shall be subject to the jurisdiction of the Malaysian courts.</LP>
        <LP style={{ marginTop: 20, padding: "12px 14px", background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 2 }}>
          By scrolling to the bottom and clicking "I Agree — Continue", you confirm that you have read, understood, and agree to the Terms of Service, Privacy Policy, and Data Processing Agreement above. Your consent is recorded with a timestamp in compliance with the Personal Data Protection Act 2010 (Malaysia).
        </LP>
      </LegalSection>
    </div>
  );
}

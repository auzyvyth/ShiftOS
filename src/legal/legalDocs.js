// Single source of truth for ShiftOS / XDrive legal copy.
// Rendered by src/pages/TermsPage.jsx, src/pages/PrivacyPage.jsx (Privacy + DPA),
// and src/components/onboarding/LegalContent.jsx — so a policy edit happens ONCE here
// and never drifts between the public pages and the onboarding consent wall.
//
// NOTE: this is draft legal copy maintained by the product team. It is NOT legal
// advice and must be reviewed by a qualified professional before any material change
// is relied upon. Company identity kept as the sole-proprietor form by decision.

export const LEGAL_META = {
  operator: "ShiftOS (operated by Airy, sole proprietor)",
  brand: "ShiftOS / xdrive.my",
  website: "https://xdrive.my",
  email: "legal@xdrive.my",
  effectiveDate: "20 May 2026",
};

// Each section: { h: heading, p: [paragraph, ...] }
export const TERMS = {
  intro:
    "These Terms govern your access to and use of the ShiftOS platform, including the XDrive dealer dashboard and the xdrive.my marketplace. By creating an account or using the Platform, you agree to be bound by these Terms.",
  sections: [
    { h: "1. DEFINITIONS", p: [
      '"ShiftOS" / "we" / "us" refers to the Platform operated by ShiftOS (operated by Airy, sole proprietor). "Dealer" refers to a subscribed business user. "Salesman" refers to a sub-user account linked to a Dealer. "User" refers to any person accessing the Platform. "Content" refers to vehicle listings, images, descriptions, and other data uploaded. "Customer Data" refers to buyer information, leads, enquiries and other data uploaded by Dealers.',
    ] },
    { h: "2. ACCOUNT REGISTRATION", p: [
      "To access the dealer dashboard you must register and provide accurate, complete information. You agree to: provide truthful registration information including your name, IC number, and business details; maintain the security of your login credentials and not share them with unauthorised persons; notify us immediately of any unauthorised access; ensure your use complies with all applicable Malaysian laws and regulations. We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.",
    ] },
    { h: "3. SUBSCRIPTION PLANS AND PAYMENT", p: [
      "Salesman Lite: Free (limited features, subject to fair use). Salesman Premium: RM 35/month. Dealer Starter: RM 299/month. Dealer Growth: RM 599/month. Dealer Pro: RM 1,199/month. Dealer Group: RM 2,999/month. All prices are in MYR and exclusive of applicable taxes. New dealer accounts receive a 14-day free trial with full platform access. No payment information is required during the trial. Subscriptions are billed monthly in advance. You may cancel at any time by contacting legal@xdrive.my. Cancellation takes effect at the end of the current billing period. No refunds for partial months. Data remains accessible for 30 days after cancellation before deletion.",
    ] },
    { h: "4. ACCEPTABLE USE", p: [
      "You agree not to: upload fraudulent, stolen, or non-existent vehicle listings; misrepresent vehicle condition, mileage, ownership history, or specifications; collect or process customer data without appropriate consent; violate any applicable Malaysian law including the Road Transport Act 1987, Consumer Protection Act 1999, or PDPA 2010; attempt to circumvent, reverse engineer, or compromise the Platform's security; use the Platform to harass, defraud, or deceive any person; upload defamatory, obscene, or intellectual-property-infringing content. Violation may result in immediate account suspension without refund.",
    ] },
    { h: "5. YOUR CONTENT AND DATA", p: [
      'You retain ownership of all Content and Customer Data you upload. By uploading Content, you grant ShiftOS a non-exclusive, royalty-free licence to store, display, and process that Content solely for providing the Platform services. You are the data controller for your customers\' personal data and are responsible for: obtaining valid consent from customers before uploading their personal data; ensuring compliance with PDPA 2010; responding to customer data access and correction requests. ShiftOS acts as a data processor on your behalf. Vehicle listings marked "available" will be publicly visible on xdrive.my.',
    ] },
    { h: "6. PLATFORM AVAILABILITY", p: [
      "We aim to maintain 99% uptime, excluding scheduled maintenance. We will provide advance notice of planned maintenance where possible. We are not liable for downtime caused by third-party infrastructure providers, force majeure events, or circumstances beyond our reasonable control.",
    ] },
    { h: "7. INTELLECTUAL PROPERTY", p: [
      "ShiftOS, XDrive, xdrive.my and associated branding are the intellectual property of the Platform operator. You may not use our trademarks, logos or branding without prior written consent. The Platform software, design, and underlying technology remain our exclusive property.",
    ] },
    { h: "8. LIMITATION OF LIABILITY", p: [
      "ShiftOS is a software tool. We are not a party to any vehicle sale transaction between a dealer and a buyer. We are not liable for any loss arising from vehicle transactions facilitated by the Platform. Our total aggregate liability for any claim shall not exceed the total subscription fees paid by you in the three months preceding the claim. We exclude liability for indirect, consequential, special or punitive damages of any kind.",
    ] },
    { h: "9. INDEMNIFICATION", p: [
      "You agree to indemnify and hold harmless ShiftOS and its operators from any claims, damages, losses or expenses (including legal fees) arising from: (a) your use of the Platform in violation of these Terms; (b) your vehicle listings or customer data; (c) your violation of any applicable law; or (d) any dispute between you and a buyer or third party.",
    ] },
    { h: "10. TERMINATION", p: [
      "We may suspend or terminate your account immediately if you: breach any provision of these Terms; fail to pay subscription fees within 14 days of the due date; engage in fraudulent, illegal, or abusive conduct. Upon termination, access ceases and data is retained for 30 days during which you may request an export, after which it will be permanently deleted.",
    ] },
    { h: "11. GOVERNING LAW", p: [
      "These Terms are governed by the laws of Malaysia. Any dispute shall be subject to the exclusive jurisdiction of the courts of Malaysia.",
    ] },
    { h: "12. CHANGES TO THESE TERMS", p: [
      "We may update these Terms from time to time with at least 14 days notice of material changes via in-app notification or email. Continued use after the effective date constitutes acceptance.",
    ] },
    { h: "13. CONTACT", p: [
      "For questions regarding these Terms: Email: legal@xdrive.my · Website: https://xdrive.my",
    ] },
  ],
};

export const PRIVACY = {
  intro:
    "This Privacy Policy describes how ShiftOS collects, uses, stores, and protects personal data in connection with the ShiftOS platform and xdrive.my marketplace. Prepared in compliance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.",
  sections: [
    { h: "1. WHO WE ARE", p: [
      "ShiftOS (operated by Airy, sole proprietor) operates ShiftOS, a SaaS platform for independent used car dealerships in Malaysia, accessible at https://xdrive.my. Our data protection contact point for any privacy enquiry or to exercise your rights is legal@xdrive.my.",
    ] },
    { h: "2. DATA WE COLLECT", p: [
      "Dealer and Salesman accounts: full name, email address, phone number, IC (MyKad) number (for account verification), dealership name, SSM registration number, business address, profile photo, subdomain, and platform usage data.",
      "Buyer / customer data: when you make an enquiry, book a test drive, or contact a dealer through xdrive.my, we collect your name, phone number, and state of residence to pass your enquiry to the relevant dealer and to create a record of your request. Where a dealer uploads further customer data (lead, appointment, or loan application details including IC numbers), ShiftOS processes it on behalf of that dealer, who is the data controller responsible for obtaining appropriate consent.",
      "Automatically collected data: analytics events (page views, WhatsApp clicks, car views — no cookies, session-based only), browser type, device information, IP address (not stored persistently), and error logs for debugging.",
    ] },
    { h: "3. HOW WE USE YOUR DATA", p: [
      "To provide, maintain and improve the platform; to authenticate users and manage account access; to route buyer enquiries and bookings to the relevant dealer; to process and display vehicle listings on xdrive.my; to send in-app notifications and Telegram alerts; to generate reports, analytics and performance insights; to comply with legal obligations; to communicate service updates, billing information, and security notices. We do not use your data for advertising purposes. ShiftOS is ad-free.",
    ] },
    { h: "4. LEGAL BASIS FOR PROCESSING (PDPA 2010)", p: [
      "Contractual necessity — to deliver subscribed services. Legitimate interests — to improve the platform and prevent fraud. Consent — for enquiries and bookings you submit, and for optional features such as Telegram notifications. Legal obligation — where required by Malaysian law.",
    ] },
    { h: "5. DATA SHARING", p: [
      "We do not sell, rent or trade your personal data. We may share data with: the dealer you enquire with (for buyer enquiries and bookings); Supabase Inc. (database and authentication infrastructure); Vercel Inc. (hosting and edge network); Telegram (if you opt in to notifications, your chat ID is used to deliver alerts); Malaysian regulatory authorities if required by law or court order. All third-party providers maintain appropriate security and confidentiality obligations.",
    ] },
    { h: "6. DATA RETENTION", p: [
      "Account data: retained for the duration of your subscription plus 12 months after termination. Customer lead and enquiry data: retained as long as the relevant dealer account is active. Analytics data: retained for 24 months on a rolling basis. Error logs: retained for 90 days. You may request deletion at any time by contacting legal@xdrive.my. Deletion requests will be actioned within 30 days, subject to legal retention obligations.",
    ] },
    { h: "7. DATA SECURITY", p: [
      "We implement: Row Level Security (RLS) on all database tables; encrypted data transmission via HTTPS/TLS; access controls limiting data access to authorised roles only; an append-only audit log of sensitive actions; regular security audits and policy reviews. No method of transmission or storage is 100% secure. You are responsible for maintaining the confidentiality of your login credentials.",
    ] },
    { h: "8. DATA BREACH", p: [
      "If a personal data breach occurs that is likely to cause significant harm, we will notify affected individuals and the Personal Data Protection Commissioner without undue delay, in line with the Personal Data Protection Act 2010 (as amended). Where the affected data was uploaded by a dealer, we will notify that dealer so they can meet their own obligations as the data controller.",
    ] },
    { h: "9. YOUR RIGHTS UNDER PDPA 2010", p: [
      "As a data subject under the Personal Data Protection Act 2010, you have the right to: access the personal data we hold about you; correct inaccurate or incomplete personal data; withdraw consent for processing where consent is the legal basis; request deletion of your personal data (subject to legal obligations); object to processing for purposes beyond what you were informed of. To exercise these rights, contact legal@xdrive.my. We will respond within 21 days.",
    ] },
    { h: "10. COOKIES AND LOCAL STORAGE", p: [
      "ShiftOS does not use third-party tracking cookies. We use browser localStorage to maintain your authenticated session while logged in. This data is cleared when you log out. We do not use advertising or analytics cookies.",
    ] },
    { h: "11. CHILDREN'S DATA", p: [
      "ShiftOS is a business-to-business platform intended for use by persons aged 18 and above. We do not knowingly collect personal data from individuals under 18 years of age.",
    ] },
    { h: "12. CHANGES TO THIS POLICY", p: [
      "We will notify registered dealers of material changes via in-app notification or email at least 14 days before changes take effect. Continued use of the platform after the effective date constitutes acceptance.",
    ] },
    { h: "13. CONTACT", p: [
      "For questions, concerns or data access requests: Email: legal@xdrive.my · Website: https://xdrive.my",
    ] },
  ],
};

export const DPA = {
  intro:
    'Effective Date: 20 May 2026. This DPA forms part of the Terms of Service between ShiftOS ("Processor") and the registered Dealer ("Controller") and governs the processing of personal data by ShiftOS on behalf of the Dealer. Prepared in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.',
  sections: [
    { h: "1. DEFINITIONS", p: [
      '"Controller" means the Dealer who determines the purposes and means of processing Customer Data. "Processor" means ShiftOS, which processes Customer Data on behalf of the Controller. "Customer Data" means any personal data relating to the Controller\'s customers uploaded to the Platform. "Personal Data" has the meaning given under the PDPA 2010. "Processing" includes collecting, storing, organising, retrieving, disclosing, and deleting data. "Sub-processor" means any third party engaged by ShiftOS to assist in processing Customer Data.',
    ] },
    { h: "2. ROLES AND RESPONSIBILITIES", p: [
      "Controller (Dealer) confirms that: it has a lawful basis for collecting and uploading Customer Data; it has provided customers with appropriate privacy notices; it has obtained necessary consents where required under PDPA 2010; it will only upload Customer Data that is accurate and relevant to its legitimate business activities; it will promptly action any customer data access, correction or deletion requests.",
      "ShiftOS (Processor) agrees to: process Customer Data only on documented instructions from the Controller; ensure that all staff with access to Customer Data are bound by confidentiality obligations; implement appropriate technical and organisational security measures; not engage sub-processors without informing the Controller and ensuring equivalent protections apply; assist the Controller in responding to data subject requests; notify the Controller without undue delay upon becoming aware of a personal data breach affecting Customer Data; delete or return all Customer Data upon termination of the subscription, at the Controller's request.",
    ] },
    { h: "3. SUB-PROCESSORS", p: [
      "ShiftOS currently engages the following sub-processors: Supabase Inc. (USA) — database hosting, authentication, and file storage; Vercel Inc. (USA) — web hosting and edge delivery; Telegram Messenger Inc. — notification delivery (only where Dealer has enabled Telegram integration). ShiftOS will notify Dealers of any intended changes to sub-processors at least 14 days in advance, giving the Dealer the opportunity to object.",
    ] },
    { h: "4. DATA SECURITY", p: [
      "ShiftOS implements and maintains: Row Level Security (RLS) ensuring each Dealer can only access their own Customer Data; encrypted transmission of all data via HTTPS/TLS; role-based access controls limiting data access within the Platform; regular security reviews and vulnerability assessments; secure deletion of data upon account termination.",
    ] },
    { h: "5. DATA BREACH NOTIFICATION", p: [
      "In the event of a personal data breach affecting Customer Data, ShiftOS will: notify the affected Dealer within 72 hours of becoming aware of the breach; provide details of the nature of the breach, the data affected, and likely consequences; describe the measures taken or proposed to address the breach. Where the breach is likely to cause significant harm, ShiftOS will support notification to the affected data subjects and to the Personal Data Protection Commissioner. The Dealer, as Controller, remains responsible for determining and making any notifications required of it under PDPA 2010.",
    ] },
    { h: "6. DATA SUBJECT RIGHTS", p: [
      "Where a Dealer's customer exercises rights under PDPA 2010 (access, correction, deletion), ShiftOS will provide reasonable assistance to the Dealer in fulfilling those requests, including providing tools to export or delete specific customer records from the Platform.",
    ] },
    { h: "7. AUDITS", p: [
      "The Dealer may request information from ShiftOS to verify compliance with this DPA not more than once per calendar year, with reasonable advance notice. ShiftOS will respond within 30 days.",
    ] },
    { h: "8. TERM AND TERMINATION", p: [
      "This DPA remains in effect for the duration of the Dealer's subscription. Upon termination: ShiftOS will retain Customer Data for 30 days to allow the Dealer to export it; after 30 days, Customer Data will be permanently deleted from all active systems; backups containing Customer Data will be purged within 90 days of termination.",
    ] },
    { h: "9. GOVERNING LAW", p: [
      "This DPA is governed by the laws of Malaysia. Any disputes shall be subject to the jurisdiction of the Malaysian courts.",
    ] },
    { h: "10. CONTACT FOR DATA PROTECTION MATTERS", p: [
      "For any data protection queries or to exercise rights under this DPA, contact ShiftOS at legal@xdrive.my.",
    ] },
  ],
};

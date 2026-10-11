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
  // Privacy Policy last changed (fuller provider list, buyer data, BM version).
  privacyUpdated: "11 October 2026",
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
      "Salesman Lite: Free (limited features, subject to fair use). Salesman Premium: RM 35/month. Dealer Starter: RM 299/month. Dealer Growth: RM 599/month. Dealer Pro: RM 1,199/month. Dealer Group: RM 2,999/month. All prices are in MYR and exclusive of applicable taxes. New dealer accounts receive a 14-day free trial with full platform access. No payment information is required during the trial. Subscriptions are billed monthly in advance. You may cancel at any time by contacting legal@xdrive.my. Cancellation takes effect at the end of the current billing period. No refunds for partial months. If you pay twice or pay by mistake, we refund the extra payment in full: email legal@xdrive.my within 30 days of paying. Data remains accessible for 30 days after cancellation before deletion.",
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

// Updated 11 Oct 2026: the old copy named 3 service providers (we use ~12), said
// we use no analytics storage (the consent banner exists because we do), kept
// account data "12 months" while the delete flow purges in 30 days, and said
// nothing about buyer chat, email alerts or Find me posts. PRIVACY_MS below is
// the Bahasa Malaysia version PDPA s.7(3) asks for: change both together.
export const PRIVACY = {
  intro:
    "This Privacy Policy explains how ShiftOS collects, uses, stores and protects personal data on the ShiftOS platform and the xdrive.my marketplace, under the Personal Data Protection Act 2010 (PDPA) of Malaysia. A Bahasa Malaysia version is on the same page.",
  sections: [
    { h: "1. WHO WE ARE", p: [
      "ShiftOS (operated by Airy, sole proprietor) runs the ShiftOS seller platform and the xdrive.my car marketplace in Malaysia. For any privacy question, or to use your rights below, email legal@xdrive.my.",
    ] },
    { h: "2. DATA WE COLLECT", p: [
      "Dealer and salesman accounts: full name, email address, phone number, IC (MyKad) number and IC photos for identity checks, dealership name, business registration number where you have one, business address, profile photo, subdomain, payment records, and platform usage data.",
      "Buyers: when you enquire, book a viewing or contact a seller, we collect your name, phone number and state to pass your request to that seller. If you chat with a seller on xdrive.my, we keep your messages and pass them to that seller. If you add an email address in a chat, we use it only to tell you a seller replied. If you post a Find me request, sellers see the car you want and your state; your name reaches a seller only when you reply to them. If you create an account, we also keep your saved cars and price alerts.",
      "Data a seller adds: where a dealer or salesman adds further customer data (lead, appointment or loan details, including IC numbers), we process it on their behalf. They are the data controller and are responsible for getting appropriate consent.",
      "Automatic data: pages viewed and buttons tapped (see section 10), browser and device type, IP address (used for rate limiting and security, not kept with your profile), and error reports.",
    ] },
    { h: "3. HOW WE USE YOUR DATA", p: [
      "To run and improve the platform; to log you in and protect your account; to check that sellers are real people; to send buyer enquiries, bookings and messages to the right seller; to show vehicle listings on xdrive.my; to send notifications by app, push, email or Telegram; to produce reports and performance figures for sellers; to stop fraud and abuse; to meet legal obligations; and to send service, billing and security messages. We do not sell your data or use it for advertising.",
    ] },
    { h: "4. LEGAL BASIS FOR PROCESSING (PDPA 2010)", p: [
      "Contract: to provide the service you signed up for. Legitimate interests: to improve the platform and prevent fraud. Consent: for enquiries, bookings, chats and optional features such as email alerts, push notifications and Telegram. Legal obligation: where Malaysian law requires it.",
    ] },
    { h: "5. WHO WE SHARE DATA WITH", p: [
      "We do not sell, rent or trade personal data. We share it with: the seller you contact; and the service providers we use to run XDrive: Supabase (database, login and file storage, USA); Vercel (hosting and cookie-free visit statistics, USA); Sentry (error reports, and on seller dashboards screen recordings with all text and inputs hidden, USA); Resend (email, USA); Anthropic (AI drafting tools for sellers, which only see chat text with phone, IC and email numbers removed, USA); Cloudflare (bot checks on forms); Upstash (rate limiting); wsrv.nl (photo resizing); Google Fonts; Google and Apple (push notifications, only if you turn them on); Telegram (seller alerts, only if turned on). We also share data with Malaysian authorities where the law or a court requires it.",
      "Some of these providers store data outside Malaysia. We choose providers that protect personal data to a standard comparable to the PDPA.",
    ] },
    { h: "6. HOW LONG WE KEEP DATA", p: [
      "Account data: while your account is open. If you delete your account or your subscription ends, we keep it for 30 days so you can change your mind or export it, then delete it. Backups are cleared within 90 days after that. Buyer enquiries and leads: for as long as the seller who received them keeps their account. Analytics: 24 months. Error logs: 90 days. Payment records may be kept longer where tax law requires.",
    ] },
    { h: "7. DATA SECURITY", p: [
      "We use row-level security on every database table so each seller sees only their own data, encrypted connections (HTTPS/TLS), role-based access, an append-only log of sensitive actions, rate limits, and regular security reviews. No system is 100% secure. Keep your password to yourself.",
    ] },
    { h: "8. DATA BREACH", p: [
      "If a breach of personal data is likely to cause significant harm, we will tell the people affected and the Personal Data Protection Commissioner without undue delay, as the PDPA (as amended) requires. If the data was added by a seller, we will tell that seller too so they can meet their own obligations.",
    ] },
    { h: "9. YOUR RIGHTS", p: [
      "You can: see the personal data we hold about you; correct it; take a copy in a common file format to another service (data portability); withdraw consent where consent is the basis; ask us to delete it, subject to legal obligations; and object to uses beyond what we told you. Dealers, independent salesmen and signed-in buyers can delete their account themselves in Settings. Anyone else can email legal@xdrive.my. We reply within 21 days.",
    ] },
    { h: "10. COOKIES AND DEVICE STORAGE", p: [
      "We do not use advertising cookies. We store a few things on your device: your login session, your cookie choice, your language, cars you saved, and, if you ask us to, your name and phone for your next enquiry. Seller dashboards keep a copy of their data on the device so they open quickly; it is cleared when you log out. Our own page-view and button counts run only if you allow \"Analytics\" in Cookie settings (link in the site footer). Vercel's visit counter does not use cookies or identify you.",
    ] },
    { h: "11. CHILDREN", p: [
      "XDrive is for adults. Buyer accounts require you to confirm you are 18 or older, and seller accounts require an IC. We do not knowingly collect data from anyone under 18; if you think we have, email legal@xdrive.my and we will delete it.",
    ] },
    { h: "12. CHANGES TO THIS POLICY", p: [
      "We will tell registered sellers about material changes by in-app notice or email at least 14 days before they take effect. The date at the top shows the latest version.",
    ] },
    { h: "13. CONTACT", p: [
      "Questions, requests or complaints: legal@xdrive.my · https://xdrive.my",
    ] },
  ],
};

// Bahasa Malaysia version (PDPA s.7(3)). Same sections, same order as PRIVACY.
export const PRIVACY_MS = {
  intro:
    "Polisi Privasi ini menerangkan cara ShiftOS mengumpul, menggunakan, menyimpan dan melindungi data peribadi di platform ShiftOS dan pasaran xdrive.my, di bawah Akta Perlindungan Data Peribadi 2010 (PDPA) Malaysia. Versi Bahasa Inggeris ada di halaman yang sama.",
  sections: [
    { h: "1. SIAPA KAMI", p: [
      "ShiftOS (dikendalikan oleh Airy, pemilik tunggal) mengendalikan platform penjual ShiftOS dan pasaran kereta xdrive.my di Malaysia. Untuk sebarang soalan privasi, atau untuk menggunakan hak anda di bawah, e-mel legal@xdrive.my.",
    ] },
    { h: "2. DATA YANG KAMI KUMPUL", p: [
      "Akaun pengedar dan jurujual: nama penuh, alamat e-mel, nombor telefon, nombor IC (MyKad) dan gambar IC untuk semakan identiti, nama syarikat, nombor pendaftaran perniagaan jika ada, alamat perniagaan, gambar profil, subdomain, rekod bayaran, dan data penggunaan platform.",
      "Pembeli: apabila anda membuat pertanyaan, menempah tinjauan atau menghubungi penjual, kami mengumpul nama, nombor telefon dan negeri anda untuk menghantar permintaan anda kepada penjual itu. Jika anda berbual dengan penjual di xdrive.my, kami menyimpan mesej anda dan menghantarnya kepada penjual itu. Jika anda menambah alamat e-mel dalam perbualan, kami menggunakannya hanya untuk memberitahu anda bahawa penjual telah membalas. Jika anda membuat permintaan Find me, penjual nampak kereta yang anda cari dan negeri anda; nama anda sampai kepada penjual hanya apabila anda membalas mereka. Jika anda membuka akaun, kami juga menyimpan kereta yang anda simpan dan amaran harga anda.",
      "Data yang ditambah oleh penjual: jika pengedar atau jurujual menambah data pelanggan lain (butiran prospek, temujanji atau pinjaman, termasuk nombor IC), kami memprosesnya bagi pihak mereka. Mereka ialah pengawal data dan bertanggungjawab mendapatkan persetujuan yang sewajarnya.",
      "Data automatik: halaman yang dilihat dan butang yang ditekan (lihat seksyen 10), jenis pelayar dan peranti, alamat IP (digunakan untuk had kadar dan keselamatan, tidak disimpan bersama profil anda), dan laporan ralat.",
    ] },
    { h: "3. CARA KAMI MENGGUNAKAN DATA ANDA", p: [
      "Untuk menjalankan dan menambah baik platform; untuk log masuk dan melindungi akaun anda; untuk memastikan penjual ialah orang sebenar; untuk menghantar pertanyaan, tempahan dan mesej pembeli kepada penjual yang betul; untuk memaparkan iklan kereta di xdrive.my; untuk menghantar notifikasi melalui aplikasi, push, e-mel atau Telegram; untuk menghasilkan laporan dan prestasi untuk penjual; untuk menghalang penipuan dan penyalahgunaan; untuk mematuhi undang-undang; dan untuk menghantar mesej perkhidmatan, bil dan keselamatan. Kami tidak menjual data anda dan tidak menggunakannya untuk pengiklanan.",
    ] },
    { h: "4. ASAS UNDANG-UNDANG (PDPA 2010)", p: [
      "Kontrak: untuk memberikan perkhidmatan yang anda langgan. Kepentingan sah: untuk menambah baik platform dan menghalang penipuan. Persetujuan: untuk pertanyaan, tempahan, perbualan dan ciri pilihan seperti amaran e-mel, notifikasi push dan Telegram. Kewajipan undang-undang: apabila dikehendaki oleh undang-undang Malaysia.",
    ] },
    { h: "5. DENGAN SIAPA KAMI BERKONGSI DATA", p: [
      "Kami tidak menjual, menyewa atau memperdagangkan data peribadi. Kami berkongsinya dengan: penjual yang anda hubungi; dan pembekal perkhidmatan yang kami gunakan untuk menjalankan XDrive: Supabase (pangkalan data, log masuk dan storan fail, Amerika Syarikat); Vercel (hos laman dan statistik lawatan tanpa kuki, AS); Sentry (laporan ralat, dan di papan pemuka penjual rakaman skrin dengan semua teks dan input disembunyikan, AS); Resend (e-mel, AS); Anthropic (alat draf AI untuk penjual, yang hanya melihat teks perbualan dengan nombor telefon, IC dan e-mel dibuang, AS); Cloudflare (semakan bot pada borang); Upstash (had kadar); wsrv.nl (saiz semula gambar); Google Fonts; Google dan Apple (notifikasi push, hanya jika anda menghidupkannya); Telegram (amaran penjual, hanya jika dihidupkan). Kami juga berkongsi data dengan pihak berkuasa Malaysia jika dikehendaki oleh undang-undang atau mahkamah.",
      "Sesetengah pembekal ini menyimpan data di luar Malaysia. Kami memilih pembekal yang melindungi data peribadi pada tahap yang setanding dengan PDPA.",
    ] },
    { h: "6. TEMPOH KAMI MENYIMPAN DATA", p: [
      "Data akaun: selagi akaun anda dibuka. Jika anda memadam akaun atau langganan anda tamat, kami menyimpannya selama 30 hari supaya anda boleh berubah fikiran atau mengeksportnya, kemudian memadamnya. Salinan sandaran dibersihkan dalam masa 90 hari selepas itu. Pertanyaan dan prospek pembeli: selagi penjual yang menerimanya masih mempunyai akaun. Analitik: 24 bulan. Log ralat: 90 hari. Rekod bayaran mungkin disimpan lebih lama jika dikehendaki oleh undang-undang cukai.",
    ] },
    { h: "7. KESELAMATAN DATA", p: [
      "Kami menggunakan keselamatan peringkat baris pada setiap jadual pangkalan data supaya setiap penjual hanya nampak data mereka sendiri, sambungan yang disulitkan (HTTPS/TLS), akses mengikut peranan, log tindakan sensitif yang tidak boleh diubah, had kadar, dan semakan keselamatan berkala. Tiada sistem yang 100% selamat. Jangan kongsi kata laluan anda.",
    ] },
    { h: "8. PELANGGARAN DATA", p: [
      "Jika berlaku pelanggaran data peribadi yang mungkin menyebabkan kemudaratan ketara, kami akan memaklumkan orang yang terjejas dan Pesuruhjaya Perlindungan Data Peribadi tanpa kelewatan yang tidak wajar, seperti yang dikehendaki oleh PDPA (sebagaimana dipinda). Jika data itu ditambah oleh penjual, kami akan memaklumkan penjual itu juga supaya mereka boleh memenuhi kewajipan mereka sendiri.",
    ] },
    { h: "9. HAK ANDA", p: [
      "Anda boleh: melihat data peribadi anda yang kami simpan; membetulkannya; mengambil salinan dalam format fail biasa untuk dibawa ke perkhidmatan lain (kemudahalihan data); menarik balik persetujuan jika persetujuan ialah asasnya; meminta kami memadamnya, tertakluk kepada kewajipan undang-undang; dan membantah penggunaan di luar apa yang kami maklumkan. Pengedar, jurujual bebas dan pembeli yang log masuk boleh memadam akaun sendiri di Tetapan. Orang lain boleh e-mel legal@xdrive.my. Kami membalas dalam masa 21 hari.",
    ] },
    { h: "10. KUKI DAN STORAN PERANTI", p: [
      "Kami tidak menggunakan kuki pengiklanan. Kami menyimpan beberapa perkara pada peranti anda: sesi log masuk, pilihan kuki anda, bahasa anda, kereta yang anda simpan, dan, jika anda minta, nama dan telefon anda untuk pertanyaan seterusnya. Papan pemuka penjual menyimpan salinan data mereka pada peranti supaya cepat dibuka; ia dipadam apabila anda log keluar. Kiraan paparan halaman dan butang kami sendiri hanya berjalan jika anda membenarkan \"Analytics\" dalam Cookie settings (pautan di bahagian bawah laman). Pengira lawatan Vercel tidak menggunakan kuki dan tidak mengenal pasti anda.",
    ] },
    { h: "11. KANAK-KANAK", p: [
      "XDrive untuk orang dewasa. Akaun pembeli memerlukan anda mengesahkan umur 18 tahun ke atas, dan akaun penjual memerlukan IC. Kami tidak sengaja mengumpul data daripada sesiapa di bawah 18 tahun; jika anda fikir kami telah berbuat demikian, e-mel legal@xdrive.my dan kami akan memadamnya.",
    ] },
    { h: "12. PERUBAHAN POLISI INI", p: [
      "Kami akan memaklumkan penjual berdaftar tentang perubahan penting melalui notis dalam aplikasi atau e-mel sekurang-kurangnya 14 hari sebelum ia berkuat kuasa. Tarikh di bahagian atas menunjukkan versi terkini.",
    ] },
    { h: "13. HUBUNGI KAMI", p: [
      "Soalan, permintaan atau aduan: legal@xdrive.my · https://xdrive.my",
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
      "ShiftOS currently engages the following sub-processors: Supabase Inc. (USA) — database hosting, authentication, and file storage; Vercel Inc. (USA) — web hosting and edge delivery; Functional Software Inc. (Sentry, USA) — error reporting and masked session replay on dashboards; Resend (USA) — email delivery; Anthropic PBC (USA) — AI drafting features, which receive chat text with phone, IC and email numbers removed; Cloudflare — bot protection on forms; Upstash — rate limiting; Telegram Messenger Inc. — notification delivery (only where Dealer has enabled Telegram integration); Google and Apple — push notification delivery (only where enabled). ShiftOS will notify Dealers of any intended changes to sub-processors at least 14 days in advance, giving the Dealer the opportunity to object.",
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

import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'apa-itu-dms-dealer-kereta',
  title: 'Apa Itu Dealer Management System (DMS) Dan Kenapa Dealer Kereta Perlu Guna',
  description:
    'Penjelasan lengkap apa itu Dealer Management System (DMS) untuk kereta, kenapa dealer kereta terpakai Malaysia perlu guna, dan beza DMS dengan platform iklan. Panduan used car DMS Malaysia 2026.',
  datePublished: '2026-06-22',
  dateModified: '2026-06-22',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Apa itu Dealer Management System (DMS)?',
    a: 'Dealer Management System (DMS) ialah sistem jualan kereta Malaysia yang menyatukan semua operasi dealer — urus stok, lead CRM, jualan, komisen, dokumen dan laporan keuntungan — dalam satu platform. Untuk dealer kereta terpakai, DMS menggantikan Excel dan WhatsApp dengan satu sumber data tunggal.',
  },
  {
    q: 'Kenapa dealer kereta perlu guna DMS?',
    a: 'Dealer perlu guna DMS kerana ia menjimatkan masa, mengurangkan kesilapan kiraan, mengesan stok lama, dan memaparkan keuntungan sebenar setiap unit. Tanpa DMS, dealer mudah kehilangan margin akibat rekod manual yang berselerak dan tidak tepat.',
  },
  {
    q: 'Apa beza DMS dengan Mudah atau Carlist?',
    a: 'Mudah dan Carlist ialah platform iklan untuk dapatkan pembeli. DMS pula ialah software dealer kereta Malaysia untuk urus operasi dalaman — stok, lead, jualan dan komisen. Kedua-duanya boleh digunakan serentak: iklan di Mudah/Carlist, urus operasi dalam DMS.',
  },
  {
    q: 'Adakah DMS ada CRM untuk lead?',
    a: 'Ya. DMS moden seperti ShiftOS termasuk car dealer CRM Malaysia untuk urus enquiry dan lead dari semua sumber — WhatsApp, walk-in, Mudah dan Carlist — supaya tiada pembeli berpotensi terlepas.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      headline: ARTICLE.title,
      description: ARTICLE.description,
      datePublished: ARTICLE.datePublished,
      dateModified: ARTICLE.dateModified,
      author: { '@type': 'Organization', name: 'ShiftOS by XDrive' },
      publisher: { '@type': 'Organization', name: 'XDrive Malaysia', url: 'https://xdrive.my' },
      url: `https://xdrive.my/articles/${ARTICLE.slug}`,
      inLanguage: 'ms',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
};

export default function ApaItuDmsArticle() {
  return (
    <>
      <Helmet>
        <title>{ARTICLE.title} · XDrive</title>
        <meta name="description" content={ARTICLE.description} />
        <meta property="og:title" content={ARTICLE.title} />
        <meta property="og:description" content={ARTICLE.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://xdrive.my/articles/${ARTICLE.slug}`} />
        <meta property="article:published_time" content={ARTICLE.datePublished} />
        <meta property="article:modified_time" content={ARTICLE.dateModified} />
        <link rel="canonical" href={`https://xdrive.my/articles/${ARTICLE.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "system-ui, sans-serif" }}>
        <MarketplaceHeader />

        <main style={{ paddingTop: 72, maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Laman Utama</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Panduan</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Apa Itu DMS</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Apa Itu Dealer Management<br />
              <span style={{ color: '#dc2626' }}>System (DMS)?</span>
            </h1>
            <p style={{ color: '#4b5563', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
              {ARTICLE.description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} />
                {new Date(ARTICLE.datePublished).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={12} />
                {ARTICLE.readMins} minit bacaan
              </span>
              <span>ShiftOS by XDrive</span>
            </div>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 }}>
                <strong style={{ color: '#111827' }}>Dealer Management System (DMS) ialah sistem jualan kereta Malaysia yang menyatukan semua operasi dealer dalam satu platform</strong> — urus stok, lead CRM, jualan, komisen salesman, dokumen dan laporan keuntungan. Untuk dealer kereta terpakai, DMS menggantikan Excel dan WhatsApp yang berselerak dengan satu sumber data tunggal yang tepat.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                ShiftOS ialah contoh used car DMS Malaysia yang dibina khas untuk dealer kereta terpakai tempatan.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Apa Yang Ada Dalam Sebuah DMS?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  { t: 'Urus Stok', d: 'Rekod setiap unit, kos, harga & umur stok.' },
                  { t: 'Lead CRM', d: 'Urus enquiry dari WhatsApp, walk-in, Mudah & Carlist.' },
                  { t: 'Jualan & Untung', d: 'Rekod jualan dengan untung kasar setiap unit.' },
                  { t: 'Komisen Salesman', d: 'Kira komisen automatik setiap deal.' },
                  { t: 'Dokumen', d: 'Sales agreement, invois & dokumen pindah milik.' },
                  { t: 'Analitik', d: 'Laporan prestasi & keuntungan bulanan.' },
                ].map(({ t, d }) => (
                  <div key={t} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontWeight: 700, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{t}</p>
                    <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{d}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>DMS vs Platform Iklan vs Excel</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid #e5e7eb', minWidth: 120 }}>Fungsi</th>
                      <th style={{ textAlign: 'center', color: '#15803d', fontWeight: 600, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>DMS</th>
                      <th style={{ textAlign: 'center', color: '#6b7280', fontWeight: 600, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Iklan</th>
                      <th style={{ textAlign: 'center', color: '#6b7280', fontWeight: 600, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Urus stok & kos', 'Ya', 'Tidak', 'Manual'],
                      ['Lead CRM', 'Ya', 'Sebahagian', 'Tidak'],
                      ['Komisen automatik', 'Ya', 'Tidak', 'Manual'],
                      ['Untung setiap unit', 'Ya', 'Tidak', 'Manual'],
                      ['Cari pembeli baru', 'Storefront', 'Ya', 'Tidak'],
                    ].map(([fn, dms, ad, xl], i, arr) => (
                      <tr key={fn} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ color: '#374151', fontWeight: 500, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{fn}</td>
                        <td style={{ color: '#15803d', textAlign: 'center', fontWeight: 600, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{dms}</td>
                        <td style={{ color: '#6b7280', textAlign: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{ad}</td>
                        <td style={{ color: '#6b7280', textAlign: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{xl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Kenapa Dealer Kereta Perlu Guna DMS</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Nampak untung sebenar setiap unit — termasuk kos recon, komisen & handover.',
                  'Kesan stok lama lebih awal sebelum modal terikat terlalu lama.',
                  'Tiada lead terlepas — semua enquiry diurus di satu tempat.',
                  'Komisen salesman dikira automatik, tiada pertikaian gaji.',
                  'Laporan keuntungan sedia untuk keputusan beli stok seterusnya.',
                  'Pasukan boleh akses maklumat yang sama, di mana sahaja.',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Soalan Lazim (FAQ)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {FAQS.map(({ q, a }, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, marginBottom: 8 }}>{q}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{a}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Baca Seterusnya</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                {[
                  { to: '/articles/app-terbaik-dealer-kereta-terpakai-malaysia', cat: 'Urus Dealer', title: 'App Terbaik Untuk Dealer Kereta Terpakai 2025' },
                  { to: '/articles/cara-urus-stok-kereta-terpakai-sistem-digital', cat: 'Urus Dealer', title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital' },
                ].map(({ to, cat, title }) => (
                  <Link key={to} to={to} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, textDecoration: 'none', display: 'block' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 8 }}>{cat}</p>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, lineHeight: 1.4, margin: '0 0 8px' }}>{title}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Baca panduan →</p>
                  </Link>
                ))}
              </div>
            </section>

            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>DMS Lengkap Untuk Dealer Kereta Malaysia</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                ShiftOS menyatukan stok, lead, jualan, komisen & analitik dalam satu sistem. Mula percuma hari ini.
              </p>
              <Link to="/shiftos" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Cuba ShiftOS DMS
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'app-terbaik-dealer-kereta-terpakai-malaysia',
  title: 'App Terbaik Untuk Dealer Kereta Terpakai Di Malaysia 2025',
  description:
    'Senarai app terbaik dan software dealer kereta Malaysia untuk dealer kereta terpakai 2025. Bandingkan ciri, harga dan kelebihan setiap pilihan — termasuk used car dealer software Malaysia yang dibina khas tempatan.',
  datePublished: '2026-06-22',
  dateModified: '2026-06-22',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Apa app terbaik untuk dealer kereta terpakai di Malaysia?',
    a: 'Untuk dealer kereta terpakai Malaysia, ShiftOS adalah antara pilihan terbaik kerana ia dibina khas untuk pasaran tempatan — merangkumi urus stok, lead CRM, komisen salesman, dokumen dan analitik keuntungan dalam satu app. Platform iklan seperti Mudah dan Carlist pula sesuai untuk pemasaran, tetapi bukan untuk urus operasi dalaman.',
  },
  {
    q: 'Adakah Mudah atau Carlist boleh urus stok dan jualan saya?',
    a: 'Tidak sepenuhnya. Mudah dan Carlist ialah platform iklan untuk dapatkan pembeli, bukan software dealer kereta untuk urus stok, kos, lead dan komisen. Kebanyakan dealer guna Mudah/Carlist untuk iklan, dan app untuk dealer kereta terpakai seperti ShiftOS untuk urus operasi.',
  },
  {
    q: 'Ada tak software dealer kereta murah untuk dealer kecil?',
    a: 'Ada. ShiftOS bermula RM299/bulan untuk Dealer Starter, dan ada pelan percuma untuk salesman individu (app salesman kereta Malaysia). Ini jauh lebih murah berbanding sistem DMS antarabangsa yang selalunya berharga ribuan ringgit sebulan.',
  },
  {
    q: 'Perlu ke guna app khas, atau cukup dengan Excel?',
    a: 'Excel boleh berfungsi untuk segelintir kereta, tetapi gagal apabila stok bertambah, ada ramai salesman, atau anda perlu jejak komisen dan keuntungan tepat. App khas mengautomasikan kiraan dan mengurangkan kesilapan — menjimatkan masa dan melindungi margin anda.',
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

export default function AppTerbaikDealerArticle() {
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
            <span style={{ color: '#6b7280' }}>App Terbaik Dealer</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              App Terbaik Untuk Dealer<br />
              <span style={{ color: '#dc2626' }}>Kereta Terpakai 2025</span>
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
                <strong style={{ color: '#111827' }}>App terbaik untuk dealer kereta terpakai di Malaysia ialah sistem yang dibina khas untuk operasi dealer tempatan</strong> — bukan sekadar platform iklan. Pilihan terbaik 2025 ialah ShiftOS, sebuah used car dealer software Malaysia yang menggabungkan urus stok, lead CRM, komisen salesman, dokumen dan analitik dalam satu app untuk dealer kereta terpakai.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Di bawah, kami bandingkan jenis-jenis pilihan secara adil supaya anda boleh pilih yang sesuai dengan saiz dan keperluan perniagaan anda.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Perbandingan Pilihan Untuk Dealer</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid #e5e7eb', minWidth: 130 }}>Pilihan</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Sesuai untuk</th>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Had</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { opt: 'ShiftOS', use: 'Urus stok, lead, jualan, komisen & analitik', limit: 'Fokus pasaran Malaysia' },
                      { opt: 'Mudah / Carlist', use: 'Iklan & cari pembeli', limit: 'Bukan untuk urus operasi dalaman' },
                      { opt: 'Excel / Sheets', use: 'Dealer sangat kecil (<5 unit)', limit: 'Manual, mudah silap, tiada automasi' },
                      { opt: 'DMS antarabangsa', use: 'Francais besar', limit: 'Mahal, tak sesuai konteks tempatan' },
                    ].map(({ opt, use, limit }, i, arr) => (
                      <tr key={opt} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ color: '#111827', fontWeight: 600, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{opt}</td>
                        <td style={{ color: '#6b7280', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{use}</td>
                        <td style={{ color: '#6b7280', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{limit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 10 }}>
                Nota: Mudah dan Carlist adalah platform iklan yang bagus dan boleh digunakan serentak dengan ShiftOS — bukan pesaing langsung.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Ciri Yang Patut Ada Dalam App Dealer</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Urus stok kereta dengan kos & untung setiap unit',
                  'CRM lead untuk urus enquiry dari pelbagai sumber',
                  'Rekod komisen salesman secara automatik',
                  'Penyediaan dokumen & sales agreement',
                  'Analitik keuntungan & prestasi bulanan',
                  'Akses mudah alih (telefon) untuk salesman',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Kenapa ShiftOS Sesuai Untuk Dealer Malaysia</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                ShiftOS dibina khas untuk aliran kerja kereta terpakai Malaysia — Puspakom B5/B7, pindah milik JPJ, pembiayaan HP, dan F&amp;I add-on. Sebagai car dealer management app Malaysia, ia menyatukan semua yang dealer perlukan tanpa kerumitan sistem antarabangsa.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Untuk salesman individu pula, ShiftOS menyediakan app salesman kereta Malaysia percuma untuk urus listing, lead dan komisen sendiri — pilihan ringan sebelum naik taraf ke pelan dealer penuh.
              </p>
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
                  { to: '/articles/cara-urus-stok-kereta-terpakai-sistem-digital', cat: 'Urus Dealer', title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital' },
                  { to: '/articles/cara-kira-komisen-salesman-kereta', cat: 'Urus Dealer', title: 'Cara Kira Komisen Salesman Kereta Dengan Betul' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Cuba App Dealer Terbaik Untuk Malaysia</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                ShiftOS — software dealer kereta Malaysia yang lengkap. Mula percuma, naik taraf bila perlu.
              </p>
              <Link to="/shiftos" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat ShiftOS
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

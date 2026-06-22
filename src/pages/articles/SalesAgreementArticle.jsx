import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-buat-sales-agreement-kereta-terpakai',
  title: 'Cara Buat Sales Agreement Kereta Terpakai Malaysia (2026)',
  description:
    'Panduan cara buat sales agreement (perjanjian jual beli) kereta terpakai Malaysia — apa yang wajib ada, contoh klausa, dan cara automasikan dokumen jualan guna software rekod jualan kereta.',
  datePublished: '2026-06-22',
  dateModified: '2026-06-22',
  readMins: 7,
};

const FAQS = [
  {
    q: 'Apa itu sales agreement kereta terpakai?',
    a: 'Sales agreement (perjanjian jual beli) kereta terpakai ialah dokumen bertulis yang merekod butiran jualan antara dealer dan pembeli — termasuk maklumat kereta, harga, deposit, baki bayaran dan syarat. Ia melindungi kedua-dua pihak jika berlaku pertikaian.',
  },
  {
    q: 'Apa yang wajib ada dalam sales agreement kereta?',
    a: 'Sales agreement wajib mengandungi butiran pembeli & penjual, maklumat kenderaan (jenama, model, tahun, plat, VIN), harga jual, jumlah deposit, baki bayaran, tarikh serahan, dan syarat berkaitan pindah milik serta keadaan kereta (as-is atau dengan waranti).',
  },
  {
    q: 'Boleh ke automasikan pembuatan sales agreement?',
    a: 'Boleh. Software rekod jualan kereta seperti ShiftOS boleh menjana sales agreement dan invois secara automatik dari rekod jualan — mengisi butiran kereta dan pembeli terus dari sistem, jadi tiada perlu taip semula setiap kali.',
  },
  {
    q: 'Adakah sales agreement sama dengan borang pindah milik JPJ?',
    a: 'Tidak. Sales agreement ialah perjanjian komersial antara dealer dan pembeli. Pindah milik pula dibuat melalui sistem JPJ (MySikap) dengan dokumen berasingan. Kedua-duanya diperlukan: agreement untuk merekod jualan, dan pindah milik untuk tukar pemilikan rasmi.',
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

export default function SalesAgreementArticle() {
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

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "'DM Sans', sans-serif" }}>
        <MarketplaceHeader />

        <main style={{ paddingTop: 72, maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Laman Utama</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Panduan</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Sales Agreement</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Buat Sales Agreement<br />
              <span style={{ color: '#dc2626' }}>Kereta Terpakai</span>
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
                <strong style={{ color: '#111827' }}>Sales agreement kereta terpakai ialah dokumen bertulis yang merekod butiran jualan antara dealer dan pembeli</strong> — maklumat kereta, harga, deposit, baki bayaran dan syarat jualan. Dokumen ini penting untuk melindungi dealer dan pembeli jika berlaku pertikaian, dan menjadi rekod rasmi transaksi.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Berikut adalah apa yang wajib ada, contoh struktur, dan cara automasikan pembuatannya.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Apa Yang Wajib Ada Dalam Sales Agreement</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Butiran penjual (dealer): nama syarikat, alamat, no. SSM/pendaftaran.',
                  'Butiran pembeli: nama penuh, no. IC, alamat, no. telefon.',
                  'Maklumat kenderaan: jenama, model, tahun, no. plat, no. enjin & VIN.',
                  'Harga jual penuh dan jumlah deposit yang dibayar.',
                  'Baki bayaran dan kaedah pembayaran (tunai/pinjaman HP).',
                  'Tarikh serahan kereta dan tanggungjawab pindah milik.',
                  'Keadaan jualan: as-is atau dengan waranti dealer.',
                  'Tandatangan kedua-dua pihak dan tarikh.',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Contoh Struktur Klausa</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, fontSize: 14, color: '#4b5563', lineHeight: 1.8 }}>
                <p style={{ margin: '0 0 10px' }}><strong style={{ color: '#111827' }}>1. Pihak Terlibat</strong> — Penjual (dealer) dan Pembeli, dengan butiran penuh masing-masing.</p>
                <p style={{ margin: '0 0 10px' }}><strong style={{ color: '#111827' }}>2. Kenderaan</strong> — Spesifikasi penuh kereta dan nombor pendaftaran.</p>
                <p style={{ margin: '0 0 10px' }}><strong style={{ color: '#111827' }}>3. Harga &amp; Bayaran</strong> — Harga jual, deposit, baki dan jadual bayaran.</p>
                <p style={{ margin: '0 0 10px' }}><strong style={{ color: '#111827' }}>4. Serahan &amp; Pindah Milik</strong> — Tarikh serahan dan tanggungjawab pindah milik JPJ.</p>
                <p style={{ margin: 0 }}><strong style={{ color: '#111827' }}>5. Syarat &amp; Tandatangan</strong> — Keadaan jualan, terma tambahan, dan tandatangan kedua pihak.</p>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Cara Automasikan Sales Agreement Anda</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                Menulis sales agreement secara manual setiap kali memakan masa dan mudah silap. Dengan software rekod jualan kereta seperti ShiftOS, dokumen dijana automatik dari rekod jualan — butiran kereta dan pembeli diisi terus dari sistem. Anda hanya semak dan hantar.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Dokumen diisi automatik dari rekod kereta & pembeli',
                  'Hantar terus kepada pembeli melalui e-mel',
                  'Rekod jualan & keuntungan dikemas kini serentak',
                  'Simpan semua dokumen di satu tempat untuk rujukan',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 12 }}>
                Nota: Artikel ini panduan umum, bukan nasihat undang-undang. Rujuk peguam untuk perjanjian bernilai tinggi atau kes khusus.
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
                  { to: '/articles/cara-pindah-milik-kereta-mysikap', cat: 'Pindah Milik', title: 'Cara Pindah Milik Kereta Online Guna MySikap 2026' },
                  { to: '/articles/apa-itu-dms-dealer-kereta', cat: 'Urus Dealer', title: 'Apa Itu Dealer Management System (DMS)?' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Jana Dokumen Jualan Secara Automatik</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                ShiftOS jana sales agreement & invois terus dari rekod jualan anda. Jimat masa, kurang silap.
              </p>
              <Link to="/shiftos" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Cuba ShiftOS
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

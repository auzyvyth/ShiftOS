import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-urus-stok-kereta-terpakai-sistem-digital',
  title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital (2026)',
  description:
    'Panduan lengkap cara urus stok kereta terpakai Malaysia guna sistem digital. Tinggalkan Excel & WhatsApp — guna app urus stok kereta untuk pantau kos, umur stok dan keuntungan setiap unit secara automatik.',
  datePublished: '2026-06-22',
  dateModified: '2026-06-22',
  readMins: 7,
};

const FAQS = [
  {
    q: 'Apa cara terbaik urus stok kereta terpakai untuk dealer?',
    a: 'Cara terbaik adalah guna sistem urus stok kereta terpakai (app urus stok kereta) yang merekod setiap unit — kos beli, kos recon, harga jual dan umur stok — di satu tempat. Berbanding Excel atau WhatsApp, sistem digital mengira keuntungan setiap unit secara automatik dan memberi amaran untuk stok yang lama tidak terjual.',
  },
  {
    q: 'Adakah perlu bayar mahal untuk app urus stok kereta?',
    a: 'Tidak. Ada software dealer kereta murah seperti ShiftOS yang bermula RM299/bulan untuk dealer kecil, dan pelan percuma untuk salesman individu. Kos ini jauh lebih rendah berbanding kerugian akibat stok lama atau silap kira untung.',
  },
  {
    q: 'Boleh ke guna sistem digital walaupun saya tak biasa dengan teknologi?',
    a: 'Boleh. Sistem moden seperti ShiftOS direka mesra pengguna dan boleh diakses dari telefon. Anda hanya perlu masukkan maklumat kereta sekali, dan sistem uruskan pengiraan kos serta keuntungan untuk anda.',
  },
  {
    q: 'Bagaimana sistem digital bantu kurangkan stok lama?',
    a: 'Sistem urus stok kereta digital memaparkan umur setiap unit (days-in-stock) dan menanda kereta yang sudah lama tidak terjual. Ini membolehkan dealer buat keputusan repricing lebih awal sebelum modal terikat terlalu lama.',
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

export default function UrusStokDigitalArticle() {
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
            <span style={{ color: '#6b7280' }}>Urus Stok Digital</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Urus Stok Kereta Terpakai<br />
              <span style={{ color: '#dc2626' }}>Dengan Sistem Digital</span>
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
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#b8bcc4', fontStyle: 'italic' }}>
              Artikel ini ditulis oleh AI.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 }}>
                <strong style={{ color: '#111827' }}>Cara terbaik urus stok kereta terpakai hari ini ialah guna sistem digital</strong> — sebuah app urus stok kereta yang merekod setiap unit di satu tempat, dari kos beli sehingga harga jual. Bagi kebanyakan dealer kereta terpakai di Malaysia, ini bermakna meninggalkan Excel dan WhatsApp, dan beralih kepada sistem urus stok kereta terpakai yang mengira keuntungan dan umur stok secara automatik.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Artikel ini menerangkan cara urus stok kereta dealer langkah demi langkah, masalah cara lama, dan apa yang patut ada dalam sistem stok digital yang baik.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Masalah Cara Lama: Excel &amp; WhatsApp</h2>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Tiada gambaran untung sebenar — kos recon, komisen dan kos handover selalu tertinggal dalam kiraan.',
                    'Stok lama tidak dikesan — modal terikat berbulan tanpa amaran.',
                    'Maklumat berselerak antara fail Excel, chat WhatsApp dan buku nota.',
                    'Sukar dikongsi — bila salesman bertanya, anda terpaksa cari manual.',
                    'Mudah silap taip dan formula rosak — satu kesilapan boleh ubah seluruh kiraan.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151' }}>
                      <XCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: 3 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Apa Itu Sistem Urus Stok Kereta Digital?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Sistem urus stok kereta digital (car inventory management Malaysia) ialah perisian yang menyimpan rekod setiap unit kereta dalam stok anda — termasuk kos beli, kos recon, harga jual, plat, status, dan umur stok. Setiap kali anda jual sebuah kereta, sistem mengira keuntungan unit itu secara automatik. Ia menjadi satu sumber kebenaran tunggal untuk seluruh perniagaan dealer anda.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>5 Perkara Sistem Stok Digital Patut Ada</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Rekod kos penuh setiap unit', desc: 'Kos beli, kos recon, harga jual dan kos handover — supaya untung sebenar (gross profit) dipaparkan tepat untuk setiap kereta.' },
                  { label: 'Penjejak umur stok (days-in-stock)', desc: 'Tahu berapa lama setiap unit sudah dalam stok, dengan amaran untuk kereta yang lewat terjual.' },
                  { label: 'Akses dari telefon', desc: 'Semak stok di mana sahaja — di showroom, di lelong, atau semasa berjumpa pembeli.' },
                  { label: 'Sambungan ke lead & jualan', desc: 'Stok yang terjual terus dikemas kini sebagai sold, dan dihubungkan dengan lead serta komisen salesman.' },
                  { label: 'Laporan keuntungan automatik', desc: 'Lihat jumlah untung bulanan, purata margin, dan prestasi setiap unit tanpa kira manual.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> {label}
                    </p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Cara Urus Stok Kereta Dealer Langkah Demi Langkah</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Daftar setiap unit baru: masukkan jenama, model, tahun, plat, kos beli dan kos recon yang dijangka.',
                  'Tetapkan harga jual (asking price) dan tandakan status sebagai tersedia.',
                  'Pantau umur stok setiap hari — beri perhatian kepada unit yang melebihi 30–45 hari.',
                  'Hubungkan setiap enquiry atau lead dengan unit berkenaan supaya minat pembeli dapat dijejak.',
                  'Apabila terjual, rekod harga jualan sebenar — sistem akan kira untung unit secara automatik.',
                  'Semak laporan keuntungan bulanan untuk tahu model mana paling untung dan mana yang perlu dielak.',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Berapa Kos Sistem Stok Digital?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Tidak perlu mahal. ShiftOS — sistem urus stok kereta terpakai untuk dealer Malaysia — bermula RM299/bulan untuk Dealer Starter, dan ada pelan percuma (Salesman Lite) untuk salesman individu. Berbanding kerugian akibat stok lama atau silap kira untung, ini adalah software dealer kereta murah yang membayar balik dirinya sendiri.
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
                  { to: '/articles/apa-itu-dms-dealer-kereta', cat: 'Urus Dealer', title: 'Apa Itu Dealer Management System (DMS)?' },
                  { to: '/articles/app-terbaik-dealer-kereta-terpakai-malaysia', cat: 'Urus Dealer', title: 'App Terbaik Untuk Dealer Kereta Terpakai 2025' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Urus Stok Kereta Anda Dengan ShiftOS</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Pantau kos, umur stok dan keuntungan setiap unit secara automatik. Mula percuma — tiada kad kredit diperlukan.
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

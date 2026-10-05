import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'apa-itu-puspakom-b5-b7',
  title: 'Puspakom B5 & B7 Untuk Apa? Beza, Kos & Bila Perlu (2026)',
  description:
    'B5 untuk tukar nama kereta (RM30, laporan sah 120 hari). B7 untuk loan kereta terpakai (RM60, bank yang minta). Apa yang diperiksa, kos sebenar dan bila perlu buat kedua-duanya.',
  datePublished: '2026-06-13',
  dateModified: '2026-10-05',
  readMins: 5,
};

const FAQS = [
  {
    q: 'Puspakom B5 untuk apa?',
    a: 'B5 (kini dipanggil MV15) ialah pemeriksaan tukar hak milik. JPJ perlukan laporan B5 yang lulus sebelum boleh pindah milik kereta terpakai. Ia mengesahkan nombor casis dan nombor enjin sepadan dengan rekod, dan memeriksa perkara asas seperti lampu dan tahap kegelapan tint. Yuran pemeriksaan RM30.',
  },
  {
    q: 'Puspakom B7 untuk apa?',
    a: 'B7 ialah pemeriksaan sewa beli. Bank atau syarikat kewangan minta laporan B7 sebelum meluluskan pinjaman untuk kereta terpakai. Jika anda bayar tunai, B7 biasanya tidak diperlukan. Yuran pemeriksaan RM60.',
  },
  {
    q: 'Berapa lama laporan Puspakom B5 sah?',
    a: '120 hari dari tarikh pemeriksaan, berkuat kuasa 1 Julai 2026. Sebelum itu tempohnya 60 hari. Selesaikan pindah milik dalam tempoh ini atau pemeriksaan perlu dibuat semula.',
  },
  {
    q: 'Perlu buat B5 dan B7 sekali?',
    a: 'Jika pembeli ambil pinjaman, ya: JPJ perlukan B5 untuk tukar nama dan bank perlukan B7 untuk pinjaman. Kedua-duanya boleh dibuat pada hari yang sama. Yuran pemeriksaan RM90, tidak termasuk yuran pemprosesan tempahan.',
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
      author: { '@type': 'Organization', name: 'XDrive Malaysia' },
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

export default function PuspakomB5B7Article() {
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

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "var(--xd-font-body)" }}>
        <MarketplaceHeader />

        <main style={{ paddingTop: 72, maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          {/* Breadcrumb */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Laman Utama</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Panduan</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Puspakom B5 & B7</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Pindah Milik
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Puspakom B5 & B7 Untuk Apa?<br />
              <span style={{ color: '#dc2626' }}>Beza, Kos & Bila Perlu</span>
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
              <span>XDrive Malaysia</span>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#b8bcc4', fontStyle: 'italic' }}>
              Artikel ini ditulis oleh AI.
            </p>
          </header>

          {/* Summary box */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 40 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 14 }}>Ringkasan Pantas</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'B5 (kini dipanggil MV15) untuk tukar nama. JPJ perlukan laporan B5 yang lulus sebelum pindah milik kereta terpakai. Yuran RM30.',
                'B7 untuk pinjaman. Hanya perlu jika pembeli ambil loan bank untuk beli kereta itu, dan bank yang minta. Yuran RM60.',
                'Bayar tunai: biasanya B5 sahaja. Ambil loan: B5 dan B7, boleh dibuat pada hari yang sama.',
                'Laporan B5 sah 120 hari mulai 1 Julai 2026 (sebelum ini 60 hari).',
                'Setiap tempahan dikenakan yuran pemprosesan RM5 + SST, jadi B5 berjumlah RM37.80.',
              ].map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151' }}>
                  <CheckCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Apa Itu Pemeriksaan Puspakom?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                Puspakom ialah syarikat pemeriksaan kenderaan yang dilantik oleh Kementerian Pengangkutan. Terdapat beberapa jenis pemeriksaan Puspakom — yang paling relevan untuk urusan jual beli kereta terpakai ialah <strong style={{ color: '#111827' }}>B5</strong> dan <strong style={{ color: '#111827' }}>B7</strong>.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Ramai sangka kedua-duanya wajib untuk setiap jualan. Sebenarnya tidak: <strong style={{ color: '#111827' }}>B5 diperlukan oleh JPJ untuk tukar nama</strong>, manakala <strong style={{ color: '#111827' }}>B7 diperlukan oleh bank untuk pinjaman</strong>. Pembeli tunai biasanya hanya perlukan B5.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Puspakom B5 Untuk Apa? (Tukar Hak Milik)</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Puspakom B5</span>
                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>RM 30</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65 }}>
                  Pemeriksaan tukar hak milik. Kini dipanggil MV15. JPJ tidak akan proses pindah milik tanpa laporan yang lulus.
                </p>
              </div>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>Tujuan utama B5 ialah memastikan kereta itu memang kereta yang tertera dalam rekod JPJ, bukan kereta curi atau kereta klon. Antara yang diperiksa:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Nombor casis sepadan dengan rekod JPJ',
                  'Nombor enjin sepadan dengan rekod JPJ',
                  'Keadaan badan dan bahagian bawah kenderaan',
                  'Tahap kegelapan cermin (tint) mengikut had JPJ',
                  'Lampu berfungsi',
                  'Pemeriksaan mekanikal asas',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151' }}>
                    <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                <p style={{ color: '#92400e', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                  Jika kenderaan gagal B5, laporan akan menyatakan sebabnya. Betulkan perkara itu dahulu (contohnya tint terlalu gelap), kemudian tempah pemeriksaan semula. Semak caj pemeriksaan semula semasa membuat tempahan.
                </p>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Puspakom B7 Untuk Apa? (Pinjaman Sewa Beli)</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Puspakom B7</span>
                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>RM 60</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65 }}>
                  Pemeriksaan sewa beli. Bank atau syarikat kewangan minta laporan ini sebelum meluluskan pinjaman untuk kereta terpakai.
                </p>
              </div>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>B7 diperlukan apabila <strong style={{ color: '#111827' }}>pembeli mengambil pinjaman sewa beli (hire purchase) untuk membeli kereta terpakai itu</strong>. Ia lebih menyeluruh daripada B5, sebab itu yurannya dua kali ganda:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Semua yang diperiksa dalam B5',
                  'Pemeriksaan identiti kenderaan yang lebih mendalam',
                  'Pemeriksaan fizikal keadaan dan keselamatan, termasuk brek',
                  'Tujuannya: bank perlu yakin kereta yang menjadi cagaran pinjaman itu tulen dan dalam keadaan baik',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151' }}>
                    <CheckCircle size={13} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Info size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
                <p style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                  Nak tahu sama ada kereta itu masih ada baki loan penjual? Itu bukan kerja B7. Minta penjual tunjuk surat penyelesaian daripada bank. Selagi bank belum melepaskan tuntutannya ke atas kereta itu, pindah milik tidak boleh dibuat.
                </p>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Proses Pindah Milik Penuh (Urutan)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { step: '1', label: 'Selesaikan baki pinjaman', desc: 'Dapatkan surat penyelesaian hutang dari bank jika kenderaan pernah ada HP.' },
                  { step: '2', label: 'Pemeriksaan B5 (dan B7 jika ambil loan)', desc: 'Tempah di Puspakom atau pusat MV15 yang dilantik. B5 dan B7 boleh dibuat pada hari yang sama.' },
                  { step: '3', label: 'Dapatkan insurans baharu', desc: 'Pembeli perlu ada polisi insurans atas nama mereka sebelum JPJ boleh proses pindah milik.' },
                  { step: '4', label: 'JPJ Pindah Milik (RM 100)', desc: 'Penjual dan pembeli sahkan biometrik, kemudian JPJ proses tukar nama. Buat sebelum laporan B5 tamat tempoh.' },
                  { step: '5', label: 'Renew road tax', desc: 'Selepas pindah milik selesai, renew road tax atas nama pembeli baharu.' },
                  { step: '6', label: 'Semak rekod baharu', desc: 'Pastikan nama pembeli kini tertera sebagai pemilik dalam rekod JPJ (aplikasi MyJPJ).' },
                ].map(({ step, label, desc }) => (
                  <div key={step} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dc2626', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      {step}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 4px' }}>{label}</p>
                      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Di Mana Boleh Buat Puspakom?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                Tempah melalui laman web rasmi Puspakom. Sejak 2025, Kementerian Pengangkutan juga melantik pusat pemeriksaan MV15 (B5) selain Puspakom, iaitu Carro, Carsome Academy, Wawasan Bintang dan Beriman Gold, dengan yuran yang sama. Pemeriksaan B7 masih dibuat di Puspakom.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                <strong style={{ color: '#111827' }}>Tip:</strong> Buat B5 hanya selepas tarikh pindah milik hampir pasti. Laporan sah 120 hari, dan jika tamat tempoh anda perlu bayar dan periksa semula.
              </p>
            </section>

            {/* FAQ */}
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

            {/* Read more */}
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Baca Seterusnya</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                {[
                  { to: '/articles/cara-pindah-milik-kereta-mysikap', cat: 'Pindah Milik', title: 'Cara Pindah Milik Kereta Online Guna MySikap 2026' },
                  { to: '/articles/beza-kereta-recon-dan-terpakai', cat: 'Panduan Beli', title: 'Beza Kereta Recon & Terpakai — Mana Lebih Berbaloi?' },
                ].map(({ to, cat, title }) => (
                  <Link key={to} to={to} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, textDecoration: 'none', display: 'block' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 8 }}>{cat}</p>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, lineHeight: 1.4, margin: '0 0 8px' }}>{title}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Baca panduan →</p>
                  </Link>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Cari Kereta Terpakai Terpercaya</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Setiap penjual di XDrive disemak oleh pasukan kami sebelum boleh menyiarkan kereta. Minta laporan Puspakom B5 daripada penjual sebelum anda bayar deposit.
              </p>
              <Link to="/showroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat Kereta Tersedia
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

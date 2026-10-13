import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

// Every price below is either an official launch price (sourced) or an asking
// price on XDrive on the snapshot date. Nothing here promises a price, loan
// rate or approval. The live numbers are on the hub page, which this links to.
const ARTICLE = {
  slug: 'harga-alphard-recon-malaysia',
  title: 'Harga Toyota Alphard Recon di Malaysia (2026): 2.5 SC vs 2.5 Z',
  description:
    'Berapa harga Alphard recon sekarang, beza gred 2.5 SC (AH30) dan 2.5 Z (AH40), harga rasmi UMW Toyota sebagai perbandingan, dan apa perlu disemak sebelum bayar deposit.',
  datePublished: '2026-10-13',
  dateModified: '2026-10-13',
  readMins: 7,
};

const HUB = '/used-cars/toyota/alphard';

const FAQS = [
  {
    q: 'Berapa harga Toyota Alphard recon di Malaysia?',
    a: 'Pada 13 Oktober 2026, harga diminta untuk Alphard di XDrive ialah RM193,000 hingga RM212,000 untuk unit 2.5 SC tahun 2021 hingga 2023, dan RM274,000 hingga RM299,000 untuk unit 2.5 Z tahun 2024 dan 2025. Ini harga yang diminta oleh penjual, bukan harga muktamad. Harga terkini ada di halaman Toyota Alphard XDrive.',
  },
  {
    q: 'Apa beza Alphard 2.5 SC dan 2.5 Z?',
    a: 'Dalam iklan recon, 2.5 SC ialah gred generasi AH30 (kod model AGH30W, enjin petrol 2.5 liter 2AR-FE dengan CVT). 2.5 Z yang dijual hari ini kebanyakannya generasi baharu AH40, yang mula dijual di Jepun pada 21 Jun 2023 (kod model petrol AGH40W). Semak kod model pada laporan lelong atau geran untuk tahu generasi sebenar.',
  },
  {
    q: 'Berapa harga Alphard baharu dari UMW Toyota?',
    a: 'UMW Toyota melancarkan Alphard AH40 di Malaysia pada Oktober 2023 dalam satu varian, Alphard 2.4T Executive Lounge, pada RM538,000 tanpa insurans. Vellfire 2.5 dilancarkan pada masa yang sama pada RM438,000. Harga ini mungkin telah berubah sejak itu.',
  },
  {
    q: 'Adakah Alphard recon ada waranti Toyota?',
    a: 'Alphard recon tidak datang dengan waranti pengeluar UMW Toyota. Waranti panjang yang disebut dalam iklan datang dari dealer atau syarikat waranti pihak ketiga. Minta buku waranti, baca apa yang dilindungi, had tuntutan, dan syarat servis sebelum bayar.',
  },
  {
    q: 'Adakah XDrive memeriksa Alphard yang dijual?',
    a: 'Tidak. XDrive ialah platform jual beli dan tidak memeriksa mana-mana kereta. Minta laporan lelong asal, rekod servis dan buat pemeriksaan sendiri sebelum membayar deposit.',
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

const P = { color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 };
const H2 = { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 };
const STRONG = { color: '#111827' };
const LINK = { color: '#dc2626' };
const TH = { textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', padding: '8px 8px 8px 0', borderBottom: '1px solid #e5e7eb' };
const TD = { padding: '10px 8px 10px 0', borderBottom: '1px solid #f3f4f6', color: '#111827' };

const SNAPSHOT = [
  { year: '2025', grade: '2.5 Z', price: 'RM295,000 – RM299,000', km: '1,819 – 2,510 km', n: 2 },
  { year: '2024', grade: '2.5 Z', price: 'RM274,000 – RM287,000', km: '3,000 – 17,612 km', n: 4 },
  { year: '2023', grade: '2.5 SC', price: 'RM212,000', km: '26,834 km', n: 1 },
  { year: '2022', grade: '2.5 SC', price: 'RM205,000', km: '31,670 km', n: 1 },
  { year: '2021', grade: '2.5 SC', price: 'RM193,000', km: '30,756 km', n: 1 },
];

export default function HargaAlphardReconArticle() {
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

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: 'var(--xd-font-body)' }}>
        <MarketplaceHeader />

        <main style={{ paddingTop: 72, maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Laman Utama</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Panduan</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Harga Alphard Recon</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Beli
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Harga Toyota Alphard Recon:<br />
              <span style={{ color: '#dc2626' }}>2.5 SC vs 2.5 Z</span>
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
              <p style={P}>
                <strong style={STRONG}>Jawapan ringkas:</strong> pada 13 Oktober 2026, Alphard recon di XDrive diminta antara <strong style={STRONG}>RM193,000 dan RM212,000</strong> untuk gred 2.5 SC (2021 hingga 2023), dan antara <strong style={STRONG}>RM274,000 dan RM299,000</strong> untuk gred 2.5 Z (2024 dan 2025). Jurang besar itu kebanyakannya bukan soal tahun, tetapi soal generasi: SC ialah model lama, Z ialah model baharu.
              </p>
              <p style={P}>
                Harga di bawah ialah harga yang diminta oleh penjual pada tarikh itu, bukan harga pasaran rasmi dan bukan harga muktamad. Untuk senarai terkini, lihat <Link to={HUB} style={LINK}>semua Toyota Alphard dijual di XDrive</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>Harga Alphard Recon Ikut Tahun (13 Oktober 2026)</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 16px 4px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr><th style={TH}>Tahun</th><th style={TH}>Gred</th><th style={TH}>Harga diminta</th><th style={TH}>Jarak</th></tr>
                  </thead>
                  <tbody>
                    {SNAPSHOT.map((r) => (
                      <tr key={r.year}>
                        <td style={TD}>{r.year}</td>
                        <td style={TD}>{r.grade}</td>
                        <td style={TD}>{r.price}</td>
                        <td style={TD}>{r.km}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, fontSize: 13, marginTop: 10 }}>
                Sumber: iklan aktif di XDrive pada 13 Oktober 2026, {SNAPSHOT.reduce((a, r) => a + r.n, 0)} kereta. Satu unit 2025 diiklankan sebagai terpakai (sudah didaftar di Malaysia), selebihnya recon.
              </p>
            </section>

            <section>
              <h2 style={H2}>2.5 SC vs 2.5 Z: Dua Generasi Berbeza</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <p style={{ fontWeight: 600, color: '#111827', fontSize: 15, margin: '0 0 8px' }}>2.5 SC: generasi AH30</p>
                <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  &quot;SC&quot; dalam iklan merujuk gred S &quot;C Package&quot; generasi AH30 (kod model AGH30W). Enjinnya petrol 2.5 liter 2AR-FE dengan gear CVT. Generasi ini dijual di Jepun sehingga model baharu dilancarkan pada pertengahan 2023, jadi unit SC 2021 hingga 2023 ialah antara AH30 yang terakhir.
                </p>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <p style={{ fontWeight: 600, color: '#111827', fontSize: 15, margin: '0 0 8px' }}>2.5 Z: generasi AH40</p>
                <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  Toyota mula menjual Alphard dan Vellfire generasi baharu di Jepun pada 21 Jun 2023, dalam versi petrol dan hibrid. Dalam spesifikasi rasmi Toyota Jepun, gred petrol membawa kod model AGH40W (dua roda) dan hibrid AAHH40W. Kebanyakan iklan &quot;2.5 Z&quot; tahun 2024 dan 2025 ialah AH40 petrol.
                </p>
              </div>
              <p style={P}>
                <strong style={STRONG}>Cara pasti:</strong> jangan bergantung pada nama gred dalam iklan. Minta laporan lelong (auction report) dan semak kod model di situ dan pada geran. AGH30W bermaksud AH30, AGH40W bermaksud AH40. Dua kereta dengan tahun yang sama boleh jadi dari generasi berbeza.
              </p>
            </section>

            <section>
              <h2 style={H2}>Harga Rasmi UMW Toyota Sebagai Perbandingan</h2>
              <p style={P}>
                UMW Toyota melancarkan Alphard AH40 di Malaysia pada Oktober 2023 dengan satu varian sahaja: <strong style={STRONG}>Alphard 2.4T Executive Lounge pada RM538,000</strong> tanpa insurans, import penuh dari Jepun. Vellfire 2.5 dilancarkan bersama pada RM438,000. Harga ini mungkin telah berubah sejak pelancaran.
              </p>
              <p style={P}>
                Unit rasmi dan unit recon bukan kereta yang sama. Unit rasmi datang dengan waranti pengeluar dan sokongan pengedar rasmi. Unit recon biasanya gred lain (contohnya 2.5 Z petrol, bukan 2.4T Executive Lounge) dan dijual oleh pengimport. Bandingkan gred dengan gred, bukan nama model sahaja.
              </p>
            </section>

            <section>
              <h2 style={H2}>Apa Perlu Semak Sebelum Bayar Deposit</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Laporan lelong asal', desc: 'Minta salinan laporan lelong Jepun. Ia menunjukkan gred keadaan, jarak semasa dilelong, kod model dan tanda kerosakan. Bandingkan jarak dalam laporan dengan meter kereta.' },
                  { label: 'Kod model dan gred', desc: 'Pastikan kod model (AGH30W atau AGH40W) sepadan dengan gred dan harga yang diiklankan.' },
                  { label: 'Buku waranti bertulis', desc: 'Waranti recon datang dari dealer atau syarikat pihak ketiga, bukan UMW Toyota. Baca apa yang dilindungi, had tuntutan setiap kali, dan syarat servis.' },
                  { label: 'Pemeriksaan bebas', desc: 'Bawa kereta ke bengkel atau pemeriksa yang anda pilih sendiri, terutamanya pintu gelangsar elektrik, aircond belakang dan kerosakan air.' },
                  { label: 'Sebut harga pinjaman', desc: 'Mulai 1 Jun 2026, pinjaman sewa beli baharu dikira dengan EIR atas baki berkurangan. Minta sebut harga bertulis daripada bank dan semak bayaran bulanan sendiri.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...P, marginTop: 12 }}>
                Kira anggaran bayaran bulanan dengan <Link to="/calculator" style={LINK}>kalkulator pinjaman kereta</Link>, dan baca <Link to="/articles/akta-sewa-beli-2026-eir-pinjaman-kereta" style={LINK}>apa yang berubah di bawah Akta Sewa Beli 2026</Link>. Bank yang menentukan kelulusan dan kadar.
              </p>
            </section>

            <section>
              <h2 style={H2}>Senarai Semak Ringkas</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Laporan lelong asal dengan kod model',
                  'Jarak dalam laporan sama dengan meter',
                  'Gred dan harga sepadan dengan generasi',
                  'Buku waranti dealer, dibaca penuh',
                  'Pemeriksaan oleh bengkel pilihan sendiri',
                  'Sebut harga pinjaman bertulis (EIR)',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
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
                  { to: '/articles/beza-kereta-recon-dan-terpakai', cat: 'Panduan Beli', title: 'Beza Kereta Recon & Terpakai — Mana Lebih Berbaloi?' },
                  { to: '/articles/harga-harrier-recon-malaysia', cat: 'Panduan Beli', title: 'Harga Toyota Harrier Recon: 2.0 Petrol vs Hybrid Rasmi' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Toyota Alphard Dijual Di XDrive</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Harga diminta ikut tahun, jarak dan lokasi, dikemas kini setiap kali penjual menukar iklan. Hubungi penjual terus.
              </p>
              <Link to={HUB} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat Alphard dijual
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

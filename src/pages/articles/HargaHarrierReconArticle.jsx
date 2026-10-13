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
  slug: 'harga-harrier-recon-malaysia',
  title: 'Harga Toyota Harrier Recon di Malaysia (2026): 2.0 Petrol vs Hybrid Rasmi',
  description:
    'Berapa harga Harrier recon 2.0 sekarang, beza gred S, G dan Z, harga Harrier 2.5 Hybrid rasmi UMW Toyota, dan apa perlu disemak sebelum bayar deposit.',
  datePublished: '2026-10-13',
  dateModified: '2026-10-13',
  readMins: 6,
};

const HUB = '/used-cars/toyota/harrier';

const FAQS = [
  {
    q: 'Berapa harga Toyota Harrier recon di Malaysia?',
    a: 'Pada 13 Oktober 2026, sembilan Harrier 2.0 G recon tahun 2025 diiklankan di XDrive dengan harga diminta RM182,000 hingga RM185,000, jarak 2,570 hingga 15,624 km. Ini harga yang diminta oleh penjual, bukan harga muktamad. Harga terkini ada di halaman Toyota Harrier XDrive.',
  },
  {
    q: 'Apa beza Harrier gred S, G dan Z?',
    a: 'Untuk Harrier generasi semasa (XU80) yang dilancarkan di Jepun pada 17 Jun 2020, versi petrol 2.0 liter (enjin M20A-FKS dengan Direct Shift-CVT) ditawarkan dalam gred S, G dan Z, dengan pilihan Leather Package untuk G dan Z. S ialah gred asas dan Z yang tertinggi. Semak senarai kelengkapan sebenar kereta, bukan nama gred sahaja.',
  },
  {
    q: 'Berapa harga Harrier baharu dari UMW Toyota?',
    a: 'Pada Mac 2026, UMW Toyota melancarkan Harrier 2.5 Hybrid pada RM289,000 atas jalan, dan ia menggantikan versi petrol 2.0 liter sebagai satu-satunya Harrier rasmi. Harga ini mungkin telah berubah sejak itu.',
  },
  {
    q: 'Adakah Harrier recon ada waranti Toyota?',
    a: 'Harrier recon tidak datang dengan waranti pengeluar UMW Toyota. Waranti dalam iklan datang dari dealer atau syarikat pihak ketiga. Minta buku waranti dan baca apa yang dilindungi sebelum bayar.',
  },
  {
    q: 'Adakah XDrive memeriksa Harrier yang dijual?',
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
  { year: '2025', grade: '2.0 G', price: 'RM182,000 – RM185,000', km: '2,570 – 15,624 km', n: 9 },
];

export default function HargaHarrierReconArticle() {
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
            <span style={{ color: '#6b7280' }}>Harga Harrier Recon</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Beli
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Harga Toyota Harrier Recon:<br />
              <span style={{ color: '#dc2626' }}>2.0 Petrol vs Hybrid Rasmi</span>
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
                <strong style={STRONG}>Jawapan ringkas:</strong> pada 13 Oktober 2026, Harrier 2.0 G recon tahun 2025 di XDrive diminta antara <strong style={STRONG}>RM182,000 dan RM185,000</strong>. Harrier rasmi UMW Toyota hari ini ialah 2.5 Hybrid pada <strong style={STRONG}>RM289,000</strong> atas jalan semasa pelancaran. Jadi soalan sebenar bukan &quot;recon atau rasmi&quot;, tetapi &quot;petrol 2.0 recon atau hibrid 2.5 rasmi&quot;.
              </p>
              <p style={P}>
                Harga di bawah ialah harga yang diminta oleh penjual pada tarikh itu, bukan harga pasaran rasmi dan bukan harga muktamad. Untuk senarai terkini, lihat <Link to={HUB} style={LINK}>semua Toyota Harrier dijual di XDrive</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>Harga Harrier Recon (13 Oktober 2026)</h2>
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
                Sumber: iklan aktif di XDrive pada 13 Oktober 2026, {SNAPSHOT.reduce((a, r) => a + r.n, 0)} kereta, semuanya recon. Jurang harga yang kecil (RM3,000) antara unit yang sama tahun dan gred bermakna jarak dan keadaan lebih penting daripada harga ketika memilih.
              </p>
            </section>

            <section>
              <h2 style={H2}>Gred S, G dan Z: Apa Bezanya</h2>
              <p style={P}>
                Toyota melancarkan Harrier generasi semasa (XU80) di Jepun pada 17 Jun 2020. Versi petrolnya menggunakan enjin 2.0 liter Dynamic Force M20A-FKS dengan Direct Shift-CVT, dalam tiga gred:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'S', desc: 'Gred asas.' },
                  { label: 'G', desc: 'Gred tengah, dengan pilihan Leather Package. Ini gred yang paling banyak diiklankan di XDrive sekarang.' },
                  { label: 'Z', desc: 'Gred tertinggi, juga dengan pilihan Leather Package.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>2.0 {label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
              <p style={P}>
                Senarai kelengkapan setiap gred boleh berbeza mengikut tahun dan pilihan kilang, jadi minta senarai kelengkapan atau laporan lelong kereta itu sendiri. Jangan bayar lebih untuk gred yang hanya disebut dalam tajuk iklan.
              </p>
            </section>

            <section>
              <h2 style={H2}>Recon 2.0 Petrol vs 2.5 Hybrid Rasmi</h2>
              <p style={P}>
                Pada Mac 2026, UMW Toyota melancarkan <strong style={STRONG}>Harrier 2.5 Hybrid pada RM289,000</strong> atas jalan, dan ia menggantikan versi petrol 2.0 liter sebagai satu-satunya Harrier rasmi. Harga ini mungkin telah berubah sejak pelancaran.
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Recon 2.0 G: harga diminta jauh lebih rendah, tetapi waranti datang dari dealer, bukan Toyota.',
                    'Hibrid rasmi: harga lebih tinggi, dengan waranti pengeluar dan servis di pengedar rasmi.',
                    'Harrier 2.0 petrol yang sudah didaftar di Malaysia (terpakai, bukan recon) boleh jadi unit rasmi UMW yang lama. Tanya penjual dan semak rekod servis.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 style={H2}>Apa Perlu Semak Sebelum Bayar Deposit</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Laporan lelong asal', desc: 'Minta salinan laporan lelong Jepun. Ia menunjukkan gred keadaan, jarak semasa dilelong dan tanda kerosakan. Bandingkan jarak dalam laporan dengan meter kereta.' },
                  { label: 'Gred dan kelengkapan', desc: 'Pastikan gred (S, G atau Z) dan Leather Package dalam laporan sepadan dengan iklan dan harga.' },
                  { label: 'Buku waranti bertulis', desc: 'Waranti recon datang dari dealer atau syarikat pihak ketiga, bukan UMW Toyota. Baca apa yang dilindungi, had tuntutan setiap kali, dan syarat servis.' },
                  { label: 'Pemeriksaan bebas', desc: 'Bawa kereta ke bengkel atau pemeriksa yang anda pilih sendiri sebelum bayar.' },
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
                  { to: '/articles/harga-alphard-recon-malaysia', cat: 'Panduan Beli', title: 'Harga Toyota Alphard Recon: 2.5 SC vs 2.5 Z' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Toyota Harrier Dijual Di XDrive</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Harga diminta ikut tahun, jarak dan lokasi, dikemas kini setiap kali penjual menukar iklan. Hubungi penjual terus.
              </p>
              <Link to={HUB} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat Harrier dijual
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'apa-itu-puspakom-b5-b7',
  title: 'Apa Itu Puspakom B5 & B7? Panduan Penuh untuk Dealer & Pembeli (2026)',
  description:
    'Fahami perbezaan pemeriksaan Puspakom B5 dan B7, berapa kos sebenar, bila wajib dibuat, dan apa yang berlaku jika gagal. Panduan lengkap untuk pembeli dan penjual kereta terpakai Malaysia.',
  datePublished: '2026-06-13',
  dateModified: '2026-09-25',
  readMins: 6,
};

const FAQS = [
  {
    q: 'Adakah Puspakom B5 wajib untuk semua pindah milik kereta?',
    a: 'Ya. Puspakom B5 adalah pemeriksaan kelayakan jalan mandatori untuk semua kenderaan terpakai yang ingin menukar pemilik. Tanpa pas B5 yang sah, JPJ tidak akan proses pindah milik.',
  },
  {
    q: 'Berapa lama tempoh sah laporan Puspakom B5?',
    a: 'Laporan B5 sah selama 3 bulan dari tarikh pemeriksaan. Pastikan pindah milik selesai dalam tempoh ini atau anda perlu buat semula.',
  },
  {
    q: 'Apa yang diperiksa dalam Puspakom B7?',
    a: 'B7 memfokuskan pengesahan nombor siri enjin dan nombor casis untuk memastikan kenderaan tiada sebarang sekatan HP atau bebanan lain dari institusi kewangan sebelum pindah milik boleh diproses.',
  },
  {
    q: 'Bolehkah saya buat Puspakom tanpa hadir sendiri?',
    a: 'Untuk B5, kenderaan mesti hadir secara fizikal untuk pemeriksaan. Walau bagaimanapun, pemilik tidak semestinya hadir — pembantu atau wakil boleh membawa kenderaan atas nama pemilik.',
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

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "system-ui, sans-serif" }}>
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
              Apa Itu Puspakom B5 & B7?<br />
              <span style={{ color: '#dc2626' }}>Panduan Penuh 2026</span>
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
                'B5 = pemeriksaan kelayakan jalan (RM 30) — wajib untuk semua pindah milik',
                'B7 = pengesahan enjin/casis & sekatan HP (RM 60) — wajib jika kenderaan pernah ada pinjaman',
                'Kedua-dua pemeriksaan dilakukan di pusat Puspakom berdekatan',
                'Laporan B5 sah 3 bulan; B7 sah sepanjang proses pindah milik',
                'Gagal B5? Kenderaan perlu dibaiki dan diperiksa semula sebelum pindah milik',
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
                Puspakom (Pusat Pemeriksaan Kenderaan Motor) adalah agensi kerajaan Malaysia di bawah Kementerian Pengangkutan yang menjalankan pemeriksaan kenderaan bermotor. Terdapat beberapa jenis pemeriksaan Puspakom — yang paling relevan untuk urusan jual beli kereta terpakai ialah <strong style={{ color: '#111827' }}>B5</strong> dan <strong style={{ color: '#111827' }}>B7</strong>.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Kedua-dua pemeriksaan ini adalah <strong style={{ color: '#111827' }}>wajib</strong> sebelum JPJ akan memproses pindah milik kenderaan. Ini bermakna sama ada anda pembeli atau penjual, anda perlu memastikan semua pemeriksaan ini selesai dan lulus sebelum proses tukar nama boleh dimulakan.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Pemeriksaan B5: Kelayakan Jalan</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Puspakom B5</span>
                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>RM 30</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65 }}>
                  Pemeriksaan fizikal menyeluruh ke atas kenderaan untuk memastikan ia selamat dan layak untuk bergerak di jalan raya.
                </p>
              </div>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>B5 adalah pemeriksaan "kesihatan" kenderaan. Juruteknik Puspakom akan memeriksa lebih daripada 40 komponen merangkumi:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Sistem brek (brek kaki dan brek tangan)',
                  'Sistem suspensi dan stereng',
                  'Lampu hadapan, belakang, signal dan lampu brek',
                  'Tayar (kedalaman alur, tekanan, keadaan)',
                  'Ekzos dan tahap pelepasan asap',
                  'Wiper dan cermin pandang belakang',
                  'Badan kenderaan (tidak ada kerosakan struktur yang bahaya)',
                  'Meter dan speedometer berfungsi',
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
                  Jika kenderaan gagal B5, anda akan menerima laporan terperinci tentang komponen yang perlu dibaiki. Selepas pembaikan, kenderaan perlu datang semula untuk pemeriksaan ulang (bayaran semula dikenakan).
                </p>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Pemeriksaan B7: Pengesahan Enjin & Sekatan</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>Puspakom B7</span>
                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>RM 60</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65 }}>
                  Pengesahan nombor siri enjin, nombor casis, dan semakan sekiranya kenderaan masih ada baki pinjaman atau sekatan dari institusi kewangan.
                </p>
              </div>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>B7 diperlukan khas apabila kenderaan <strong style={{ color: '#111827' }}>pernah atau masih mempunyai pinjaman (hire purchase / HP)</strong>. Tujuannya adalah untuk:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Mengesahkan nombor enjin dan casis sepadan dengan dokumen JPJ',
                  'Memastikan kenderaan tidak lagi tertakluk kepada sekatan dari bank/syarikat kewangan',
                  'Mengelakkan penipuan di mana kenderaan dijual sebelum pinjaman diselesaikan',
                  'Melindungi pembeli daripada mewarisi hutang penjual',
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
                  Jika kenderaan tidak pernah ada pinjaman (bayar tunai terus), B7 mungkin tidak diperlukan. Semak dengan JPJ atau ejen pindah milik anda untuk pengesahan.
                </p>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Proses Pindah Milik Penuh (Urutan)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { step: '1', label: 'Selesaikan baki pinjaman', desc: 'Dapatkan surat penyelesaian hutang dari bank jika kenderaan pernah ada HP.' },
                  { step: '2', label: 'Puspakom B5 & B7', desc: 'Bawa kenderaan ke pusat Puspakom berdekatan. B5 dan B7 boleh dibuat serentak.' },
                  { step: '3', label: 'Dapatkan insurans baharu', desc: 'Pembeli perlu ada polisi insurans atas nama mereka sebelum JPJ boleh proses pindah milik.' },
                  { step: '4', label: 'JPJ Pindah Milik (RM 100)', desc: 'Kedua-dua pihak hadir secara biometrik ke JPJ dalam masa 7 hari dari tarikh jualan.' },
                  { step: '5', label: 'Renew road tax', desc: 'Selepas pindah milik selesai, renew road tax atas nama pembeli baharu.' },
                  { step: '6', label: 'Kumpul geran', desc: 'Dokumen geran (VOC) akan diterima dalam tempoh beberapa minggu.' },
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
                Puspakom mempunyai lebih 70 pusat pemeriksaan di seluruh Malaysia. Anda boleh cari cawangan terdekat melalui laman web rasmi Puspakom atau aplikasi MyJPJ. Kebanyakan pusat beroperasi dari Isnin hingga Sabtu, 8am–5pm.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                <strong style={{ color: '#111827' }}>Tip:</strong> Datang awal pagi atau buat temujanji terlebih dahulu untuk elakkan beratur panjang, terutama pada hari Isnin dan hujung bulan apabila permintaan tinggi.
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

import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-pindah-milik-kereta-mysikap',
  title: 'Cara Pindah Milik Kereta Online Guna MySikap 2026 — Panduan Lengkap',
  description:
    'Panduan langkah demi langkah cara buat pindah milik kereta secara online menggunakan sistem MySikap JPJ 2026. Dokumen diperlukan, kos, tempoh masa, dan tips mengelak kesilapan biasa.',
  datePublished: '2026-06-13',
  dateModified: '2026-09-25',
  readMins: 7,
};

const FAQS = [
  {
    q: 'Berapa lama proses pindah milik kereta mengambil masa?',
    a: 'Proses pindah milik biasanya mengambil masa 1-3 hari bekerja setelah semua dokumen lengkap dihantar melalui MySikap. Pembeli perlu menyelesaikan biometrik di kaunter JPJ dalam masa 7 hari dari tarikh jualan.',
  },
  {
    q: 'Adakah kedua-dua penjual dan pembeli perlu hadir ke JPJ?',
    a: 'Ya, untuk pengesahan biometrik (cap jari), kedua-dua penjual dan pembeli perlu hadir secara fizikal ke pejabat JPJ yang sama pada hari yang sama. Ini adalah langkah keselamatan untuk mengelak penipuan.',
  },
  {
    q: 'Apa yang berlaku jika pindah milik tidak selesai dalam 7 hari?',
    a: 'Jika pindah milik gagal diselesaikan dalam 7 hari dari tarikh penjualan, pembeli mungkin dikenakan kompaun dan proses perlu dimulakan semula. Sangat penting untuk bertindak pantas selepas urusan jual beli selesai.',
  },
  {
    q: 'Bolehkah saya pindah milik kereta tanpa ejen?',
    a: 'Ya, anda boleh buat sendiri melalui MySikap atau hadir terus ke kaunter JPJ. Namun, ramai yang menggunakan ejen kerana prosesnya melibatkan beberapa langkah dan kaunter berbeza. Ejen biasanya mengenakan caj RM 200–500 untuk perkhidmatan penuh.',
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

export default function MySikapArticle() {
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
            <span style={{ color: '#6b7280' }}>Pindah Milik MySikap</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Pindah Milik
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Pindah Milik Kereta<br />
              <span style={{ color: '#dc2626' }}>Guna MySikap 2026</span>
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
                'MySikap adalah sistem pindah milik kenderaan online oleh JPJ Malaysia',
                'Kos rasmi: RM 100 (pindah milik) + RM 30–60 Puspakom + urusan bank jika berkaitan',
                'Kedua-dua penjual & pembeli perlu hadir biometrik di JPJ',
                'Pembeli mesti selesaikan dalam 7 hari dari tarikh jualan',
                'Insurans atas nama pembeli diperlukan sebelum pindah milik boleh diproses',
              ].map((pt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151' }}>
                  <CheckCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Apa Itu MySikap?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                <strong style={{ color: '#111827' }}>MySikap (Sistem Kawalan Pendaftaran Kenderaan)</strong> adalah platform digital JPJ Malaysia yang membolehkan urusan pindah milik kenderaan bermotor dilakukan secara dalam talian. Ia memudahkan proses yang sebelum ini memerlukan banyak ulang-alik ke pejabat JPJ.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Walaupun sebahagian dokumen boleh dihantar secara digital, <strong style={{ color: '#111827' }}>kehadiran fizikal masih diperlukan</strong> untuk pengesahan biometrik (cap jari) di kaunter JPJ. Ini adalah langkah keselamatan penting untuk mengelak penipuan pindah milik.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Dokumen Yang Diperlukan</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                {[
                  {
                    title: 'Penjual Perlu Sedia',
                    items: ['MyKad (IC) asal + salinan', 'Geran kenderaan (VOC) asal', 'Surat penyelesaian hutang dari bank (jika ada HP)', 'Laporan Puspakom B5 & B7', 'Insurans yang masih sah'],
                    color: '#16a34a',
                  },
                  {
                    title: 'Pembeli Perlu Sedia',
                    items: ['MyKad (IC) asal + salinan', 'Polisi insurans baharu atas nama pembeli', 'Surat perjanjian jual beli (jika ada)', 'Surat kelulusan pinjaman (jika beli HP)', 'Bayaran RM 100 untuk pindah milik'],
                    color: '#2563eb',
                  },
                ].map(({ title, items, color }) => (
                  <div key={title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, marginBottom: 12 }}>{title}</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((doc, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                          <CheckCircle size={11} style={{ color, flexShrink: 0, marginTop: 2 }} />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Langkah Demi Langkah: Proses MySikap</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { num: '01', title: 'Selesaikan Pinjaman (Jika Ada)', desc: 'Jika kenderaan masih ada baki HP, penjual mesti dapatkan surat penyelesaian dari bank terlebih dahulu. Bank biasanya ambil 3–7 hari bekerja untuk keluarkan surat ini setelah bayaran diterima.', link: null },
                  { num: '02', title: 'Buat Puspakom B5 & B7', desc: 'Bawa kenderaan ke pusat Puspakom terdekat. Kedua-dua pemeriksaan boleh dibuat serentak. Kos: B5 = RM 30, B7 = RM 60. Laporan B5 sah 3 bulan.', link: { to: '/articles/apa-itu-puspakom-b5-b7', label: 'Baca panduan penuh kami tentang Puspakom B5 & B7' } },
                  { num: '03', title: 'Pembeli Dapatkan Insurans Baharu', desc: 'Pembeli perlu ada polisi insurans motor atas nama mereka sebelum pindah milik boleh diproses. Hubungi syarikat insurans atau ejen untuk dapatkan nota lindungan sementara.', link: null },
                  { num: '04', title: 'Akses MySikap & Muat Naik Dokumen', desc: 'Penjual log masuk ke portal MySikap (mysikap.jpj.gov.my) menggunakan MyKad digital atau kata laluan. Masukkan maklumat pembeli, nombor pendaftaran kenderaan, dan muat naik dokumen berkaitan.', link: null },
                  { num: '05', title: 'Kedua-dua Pihak Hadir ke JPJ (Biometrik)', desc: 'Penjual DAN pembeli perlu hadir ke pejabat JPJ yang sama pada hari yang sama untuk pengesahan cap jari. Ini tidak boleh dilakukan secara online.', link: null },
                  { num: '06', title: 'Bayar & Terima Slip Pindah Milik', desc: 'Bayar RM 100 di kaunter. JPJ akan proses pindah milik dan keluarkan slip pengesahan. Geran (VOC) baharu akan dihantar ke alamat pembeli dalam masa beberapa minggu.', link: null },
                ].map(({ num, title, desc, link }) => (
                  <div key={num} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: 'rgba(220,38,38,0.2)', lineHeight: 1, flexShrink: 0, fontFamily: "'Bebas Neue', sans-serif" }}>{num}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{title}</p>
                      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                      {link && (
                        <Link to={link.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 12, marginTop: 8, textDecoration: 'none' }}>
                          <ChevronRight size={11} />{link.label}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Kos Lengkap Pindah Milik</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 16px' }}>Item</th>
                      <th style={{ textAlign: 'right', color: '#6b7280', fontWeight: 500, padding: '12px 16px' }}>Kos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { item: 'Puspakom B5', cost: 'RM 30' },
                      { item: 'Puspakom B7 (jika ada HP)', cost: 'RM 60' },
                      { item: 'Pindah milik JPJ', cost: 'RM 100' },
                      { item: 'Insurans baharu (anggaran)', cost: 'RM 500 – 2,000+' },
                      { item: 'Ejen (jika guna)', cost: 'RM 200 – 500' },
                    ].map(({ item, cost }, i) => (
                      <tr key={item} style={{ borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ color: '#374151', padding: '12px 16px' }}>{item}</td>
                        <td style={{ color: '#111827', fontWeight: 600, textAlign: 'right', padding: '12px 16px' }}>{cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>* Kos boleh berbeza mengikut jenis kenderaan dan lokasi. Semak dengan JPJ untuk kadar terkini.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Tips Elak Kesilapan Biasa</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { type: 'warn', text: 'Pastikan alamat pada MyKad terkini — JPJ akan hantar geran ke alamat di MyKad pembeli.' },
                  { type: 'warn', text: 'Jangan tandatangan dokumen sebelum semua pemeriksaan Puspakom lulus — pembeli boleh enggan proses jika kenderaan gagal.' },
                  { type: 'info', text: 'Simpan semua resit dan dokumen sehingga geran baharu diterima. Ini penting jika timbul sebarang pertikaian.' },
                  { type: 'info', text: 'Semak nombor plat dan nombor siri enjin pada semua dokumen sebelum tanda tangan — kesilapan nombor boleh tangguhkan proses berminggu-minggu.' },
                ].map(({ type, text }, i) => (
                  <div key={i} style={{ background: type === 'warn' ? '#fffbeb' : '#eff6ff', border: `1px solid ${type === 'warn' ? '#fde68a' : '#bfdbfe'}`, borderRadius: 10, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {type === 'warn'
                      ? <AlertCircle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                      : <Info size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
                    }
                    <p style={{ color: type === 'warn' ? '#92400e' : '#1e40af', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{text}</p>
                  </div>
                ))}
              </div>
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
                  { to: '/articles/apa-itu-puspakom-b5-b7', cat: 'Puspakom', title: 'Apa Itu Puspakom B5 & B7? Panduan Penuh 2026' },
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
                Setiap penjual di XDrive disemak oleh pasukan kami sebelum boleh menyiarkan kereta. Tanya penjual sama ada mereka uruskan pindah milik untuk anda.
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

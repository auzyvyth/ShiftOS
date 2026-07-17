import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-kira-komisen-salesman-kereta',
  title: 'Cara Kira Komisen Salesman Kereta Dengan Betul (2026)',
  description:
    'Panduan cara kira komisen salesman kereta dengan betul untuk dealer Malaysia. Formula komisen, kesilapan biasa, dan cara buat rekod komisen salesmen kereta secara automatik guna app salesmen kereta.',
  datePublished: '2026-06-22',
  dateModified: '2026-06-22',
  readMins: 7,
};

const FAQS = [
  {
    q: 'Macam mana cara kira komisen salesman kereta?',
    a: 'Komisen salesman kereta biasanya dikira sama ada (1) peratusan tetap dari harga jual, (2) peratusan dari untung kasar (gross profit) unit, atau (3) jumlah tetap setiap unit terjual. Cara paling adil ialah berdasarkan untung kasar, kerana ia menyelaraskan motivasi salesman dengan keuntungan sebenar dealer.',
  },
  {
    q: 'Apa kesilapan biasa dalam kira komisen salesman?',
    a: 'Kesilapan biasa termasuk mengira komisen dari harga jual tanpa tolak kos recon dan kos handover, lupa kira semula bila ada diskaun, dan rekod manual yang menyebabkan pertikaian. Sistem automatik seperti ShiftOS mengelakkan semua ini dengan rekod komisen salesmen kereta yang tepat.',
  },
  {
    q: 'Boleh ke automasikan rekod komisen salesman?',
    a: 'Boleh. App salesmen kereta seperti ShiftOS mengira komisen secara automatik setiap kali deal ditutup — berdasarkan peraturan yang anda tetapkan. Ini dipanggil salesman commission tracking dan ia menghapuskan kiraan manual serta pertikaian gaji.',
  },
  {
    q: 'Berapa kadar komisen salesman kereta biasa di Malaysia?',
    a: 'Kadar berbeza mengikut dealer, tetapi lazimnya antara 10%–30% dari untung kasar unit, atau RM200–RM1,000 setiap unit untuk struktur tetap. Sesetengah dealer tambah bonus prestasi untuk salesman yang capai sasaran bulanan.',
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

export default function KomisenSalesmanArticle() {
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
            <span style={{ color: '#6b7280' }}>Komisen Salesman</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Kira Komisen Salesman<br />
              <span style={{ color: '#dc2626' }}>Kereta Dengan Betul</span>
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
                <strong style={{ color: '#111827' }}>Cara paling betul untuk kira komisen salesman kereta ialah berdasarkan untung kasar (gross profit) setiap unit</strong>, bukan harga jual semata-mata. Ini kerana harga jual tidak mengambil kira kos recon, komisen dan kos handover — jadi mengira komisen dari harga jual boleh menghakis margin dealer tanpa disedari.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Artikel ini menerangkan formula komisen, kesilapan biasa, dan cara buat rekod komisen salesmen kereta secara automatik.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>3 Struktur Komisen Yang Biasa Digunakan</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: '1. Peratusan dari untung kasar', desc: 'Contoh: 20% × (harga jual − kos beli − recon − komisen − handover). Paling adil — salesman didorong jaga margin, bukan sekadar tutup deal cepat.' },
                  { label: '2. Jumlah tetap setiap unit', desc: 'Contoh: RM500 setiap kereta terjual. Mudah difahami, tetapi tidak membezakan deal margin tinggi dan rendah.' },
                  { label: '3. Peratusan dari harga jual', desc: 'Contoh: 1% × harga jual. Berisiko — boleh bayar komisen tinggi walaupun untung sebenar unit rendah.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Contoh Pengiraan Komisen Berdasarkan Untung Kasar</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Harga jual', 'RM 75,000'],
                      ['Kos beli', '− RM 65,000'],
                      ['Kos recon', '− RM 2,000'],
                      ['Kos handover', '− RM 500'],
                      ['Untung kasar (gross)', 'RM 7,500'],
                      ['Komisen (20% × gross)', 'RM 1,500'],
                    ].map(([k, v], i, arr) => (
                      <tr key={k} style={{ fontWeight: k.includes('Untung') || k.includes('Komisen') ? 700 : 400 }}>
                        <td style={{ color: '#374151', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{k}</td>
                        <td style={{ color: k.includes('Komisen') ? '#dc2626' : '#111827', textAlign: 'right', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Kesilapan Biasa Yang Menghakis Margin</h2>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Kira komisen dari harga jual tanpa tolak kos recon & handover.',
                    'Lupa kira semula komisen apabila ada diskaun atau tukar harga.',
                    'Rekod manual di buku/Excel menyebabkan pertikaian gaji.',
                    'Tiada bukti jelas unit mana ditutup oleh salesman mana.',
                    'Komisen dibayar untuk deal yang sebenarnya rugi.',
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Cara Buat Rekod Komisen Salesmen Kereta Secara Automatik</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                Cara paling selamat ialah guna app salesmen kereta yang mengira komisen secara automatik. Dalam ShiftOS, setiap kali salesman menutup deal (lead bertukar status "won"), sistem terus menandakan kereta sebagai terjual, mengira untung kasar, dan mengira komisen salesman berdasarkan peraturan yang anda tetapkan.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Komisen dikira automatik setiap deal (salesman commission tracking car dealer)',
                  'Setiap unit jelas ditutup oleh salesman mana — tiada pertikaian',
                  'Laporan komisen bulanan setiap salesman',
                  'Diselaras dengan untung sebenar, bukan harga jual',
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
                  { to: '/articles/cara-urus-stok-kereta-terpakai-sistem-digital', cat: 'Urus Dealer', title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Automasikan Komisen Salesman Anda</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                ShiftOS kira komisen setiap deal secara automatik berdasarkan untung sebenar. Tiada lagi pertikaian gaji.
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

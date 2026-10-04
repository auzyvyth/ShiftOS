import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'beli-kereta-ev-terpakai-apa-perlu-semak',
  title: 'Beli Kereta EV Terpakai: Apa Perlu Semak Sebelum Bayar (2026)',
  description:
    'Panduan beli EV terpakai di Malaysia: cara semak kesihatan bateri (State of Health), waranti bateri bila pindah milik, cukai jalan EV 2026, insurans, pengecas di rumah dan susut nilai.',
  datePublished: '2026-10-03',
  dateModified: '2026-10-03',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Adakah waranti bateri EV boleh dipindah kepada pemilik kedua?',
    a: 'Bergantung pada jenama. Buku waranti rasmi Proton e.MAS untuk pasaran Malaysia menyatakan baki tempoh waranti boleh dipindah kepada pemilik seterusnya dengan mengisi borang di belakang buku servis dan menghantarnya ke alamat yang tertera (edisi 2025; unit 2026 mungkin berbeza). Untuk jenama lain, minta pengedar rasmi sahkan secara bertulis berdasarkan nombor casis kereta tersebut sebelum anda bayar.',
  },
  {
    q: 'Berapa cukai jalan kereta elektrik di Malaysia pada 2026?',
    a: 'Mulai 1 Januari 2026, fi lesen kenderaan motor (cukai jalan) untuk EV dikira berdasarkan kuasa motor elektrik dalam watt, bukan cc. Bagi blok pertama (1 hingga 100,000 watt), kadarnya antara RM20 hingga RM70 setahun. Kereta yang lebih berkuasa membayar lebih. Semak jumlah tepat untuk kereta yang anda mahu beli di MyJPJ atau kaunter JPJ.',
  },
  {
    q: 'Apa itu State of Health (SoH) bateri EV?',
    a: 'State of Health ialah ukuran baki kapasiti bateri berbanding semasa ia baharu, biasanya dalam peratus. Sebagai contoh, waranti bateri Proton e.MAS 7 dilaporkan menawarkan penggantian jika SoH jatuh bawah 70% dalam tempoh waranti. Minta laporan kesihatan bateri dari pusat servis sah jenama sebelum membeli.',
  },
  {
    q: 'Perlu ke pasang pengecas di rumah bila beli EV terpakai?',
    a: 'Tidak wajib, tetapi jika mahu pasang wallbox, panduan TNB menyatakan anda perlu melantik pendawai atau kontraktor elektrik berdaftar dengan Suruhanjaya Tenaga untuk semak jumlah beban elektrik rumah. Pengecas mesti guna litar khas sendiri dari papan agihan (DB). Jika jumlah beban melebihi 10 kW, bekalan perlu dinaik taraf kepada tiga fasa melalui permohonan kepada TNB.',
  },
  {
    q: 'Adakah XDrive memeriksa bateri kereta EV yang dijual?',
    a: 'Tidak. XDrive ialah platform jual beli; kami tidak memeriksa kesihatan bateri mana-mana kereta. Pembeli perlu minta laporan bateri sendiri dari penjual atau pusat servis sah jenama sebelum membuat bayaran.',
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

export default function EvTerpakaiArticle() {
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
            <span style={{ color: '#6b7280' }}>EV Terpakai</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Beli
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Beli Kereta EV Terpakai:<br />
              <span style={{ color: '#dc2626' }}>Apa Perlu Semak Sebelum Bayar</span>
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
                <strong style={STRONG}>Perkara paling penting bila beli EV terpakai ialah bateri</strong>: berapa banyak kapasiti yang tinggal, dan sama ada waranti bateri masih berjalan untuk anda sebagai pemilik baharu. Enjin kereta petrol boleh didengar dan dirasa semasa pandu uji. Bateri EV tidak. Anda perlukan laporan dan dokumen.
              </p>
              <p style={P}>
                Panduan ini menerangkan apa yang perlu disemak sebelum anda bayar deposit: kesihatan bateri, pindah milik waranti, cukai jalan EV 2026, insurans, pengecas di rumah, dan harga.
              </p>
            </section>

            <section>
              <h2 style={H2}>Kenapa Lebih Banyak EV Terpakai di Pasaran Sekarang?</h2>
              <p style={P}>
                Jualan EV baharu di Malaysia naik dengan cepat. Menurut data Persatuan Automotif Malaysia (MAA), 30,848 kereta elektrik bateri baharu dijual pada 2025, naik 109% berbanding 2024. Kereta yang dibeli pada 2023 hingga 2025 inilah yang mula ditukar ganti oleh pemilik pertama, jadi pilihan EV berumur satu hingga tiga tahun semakin banyak.
              </p>
              <p style={P}>
                Satu lagi sebab: pengecualian duti import dan duti eksais untuk EV import penuh (CBU) tamat pada 31 Disember 2025, dan Kementerian Kewangan mengesahkan ia tidak dilanjutkan. Laporan industri mengaitkan lonjakan jualan pada hujung 2025 dengan pembeli yang mengejar insentif ini sebelum tamat. EV pasang siap tempatan (CKD) pula masih menikmati pengecualian sehingga 31 Disember 2027.
              </p>
            </section>

            <section>
              <h2 style={H2}>Cara Semak Kesihatan Bateri EV Terpakai (State of Health)</h2>
              <p style={P}>
                <strong style={STRONG}>State of Health (SoH)</strong> ialah baki kapasiti bateri berbanding semasa ia baharu, biasanya dalam peratus. Bateri dengan SoH lebih rendah menyimpan tenaga lebih sedikit, jadi jarak perjalanan sekali cas juga lebih pendek.
              </p>
              <p style={P}>
                Angka SoH juga penting untuk waranti. Contohnya, waranti bateri Proton e.MAS 7 selama 8 tahun atau 160,000 km dilaporkan menawarkan penggantian satu-ke-satu jika SoH jatuh bawah 70% dalam tempoh waranti.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Minta laporan bateri dari pusat servis sah', desc: 'Minta penjual bawa kereta ke pusat servis sah jenama untuk diagnostik bateri, atau minta salinan laporan terkini. Laporan dari bengkel yang tidak dikenali lebih sukar disahkan.' },
                  { label: 'Semak rekod servis bercop', desc: 'Waranti biasanya bersyarat pada servis berkala di pusat sah. Rekod yang tidak lengkap boleh menjejaskan tuntutan waranti anda nanti.' },
                  { label: 'Tanya bagaimana kereta dicas', desc: 'Tanya pemilik sama ada kereta kebanyakannya dicas di rumah atau di pengecas laju DC awam, dan untuk apa kereta digunakan (peribadi atau komersial).' },
                  { label: 'Pandu uji dengan bateri penuh', desc: 'Lihat anggaran jarak di skrin semasa bateri hampir penuh, dan bandingkan dengan spesifikasi asal model tersebut.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={H2}>Waranti Bateri EV Bila Pindah Milik: Masih Sah Atau Tidak?</h2>
              <p style={P}>
                Jangan anggap waranti bateri ikut kereta secara automatik. Syaratnya berbeza mengikut jenama, dan ada yang memerlukan anda membuat sesuatu selepas pindah milik.
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <p style={{ fontWeight: 600, color: '#111827', fontSize: 15, margin: '0 0 8px' }}>Proton e.MAS 7</p>
                <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  Bateri dan unit motor elektrik e.MAS 7 dilindungi waranti 8 tahun atau 160,000 km. Buku waranti dan servis rasmi untuk pasaran Malaysia menyatakan baki tempoh waranti boleh dipindah kepada pemilik seterusnya dengan mengisi borang pertukaran alamat/pemilikan di belakang buku servis dan menghantarnya ke alamat yang tertera (edisi 2025). Unit 2026 mungkin berbeza; minta pengedar sahkan berdasarkan nombor casis. Waranti juga bersyarat pada servis berkala yang dicop oleh pengedar sah Proton e.MAS. Menurut laporan media, polisi waranti ini tidak terpakai untuk kenderaan yang digunakan secara komersial.
                </p>
              </div>
              <p style={P}>
                Untuk jenama lain seperti BYD, Tesla atau Volvo, kami tidak dapat mengesahkan syarat pindah milik waranti bateri daripada dokumen waranti rasmi untuk pasaran Malaysia, jadi kami tidak menyenaraikannya di sini. Jika anda mencari BYD terpakai atau mana-mana jenama lain, berikan nombor casis kepada pengedar rasmi dan minta mereka sahkan secara bertulis: tarikh mula waranti, baki tempoh dan jarak, dan apa yang perlu dibuat selepas pindah milik.
              </p>
            </section>

            <section>
              <h2 style={H2}>Cukai Jalan EV 2026: Berapa Perlu Bayar?</h2>
              <p style={P}>
                Pengecualian cukai jalan EV sudah tamat. Mulai 1 Januari 2026, kadar fi Lesen Kenderaan Motor (LKM) untuk kenderaan elektrik ditetapkan berdasarkan kuasa motor elektrik, seperti diumumkan oleh Menteri Pengangkutan Anthony Loke. Kadar dibahagi kepada blok kuasa; blok pertama meliputi motor 1 hingga 100,000 watt, dengan kadar minimum RM20 dan maksimum RM70 setahun. Kereta dengan motor lebih berkuasa jatuh dalam blok lebih tinggi dan membayar lebih.
              </p>
              <p style={P}>
                Jadi sebelum beli, semak kuasa motor (kW) kereta dalam spesifikasi rasmi kereta, kemudian semak jumlah cukai jalan sebenar melalui MyJPJ. Ini lebih tepat daripada senarai di internet.
              </p>
            </section>

            <section>
              <h2 style={H2}>Insurans Kereta Elektrik Terpakai</h2>
              <p style={P}>
                Sejak pasaran insurans motor diliberalisasikan oleh Bank Negara Malaysia (harga premium komprehensif dan pihak ketiga, kebakaran dan kecurian bebas daripada tarif mulai 1 Julai 2017), premium tidak lagi tetap. Syarikat insurans boleh mengambil kira faktor seperti jenama dan model kereta, ciri keselamatan, pengalaman pemandu, lokasi dan rekod kesalahan trafik.
              </p>
              <p style={P}>
                Beberapa syarikat insurans di Malaysia kini menawarkan tambahan khusus EV, contohnya perlindungan untuk pengecas dinding di rumah dan kabel pengecas mudah alih. Minta sebut harga daripada beberapa syarikat sebelum tandatangan perjanjian jual beli, kerana premium boleh berbeza mengikut model.
              </p>
            </section>

            <section>
              <h2 style={H2}>Pengecas Di Rumah: Semak Sebelum Beli</h2>
              <p style={P}>
                Jika anda mahu cas di rumah dengan wallbox, panduan pelanggan TNB menyatakan perkara berikut:
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Lantik pendawai atau kontraktor elektrik berdaftar dengan Suruhanjaya Tenaga untuk semak jumlah beban elektrik rumah termasuk pengecas.',
                    'Pengecas mesti disambung melalui litar khas sendiri dari papan agihan (DB).',
                    'Bekalan satu fasa sesuai untuk penggunaan sehingga 10 kW; melebihi itu, rumah perlu dinaik taraf ke tiga fasa melalui permohonan kepada TNB.',
                    'Kelulusan TNB tidak diperlukan untuk pasang pengecas itu sendiri, kecuali jika perlu naik taraf bekalan.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ ...P, marginTop: 12 }}>
                Tanya juga penjual sama ada pengecas mudah alih atau kabel asal disertakan bersama kereta. Jika tiada, masukkan kosnya dalam bajet anda.
              </p>
            </section>

            <section>
              <h2 style={H2}>Susut Nilai EV: Bagaimana Nak Tahu Harga Berpatutan</h2>
              <p style={P}>
                Harga EV terpakai bergerak mengikut harga EV baharu. Bila model baharu atau versi yang dikemas kini dilancarkan, atau harga kereta baharu turun, harga unit terpakai biasanya ikut terkesan. Jadi sebelum tawar-menawar:
              </p>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Jangan bandingkan dengan harga asal masa kereta itu baharu. Bandingkan dengan harga model sama yang dijual baharu hari ini.',
                    'Bandingkan beberapa iklan untuk model, tahun dan varian bateri yang sama.',
                    'Ambil kira baki waranti bateri. Kereta dengan waranti yang sah dan boleh dipindah lebih bernilai.',
                    'Jangan bayar deposit sebelum laporan bateri dan status waranti disahkan.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <XCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: 4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ ...P, marginTop: 12 }}>
                Anda boleh lihat EV yang sedang dijual di <Link to="/showroom?fuel_type=Electric" style={{ color: '#dc2626' }}>showroom XDrive</Link> (pilih jenis bahan api Electric), dan kira anggaran bayaran bulanan dengan <Link to="/calculator" style={{ color: '#dc2626' }}>kalkulator pinjaman kereta</Link>. Ingat, XDrive ialah platform jual beli dan tidak memeriksa kesihatan bateri mana-mana kereta. Semakan bateri tetap tanggungjawab anda sebagai pembeli.
              </p>
            </section>

            <section>
              <h2 style={H2}>Senarai Semak Ringkas Beli EV Terpakai</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Laporan State of Health bateri dari pusat servis sah',
                  'Rekod servis lengkap dan bercop',
                  'Pengesahan bertulis status dan pindah milik waranti bateri',
                  'Kuasa motor (kW) dan jumlah cukai jalan 2026',
                  'Sebut harga insurans, termasuk tambahan EV',
                  'Kemampuan bekalan elektrik rumah untuk pengecas',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ ...P, marginTop: 12 }}>
                Sedang pertimbangkan EV import terpakai berbanding unit tempatan? Baca juga <Link to="/articles/beza-kereta-recon-dan-terpakai" style={{ color: '#dc2626' }}>beza kereta recon dan terpakai</Link>.
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Cari EV Terpakai Di XDrive</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Tapis showroom ikut jenis bahan api Electric, kemudian hubungi penjual terus. Minta laporan bateri sebelum anda bayar deposit.
              </p>
              <Link to="/showroom?fuel_type=Electric" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat EV di showroom
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

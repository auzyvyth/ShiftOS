import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'beza-kereta-recon-dan-terpakai',
  title: 'Beza Kereta Recon & Terpakai — Mana Lebih Berbaloi? (2026)',
  description:
    'Apa beza kereta recon dan kereta terpakai di Malaysia? Panduan lengkap tentang kelebihan, kelemahan, kos tersembunyi, dan mana yang lebih berbaloi untuk pembeli Malaysia 2026.',
  datePublished: '2026-06-13',
  dateModified: '2026-06-13',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Adakah kereta recon lebih murah daripada kereta baharu?',
    a: 'Tidak semestinya. Kereta recon import mewah (BMW, Mercedes, Lexus) boleh lebih murah berbanding CBU baharu, tetapi dengan pendedahan cukai import dan kos pematuhan, harganya masih signifikan. Untuk model biasa seperti Toyota atau Honda, perbezaan harga antara recon dan baharu mungkin kecil sahaja.',
  },
  {
    q: 'Berapa lama biasanya kereta recon boleh digunakan?',
    a: 'Kereta recon dari Jepun biasanya berumur 3–5 tahun dengan jarak bawah 50,000 km. Jika diselenggara dengan baik, boleh digunakan 10–15 tahun lebih. Kunci utama adalah rekod servis yang lengkap dan pemeriksaan menyeluruh sebelum beli.',
  },
  {
    q: 'Apakah maksud "Recond" pada iklan kereta?',
    a: '"Recond" atau "Recon" merujuk kepada kenderaan yang diimport dari luar negara (biasanya Jepun) sebagai unit terpakai, kemudian melalui proses pemulihan (reconditioning) sebelum dijual di Malaysia. Kenderaan ini memerlukan proses kastam dan homologasi JPJ.',
  },
  {
    q: 'Bolehkah kereta recon dapat waranti?',
    a: 'Kereta recon tidak mendapat waranti pengeluar seperti kereta baharu. Walau bagaimanapun, sesetengah dealer menawarkan waranti dealer mereka sendiri (biasanya 3–12 bulan). Anda juga boleh beli extended warranty pihak ketiga untuk perlindungan tambahan.',
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

export default function ReconArticle() {
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
            <span style={{ color: '#6b7280' }}>Recon vs Terpakai</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Panduan Beli Kereta
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Beza Kereta Recon<br />
              <span style={{ color: '#dc2626' }}>& Terpakai 2026</span>
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
          </header>

          {/* Recon vs local comparison header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <p style={{ color: '#1d4ed8', fontWeight: 900, fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", margin: '0 0 4px' }}>RECON</p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 2px' }}>Import dari luar negara</p>
              <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>(Biasanya dari Jepun)</p>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <p style={{ color: '#15803d', fontWeight: 900, fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", margin: '0 0 4px' }}>TERPAKAI</p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 2px' }}>Pasaran tempatan Malaysia</p>
              <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>(CBU atau CKD lokal)</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Apa Itu Kereta Recon?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75, marginBottom: 12 }}>
                <strong style={{ color: '#111827' }}>Kereta recon (reconditioned)</strong> adalah kenderaan yang diimport dari luar negara dalam keadaan terpakai, kemudian melalui proses pemulihan dan pemeriksaan sebelum dijual di pasaran tempatan. Majoriti kereta recon di Malaysia datang dari <strong style={{ color: '#111827' }}>Jepun</strong>, yang terkenal dengan sistem penguatkuasaan keselamatan kenderaan yang ketat dan rekod servis yang teliti.
              </p>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                Kereta recon Jepun biasanya mempunyai jarak rendah (bawah 50,000km) kerana peraturan Japan memerlukan pemilik bayar cukai tahunan yang tinggi setelah kenderaan berusia 3–5 tahun, mendorong ramai orang Jepun untuk menjual kereta lebih awal. Ini bermakna Malaysia mendapat kereta muda dengan jarak rendah pada harga yang lebih kompetitif.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Apa Itu Kereta Terpakai?</h2>
              <p style={{ color: '#4b5563', lineHeight: 1.75 }}>
                <strong style={{ color: '#111827' }}>Kereta terpakai</strong> adalah kenderaan yang sebelum ini dimiliki dan digunakan di Malaysia — sama ada model CBU (Completely Built-Up) yang diimport sebagai baharu, atau CKD (Completely Knocked Down) yang dipasang di Malaysia. Kenderaan ini mempunyai sejarah penggunaan tempatan dan boleh disemak rekod pendaftaran dan pindah milik melalui JPJ.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Perbandingan Terperinci</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', color: '#6b7280', fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid #e5e7eb', minWidth: 120 }}>Aspek</th>
                      <th style={{ textAlign: 'center', color: '#1d4ed8', fontWeight: 600, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Recon</th>
                      <th style={{ textAlign: 'center', color: '#15803d', fontWeight: 600, padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>Terpakai Tempatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { aspect: 'Asal usul', recon: 'Import (Jepun, UK, dll)', local: 'Pasaran Malaysia' },
                      { aspect: 'Jarak biasa', recon: '10,000–50,000 km', local: '20,000–150,000 km' },
                      { aspect: 'Umur kenderaan', recon: 'Biasanya 3–7 tahun', local: 'Pelbagai (1–20 tahun)' },
                      { aspect: 'Waranti', recon: 'Tiada (atau waranti dealer)', local: 'Mungkin ada baki waranti' },
                      { aspect: 'Rekod servis', recon: 'Rekod Jepun (Bahasa Jepun)', local: 'Rekod tempatan, mudah semak' },
                      { aspect: 'Alat ganti', recon: 'Mungkin susah cari / mahal', local: 'Mudah cari di pasaran tempatan' },
                      { aspect: 'Semak sejarah', recon: 'Sukar (rekod luar negara)', local: 'Mudah (JPJ, CarAdvisor)' },
                    ].map(({ aspect, recon, local }, i, arr) => (
                      <tr key={aspect} style={{ background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ color: '#374151', fontWeight: 500, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{aspect}</td>
                        <td style={{ color: '#6b7280', textAlign: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{recon}</td>
                        <td style={{ color: '#6b7280', textAlign: 'center', padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{local}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Kelebihan & Kelemahan</h2>

              {[
                {
                  label: 'Kereta Recon',
                  pros: ['Jarak rendah — seperti kereta hampir baharu', 'Model premium (Lexus, Alphard) lebih mampu milik', 'Spesifikasi Jepun biasanya lebih tinggi', 'Kenderaan Jepun terkenal tahan lama'],
                  cons: ['Tiada waranti pengeluar', 'Alat ganti mungkin sukar & mahal', 'Rekod sejarah sukar disahkan', 'Spesifikasi mungkin tidak sesuai iklim Malaysia'],
                },
                {
                  label: 'Kereta Terpakai Tempatan',
                  pros: ['Sejarah penggunaan boleh disahkan', 'Alat ganti mudah didapati & murah', 'Mekanik tempatan lebih biasa', 'Boleh ada baki waranti pengeluar'],
                  cons: ['Jarak biasanya lebih tinggi', 'Mungkin ada sejarah accident/banjir', 'Harga pasaran lebih stabil (kurang ruang tawar)'],
                },
              ].map(({ label, pros, cons }) => (
                <div key={label} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>{label}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                    {[
                      { title: 'Kelebihan', items: pros, icon: CheckCircle, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                      { title: 'Kelemahan', items: cons, icon: XCircle, color: '#dc2626', bg: '#fff5f5', border: '#fecaca' },
                    ].map(({ title, items, icon: Icon, color, bg, border }) => (
                      <div key={title} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                        <p style={{ fontWeight: 600, color: '#111827', fontSize: 13, marginBottom: 10 }}>{title}</p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {items.map((item, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                              <Icon size={12} style={{ color, flexShrink: 0, marginTop: 2 }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Kos Tersembunyi Yang Ramai Tidak Sedar</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Alat ganti import', desc: 'Kereta recon Jepun yang tidak dijual di Malaysia secara rasmi mungkin memerlukan alat ganti import yang 2–5x lebih mahal.' },
                  { label: 'Servis spesialis', desc: 'Bukan semua bengkel biasa boleh servis kereta recon premium. Bengkel pakar mungkin cas lebih tinggi.' },
                  { label: 'Cukai jalan lebih tinggi', desc: 'Sesetengah model recon mempunyai spesifikasi enjin berbeza yang dikenakan cukai jalan lebih tinggi berbanding versi tempatan.' },
                  { label: 'Kos pembaikan awal', desc: 'Kereta recon dari iklim sejuk (Jepun) mungkin memerlukan penggantian komponen getah/seal yang rosak akibat perbezaan iklim.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Mana Lebih Berbaloi?</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <p style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>Jawapannya bergantung kepada apa yang anda cari:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    {
                      type: 'Pilih Recon jika', color: '#1d4ed8',
                      points: ['Anda mahukan model premium yang tidak dijual baharu di Malaysia', 'Bajet terhad untuk model Jepun berkualiti tinggi', 'Anda tidak kisah dengan kekurangan waranti', 'Anda ada mekanik dipercayai yang biasa dengan model berkenaan'],
                    },
                    {
                      type: 'Pilih Terpakai Tempatan jika', color: '#15803d',
                      points: ['Anda mahu sejarah kenderaan yang jelas dan boleh disahkan', 'Anda utamakan kemudahan servis & alat ganti', 'Anda mahukan kenderaan dengan baki waranti pengeluar', 'Ini kenderaan pertama atau untuk ahli keluarga baru belajar memandu'],
                    },
                  ].map(({ type, color, points }) => (
                    <div key={type}>
                      <p style={{ fontWeight: 600, fontSize: 13, color, marginBottom: 8 }}>{type}:</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {points.map((pt, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                            <ChevronRight size={11} style={{ color: '#9ca3af', flexShrink: 0, marginTop: 2 }} />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 }}>7 Perkara Wajib Semak Sebelum Beli</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Lakukan semakan CCRIS/CTOS kereta (CarAdvisor, MyCarInfo) untuk semak sejarah pindah milik',
                  'Minta rekod servis — jika tiada, berhati-hati terutama untuk recon',
                  'Periksa fizikal dengan mekanik bebas yang anda percaya',
                  'Untuk recon: periksa kerosakan akibat iklim (getah rosak, pendawaian)',
                  'Pastikan nombor enjin dan casis sepadan dengan dokumen JPJ',
                  'Semak jika kenderaan pernah direkodkan dalam kemalangan',
                  'Dapatkan Puspakom B5 (dan B7 jika ada HP) sebelum bayar deposit penuh',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{item}</p>
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
                  { to: '/articles/cara-pindah-milik-kereta-mysikap', cat: 'Pindah Milik', title: 'Cara Pindah Milik Kereta Online Guna MySikap 2026' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Cari Recon & Terpakai Terpercaya</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Semua listing di XDrive disertakan rekod kenderaan. Filter ikut kondisi — recon atau terpakai — dan bandingkan dengan mudah.
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

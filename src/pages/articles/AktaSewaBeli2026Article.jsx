import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'akta-sewa-beli-2026-eir-pinjaman-kereta',
  title: 'Akta Sewa Beli (Pindaan) 2026: Apa Berubah Untuk Pinjaman Kereta Anda',
  description:
    'Akta Sewa Beli (Pindaan) 2026 berkuat kuasa 1 Jun 2026. Kadar rata dan Rule of 78 dimansuhkan, diganti EIR atas baki berkurangan. Panduan mudah untuk pembeli kereta: contoh kiraan, selesai loan awal, perjanjian lama, dan apa perlu disemak dalam sebut harga.',
  datePublished: '2026-10-03',
  dateModified: '2026-10-03',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Bila Akta Sewa Beli (Pindaan) 2026 berkuat kuasa?',
    a: 'Akta ini diwartakan pada 30 Januari 2026 dan berkuat kuasa pada 1 Jun 2026. Penyedia sewa beli diberi tempoh peralihan sehingga 31 Mac 2027 untuk menaik taraf sistem mereka kepada kaedah baki berkurangan dan harga dalam EIR.',
  },
  {
    q: 'Adakah loan kereta lama saya bertukar kepada EIR secara automatik?',
    a: 'Tidak. Perjanjian sewa beli sedia ada tidak ditukar secara automatik. Jika anda terus membayar sehingga tamat tempoh, anda tidak perlu buat apa-apa. Jika anda mahu selesaikan awal perjanjian kadar tetap lama yang guna Rule of 78, bank menawarkan diskaun muhibah (goodwill discount) mulai 1 Jun 2026.',
  },
  {
    q: 'Apa beza kadar rata (flat rate) dan EIR?',
    a: 'Kadar rata mengira faedah atas jumlah pinjaman asal untuk sepanjang tempoh, walaupun hutang anda makin berkurang. EIR (kadar faedah efektif) atas baki berkurangan mengira faedah hanya atas baki pokok yang masih tertunggak. Sebab itu angka kadar rata kelihatan lebih rendah daripada kos sebenar.',
  },
  {
    q: '3.5% flat sama dengan berapa EIR?',
    a: 'Sebagai ilustrasi, bagi pinjaman 7 tahun, ansuran pada kadar rata 3.5% sama dengan ansuran pada EIR sekitar 6.44% setahun. Angka tepat bergantung kepada tempoh pinjaman. Jadi jangan bandingkan angka flat dengan angka EIR secara terus.',
  },
  {
    q: 'Bagaimana kira ansuran kereta 2026?',
    a: 'Gunakan formula baki berkurangan dengan EIR. Kalkulator pinjaman XDrive di /calculator mengira ansuran bulanan dan jumlah faedah berdasarkan EIR atas baki berkurangan. Ia anggaran sahaja; kadar sebenar datang daripada bank anda.',
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
const CELL = { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#111827' };
const CELL_L = { ...CELL, textAlign: 'left', color: '#374151', paddingLeft: 0 };

export default function AktaSewaBeli2026Article() {
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
            <span style={{ color: '#6b7280' }}>Akta Sewa Beli 2026</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Pinjaman Kereta
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Akta Sewa Beli (Pindaan) 2026:<br />
              <span style={{ color: '#dc2626' }}>Apa Berubah Untuk Pinjaman Kereta Anda</span>
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
              Artikel ini ditulis oleh AI. Ia panduan umum, bukan nasihat undang-undang atau kewangan.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={P}>
                <strong style={{ color: '#111827' }}>Mulai 1 Jun 2026, cara faedah pinjaman kereta dikira di Malaysia sudah berubah.</strong> Akta Sewa Beli (Pindaan) 2026 memansuhkan kadar rata (flat rate) dan kaedah Rule of 78. Sebagai ganti, faedah dikira atas baki pinjaman yang masih tertunggak (kaedah baki berkurangan) dan kos pinjaman dinyatakan sebagai EIR, iaitu kadar faedah efektif.
              </p>
              <p style={P}>
                Untuk pembeli kereta, maksudnya mudah: angka kadar faedah dalam sebut harga kini lebih jujur, dan selesai loan kereta awal tidak lagi "menghukum" anda dengan baki faedah yang tinggi. Artikel ini menerangkan apa yang berubah, satu contoh kiraan, dan apa yang perlu anda semak sebelum menandatangani perjanjian.
              </p>
            </section>

            <section>
              <h2 style={H2}>Apa Itu Akta Sewa Beli (Pindaan) 2026 dan Bila Berkuat Kuasa?</h2>
              <p style={P}>
                Akta ini meminda Akta Sewa Beli 1967 (Akta 212), undang-undang yang mengawal perjanjian sewa beli termasuk pinjaman kereta. Pindaan ini diwartakan pada 30 Januari 2026 dan berkuat kuasa pada 1 Jun 2026, seperti diumumkan oleh Kementerian Perdagangan Dalam Negeri dan Kos Sara Hidup (KPDN). KPDN kekal sebagai pihak berkuasa yang mengawal selia urusan sewa beli di bawah akta yang dipinda.
              </p>
              <p style={P}>Menurut panduan pengguna Bank Negara Malaysia (BNM), perubahan utamanya ialah:</p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'EIR dan kaedah baki berkurangan digunakan untuk semua jenis pembiayaan sewa beli, sama ada kadar tetap atau kadar boleh ubah.',
                    'Istilah Kadar Pinjaman Asas (Base Lending Rate) diganti dengan Kadar Rujukan (Reference Rate).',
                    'Had kadar faedah maksimum kini dinyatakan dalam EIR.',
                    'Tempoh peralihan untuk penyedia menaik taraf sistem, sehingga 31 Mac 2027.',
                    'Pilihan untuk menandatangani secara elektronik atau digital dan menerima perjanjian serta dokumen berkaitan secara elektronik.',
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
              <h2 style={H2}>Kadar Rata Dimansuhkan: Beza Flat Rate dan EIR Baki Berkurangan</h2>
              <p style={P}>
                <strong style={{ color: '#111827' }}>Kadar rata</strong> mengira faedah atas jumlah pinjaman asal, untuk setiap tahun pinjaman. Walaupun selepas lima tahun anda sudah bayar sebahagian besar hutang, faedah masih dikira seolah-olah anda berhutang jumlah penuh. Sebab itu angka "3.5%" kelihatan murah.
              </p>
              <p style={P}>
                <strong style={{ color: '#111827' }}>EIR atas baki berkurangan</strong> mengira faedah hanya atas baki pokok yang masih ada. Bulan pertama, faedah tinggi kerana baki masih besar. Setiap bulan baki turun, jadi bahagian faedah dalam ansuran makin kecil dan bahagian pokok makin besar.
              </p>
              <p style={P}>
                Penting: undang-undang ini mengubah <em>cara kiraan</em>, bukan menetapkan kadar yang bank mesti beri. Kadar sebenar anda masih bergantung kepada bank, profil kredit anda dan kereta yang dibeli.
              </p>
            </section>

            <section>
              <h2 style={H2}>Contoh Kiraan: Kenapa 3.5% Flat Bukan 3.5% EIR</h2>
              <p style={P}>
                Ilustrasi di bawah menggunakan pinjaman RM60,000 selama 7 tahun (84 bulan). Angka ini dikira dengan formula yang sama yang digunakan oleh kalkulator XDrive. Ia contoh matematik sahaja, bukan sebut harga mana-mana bank.
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 300 }}>
                  <thead>
                    <tr>
                      <th style={{ ...CELL_L, fontWeight: 700, color: '#111827' }}>Pinjaman RM60,000, 7 tahun</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>3.5% flat</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>3.5% EIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Ansuran bulanan', 'RM889', 'RM806'],
                      ['Jumlah faedah', 'RM14,700', 'RM7,737'],
                      ['Jumlah dibayar', 'RM74,700', 'RM67,737'],
                    ].map(([k, a, b]) => (
                      <tr key={k}>
                        <td style={CELL_L}>{k}</td>
                        <td style={CELL}>{a}</td>
                        <td style={{ ...CELL, color: '#dc2626', fontWeight: 600 }}>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Kiraan kadar rata: RM60,000 x 3.5% x 7 tahun = RM14,700 faedah. Campur pokok, RM74,700 dibahagi 84 bulan = lebih kurang RM889 sebulan.
              </p>
              <p style={P}>
                Sekarang soalan sebenar: kalau ansuran RM889 itu dikira semula dengan kaedah baki berkurangan, berapa EIR-nya? Jawapannya sekitar <strong style={{ color: '#111827' }}>6.44% setahun</strong>. Jadi "3.5% flat" bukan 3.5% kos sebenar. Kos sebenarnya hampir dua kali ganda angka yang tertulis.
              </p>
              <p style={P}>
                Pengajarannya: bila anda bandingkan dua tawaran, pastikan kedua-duanya dalam EIR. Tawaran 6% EIR sebenarnya lebih murah daripada 3.5% flat untuk pinjaman 7 tahun, walaupun angkanya nampak lebih tinggi.
              </p>
            </section>

            <section>
              <h2 style={H2}>Rule of 78 dan Selesai Loan Kereta Awal</h2>
              <p style={P}>
                Rule of 78 ialah kaedah lama untuk mengira berapa faedah yang dikira "sudah dibayar" bila anda selesaikan pinjaman awal. Kaedah ini meletakkan sebahagian besar faedah di awal tempoh. Akibatnya, dalam tahun-tahun awal, kebanyakan ansuran anda pergi kepada faedah dan hanya sedikit kepada pokok. Peminjam yang mahu selesaikan awal mendapati baki mereka masih tinggi.
              </p>
              <p style={P}>
                Dengan kaedah baki berkurangan, faedah terikat kepada pokok yang masih anda hutang. Jika anda selesaikan awal, anda membayar baki pokok itu, bukan faedah masa depan yang dikira mengikut jadual Rule of 78. KPDN menyatakan perubahan ini menjadikan penyelesaian awal lebih telus dan adil kepada pengguna.
              </p>
              <p style={P}>
                Sebelum selesaikan awal, minta penyata penyelesaian daripada bank dan baca perjanjian anda untuk sebarang caj atau notis yang dikenakan.
              </p>
            </section>

            <section>
              <h2 style={H2}>Perjanjian Lama: Adakah Loan Sedia Ada Terkesan?</h2>
              <p style={P}>
                Perjanjian sewa beli yang dibuat sebelum ini <strong style={{ color: '#111827' }}>tidak ditukar secara automatik</strong> kepada kaedah baru. Jika anda terus membayar ansuran sehingga tamat tempoh, anda tidak perlu berbuat apa-apa.
              </p>
              <p style={P}>
                Jika anda mahu selesaikan awal, bank-bank di bawah Persatuan Bank-Bank Dalam Malaysia (ABM) menawarkan <strong style={{ color: '#111827' }}>diskaun muhibah (goodwill discount)</strong> mulai 1 Jun 2026 kepada individu serta perniagaan mikro dan kecil yang layak, bagi perjanjian kadar tetap sedia ada yang menggunakan Rule of 78. Tujuannya supaya baki penyelesaian lebih hampir dengan apa yang akan dibayar di bawah kaedah baki berkurangan. Setiap bank mengira diskaun berdasarkan ciri perjanjian anda, termasuk tempoh pembiayaan dan masa penyelesaian. Jumlah tepat diberi bila anda memohon penyelesaian awal.
              </p>
            </section>

            <section>
              <h2 style={H2}>Tempoh Peralihan Sehingga 31 Mac 2027</h2>
              <p style={P}>
                Walaupun akta berkuat kuasa 1 Jun 2026, penyedia sewa beli diberi masa sehingga 31 Mac 2027 untuk menaik taraf sistem bagi kaedah baki berkurangan dan harga dalam EIR. ABM menyatakan sesetengah bank sudah bersedia menawarkan kaedah baki berkurangan dalam tempoh peralihan ini.
              </p>
              <p style={P}>
                Maksudnya untuk anda: jika anda membeli kereta sebelum 31 Mac 2027, tanya terus kepada bank atau salesman sama ada sebut harga itu menggunakan kaedah baki berkurangan dengan EIR, atau masih kaedah lama.
              </p>
            </section>

            <section>
              <h2 style={H2}>Perjanjian Digital dan Tandatangan Elektronik</h2>
              <p style={P}>
                Akta yang dipinda membenarkan pengguna memilih untuk menandatangani secara elektronik atau digital, dan menerima perjanjian sewa beli serta dokumen berkaitan secara elektronik. Ini pilihan, bukan kewajipan. Ia boleh mempercepat proses kerana anda tidak semestinya perlu hadir ke bank untuk urusan dokumen.
              </p>
            </section>

            <section>
              <h2 style={H2}>Had Kadar Faedah Maksimum Dalam EIR</h2>
              <p style={P}>
                Menurut panduan BNM, bagi pembiayaan kadar tetap, had maksimum ialah EIR 17% setahun untuk tempoh sehingga lima tahun dan 16% untuk tempoh melebihi lima tahun. Bagi pembiayaan kadar boleh ubah, had kekal pada EIR 17% untuk semua tempoh. Ini had atas, bukan kadar biasa yang ditawarkan.
              </p>
            </section>

            <section>
              <h2 style={H2}>Apa Perlu Disemak Dalam Sebut Harga Loan Kereta</h2>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Kadar ditulis sebagai EIR atau flat? Jangan bandingkan satu flat dengan satu EIR.',
                    'Kadar tetap atau kadar boleh ubah? Kadar boleh ubah boleh berubah sepanjang tempoh pinjaman.',
                    'Jumlah pinjaman, tempoh (bulan) dan ansuran bulanan yang tepat.',
                    'Jumlah faedah sepanjang tempoh dan jumlah keseluruhan yang akan dibayar.',
                    'Jadual bayaran: berapa pokok dan berapa faedah setiap bulan.',
                    'Syarat penyelesaian awal, termasuk sebarang caj atau notis.',
                    'Anda mahu tandatangan secara fizikal atau elektronik.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Jika anda membeli kereta terpakai daripada dealer, pastikan juga harga jualan, deposit dan jumlah pinjaman dalam perjanjian jualan sama dengan apa yang dihantar ke bank. Panduan kami tentang <Link to="/articles/cara-buat-sales-agreement-kereta-terpakai" style={{ color: '#dc2626' }}>perjanjian jualan kereta terpakai</Link> menerangkan apa yang patut ada di dalamnya.
              </p>
            </section>

            <section>
              <h2 style={H2}>Kira Ansuran Kereta 2026 Dengan Kaedah Baru</h2>
              <p style={P}>
                <Link to="/calculator" style={{ color: '#dc2626', fontWeight: 600 }}>Kalkulator pinjaman kereta XDrive</Link> mengira ansuran bulanan dan jumlah faedah menggunakan EIR atas baki berkurangan, iaitu kaedah di bawah akta yang dipinda. Masukkan harga kereta, deposit, tempoh dan kadar EIR yang bank beri. Jika bank masih memberi anda angka flat, tukar dahulu ke EIR atau minta bank nyatakan EIR-nya, kerana memasukkan angka flat terus ke dalam kalkulator EIR akan memberi ansuran yang terlalu rendah.
              </p>
              <p style={P}>
                Hasilnya anggaran sahaja. Kelulusan, kadar dan ansuran sebenar hanya datang daripada bank atau penyedia pembiayaan. Bila anda sudah tahu bajet bulanan, anda boleh <Link to="/showroom" style={{ color: '#dc2626' }}>lihat kereta di showroom XDrive</Link> dalam julat harga itu.
              </p>
            </section>

            <section>
              <h2 style={{ ...H2, marginBottom: 20 }}>Soalan Lazim (FAQ)</h2>
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
              <h2 style={{ ...H2, marginBottom: 20 }}>Baca Seterusnya</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                {[
                  { to: '/articles/cara-buat-sales-agreement-kereta-terpakai', cat: 'Beli Kereta', title: 'Cara Buat Sales Agreement Kereta Terpakai' },
                  { to: '/articles/beza-kereta-recon-dan-terpakai', cat: 'Beli Kereta', title: 'Beza Kereta Recon dan Kereta Terpakai' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Kira Ansuran Anda Dalam EIR</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Kalkulator XDrive menggunakan kaedah baki berkurangan. Anggaran sahaja; kadar sebenar daripada bank anda.
              </p>
              <Link to="/calculator" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Buka Kalkulator
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

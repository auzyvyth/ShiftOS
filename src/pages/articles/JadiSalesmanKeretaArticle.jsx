import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-jadi-salesman-kereta-freelance',
  title: 'Cara Jadi Salesman Kereta (Termasuk Freelance) di Malaysia 2026',
  description:
    'Panduan cara jadi salesman kereta di Malaysia: beza kerja di showroom cawangan, dealer kereta terpakai dan agent kereta freelance, cara gaji dan komisen berfungsi, kemahiran yang perlu, cara cari pembeli sendiri, dan garis undang-undang yang tidak boleh dilanggar.',
  datePublished: '2026-10-03',
  dateModified: '2026-10-03',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Berapa gaji salesman kereta di Malaysia?',
    a: 'Menurut Indeed Malaysia, purata gaji Car Sales Executive ialah RM4,606 sebulan, berdasarkan 187 laporan gaji (dikemas kini 5 Julai 2026). Angka ini purata — pendapatan sebenar bergantung pada berapa unit anda jual, kerana sebahagian besarnya datang daripada komisen.',
  },
  {
    q: 'Apa beza salesman kereta biasa dan agent kereta freelance?',
    a: 'Salesman biasa ialah pekerja showroom atau dealer: ada majikan, biasanya ada gaji asas, dan menjual stok syarikat. Agent freelance pula bekerja atas komisen sahaja tanpa gaji asas — pendapatan tidak tetap, tetapi masa lebih bebas. Sebagai pekerja, gaji asas anda dilindungi Perintah Gaji Minimum (RM1,700 sebulan sejak 1 Februari 2025); sebagai freelance, anda bukan pekerja dan perlu urus KWSP sendiri, contohnya melalui i-Saraan.',
  },
  {
    q: 'Bolehkah saya bantu pelanggan buat kereta sambung bayar?',
    a: 'Tidak. KPDN telah menegaskan kontrak sambung bayar kenderaan adalah tidak sah. Menjual atau melupuskan kereta yang masih di bawah perjanjian sewa beli tanpa kebenaran pemilik (bank) dan dengan itu menipu pemilik ialah kesalahan di bawah seksyen 38 Akta Sewa Beli 1967. Pemindahan hak penyewa hanya boleh dibuat dengan kebenaran pemilik. Jangan tawarkan, aturkan atau iklankan sambung bayar.',
  },
  {
    q: 'Macam mana agent kereta freelance nak cari pembeli?',
    a: 'Kumpulkan semua kereta anda dalam satu link yang boleh dikongsi di status WhatsApp, bio Instagram dan iklan anda, balas pertanyaan dengan cepat, rekod setiap pertanyaan sebagai lead, dan buat susulan. Pelanggan lama juga sumber rujukan yang paling murah.',
  },
  {
    q: 'Perlu ke saya ada laman web sendiri?',
    a: 'Tidak semestinya. Salesman Lite di XDrive ialah akaun percuma (RM0, tiada kad kredit) yang memberi anda page sendiri di xdrive.my/s/namaanda, sehingga 10 listing aktif, dan butang WhatsApp terus kepada anda pada setiap kereta.',
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
const H2 = { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 16 };
const CARD = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' };
const LINK = { color: '#dc2626', fontWeight: 600, textDecoration: 'none' };

export default function JadiSalesmanKeretaArticle() {
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
            <span style={{ color: '#6b7280' }}>Jadi Salesman Kereta</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Kerjaya Salesman
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Jadi Salesman Kereta<br />
              <span style={{ color: '#dc2626' }}>Termasuk Agent Freelance</span>
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
                <strong style={{ color: '#111827' }}>Untuk jadi salesman kereta di Malaysia, anda ada tiga jalan: bekerja di showroom cawangan sesuatu jenama, bekerja dengan dealer kereta terpakai, atau jadi agent kereta freelance yang dibayar atas komisen sahaja.</strong> Ketiga-tiganya menjual benda yang sama — kereta — tetapi cara anda dibayar, siapa yang bawa pembeli, dan berapa banyak kawalan yang anda ada sangat berbeza.
              </p>
              <p style={P}>
                Panduan ini menerangkan beza ketiga-tiga jalan itu, cara gaji dan komisen berfungsi (dengan angka daripada sumber yang boleh disemak), kemahiran yang paling penting, cara cari pembeli sendiri, dan garis undang-undang yang mesti anda jaga.
              </p>
            </section>

            <section>
              <h2 style={H2}>Showroom Cawangan, Dealer Terpakai atau Freelance?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: '1. Showroom cawangan (kereta baharu)', desc: 'Anda pekerja syarikat yang mengendalikan showroom jenama. Pembeli datang sendiri ke showroom, stok dan harga ditetapkan oleh syarikat, dan biasanya ada gaji asas, KWSP dan PERKESO. Kebebasan rendah, tetapi pendapatan paling stabil untuk orang baru.' },
                  { label: '2. Dealer kereta terpakai', desc: 'Anda menjual stok milik dealer. Setiap kereta lain keadaan, sejarah dan harganya, jadi anda perlu faham cara semak kereta, dokumen dan proses pindah milik. Struktur gaji berbeza-beza antara dealer — ada yang beri gaji asas, ada yang komisen sahaja.' },
                  { label: '3. Agent kereta freelance', desc: 'Tiada gaji asas, dibayar komisen bagi setiap kereta yang terjual. Anda cari pembeli sendiri dan selalunya bekerja dengan stok satu atau beberapa dealer. Masa bebas, tetapi bulan tanpa jualan bermakna bulan tanpa pendapatan.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={CARD}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...P, marginTop: 16, marginBottom: 0 }}>
                Kalau anda baru bermula, jalan pertama atau kedua memberi anda gaji semasa belajar. Ramai agent freelance yang berjaya bermula sebagai pekerja dahulu, kemudian keluar selepas ada pelanggan dan rangkaian sendiri.
              </p>
            </section>

            <section>
              <h2 style={H2}>Gaji Salesman Kereta: Berapa Sebenarnya?</h2>
              <p style={P}>
                Angka di bawah datang daripada laman kerja utama Malaysia. Ia purata yang dilaporkan, bukan janji pendapatan.
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Purata Car Sales Executive (Indeed Malaysia, 187 laporan, dikemas kini 5 Julai 2026)', 'RM4,606 / bulan'],
                      ['Purata Sales Executive semua industri (JobStreet, Ogos 2026)', 'RM3,400 – RM4,800 / bulan'],
                      ['Gaji minimum untuk pekerja (Perintah Gaji Minimum 2024, sejak 1 Feb 2025)', 'RM1,700 / bulan'],
                    ].map(([k, v], i, arr) => (
                      <tr key={k}>
                        <td style={{ color: '#374151', padding: '9px 12px 9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none', lineHeight: 1.5 }}>{k}</td>
                        <td style={{ color: '#111827', fontWeight: 700, textAlign: 'right', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none', whiteSpace: 'nowrap' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={P}>
                Purata ini menyembunyikan jurang yang besar. Pendapatan salesman kereta terdiri daripada dua bahagian: <strong style={{ color: '#111827' }}>gaji asas</strong> (jika ada) dan <strong style={{ color: '#111827' }}>komisen</strong> bagi setiap unit yang anda tutup. Jadi dua orang dengan jawatan yang sama boleh bawa pulang jumlah yang sangat berbeza bergantung pada berapa kereta mereka jual sebulan.
              </p>
              <p style={P}>
                Kalau anda pekerja, majikan wajib bayar sekurang-kurangnya gaji minimum RM1,700 sebulan sejak 1 Februari 2025 (bagi majikan dengan lima pekerja atau lebih; majikan kecil mula 1 Ogos 2025). Kalau anda agent freelance komisen sahaja, anda bukan pekerja — tiada gaji asas, dan tiada majikan yang mencarum KWSP untuk anda. Skim i-Saraan KWSP dibuat untuk orang bekerja sendiri seperti ini: anda mencarum secara sukarela dan kerajaan memberi insentif 20% daripada caruman tahunan, sehingga RM500 setahun.
              </p>
            </section>

            <section>
              <h2 style={H2}>Komisen Salesman Kereta Terpakai: Cara Ia Dikira</h2>
              <p style={P}>
                Tiada kadar komisen standard yang ditetapkan oleh undang-undang — setiap dealer tetapkan sendiri. Secara umum ada tiga bentuk: peratusan daripada untung kasar unit, jumlah tetap bagi setiap kereta, atau peratusan daripada harga jual. Sebelum anda terima tawaran, tanya dengan jelas: komisen dikira daripada apa, bila dibayar, dan apa jadi kalau pembeli batal atau loan ditolak.
              </p>
              <p style={P}>
                Penerangan penuh setiap struktur, dengan contoh kiraan, ada dalam panduan kami: <Link to="/articles/cara-kira-komisen-salesman-kereta" style={LINK}>Komisen Jual Kereta: Berapa & Cara Kira</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>Kemahiran Yang Paling Penting</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                {[
                  'Balas cepat. Pembeli bertanya kepada beberapa penjual serentak; yang membalas dulu selalunya yang dapat temu janji.',
                  'Faham produk. Tahu spesifikasi, kos penyelenggaraan dan kelemahan biasa setiap model yang anda jual.',
                  'Faham proses. Pinjaman bank, insurans, pemeriksaan Puspakom dan pindah milik JPJ — pembeli harapkan anda tahu langkahnya.',
                  'Buat susulan. Kebanyakan pembeli tidak membeli pada hari pertama mereka bertanya.',
                  'Jujur tentang angka. Jangan sebut kadar faedah, kelulusan loan atau nilai trade-in yang anda belum sahkan.',
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ ...P, marginTop: 16, marginBottom: 0 }}>
                Satu perkara baharu untuk 2026: Akta Sewa Beli (Pindaan) 2026 berkuat kuasa pada 1 Jun 2026 dan menggantikan kadar rata (flat rate) dengan kadar faedah efektif (EIR) atas baki berkurangan bagi perjanjian sewa beli baharu (penjelasan penuh: <Link to="/articles/akta-sewa-beli-2026-eir-pinjaman-kereta" style={LINK}>Akta Sewa Beli 2026 dan EIR</Link>). Kalau anda masih menyebut ansuran bulanan guna formula kadar rata yang lama, angka anda mungkin salah. Gunakan <Link to="/calculator" style={LINK}>kalkulator loan</Link> sebagai anggaran, dan biar bank sahkan angka sebenar.
              </p>
            </section>

            <section>
              <h2 style={H2}>Cara Cari Pembeli Sebagai Agent Kereta Freelance</h2>
              <p style={P}>
                Di showroom, pembeli datang sendiri. Sebagai freelance, mencari pembeli ialah separuh daripada kerja anda. Beberapa asas yang berkesan:
              </p>
              <ul style={{ ...P, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong style={{ color: '#111827' }}>Satu link untuk semua kereta.</strong> Pembeli yang nampak satu iklan sepatutnya boleh lihat semua stok anda dengan satu tekan, bukan minta anda hantar gambar satu demi satu.</li>
                <li><strong style={{ color: '#111827' }}>Letak link itu di mana-mana.</strong> Status WhatsApp, bio Instagram dan TikTok, dan di bawah iklan anda di portal lain.</li>
                <li><strong style={{ color: '#111827' }}>Rekod setiap pertanyaan.</strong> Pertanyaan yang tinggal dalam chat WhatsApp mudah hilang. Simpan nama, kereta yang diminati dan tarikh susulan.</li>
                <li><strong style={{ color: '#111827' }}>Jaga pelanggan lama.</strong> Pembeli yang puas hati akan rujuk kawan dan keluarga — sumber lead paling murah.</li>
              </ul>
              <p style={P}>
                Untuk itulah kami bina <Link to="/for-salesmen" style={LINK}>Salesman Lite</Link>: akaun percuma (RM0, tiada kad kredit) untuk salesman dan agent kereta di Malaysia. Anda dapat page sendiri di <strong style={{ color: '#111827' }}>xdrive.my/s/namaanda</strong>, boleh senaraikan sehingga 10 kereta aktif di marketplace XDrive, dan setiap kereta ada butang WhatsApp yang terus kepada anda. Setiap pertanyaan menjadi lead dalam pipeline dengan peringatan susulan, dan analitik asas menunjukkan jumlah tontonan dan klik WhatsApp bagi setiap listing. Kalau stok anda melebihi 10 kereta, Salesman Premium (RM35 sebulan) menaikkan had kepada 30 listing dan menambah penjejakan komisen.
              </p>
            </section>

            <section>
              <h2 style={H2}>Garis Undang-Undang Yang Tidak Boleh Dilanggar</h2>
              <p style={P}>
                Salesman yang baru selalunya diuji dengan permintaan "jalan pintas" daripada pelanggan. Yang paling biasa ialah <strong style={{ color: '#111827' }}>sambung bayar</strong> — pembeli ambil alih kereta yang masih ada loan dan terus bayar ansuran atas nama pemilik asal, tanpa pindah milik dan tanpa kebenaran bank.
              </p>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'KPDN telah menegaskan bahawa sebarang kontrak sambung bayar kenderaan adalah tidak sah.',
                    'Menjual atau melupuskan kereta di bawah perjanjian sewa beli dengan cara yang menipu pemilik (bank) ialah kesalahan di bawah seksyen 38 Akta Sewa Beli 1967, dan boleh membawa hukuman penjara.',
                    'Hak penyewa hanya boleh dipindahkan dengan kebenaran pemilik. Jalan yang betul ialah selesaikan loan, atau pembeli memohon pembiayaan baharu, kemudian pindah milik melalui JPJ.',
                    'Jangan tawarkan, aturkan atau iklankan sambung bayar — walaupun pelanggan sendiri yang minta.',
                  ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <XCircle size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: 4 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p style={P}>
                Prinsip yang sama terpakai pada perkara lain: jangan janjikan kelulusan loan, jangan reka kadar faedah, dan jangan sembunyikan sejarah kereta yang anda tahu. Nama baik ialah aset terbesar seorang agent freelance, kerana pelanggan anda sendiri yang akan merujuk pelanggan seterusnya.
              </p>
            </section>

            <section>
              <h2 style={H2}>Jejak Prestasi Sendiri: Close Rate dan Kelajuan Balas</h2>
              <p style={P}>
                Salesman yang bertambah baik dari bulan ke bulan biasanya menjejak dua nombor:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Close rate', desc: 'Berapa peratus pertanyaan yang akhirnya membeli. Kira daripada rekod lead anda sendiri: jumlah deal ditutup dibahagi jumlah lead dalam tempoh yang sama. Lebih berguna lagi kalau anda tahu di peringkat mana deal paling banyak hilang — selepas pertanyaan pertama, selepas test drive, atau semasa loan.' },
                  { label: 'Kelajuan balas', desc: 'Berapa lama pembeli menunggu jawapan pertama anda. Ini antara perkara yang paling mudah dibaiki, dan pembeli perasan.' },
                ].map(({ label, desc }) => (
                  <div key={label} style={CARD}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, margin: '0 0 6px' }}>{label}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
              <p style={P}>
                Bagi pengguna Salesman Premium, tab Performance menunjukkan di mana deal anda hilang dalam funnel, close rate anda dan kelajuan balas — berdasarkan rekod lead anda sendiri, bukan anggaran.
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
                  { to: '/articles/cara-kira-komisen-salesman-kereta', cat: 'Komisen', title: 'Komisen Jual Kereta: Berapa & Cara Kira' },
                  { to: '/articles/cara-pindah-milik-kereta-mysikap', cat: 'Dokumen', title: 'Cara Pindah Milik Kereta di MySikap' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Page Percuma Untuk Agent Kereta</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Salesman Lite: page sendiri di xdrive.my/s/namaanda, sehingga 10 kereta, pertanyaan terus ke WhatsApp anda. RM0, tiada kad kredit.
              </p>
              <Link to="/for-salesmen" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Lihat Salesman Lite
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

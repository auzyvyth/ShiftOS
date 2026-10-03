import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';

const ARTICLE = {
  slug: 'cara-urus-dealership-kedai-kereta-terpakai',
  title: 'Cara Urus Dealership & Kedai Kereta Terpakai Setiap Hari (2026)',
  description:
    'Panduan praktikal cara urus dealership dan kedai kereta terpakai di Malaysia: kawal umur stok, susul lead, pantau prestasi salesman dan komisen, uruskan dokumen, handover selepas jual, dan nombor harian yang perlu dilihat.',
  datePublished: '2026-10-03',
  dateModified: '2026-10-03',
  readMins: 8,
};

const FAQS = [
  {
    q: 'Apa perkara paling penting bila urus kedai kereta terpakai?',
    a: 'Tiga perkara: berapa lama setiap kereta sudah duduk dalam stok, berapa cepat setiap lead dijawab, dan berapa untung kasar sebenar setiap unit selepas tolak kos beli, recon, komisen dan kos handover. Kalau tiga ini terkawal, kebanyakan masalah lain lebih mudah diurus.',
  },
  {
    q: 'Macam mana nak pantau prestasi salesman kereta?',
    a: 'Lihat lebih daripada jumlah unit terjual. Bandingkan unit terjual, untung kasar yang dijana, komisen, dan berapa cepat salesman menjawab lead. Salesman yang jual banyak unit tetapi dengan diskaun besar mungkin menjana untung lebih rendah daripada rakan yang jual kurang unit.',
  },
  {
    q: 'Berapa lama kereta terpakai patut duduk dalam stok?',
    a: 'Tiada satu angka yang betul untuk semua kedai. Yang penting ialah anda tetapkan had sendiri, contohnya 60 hari, dan semak setiap minggu kereta mana yang sudah melepasi had itu supaya boleh ubah harga, iklan semula atau lepaskan unit sebelum kos pegangan memakan untung.',
  },
  {
    q: 'Adakah dealer kereta perlu patuh PDPA?',
    a: 'Ya, jika anda memproses data peribadi pelanggan dalam urusan komersial, seperti nama, nombor telefon, nombor IC dan alamat. Akta Perlindungan Data Peribadi 2010 menetapkan tujuh prinsip perlindungan data, dan pindaan yang berkuat kuasa pada 1 Jun 2025 mewajibkan notifikasi pelanggaran data kepada Pesuruhjaya.',
  },
  {
    q: 'Boleh ke urus dealership guna Excel dan WhatsApp sahaja?',
    a: 'Boleh untuk kedai yang sangat kecil, tetapi masalah biasanya muncul bila stok dan bilangan salesman bertambah: lead terlepas, umur stok tidak dikira, komisen dipertikai dan dokumen handover tercicir. Sistem urus dealer seperti ShiftOS menyimpan semua ini di satu tempat.',
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
const A = { color: '#dc2626', fontWeight: 600, textDecoration: 'none' };

function Checklist({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.55 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function UrusDealershipArticle() {
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
            <span style={{ color: '#6b7280' }}>Urus Dealership</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Urus Dealer
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Urus Dealership &amp; Kedai<br />
              <span style={{ color: '#dc2626' }}>Kereta Terpakai Setiap Hari</span>
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
                <strong style={{ color: '#111827' }}>Urus dealership atau kedai kereta terpakai sebenarnya ialah urus enam perkara serentak:</strong> stok, lead, salesman, dokumen, handover selepas jual, dan nombor yang memberitahu sama ada semua itu menjana untung. Kebanyakan kedai bukan rugi kerana tiada pembeli, tetapi kerana satu daripada enam perkara ini terlepas pandang: kereta duduk terlalu lama, lead tidak dijawab, atau komisen dibayar atas deal yang untungnya nipis.
              </p>
              <p style={P}>
                Panduan ini menerangkan rutin harian dan mingguan untuk setiap bahagian. Untuk topik yang sudah ada panduan penuh, kami pautkan terus supaya anda boleh baca lebih mendalam.
              </p>
            </section>

            <section>
              <h2 style={H2}>1. Cara Urus Stok Kereta Terpakai &amp; Pantau Umur Stok</h2>
              <p style={P}>
                Setiap hari sebuah kereta duduk di lot, modal anda terikat padanya. Sebab itu angka paling penting dalam stok bukan jumlah unit, tetapi <strong style={{ color: '#111827' }}>umur setiap unit</strong> (berapa hari sejak ia masuk stok).
              </p>
              <p style={P}>Rutin yang mudah diikut:</p>
              <Checklist items={[
                'Rekod tarikh masuk, harga beli dan kos recon untuk setiap unit pada hari ia masuk, bukan selepas ia terjual.',
                'Tetapkan had umur stok sendiri (contohnya 60 hari) dan semak senarai unit yang melepasi had itu setiap minggu.',
                'Untuk unit yang sudah lama, pilih satu tindakan: ubah harga, tukar gambar dan iklan semula, beri kepada salesman tertentu, atau lepaskan.',
                'Jangan beli stok baru yang serupa dengan unit yang sudah lama tidak bergerak.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Dalam ShiftOS, tab stok dealer menanda unit yang sudah lebih 60 hari dalam stok dan menunjukkan bilangannya di bahagian atas, jadi anda tidak perlu kira sendiri. Panduan penuh tentang sistem stok ada di <Link to="/articles/cara-urus-stok-kereta-terpakai-sistem-digital" style={A}>Cara Urus Stok Kereta Terpakai Dengan Sistem Digital</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>2. Cara Susul Lead Supaya Pembeli Tidak Terlepas</h2>
              <p style={P}>
                Pembeli kereta terpakai biasanya bertanya kepada beberapa kedai serentak. Kedai yang menjawab dahulu dan terus menyusul biasanya yang dapat peluang untuk test drive. Masalahnya, bila lead masuk melalui WhatsApp, panggilan, walk-in dan iklan, ia mudah bertaburan di telefon salesman masing-masing.
              </p>
              <Checklist items={[
                'Satu tempat untuk semua lead, tidak kira dari mana ia datang.',
                'Setiap lead ada peringkat yang jelas: baru, sudah dihubungi, test drive, rundingan, deposit, menang atau kalah.',
                'Setiap lead ada pemilik (salesman) supaya tiada yang terbiar atau dijawab dua kali.',
                'Semak setiap pagi: lead mana belum dijawab, dan lead mana sudah senyap beberapa hari.',
                'Bila lead kalah, rekod sebabnya. Selepas beberapa bulan, sebab-sebab ini tunjuk di mana kedai anda selalu tewas.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                ShiftOS menyimpan lead dalam papan pipeline mengikut peringkat, dan bila sesuatu lead ditanda menang, kereta itu terus ditanda terjual, rekod pelanggan dicipta dan senarai semak handover disediakan secara automatik. Lihat <Link to="/features/leads-crm" style={A}>ciri Leads CRM</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>3. Cara Pantau Prestasi Salesman &amp; Lihat Prestasi Jualan</h2>
              <p style={P}>
                Ramai pemilik kedai hanya melihat siapa jual paling banyak unit bulan ini. Itu satu angka sahaja. Untuk pantau prestasi salesman dengan adil, lihat sekurang-kurangnya empat perkara bersama:
              </p>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Unit terjual', 'Berapa deal yang ditutup dalam tempoh itu.'],
                      ['Untung kasar dijana', 'Jumlah untung unit yang ditutup, bukan harga jual.'],
                      ['Komisen', 'Berapa yang perlu dibayar, mengikut peraturan yang anda tetapkan.'],
                      ['Masa respons', 'Berapa cepat salesman menjawab lead baru.'],
                    ].map(([k, v], i, arr) => (
                      <tr key={k}>
                        <td style={{ color: '#111827', fontWeight: 600, padding: '9px 12px 9px 0', verticalAlign: 'top', whiteSpace: 'nowrap', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{k}</td>
                        <td style={{ color: '#4b5563', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={P}>
                Salesman yang menutup banyak unit dengan diskaun besar mungkin menjana untung lebih rendah daripada rakan yang menutup kurang unit. Sebab itu komisen paling selamat dikira dari untung kasar. Formula dan contoh pengiraan ada di <Link to="/articles/cara-kira-komisen-salesman-kereta" style={A}>Cara Kira Komisen Salesman Kereta Dengan Betul</Link>.
              </p>
              <p style={P}>
                Dalam ShiftOS, tab pasukan dealer memaparkan papan kedudukan salesman dengan unit terjual, untung kasar dan komisen setiap orang. Analitik hasil pula menunjukkan masa respons mengikut salesman dan perbandingan bulan ini dengan tempoh yang sama bulan lepas. Lihat <Link to="/features/salesman-performance" style={A}>ciri prestasi salesman</Link> dan <Link to="/features/revenue-analytics" style={A}>ciri analitik hasil</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>4. Dokumen: Sales Agreement, Puspakom &amp; Pindah Milik</h2>
              <p style={P}>
                Bahagian dokumen jarang menjana untung, tetapi kesilapan di sini boleh melambatkan serahan kereta atau menimbulkan pertikaian dengan pembeli. Tiga perkara yang perlu ada rutin tetap:
              </p>
              <Checklist items={[
                'Sales agreement untuk setiap jualan, dengan butiran kereta, harga, deposit dan syarat yang dipersetujui.',
                'Pemeriksaan Puspakom yang berkaitan sebelum pindah milik.',
                'Pindah milik kenderaan melalui JPJ, yang melibatkan kedua-dua penjual dan pembeli.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Setiap satu sudah ada panduan langkah demi langkah:{' '}
                <Link to="/articles/cara-buat-sales-agreement-kereta-terpakai" style={A}>sales agreement</Link>,{' '}
                <Link to="/articles/apa-itu-puspakom-b5-b7" style={A}>Puspakom B5 &amp; B7</Link>, dan{' '}
                <Link to="/articles/cara-pindah-milik-kereta-mysikap" style={A}>pindah milik melalui MySikap</Link>.
                Untuk yuran rasmi dan syarat terkini, sentiasa rujuk laman JPJ dan Puspakom kerana ia boleh berubah.
              </p>
            </section>

            <section>
              <h2 style={H2}>5. Handover Selepas Jual</h2>
              <p style={P}>
                Deal belum selesai bila pembeli bayar deposit. Antara deposit dan kunci diserahkan, ada beberapa langkah yang melibatkan bank, syarikat insurans, Puspakom dan JPJ. Kalau tiada senarai semak, mudah untuk satu langkah tertinggal dan pembeli menunggu tanpa tahu sebabnya.
              </p>
              <p style={P}>
                ShiftOS menyediakan senarai semak handover 8 langkah secara automatik untuk setiap deal yang menang: penyelesaian pinjaman, insurans pembeli, Puspakom B5, Puspakom B7, pindah milik JPJ, cukai jalan, ambil geran, dan serahan kereta. Setiap langkah ada status dan pemilik, dan kos yang direkod untuk langkah-langkah ini ditolak daripada untung kasar unit. Lihat <Link to="/features/post-sale-handover" style={A}>ciri handover selepas jual</Link>.
              </p>
              <p style={P}>
                Selepas handover, pembeli menjadi pelanggan. Rekod pelanggan dengan tarikh tamat insurans dan cukai jalan membolehkan anda menghubungi mereka semula. ShiftOS menghantar peringatan bila tarikh ini tinggal 30 atau 7 hari.
              </p>
            </section>

            <section>
              <h2 style={H2}>6. Data Pelanggan &amp; PDPA</h2>
              <p style={P}>
                Kedai kereta memegang banyak data peribadi: nama, nombor telefon, nombor IC, alamat dan butiran pinjaman. Data ini tertakluk kepada <strong style={{ color: '#111827' }}>Akta Perlindungan Data Peribadi 2010</strong>, yang menetapkan tujuh prinsip: Am, Notis dan Pilihan, Penzahiran, Keselamatan, Penyimpanan, Integriti Data, dan Akses.
              </p>
              <p style={P}>
                Pindaan kepada akta ini yang berkuat kuasa pada 1 Jun 2025 mewajibkan pengawal data memaklumkan Pesuruhjaya Perlindungan Data Peribadi jika berlaku pelanggaran data, dan memperkenalkan kewajipan melantik Pegawai Perlindungan Data. Dari segi operasi harian, ini bermaksud: jangan simpan salinan IC pelanggan di telefon peribadi salesman atau dalam kumpulan WhatsApp, hadkan siapa boleh melihat data pelanggan, dan jangan simpan data lebih lama daripada yang perlu. Untuk keperluan tepat bagi perniagaan anda, rujuk laman rasmi Jabatan Perlindungan Data Peribadi (pdp.gov.my).
              </p>
            </section>

            <section>
              <h2 style={H2}>7. Nombor Harian &amp; Mingguan Yang Perlu Dilihat</h2>
              <p style={P}>
                Anda tidak perlu laporan panjang. Cukup beberapa nombor yang dilihat pada masa yang sama setiap hari dan setiap minggu:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
                {[
                  { label: 'Setiap pagi', items: ['Lead baru semalam dan siapa yang menjawabnya', 'Lead yang belum dijawab', 'Test drive dan temu janji hari ini', 'Langkah handover yang tertangguh'] },
                  { label: 'Setiap minggu', items: ['Unit yang melepasi had umur stok', 'Unit terjual dan untung kasar minggu ini', 'Prestasi setiap salesman: unit, untung, masa respons', 'Sebab lead kalah', 'Sumber lead yang paling banyak menjadi jualan'] },
                ].map(({ label, items }) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' }}>
                    <p style={{ fontWeight: 700, color: '#111827', fontSize: 14, margin: '0 0 10px' }}>{label}</p>
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#4b5563', fontSize: 14, lineHeight: 1.7 }}>
                      {items.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Setiap bulan, lihat untung kasar setiap unit yang terjual dalam dua bahagian: untung depan (harga jual tolak kos beli, recon, perkhidmatan termasuk, komisen dan kos handover) dan untung belakang (hasil produk tambahan seperti insurans atau perlindungan, tolak kosnya). ShiftOS memaparkan kedua-duanya dalam modal P&amp;L setiap unit, jadi anda nampak unit mana yang benar-benar menjana untung.
              </p>
            </section>

            <section>
              <h2 style={H2}>Mula Dari Mana?</h2>
              <p style={P}>
                Jika semua ini terasa banyak, mulakan dengan dua perkara sahaja: rekod umur setiap unit stok, dan pastikan setiap lead ada pemilik. Dua tabiat ini sahaja sudah mengurangkan modal yang terikat dan pembeli yang terlepas. Bila sudah stabil, tambah pemantauan prestasi salesman dan senarai semak handover.
              </p>
              <p style={P}>
                <Link to="/shiftos" style={A}>ShiftOS</Link> menggabungkan stok, lead, pasukan, dokumen dan handover dalam satu sistem untuk dealer kereta terpakai di Malaysia.
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
                  { to: '/articles/cara-urus-stok-kereta-terpakai-sistem-digital', cat: 'Urus Dealer', title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital' },
                  { to: '/articles/cara-kira-komisen-salesman-kereta', cat: 'Urus Dealer', title: 'Cara Kira Komisen Salesman Kereta Dengan Betul' },
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Urus Seluruh Dealership Di Satu Tempat</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Stok, lead, prestasi salesman, komisen dan handover dalam satu sistem.
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

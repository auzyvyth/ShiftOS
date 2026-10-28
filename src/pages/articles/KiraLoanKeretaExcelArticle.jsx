import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, Download } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';
import { SITE_URL } from '../../config/site';
import { supabase } from '../../supabaseClient';
import { trackEvent } from '../../utils/analytics';

// Search gap (2026-10-28): "kira loan kereta excel" returned only foreign PMT
// tutorials, no Malaysian page. Written for salesmen and buyers who keep a loan
// sheet. Every number was computed with src/utils/financing.js (flatToEir,
// monthlyPayment) and matches the free template, built by
// tools/build-salesman-template.py (same RM54,000 sample loan).

const ARTICLE = {
  slug: 'cara-kira-loan-kereta-excel',
  title: 'Cara Kira Loan Kereta Guna Excel: Formula PMT, Flat ke EIR (Template Percuma)',
  description:
    'Cara kira ansuran bulanan kereta dalam Excel atau Google Sheets dengan formula PMT, cara tukar kadar flat ke EIR guna RATE, contoh RM54,000 selama 5, 7 dan 9 tahun, dan template Excel percuma untuk dimuat turun.',
  datePublished: '2026-10-28',
  dateModified: '2026-10-28',
  readMins: 7,
};

const PAGE_URL = `${SITE_URL}/articles/${ARTICLE.slug}`;
const TEMPLATE = '/downloads/template-salesman-kereta.xlsx';

const FAQS = [
  {
    q: 'Apa formula Excel untuk kira ansuran bulanan kereta?',
    a: '=PMT(kadar/12, tahun*12, -jumlah pinjaman), dengan kadar dalam EIR dan ditulis sebagai perpuluhan atau peratus (contoh 6.44%). Untuk pinjaman RM54,000 pada 6.44% EIR selama 7 tahun, =PMT(6.44%/12, 84, -54000) memberi kira-kira RM800.36 sebulan.',
  },
  {
    q: 'Boleh ke taip kadar flat terus dalam formula PMT?',
    a: 'Tidak. PMT mengira faedah atas baki berkurangan, jadi ia perlukan EIR. Kalau 3.5% flat ditaip terus, pinjaman RM54,000 selama 7 tahun keluar RM725.75 sebulan, sedangkan ansuran sebenar ialah RM800.36. Tukar kadar flat ke EIR dulu dengan formula RATE.',
  },
  {
    q: 'Macam mana nak tukar kadar flat ke EIR dalam Excel?',
    a: 'Kira dulu ansuran flat: =pinjaman*(1+kadar_flat*tahun)/(tahun*12). Kemudian EIR setahun ialah =RATE(tahun*12, -ansuran_flat, pinjaman)*12. Contoh: 3.5% flat ialah lebih kurang 6.54% EIR untuk 5 tahun, 6.44% untuk 7 tahun dan 6.34% untuk 9 tahun.',
  },
  {
    q: 'Kenapa kadar flat masih disebut kalau undang-undang dah tukar ke EIR?',
    a: 'Akta Sewa Beli (Pindaan) 2026 berkuat kuasa pada 1 Jun 2026 dan perjanjian sewa beli baru dikira atas baki berkurangan dalam EIR. Bank diberi tempoh peralihan hingga 31 Mac 2027. Ramai di showroom masih menyebut kadar flat kerana sudah biasa, jadi tukar ia ke EIR sebelum membandingkan.',
  },
  {
    q: 'Formula ini jalan di Google Sheets?',
    a: 'Ya. PMT dan RATE wujud dalam Excel, Google Sheets dan LibreOffice dengan susunan yang sama. Template percuma di halaman ini dibuka di ketiga-tiganya.',
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
      author: { '@type': 'Organization', name: 'Drevo' },
      publisher: { '@type': 'Organization', name: 'Drevo', url: SITE_URL },
      url: PAGE_URL,
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

// RM54,000 loan, 3.5% flat, per tenure (financing.js flatToEir + monthlyPayment).
const RESULTS = [
  ['5 tahun (60 bulan)', '6.54%', 'RM1,057.50', 'RM9,450'],
  ['7 tahun (84 bulan)', '6.44%', 'RM800.36', 'RM13,230'],
  ['9 tahun (108 bulan)', '6.34%', 'RM657.50', 'RM17,010'],
];

const SHEET = [
  ['A', 'B', 'Isi'],
  ['Harga kereta', '60000', 'taip'],
  ['Deposit', '6000', 'taip'],
  ['Pinjaman', '=B2-B3', 'RM54,000'],
  ['Kadar (EIR)', '6.44%', 'taip'],
  ['Tempoh (tahun)', '7', 'taip'],
  ['Ansuran bulanan', '=PMT(B5/12, B6*12, -B4)', 'RM800.36'],
];

const P = { color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 };
const H2 = { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 };
const STRONG = { color: '#111827' };
const LINK = { color: '#dc2626' };
const CODE = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, background: '#f3f4f6', borderRadius: 6, padding: '2px 6px', color: '#111827' };
const CELL = { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#111827', whiteSpace: 'nowrap' };
const CELL_L = { ...CELL, textAlign: 'left', color: '#374151', paddingLeft: 0 };
const TABLE_BOX = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, overflowX: 'auto' };

function Checklist({ items }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
            <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 4 }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The free template. A plain link (no form, no sign-up); the click is counted
// as a landing_page_view on the file's path, an event type the table already
// allows, so the console's marketing numbers show downloads per article.
function TemplateDownload() {
  const onClick = () => trackEvent(supabase, 'landing_page_view', {
    page_path: TEMPLATE, dealer_id: null, metadata: { source: ARTICLE.slug },
  });
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22 }}>
      <p style={{ fontWeight: 700, fontSize: 17, color: '#111827', margin: '0 0 6px' }}>Template Excel percuma: Kira Loan + Rekod Prospek</p>
      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
        Isi harga, deposit dan kadar (flat atau EIR); monthly 9, 7 dan 5 tahun keluar sendiri, kadar flat ditukar ke EIR. Termasuk helaian rekod prospek. Untuk Excel, Google Sheets dan LibreOffice. Tiada daftar, terus muat turun.
      </p>
      <a href={TEMPLATE} download onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 10, textDecoration: 'none' }}>
        <Download size={16} /> Muat turun template (.xlsx)
      </a>
    </div>
  );
}

export default function KiraLoanKeretaExcelArticle() {
  return (
    <>
      <Helmet>
        <title>{ARTICLE.title} · Drevo</title>
        <meta name="description" content={ARTICLE.description} />
        <meta property="og:title" content={ARTICLE.title} />
        <meta property="og:description" content={ARTICLE.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="article:published_time" content={ARTICLE.datePublished} />
        <meta property="article:modified_time" content={ARTICLE.dateModified} />
        <link rel="canonical" href={PAGE_URL} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: 'var(--xd-font-body)' }}>
        <MarketplaceHeader />

        <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 20px 64px' }}>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Utama</Link>
            <ChevronRight size={12} />
            <Link to="/articles" style={{ color: '#9ca3af', textDecoration: 'none' }}>Panduan</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Kira loan kereta guna Excel</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Salesman
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Cara Kira Loan Kereta Guna Excel:<br />
              <span style={{ color: '#dc2626' }}>Formula PMT, Flat ke EIR (Template Percuma)</span>
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
              <span>Drevo</span>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#b8bcc4', fontStyle: 'italic' }}>
              Artikel ini ditulis oleh AI. Ia panduan umum, bukan nasihat kewangan.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={P}>
                <strong style={STRONG}>Jawapan ringkas:</strong> ansuran bulanan kereta dalam Excel ialah <code style={CODE}>=PMT(kadar/12, tahun*12, -pinjaman)</code>, dengan kadar dalam <strong style={STRONG}>EIR</strong>. Kalau anda cuma ada kadar flat, tukar dulu ke EIR. Kalau tidak, sheet anda tunjuk monthly yang terlalu rendah, dan pembeli terkejut bila surat bank sampai.
              </p>
              <p style={P}>
                Panduan ini tunjuk formula satu per satu, cara tukar flat ke EIR, contoh pinjaman RM54,000, dan ada template Excel percuma di bawah.
              </p>
            </section>

            <TemplateDownload />

            <section>
              <h2 style={H2}>Langkah 1: Susun Sheet Anda</h2>
              <p style={P}>
                Buka Excel atau Google Sheets dan taip begini. Lajur A ialah label, lajur B ialah nilai.
              </p>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      {SHEET[0].map((col) => <th key={col} style={{ ...(col === 'A' ? CELL_L : CELL), fontWeight: 700 }}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {SHEET.slice(1).map(([a, b, note], i) => (
                      <tr key={a}>
                        <td style={CELL_L}>{i + 2}. {a}</td>
                        <td style={{ ...CELL, fontFamily: CODE.fontFamily }}>{b}</td>
                        <td style={{ ...CELL, color: '#6b7280' }}>{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Sel B7 ialah ansuran bulanan. Tanda tolak sebelum B4 cuma untuk dapat jawapan positif; tanpa ia, Excel tunjuk nombor negatif.
              </p>
            </section>

            <section>
              <h2 style={H2}>Langkah 2: Faham Formula PMT</h2>
              <Checklist items={[
                'B5/12: kadar setahun dibahagi 12 jadi kadar sebulan. Lupa bahagi 12, dan monthly keluar berlipat kali ganda.',
                'B6*12: tempoh dalam tahun didarab 12 jadi bilangan bulan. Kalau tempoh dah dalam bulan, jangan darab lagi.',
                '-B4: jumlah pinjaman, iaitu harga tolak deposit. Bukan harga kereta.',
                'Kadar mesti EIR. PMT mengira faedah atas baki yang tinggal setiap bulan, cara yang sama bank kira sekarang.',
              ]} />
            </section>

            <section>
              <h2 style={H2}>Langkah 3: Tukar Kadar Flat ke EIR</h2>
              <p style={P}>
                Di showroom ramai masih sebut kadar flat, contohnya "3.5%". Kadar flat kira faedah atas jumlah asal pinjaman sepanjang tempoh, jadi untuk monthly yang sama, EIR-nya jauh lebih tinggi. Dua formula untuk tukar:
              </p>
              <Checklist items={[
                'Ansuran flat: =B4*(1+3.5%*B6)/(B6*12). Ini monthly yang showroom kira dengan kadar flat.',
                'EIR setahun: =RATE(B6*12, -ansuran_flat, B4)*12. Taip hasilnya di B5, dan PMT akan beri monthly yang sama.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Untuk pinjaman <strong style={STRONG}>RM54,000 pada 3.5% flat</strong>, inilah hasilnya:
              </p>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ ...CELL_L, fontWeight: 700, color: '#111827' }}>Tempoh</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>EIR</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Ansuran bulanan</th>
                      <th style={{ ...CELL, fontWeight: 700 }}>Jumlah faedah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESULTS.map(([t, e, m, i]) => (
                      <tr key={t}>
                        <td style={CELL_L}>{t}</td>
                        <td style={CELL}>{e}</td>
                        <td style={{ ...CELL, color: '#dc2626', fontWeight: 600 }}>{m}</td>
                        <td style={CELL}>{i}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 style={H2}>Kesilapan Paling Biasa: Taip Flat Sebagai EIR</h2>
              <p style={P}>
                Kalau 3.5% flat ditaip terus dalam PMT, pinjaman RM54,000 selama 7 tahun keluar <strong style={STRONG}>RM725.75 sebulan</strong>. Ansuran sebenar ialah <strong style={STRONG}>RM800.36</strong>. Itu kurang RM74.61 setiap bulan, lebih RM6,200 sepanjang 7 tahun.
              </p>
              <p style={P}>
                Bagi salesman, ini cara paling cepat hilang kepercayaan pembeli: monthly yang dijanji di live tak sama dengan surat tawaran bank. Kenapa undang-undang berubah, dan apa maksudnya untuk pembeli, ada dalam panduan kami tentang <Link to="/articles/akta-sewa-beli-2026-eir-pinjaman-kereta" style={LINK}>Akta Sewa Beli (Pindaan) 2026</Link>.
              </p>
            </section>

            <section>
              <h2 style={H2}>Bila Excel Jadi Leceh</h2>
              <p style={P}>
                Satu sheet sesuai untuk satu kereta. Masalahnya bila anda ada 10 kereta dan penonton live tanya deposit lain untuk setiap satu: taip semula harga, deposit dan kadar, sementara live menunggu.
              </p>
              <p style={P}>
                Itu sebab kami buat <Link to="/for-salesmen" style={{ ...LINK, fontWeight: 600 }}>kalkulator loan untuk salesman</Link>: setiap kereta yang anda listing dah siap monthly 9, 7 dan 5 tahun, kadar flat ditukar ke EIR, dan deposit bertukar dengan satu tap depan penonton. Formula yang sama dengan sheet di atas, cuma anda tak perlu taip.
              </p>
            </section>

            <section>
              <h2 style={{ ...H2, marginBottom: 20 }}>Soalan Lazim</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {FAQS.map(({ q, a }, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: 14, marginBottom: 8 }}>{q}</p>
                    <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.65, margin: 0 }}>{a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Monthly Siap untuk Setiap Kereta</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Kalkulator loan untuk live, dashboard dan CRM lead dalam satu app. Mula percuma. Anggaran sahaja; bank yang tentukan.
              </p>
              <Link to="/for-salesmen" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
                Tengok app untuk salesman
              </Link>
            </div>

          </div>
        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, CheckCircle, Download } from 'lucide-react';
import MarketplaceHeader from '../../components/MarketplaceHeader';
import MarketplaceFooter from '../../components/MarketplaceFooter';
import { SITE_URL } from '../../config/site';
import { supabase } from '../../supabaseClient';
import { trackEvent } from '../../utils/analytics';

// Search gap (2026-10-28): "template prospek salesman kereta" / "rekod prospek
// pelanggan" returned only generic foreign trackers. The columns and stages
// here are the ones in the free template (tools/build-salesman-template.py).
// PDPA facts checked 2026-10-28: Act 709 covers commercial transactions, seven
// principles incl. security + retention, 2024 amendment raised fines to
// RM1,000,000 / 3 years, s.43 lets a person stop direct marketing. No invented
// conversion statistics; the message samples carry no price or approval.

const ARTICLE = {
  slug: 'template-excel-rekod-prospek-salesman-kereta',
  title: 'Template Excel Rekod Prospek untuk Salesman Kereta (Percuma) + Cara Follow Up',
  description:
    'Template Excel percuma untuk rekod prospek dan lead pelanggan kereta: lajur yang perlu ada, stage dari Baru hingga Menang, follow up yang jadi merah bila sampai masa, contoh mesej WhatsApp, dan cara simpan data pelanggan ikut PDPA.',
  datePublished: '2026-10-28',
  dateModified: '2026-10-28',
  readMins: 8,
};

const PAGE_URL = `${SITE_URL}/articles/${ARTICLE.slug}`;
const TEMPLATE = '/downloads/template-salesman-kereta.xlsx';

const FAQS = [
  {
    q: 'Apa yang perlu ada dalam rekod prospek salesman kereta?',
    a: 'Sekurang-kurangnya: tarikh masuk, nama, nombor telefon, dari mana dia datang (WhatsApp, TikTok, walk-in), kereta yang diminati, bajet monthly, stage, tarikh terakhir dihubungi, tarikh follow up seterusnya dan nota. Lajur follow up seterusnya paling penting: tanpanya, pembeli yang senyap hilang begitu sahaja.',
  },
  {
    q: 'Apa stage yang sesuai untuk lead kereta?',
    a: 'Baru, Dihubungi, Viewing, Test drive, Rundingan, Deposit, kemudian Menang atau Kalah. Satu pembeli satu stage. Bila stage berubah, tukar terus supaya anda tahu berapa ramai di setiap peringkat.',
  },
  {
    q: 'Bila patut follow up pembeli kereta?',
    a: 'Balas mesej pertama secepat mungkin, kemudian tetapkan tarikh follow up seterusnya setiap kali anda hubungi dia. Setiap follow up patut ada sebab: gambar tambahan, slot test drive, atau jawapan kepada soalan dia. Kalau dia minta berhenti, berhenti.',
  },
  {
    q: 'Salesman kena ikut PDPA ke bila simpan nombor pelanggan?',
    a: 'Akta Perlindungan Data Peribadi 2010 terpakai kepada data peribadi dalam urus niaga komersial, dan jualan kereta ialah urus niaga komersial. Simpan data dengan selamat, jangan kongsi, padam bila dah tak perlu, dan berhenti hantar promosi kepada sesiapa yang minta. Sejak pindaan 2024, denda maksimum ialah RM1,000,000 atau penjara sehingga 3 tahun. Ini panduan umum, bukan nasihat undang-undang.',
  },
  {
    q: 'Template ni boleh guna di Google Sheets?',
    a: 'Boleh. Muat naik fail .xlsx ke Google Drive dan buka dengan Google Sheets. Senarai pilihan stage, warna merah untuk follow up yang dah sampai masa dan helaian ringkasan semuanya berfungsi.',
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

// The template's Prospek columns, in order, with why each one earns its place.
const COLUMNS = [
  ['Tarikh masuk', 'Bila dia mula hubungi anda. Lead lama yang tak bergerak nampak terus.'],
  ['Nama', 'Nama yang dia guna dalam chat.'],
  ['No. telefon', 'Untuk WhatsApp dan call. Data peribadi: jaga elok-elok.'],
  ['Sumber', 'WhatsApp, TikTok, Facebook, walk-in, rujukan. Lama-lama anda nampak mana yang bawa pembeli sebenar.'],
  ['Kereta diminati', 'Model, atau kereta tertentu dalam stok anda.'],
  ['Bajet monthly', 'Angka yang DIA sebut. Jangan teka untuk dia.'],
  ['Stage', 'Baru hingga Menang atau Kalah. Pilih dari senarai.'],
  ['Hubungi terakhir', 'Tarikh anda terakhir bercakap dengan dia.'],
  ['Follow up seterusnya', 'Lajur paling penting. Baris jadi merah bila tarikh ini sampai.'],
  ['Nota', 'Deposit yang dia tanya, trade-in, siapa yang buat keputusan.'],
];

const STAGES = [
  ['Baru', 'Mesej pertama masuk, belum dibalas.'],
  ['Dihubungi', 'Anda dah balas dan dia respon.'],
  ['Viewing', 'Dia setuju datang tengok kereta.'],
  ['Test drive', 'Dia dah pandu kereta itu.'],
  ['Rundingan', 'Bincang harga, trade-in atau loan.'],
  ['Deposit', 'Dia dah bayar deposit.'],
  ['Menang / Kalah', 'Kereta diserah, atau dia beli tempat lain. Tutup baris supaya senarai anda bersih.'],
];

const MESSAGES = [
  ['Selepas viewing', 'Salam [nama], terima kasih datang tengok [kereta] tadi. Ada apa-apa soalan yang saya boleh jawab?'],
  ['Pembeli senyap 3 hari', 'Salam [nama], [kereta] yang awak tanya hari tu masih ada. Nak saya hantar gambar bahagian dalam?'],
  ['Selepas test drive', 'Salam [nama], macam mana rasa pandu [kereta] semalam? Kalau nak, saya boleh semak dengan bank berapa monthly yang sesuai untuk awak.'],
];

const P = { color: '#4b5563', lineHeight: 1.75, marginBottom: 12, fontSize: 16 };
const H2 = { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 };
const STRONG = { color: '#111827' };
const LINK = { color: '#dc2626' };
const CELL = { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'left', color: '#4b5563', verticalAlign: 'top' };
const CELL_H = { ...CELL, color: '#111827', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 0 };
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

// Same file as the loan article; the click is counted the same way
// (landing_page_view on the file's path, source = this article).
function TemplateDownload() {
  const onClick = () => trackEvent(supabase, 'landing_page_view', {
    page_path: TEMPLATE, dealer_id: null, metadata: { source: ARTICLE.slug },
  });
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22 }}>
      <p style={{ fontWeight: 700, fontSize: 17, color: '#111827', margin: '0 0 6px' }}>Template Excel percuma: Rekod Prospek + Kira Loan</p>
      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
        300 baris prospek dengan senarai pilihan sumber dan stage, baris merah bila follow up sampai masa, helaian ringkasan, dan kalkulator loan (flat ke EIR). Untuk Excel, Google Sheets dan LibreOffice. Tiada daftar, terus muat turun.
      </p>
      <a href={TEMPLATE} download onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 10, textDecoration: 'none' }}>
        <Download size={16} /> Muat turun template (.xlsx)
      </a>
    </div>
  );
}

export default function TemplateProspekSalesmanArticle() {
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
            <span style={{ color: '#6b7280' }}>Template rekod prospek</span>
          </nav>

          <header style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '4px 10px', borderRadius: 99 }}>
                Salesman
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', lineHeight: 1.15, margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Template Excel Rekod Prospek untuk Salesman Kereta:<br />
              <span style={{ color: '#dc2626' }}>Percuma, Dengan Cara Follow Up</span>
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
              Artikel ini ditulis oleh AI. Ia panduan umum, bukan nasihat undang-undang.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

            <section>
              <p style={P}>
                <strong style={STRONG}>Jawapan ringkas:</strong> satu baris untuk setiap pembeli, satu stage untuk setiap baris, dan satu tarikh follow up yang anda isi setiap kali anda hubungi dia. Itu sahaja yang membezakan senarai prospek yang menjual dengan senarai nama yang dilupakan.
              </p>
              <p style={P}>
                Lead salesman kereta datang dari mana-mana: WhatsApp, komen TikTok, Facebook, walk-in, kawan kepada kawan. Tanpa satu tempat untuk semua, pembeli yang senyap tiga hari hilang terus. Template di bawah ialah tempat itu.
              </p>
            </section>

            <TemplateDownload />

            <section>
              <h2 style={H2}>Lajur Yang Perlu Ada</h2>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 420 }}>
                  <tbody>
                    {COLUMNS.map(([c, why]) => (
                      <tr key={c}>
                        <td style={CELL_H}>{c}</td>
                        <td style={CELL}>{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Jangan simpan nombor IC dalam sheet ini. Anda cuma perlukannya bila dokumen loan disediakan, dan sheet prospek bukan tempat yang selamat untuknya.
              </p>
            </section>

            <section>
              <h2 style={H2}>Stage: Dari Baru Hingga Menang</h2>
              <div style={TABLE_BOX}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 360 }}>
                  <tbody>
                    {STAGES.map(([s, d], i) => (
                      <tr key={s}>
                        <td style={CELL_H}>{i + 1}. {s}</td>
                        <td style={CELL}>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...P, marginTop: 16 }}>
                Helaian Ringkasan dalam template kira berapa ramai di setiap stage. Kalau ramai tersekat di Dihubungi tapi sedikit yang sampai Viewing, di situlah anda perlu ubah cara.
              </p>
            </section>

            <section>
              <h2 style={H2}>Cara Follow Up Pembeli Kereta</h2>
              <Checklist items={[
                'Balas mesej pertama secepat mungkin. Pembeli yang tanya beberapa salesman serentak biasanya pergi kepada yang balas dulu.',
                'Setiap kali anda hubungi dia, isi Follow up seterusnya. Tarikh kosong bermakna pembeli itu akan dilupakan.',
                'Mulakan hari dengan baris merah. Itu pembeli yang dah sampai masa untuk dihubungi.',
                'Setiap follow up ada sebab: gambar tambahan, slot test drive, jawapan kepada soalan dia. "Jadi ke?" bukan sebab.',
                'Jangan janji monthly, kelulusan atau diskaun yang belum disahkan. Biar bank dan bos yang sahkan.',
                'Kalau dia kata tak berminat atau minta berhenti, tanda Kalah dan berhenti mesej.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Contoh mesej WhatsApp. Tukar perkataan dalam kurungan:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MESSAGES.map(([when, msg]) => (
                  <div key={when} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>{when}</p>
                    <p style={{ fontSize: 15, color: '#111827', lineHeight: 1.6, margin: 0 }}>{msg}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={H2}>Data Pelanggan dan PDPA</h2>
              <p style={P}>
                Nama dan nombor telefon pembeli ialah data peribadi. Akta Perlindungan Data Peribadi 2010 terpakai kepada data peribadi dalam urus niaga komersial, dan ia ada tujuh prinsip, termasuk <strong style={STRONG}>keselamatan</strong> (jaga data daripada hilang atau disalah guna) dan <strong style={STRONG}>penyimpanan</strong> (jangan simpan lebih lama daripada perlu). Pindaan 2024 menaikkan denda maksimum kepada RM1,000,000 atau penjara sehingga 3 tahun.
              </p>
              <Checklist items={[
                'Letak kata laluan pada fail, dan jangan hantar sheet ini dalam group WhatsApp.',
                'Padam pembeli yang dah lama Kalah dan tak berurusan lagi dengan anda.',
                'Jangan masukkan nombor yang anda ambil dari tempat lain tanpa pembeli itu sendiri hubungi anda.',
                'Seseorang boleh minta anda berhenti hantar promosi. Bila dia minta, berhenti dan tandakan dalam nota.',
              ]} />
              <p style={{ ...P, marginTop: 16 }}>
                Ini panduan umum. Untuk situasi tertentu, rujuk Jabatan Perlindungan Data Peribadi atau peguam.
              </p>
            </section>

            <section>
              <h2 style={H2}>Bila Excel Tak Cukup</h2>
              <p style={P}>
                Excel cuma tahu apa yang anda taip. Setiap lead dari WhatsApp, chat dan booking kena dipindah tangan, dan tiada siapa ingatkan anda bila baris jadi merah kalau anda tak buka fail itu.
              </p>
              <p style={P}>
                Dalam <Link to="/for-salesmen" style={{ ...LINK, fontWeight: 600 }}>app untuk salesman kereta</Link> kami, setiap pembeli yang hubungi anda masuk sendiri ke senarai lead dengan stage, dan telefon anda dapat alert, percuma. Premium tambah reminder follow up, log panggilan dan senarai "Minggu ini" siapa perlu di-call. Nak kira monthly untuk pembeli pula? Baca <Link to="/articles/cara-kira-loan-kereta-excel" style={LINK}>cara kira loan kereta guna Excel</Link>.
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
              <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Lead Masuk Sendiri, Tak Perlu Taip</p>
              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                CRM lead, dashboard dan kalkulator loan untuk live dalam satu app. Mula percuma.
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

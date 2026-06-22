import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, BookOpen } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';

const ARTICLES = [
  {
    slug: 'apa-itu-puspakom-b5-b7',
    title: 'Apa Itu Puspakom B5 & B7? Panduan Penuh untuk Dealer & Pembeli (2026)',
    description: 'Fahami perbezaan pemeriksaan Puspakom B5 dan B7, berapa kos sebenar, bila wajib dibuat, dan apa yang berlaku jika gagal.',
    category: 'Pindah Milik',
    readMins: 6,
  },
  {
    slug: 'cara-pindah-milik-kereta-mysikap',
    title: 'Cara Pindah Milik Kereta Online Guna MySikap 2026 — Panduan Lengkap',
    description: 'Panduan langkah demi langkah cara buat pindah milik kereta secara online menggunakan sistem MySikap JPJ 2026. Dokumen diperlukan, kos, dan tips.',
    category: 'Pindah Milik',
    readMins: 7,
  },
  {
    slug: 'beza-kereta-recon-dan-terpakai',
    title: 'Beza Kereta Recon & Terpakai — Mana Lebih Berbaloi? (2026)',
    description: 'Apa beza kereta recon dan kereta terpakai di Malaysia? Panduan lengkap tentang kelebihan, kelemahan, kos tersembunyi, dan mana yang lebih berbaloi.',
    category: 'Panduan Beli',
    readMins: 8,
  },
  {
    slug: 'apa-itu-dms-dealer-kereta',
    title: 'Apa Itu Dealer Management System (DMS) Dan Kenapa Dealer Kereta Perlu Guna',
    description: 'Penjelasan lengkap apa itu DMS untuk kereta, kenapa dealer kereta terpakai Malaysia perlu guna, dan beza DMS dengan platform iklan seperti Mudah & Carlist.',
    category: 'Urus Dealer',
    readMins: 8,
  },
  {
    slug: 'cara-urus-stok-kereta-terpakai-sistem-digital',
    title: 'Cara Urus Stok Kereta Terpakai Dengan Sistem Digital (2026)',
    description: 'Tinggalkan Excel & WhatsApp. Panduan cara urus stok kereta terpakai Malaysia guna app urus stok kereta — pantau kos, umur stok dan keuntungan automatik.',
    category: 'Urus Dealer',
    readMins: 7,
  },
  {
    slug: 'app-terbaik-dealer-kereta-terpakai-malaysia',
    title: 'App Terbaik Untuk Dealer Kereta Terpakai Di Malaysia 2025',
    description: 'Bandingkan app terbaik dan software dealer kereta Malaysia untuk dealer kereta terpakai — ciri, harga dan kelebihan setiap pilihan.',
    category: 'Urus Dealer',
    readMins: 8,
  },
  {
    slug: 'cara-kira-komisen-salesman-kereta',
    title: 'Cara Kira Komisen Salesman Kereta Dengan Betul (2026)',
    description: 'Formula komisen salesman kereta, kesilapan biasa yang menghakis margin, dan cara buat rekod komisen salesmen kereta secara automatik.',
    category: 'Urus Dealer',
    readMins: 7,
  },
  {
    slug: 'cara-buat-sales-agreement-kereta-terpakai',
    title: 'Cara Buat Sales Agreement Kereta Terpakai Malaysia (2026)',
    description: 'Apa yang wajib ada dalam sales agreement kereta terpakai, contoh klausa, dan cara automasikan dokumen jualan guna software rekod jualan kereta.',
    category: 'Urus Dealer',
    readMins: 7,
  },
];

const PAGE_TITLE = 'Panduan Kereta Malaysia — XDrive';
const PAGE_DESCRIPTION =
  'Koleksi panduan lengkap untuk pembeli dan penjual kereta di Malaysia. Pindah milik, Puspakom, kereta recon, kewangan, dan lebih banyak lagi — semuanya dalam Bahasa Malaysia.';

export default function ArticlesIndexPage() {
  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://xdrive.my/articles" />
        <link rel="canonical" href="https://xdrive.my/articles" />
      </Helmet>

      <div style={{ minHeight: '100vh', background: '#F7F6F2', fontFamily: "'DM Sans', sans-serif" }}>
        <MarketplaceHeader />

        <main style={{ paddingTop: 72, maxWidth: 800, margin: '0 auto', padding: '72px 20px 64px' }}>

          {/* Breadcrumb */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>
            <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Laman Utama</Link>
            <ChevronRight size={12} />
            <span style={{ color: '#6b7280' }}>Panduan</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <BookOpen size={16} style={{ color: '#dc2626' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#dc2626' }}>Pusat Panduan</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.8rem,5vw,2.6rem)', fontWeight: 800, color: '#111827', margin: '0 0 12px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}>
              Panduan Kereta Malaysia
            </h1>
            <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.7, maxWidth: 560, margin: 0 }}>
              Semua yang perlu anda tahu tentang beli, jual, dan miliki kereta di Malaysia. Ditulis dalam Bahasa Malaysia, dikemas kini untuk 2026.
            </p>
          </header>

          {/* Articles list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ARTICLES.map((article) => (
              <Link
                key={article.slug}
                to={`/articles/${article.slug}`}
                style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 22px', textDecoration: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '3px 8px', borderRadius: 99 }}>
                      {article.category}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9ca3af' }}>
                      <Clock size={10} />
                      {article.readMins} min
                    </span>
                  </div>
                  <p style={{ fontWeight: 700, color: '#111827', fontSize: 15, lineHeight: 1.4, margin: '0 0 6px' }}>
                    {article.title}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {article.description}
                  </p>
                </div>
                <ChevronRight size={18} style={{ color: '#d1d5db', flexShrink: 0, marginTop: 4 }} />
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 48, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>Sedia Beli Kereta?</p>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              Semak ribuan listing kereta terpakai dan recon dari dealer berdaftar di seluruh Malaysia.
            </p>
            <Link to="/showroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 22px', borderRadius: 10, textDecoration: 'none' }}>
              Lihat Semua Kereta
            </Link>
          </div>

        </main>

        <MarketplaceFooter />
      </div>
    </>
  );
}

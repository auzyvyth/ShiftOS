import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Instagram, Facebook, Mail, Shield, Zap, BookOpen, Car, Users, BarChart3, ArrowUpRight, ChevronDown } from 'lucide-react';
import { isSubdomain } from '../hooks/useTenant';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';
import { PLAN_CONFIG } from '../utils/planConfig';

const TRUST_ICONS = [Shield, BookOpen, Users, Car];

// Footer pricing tiers — each renders as a click-to-expand dropdown. Prices/caps
// come from planConfig (single source of truth) so footer copy never drifts.
const FOOTER_TIERS = [
  { key: 'dealer_starter',  href: '/shiftos#pricing' },
  { key: 'dealer_growth',   href: '/shiftos#pricing' },
  { key: 'dealer_pro',      href: '/shiftos#pricing' },
  { key: 'salesman_lite',   href: '/shiftos?for=salesman#pricing' },
  { key: 'salesman_full',   href: '/shiftos?for=salesman#pricing' },
];
const tierCaps = (k) => {
  const c = PLAN_CONFIG[k];
  return c.listingCap == null
    ? 'Unlimited listings & team seats'
    : `${c.listingCap} listings · ${c.seatCap} seat${c.seatCap > 1 ? 's' : ''}`;
};

export default function MarketplaceFooter() {
  const { settings, copyright } = useMarketplaceSettings();
  const [openTier, setOpenTier] = useState(null);

  if (isSubdomain()) return null;

  const NAV = [
    {
      heading: 'For Buyers',
      links: [
        { label: 'Browse All Cars',    to: '/showroom' },
        { label: 'Search by Brand',    to: '/showroom#brands' },
        { label: 'Hot Deals',          to: '/showroom?hot_deals=true' },
        { label: 'Compare Cars',       to: '/compare' },
        { label: 'Saved Listings',     to: '/saved' },
        { label: 'Finance Calculator', to: '/calculator' },
        { label: "Buyer's Guide",      to: '/guides/buying' },
      ],
    },
    {
      heading: 'Product',
      links: [
        { label: 'ShiftOS DMS',        to: '/shiftos' },
        { label: 'Smart Inventory',    to: '/features/smart-inventory' },
        { label: 'Leads CRM',          to: '/features/leads-crm' },
        { label: 'Revenue Analytics',  to: '/features/revenue-analytics' },
        { label: 'F&I & Documents',    to: '/features/fi-documents' },
        { label: 'Post-Sale Handover', to: '/features/post-sale-handover' },
        { label: 'Partner with XDrive', href: `https://wa.me/${settings.support_whatsapp}?text=${encodeURIComponent("Hi! I'm interested in partnering with XDrive / ShiftOS for my dealership. Can we discuss?")}` },
      ],
    },
    {
      heading: 'Panduan & Artikel',
      links: [
        { label: 'Semua Panduan',              to: '/articles' },
        { label: 'Apa Itu Puspakom B5 & B7?',  to: '/articles/apa-itu-puspakom-b5-b7' },
        { label: 'Cara Pindah Milik MySikap',  to: '/articles/cara-pindah-milik-kereta-mysikap' },
        { label: 'Kereta Recon vs Terpakai',   to: '/articles/beza-kereta-recon-dan-terpakai' },
      ],
    },
    {
      heading: 'Help & Legal',
      links: [
        { label: 'How It Works',     to: '/guides/how-it-works' },
        { label: 'FAQ',              to: '/guides/faq' },
        { label: 'Terms of Service', to: '/terms' },
        { label: 'Privacy Policy',   to: '/privacy' },
        { label: 'Contact Us',       href: `mailto:${settings.support_email}` },
      ],
    },
  ];

  const socialLinks = [
    { icon: MessageCircle, href: `https://wa.me/${settings.support_whatsapp}`, label: 'WhatsApp' },
    settings.social_instagram ? { icon: Instagram, href: settings.social_instagram, label: 'Instagram' } : null,
    settings.social_facebook  ? { icon: Facebook,  href: settings.social_facebook,  label: 'Facebook'  } : null,
    { icon: Mail, href: `mailto:${settings.support_email}`, label: 'Email' },
  ].filter(Boolean);

  return (
    <footer className="bg-white border-t border-gray-100" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── ShiftOS DMS band ─────────────────────────────────────────── */}
      {settings.shiftos_band_enabled && (
        <div id="shiftos" className="bg-gray-950 border-b border-white/5">
          <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-red-500" />
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-red-500">For Dealers</span>
              </div>
              <h3 className="text-white text-xl font-bold leading-snug mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.03em' }}>
                Run Your Dealership on ShiftOS
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                The complete dealer management system built for Malaysian car dealers. Manage listings, track leads in a visual CRM, monitor salesman performance, handle F&I documents, and see your revenue analytics — all in one place.
              </p>
            </div>

            <div className="flex-shrink-0 flex flex-col gap-4 w-full md:w-auto">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {[
                  { icon: Car,       label: 'Smart Inventory' },
                  { icon: Users,     label: 'Leads CRM' },
                  { icon: BarChart3, label: 'Revenue Analytics' },
                  { icon: BookOpen,  label: 'F&I Documents' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon size={12} className="text-red-500 flex-shrink-0" />
                    <span className="text-gray-300 text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/shiftos"
                className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                Start Free Trial <ArrowUpRight size={13} />
              </Link>
              <p className="text-gray-600 text-[11px] text-center">From RM 1,000/mo · No setup fee</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Trust bar — same guarantee language as the hero trust strip, given
            equivalent visual weight here rather than small throwaway text. ── */}
      <div className="border-b border-gray-100" style={{ background: '#F2F0EC' }}>
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap justify-center gap-x-10 gap-y-4">
          {(settings.trust_badges || []).map(({ text }, i) => {
            const Icon = TRUST_ICONS[i % TRUST_ICONS.length];
            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}
                >
                  <Icon size={16} className="text-red-600" />
                </div>
                <span className="text-sm font-semibold" style={{ color: '#111827' }}>{text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main link grid ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-x-8 gap-y-10">

        {/* Brand column */}
        <div>
          <div className="text-2xl font-black text-gray-900 tracking-tight mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
            <span className="text-red-600">X</span>DRIVE
          </div>
          <p className="text-gray-400 text-[13px] leading-relaxed mb-5">
            {settings.brand_tagline}
          </p>

          <div className="flex gap-3">
            {socialLinks.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-400 flex items-center justify-center transition-colors"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {/* Nav columns */}
        {NAV.map(({ heading, links }) => (
          <div key={heading}>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400 mb-4">{heading}</p>
            <ul className="space-y-2.5">
              {links.map(({ label, to, href }) => (
                <li key={label}>
                  {to ? (
                    <Link to={to} className="text-[13px] text-gray-500 hover:text-red-600 transition-colors">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} className="text-[13px] text-gray-500 hover:text-red-600 transition-colors">
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Pricing — one expandable dropdown per tier */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400 mb-4">Pricing</p>
          <ul className="space-y-1">
            {FOOTER_TIERS.map(({ key, href }) => {
              const cfg = PLAN_CONFIG[key];
              const open = openTier === key;
              return (
                <li key={key} className="border-b border-gray-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenTier(open ? null : key)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-2 py-2 text-left group"
                  >
                    <span className="text-[13px] font-semibold text-gray-700 group-hover:text-red-600 transition-colors">
                      {cfg.label}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[11px] font-bold text-gray-400">
                        {cfg.price ? `RM${cfg.price}` : 'Free'}
                      </span>
                      <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {open && (
                    <div className="pb-3 pl-0.5">
                      <p className="text-[12px] text-gray-500 leading-relaxed mb-2">{tierCaps(key)}</p>
                      <Link to={href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 hover:text-red-700 transition-colors">
                        View plan <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-950">
        <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-gray-600 text-[11px]">{copyright}</p>
          <Link to="/shiftos" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors" style={{ textDecoration: 'none' }}>
            <span>Powered by</span>
            <span className="text-white font-bold tracking-wide">ShiftOS</span>
            <Zap size={10} className="text-red-500" />
          </Link>
        </div>
      </div>

    </footer>
  );
}

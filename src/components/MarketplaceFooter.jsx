import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Instagram, Facebook, Mail, Shield, Zap, BookOpen, Car, Users, BarChart3, ArrowUpRight } from 'lucide-react';

const NAV = [
  {
    heading: 'For Buyers',
    links: [
      { label: 'Browse All Cars',       to: '/showroom' },
      { label: 'Search by Brand',       to: '/showroom?brand=' },
      { label: 'Hot Deals',             to: '/marketplace?hot_deals=true' },
      { label: 'Compare Cars',          to: '/compare' },
      { label: 'Saved Listings',        to: '/saved' },
      { label: 'Finance Calculator',    to: '/calculator' },
      { label: 'Buyer\'s Guide',        to: '/guides/buying' },
    ],
  },
  {
    heading: 'For Dealers',
    links: [
      { label: 'List Your Inventory',   to: '/signup' },
      { label: 'ShiftOS DMS',           href: '#shiftos' },
      { label: 'Dealer Pricing',        to: '/signup' },
      { label: 'Partner with XDrive',   to: '/signup' },
    ],
  },
  {
    heading: 'Help & Legal',
    links: [
      { label: 'How It Works',          to: '/guides/how-it-works' },
      { label: 'FAQ',                   to: '/guides/faq' },
      { label: 'Terms of Service',      to: '/terms' },
      { label: 'Privacy Policy',        to: '/privacy' },
      { label: 'Contact Us',            href: 'mailto:hello@xdrive.my' },
    ],
  },
];

const TRUST = [
  { icon: Shield,    text: 'Every listing verified' },
  { icon: BookOpen,  text: 'Full ownership docs' },
  { icon: Users,     text: 'Certified dealers only' },
  { icon: Car,       text: 'Zero phantom listings' },
];

export default function MarketplaceFooter() {
  return (
    <footer className="bg-white border-t border-gray-100" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── ShiftOS DMS band ─────────────────────────────────────────── */}
      <div id="shiftos" className="bg-gray-950 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-16">
          {/* Left: pitch */}
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

          {/* Right: feature list + CTA */}
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
              to="/signup"
              className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
            >
              Start Free Trial <ArrowUpRight size={13} />
            </Link>
            <p className="text-gray-600 text-[11px] text-center">From RM 1,000/mo · No setup fee</p>
          </div>
        </div>
      </div>

      {/* ── Trust bar ────────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 py-4 flex flex-wrap justify-center gap-x-10 gap-y-2">
          {TRUST.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon size={13} className="text-red-500 flex-shrink-0" />
              <span className="text-gray-500 text-xs font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main link grid ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand column */}
        <div>
          <div className="text-2xl font-black text-gray-900 tracking-tight mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
            <span className="text-red-600">X</span>DRIVE
          </div>
          <p className="text-gray-400 text-[13px] leading-relaxed mb-5">
            Malaysia's first fully-verified car marketplace. Every car. Every budget. Every dealer — certified.
          </p>

          {/* Social / contact */}
          <div className="flex gap-3">
            {[
              { icon: MessageCircle, href: 'https://wa.me/60174155191', label: 'WhatsApp' },
              { icon: Instagram,     href: 'https://instagram.com/xdrive.my', label: 'Instagram' },
              { icon: Facebook,      href: 'https://facebook.com/xdrive.my', label: 'Facebook' },
              { icon: Mail,          href: 'mailto:hello@xdrive.my', label: 'Email' },
            ].map(({ icon: Icon, href, label }) => (
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
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-950">
        <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-gray-600 text-[11px]">
            © {new Date().getFullYear()} XDrive Malaysia Sdn Bhd. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <span>Powered by</span>
            <span className="text-white font-bold tracking-wide">ShiftOS</span>
            <Zap size={10} className="text-red-500" />
          </div>
        </div>
      </div>

    </footer>
  );
}

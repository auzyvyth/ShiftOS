import React from 'react';

// A row of jump chips pinned under the top of the viewport on a Premium page
// (PAGE-SITE, 2026-11-25), so the page reads as a small website: Cars,
// Calculator, About, Why me, Track record, Find me. Only sections that exist
// are listed; with fewer than three the bar is not worth showing.
export default function PageNav({ items }) {
  const list = (items || []).filter(Boolean);
  if (list.length < 3) return null;
  const go = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <nav className="pn" aria-label="Sections on this page">
      <style>{`
        .pn { position: sticky; top: 0; z-index: 20; display: flex; gap: 8px; overflow-x: auto; margin: 0 0 4px; padding: 10px 0; scrollbar-width: none; background: linear-gradient(var(--ap-bg, #F7F6F2) 70%, rgba(247,246,242,0)); }
        .pn::-webkit-scrollbar { display: none; }
        .pn a { flex: 0 0 auto; display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 999px; background: var(--ap-surf, #fff); color: #111827; font-size: 13.5px; font-weight: 800; text-decoration: none; box-shadow: 0 1px 2px rgba(15,23,42,.1), 0 4px 12px rgba(15,23,42,.06); }
        .pn a:hover { background: #fff; }
        .pn a:active { translate: 0 1px; }
        @media (prefers-reduced-motion: reduce) { .pn a:active { translate: none; } }
      `}</style>
      {list.map((it) => <a key={it.id} href={`#${it.id}`} onClick={go(it.id)}>{it.label}</a>)}
    </nav>
  );
}

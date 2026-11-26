import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cdnImg } from '../../../utils/img';
import { useModalHistory } from '../../../hooks/useModalHistory';
import { soldMonthLabel } from '../../../utils/agentTrust';

// "Handover day" (PAGE-SITE 3, owner 2026-11-26, after a Proton advisor's site). Two halves:
//  - what the buyer gets on the day: the seller's OWN checklist (page_site.handover);
//  - the handover photo wall: the seller's uploads, each with a recorded buyer consent
//    (agent_handover_photos, get_agent_handover_photos), car + month only, never a buyer's name.
// The big number is MEASURED (cars marked sold on Drevo), never typed: a seller can claim a
// ranking (labelled), but a count on the page is ours.
export default function HandoverBlock({ items, photos, soldCount, firstName }) {
  const [open, setOpen] = useState(null);
  const list = items || [];
  const pics = photos || [];
  if (!list.length && !pics.length) return null;
  return (
    <section className="ps hb" id="ap-handover" aria-label="Handover day">
      <div className="ps-head">
        <div>
          <p className="hb-eb">Handover day</p>
          <h2>What you get <span>on the day</span></h2>
        </div>
      </div>
      {list.length > 0 && (
        <ol className="hb-list">
          {list.map((x, i) => (
            <li key={i}>
              <i aria-hidden="true"><Check size={14} strokeWidth={3} /></i>
              <div><b>{x.t}</b>{x.d && <span>{x.d}</span>}</div>
            </li>
          ))}
        </ol>
      )}
      {pics.length > 0 && (
        <>
          <div className="hb-count">
            {soldCount > 0 ? (
              <><b>{soldCount}</b><p>{soldCount === 1 ? 'car' : 'cars'} sold by {firstName} through Drevo. Some of {firstName}'s handovers: tap a photo to see it bigger.</p></>
            ) : (
              <p>Some of {firstName}'s handovers. Tap a photo to see it bigger.</p>
            )}
          </div>
          <div className="hb-wall" role="list">
            {pics.map((p, i) => (
              <button key={p.id} type="button" role="listitem" className="hb-ph" onClick={() => setOpen(i)} aria-label={`${p.car_name}, ${soldMonthLabel(p.delivered_month)}`}>
                <img src={cdnImg(p.photo_url, 420, 72)} alt="" loading="lazy" />
                <span>{p.car_name}<small>{soldMonthLabel(p.delivered_month)}</small></span>
              </button>
            ))}
          </div>
          <p className="ps-fine">Photos shared by {firstName} with each buyer's permission.</p>
        </>
      )}
      {open != null && <Viewer pics={pics} at={open} onAt={setOpen} onClose={() => setOpen(null)} />}
      <HandoverStyle />
    </section>
  );
}

function Viewer({ pics, at, onAt, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'ArrowRight') onAt((i) => Math.min(i + 1, pics.length - 1));
      if (e.key === 'ArrowLeft') onAt((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = was; window.removeEventListener('keydown', key); };
  }, [pics.length, onAt]);
  const p = pics[at];
  if (!p) return null;
  return createPortal(
    <div className="hb-view" role="dialog" aria-modal="true" aria-label={p.car_name} onClick={onClose}>
      <button type="button" className="hb-x" aria-label="Close" onClick={onClose}><X size={20} /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={cdnImg(p.photo_url, 1400, 80)} alt={`${p.car_name} handover`} />
        <figcaption>{p.car_name} · {soldMonthLabel(p.delivered_month)}{p.caption ? ` · ${p.caption}` : ''}</figcaption>
      </figure>
      {at > 0 && <button type="button" className="hb-nav hb-prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); onAt(at - 1); }}><ChevronLeft size={22} /></button>}
      {at < pics.length - 1 && <button type="button" className="hb-nav hb-next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); onAt(at + 1); }}><ChevronRight size={22} /></button>}
    </div>,
    document.body,
  );
}

function HandoverStyle() {
  return (
    <style>{`
      .hb-eb { margin: 0 0 8px; font-family: var(--wide, inherit); font-stretch: 125%; font-size: 10.5px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; color: var(--t3, #6b7280); }
      .hb-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line, #e5e7eb); }
      .hb-list li { display: flex; gap: 14px; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid var(--line, #e5e7eb); }
      .hb-list i { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; corner-shape: squircle; display: flex; align-items: center; justify-content: center; background: var(--ink, #0a0a0b); color: var(--on-ink, #fff); }
      .hb-list b { display: block; font-size: 15px; font-weight: 600; color: var(--t1, #0a0a0b); }
      .hb-list span { display: block; margin-top: 3px; font-size: 13.5px; line-height: 1.5; color: var(--t2, #4b5563); }
      .hb-count { display: flex; align-items: center; gap: 16px; margin: 30px 0 14px; }
      .hb-count b { font-family: var(--head, 'Bebas Neue'), sans-serif; font-weight: 400; font-size: clamp(56px, 12vw, 88px); line-height: .85; color: var(--t1, #0a0a0b); }
      .hb-count p { margin: 0; min-width: 0; max-width: 340px; font-size: 13px; line-height: 1.5; color: var(--t2, #4b5563); }
      .hb-wall { display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, auto); grid-auto-columns: minmax(140px, 32%); gap: 8px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; }
      .hb-wall::-webkit-scrollbar { display: none; }
      .hb-ph { position: relative; padding: 0; border: none; cursor: pointer; aspect-ratio: 3 / 4; overflow: hidden; border-radius: var(--r-chip, 10px); corner-shape: squircle; background: var(--k1, #f4f4f6); scroll-snap-align: start; }
      .hb-ph img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s ease; }
      .hb-ph:hover img { transform: scale(1.04); }
      .hb-ph span { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 10px 8px; text-align: left; color: #fff; font-size: 12px; font-weight: 600; line-height: 1.25;
        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.7)); overflow-wrap: anywhere; }
      .hb-ph small { display: block; font-weight: 400; opacity: .8; }
      @media (min-width: 900px) { .hb-wall { grid-auto-columns: minmax(150px, 18%); } }
      .hb-view { position: fixed; inset: 0; z-index: 10050; background: rgba(8,8,10,.94); display: flex; align-items: center; justify-content: center; padding: 56px 12px 24px; }
      .hb-view figure { margin: 0; max-width: min(100%, 1100px); max-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .hb-view img { max-width: 100%; max-height: calc(100vh - 140px); object-fit: contain; border-radius: 12px; }
      .hb-view figcaption { color: rgba(255,255,255,.85); font-size: 13.5px; text-align: center; }
      .hb-x, .hb-nav { position: absolute; width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(255,255,255,.14); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .hb-x { top: 12px; right: 12px; }
      .hb-nav { top: 50%; translate: 0 -50%; }
      .hb-prev { left: 10px; } .hb-next { right: 10px; }
      @media (prefers-reduced-motion: reduce) { .hb-ph img { transition: none; } }
    `}</style>
  );
}

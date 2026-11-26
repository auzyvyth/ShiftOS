import React, { useRef } from 'react';
import { heroPersonStyle, heroCarStyle, HERO_SHIFT } from '../../utils/heroFrame';
import CarRing from '../agent/site/CarRing';

// PAGE-HERO 2: how the hero will look, on a phone or on a desktop, drawn small with the
// SAME size / position maths the page uses (heroPersonStyle). The page's text is shown as
// grey bars so the seller sees where their photo sits against it. Drag the photo to move it.

const clamp = (v) => Math.max(HERO_SHIFT.min, Math.min(HERO_SHIFT.max, Math.round(v)));
const bar = (w, h = 8, bg = 'rgba(255,255,255,.18)') => <span style={{ display: 'block', width: w, height: h, borderRadius: 4, background: bg }} />;

export default function HeroPreview({ mode = 'phone', url, cut, frame, carUrl, accent = '#DC2626', accent2, coverUrl, ring, onMove, avatarUrl }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const phone = mode === 'phone';
  if (frame?.layout === 'card') return <CardPreview phone={phone} photo={avatarUrl || url} accent={accent} accent2={accent2} cover={coverUrl} ring={ring} />;

  const down = (e) => {
    if (!onMove || !imgRef.current) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser */ }
    const r = imgRef.current.getBoundingClientRect();
    drag.current = { px: e.clientX, py: e.clientY, x: frame.x, y: frame.y, w: Math.max(1, r.width / (frame.size / 100)), h: Math.max(1, r.height / (frame.size / 100)) };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    onMove(clamp(d.x + ((e.clientX - d.px) / d.w) * 100), clamp(d.y + ((e.clientY - d.py) / d.h) * 100));
  };
  const up = () => { drag.current = null; };

  const person = cut
    ? <img ref={imgRef} src={url} alt="" draggable={false} style={{ position: 'relative', height: '100%', maxWidth: '100%', objectFit: 'contain', objectPosition: 'bottom', ...heroPersonStyle(frame, true) }} />
    : <img ref={imgRef} src={url} alt="" draggable={false} style={{ position: 'relative', height: phone ? '92%' : '78%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 14, marginBottom: phone ? 0 : '8%', ...heroPersonStyle(frame, false) }} />;

  const car = carUrl && (
    <img src={carUrl} alt="" draggable={false} style={{ ...(phone
      ? { position: 'absolute', zIndex: 2, bottom: -4, left: '50%', translate: '-50% 0', width: '64%', pointerEvents: 'none', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.6))' }
      : { position: 'absolute', zIndex: 2, bottom: -10, left: '46%', translate: '-50% 0', width: '140%', maxWidth: 'none', pointerEvents: 'none', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.6))' }), ...heroCarStyle(frame) }} />
  );

  const pic = (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', touchAction: 'none', cursor: onMove ? 'grab' : 'default',
        ...(phone ? { height: '58%' } : { height: '100%' }) }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '8%', width: '70%', aspectRatio: '1', translate: '-50% 0', borderRadius: '50%', background: `radial-gradient(circle, ${accent}88 0%, ${accent}22 45%, ${accent}00 70%)` }} />
      {person}
      {car}
    </div>
  );

  const text = (
    <div style={{ display: 'grid', gap: phone ? 7 : 9, alignContent: 'center' }}>
      {bar(phone ? 90 : 110, 14, 'transparent')}
      <span style={{ display: 'flex', gap: 6 }}>{bar(70, 12, 'rgba(255,255,255,.12)')}{bar(90, 12, 'rgba(255,255,255,.12)')}</span>
      {bar(phone ? '70%' : '80%', phone ? 22 : 30, 'rgba(255,255,255,.85)')}
      {bar('45%', 7)}
      {bar(phone ? '100%' : '55%', phone ? 22 : 26, accent)}
      <span style={{ display: 'flex', gap: 14, marginTop: 2 }}>{bar(28, 14, 'rgba(255,255,255,.6)')}{bar(20, 14, 'rgba(255,255,255,.6)')}{bar(30, 14, 'rgba(255,255,255,.6)')}</span>
    </div>
  );

  return (
    <div className="keep-alpha" style={{ display: 'flex', justifyContent: 'center' }}>
      <div aria-label={phone ? 'Phone preview' : 'Desktop preview'}
        style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #151820, #0b0c10)', borderRadius: phone ? 22 : 12,
          border: '1px solid rgba(255,255,255,.1)', userSelect: 'none',
          ...(phone
            ? { width: 'min(100%, 260px)', aspectRatio: '9 / 13', padding: '16px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }
            : { width: '100%', aspectRatio: '16 / 8', padding: '6% 5% 0', display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: '5%' }) }}>
        {phone ? <>{pic}{text}</> : <>{text}{pic}</>}
      </div>
    </div>
  );
}

// The business card layout, drawn small: white card, round photo beside the name, then the rest.
function CardPreview({ phone, photo, accent, accent2, cover, ring }) {
  const hasRing = Array.isArray(ring) && ring.length > 0;
  const bandH = hasRing ? (phone ? 120 : 150) : (phone ? 76 : 96);
  const g = (w, h = 8, bg = 'rgba(15,17,21,.12)') => <span style={{ display: 'block', width: w, height: h, borderRadius: 4, background: bg }} />;
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div aria-label={phone ? 'Phone preview' : 'Desktop preview'} style={{ width: phone ? 'min(100%, 260px)' : '100%', background: '#e9eaec', borderRadius: phone ? 22 : 12, padding: phone ? 12 : 18 }}>
        <div style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 16, border: '1px solid rgba(10,10,11,.12)', padding: `${bandH - (phone ? 26 : 38)}px ${phone ? 14 : 26}px ${phone ? 14 : 22}px`, display: 'grid', gap: 12 }}>
          {/* Top band = the same as the page: the turning cars, else the cover photo, else a dark band lit in the page colour. */}
          <span aria-hidden={!hasRing} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bandH, overflow: 'clip',
            background: !hasRing && cover ? `center / cover no-repeat url("${cover}")` : `radial-gradient(70% 90% at 50% 100%, ${accent}8c, ${accent}00 70%), linear-gradient(180deg, #08090b, #16181d)` }}>
            {hasRing && <CarRing cars={ring} small />}
          </span>
          <div style={{ position: 'relative', display: 'flex', flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'flex-start' : 'flex-end', gap: phone ? 8 : 18 }}>
            {photo
              ? <img src={photo} alt="" style={{ width: phone ? 56 : 76, height: phone ? 56 : 76, borderRadius: '50%', objectFit: 'cover', objectPosition: '50% 20%', background: '#f1f1f3', flexShrink: 0, border: '3px solid #fff' }} />
              : <span style={{ width: phone ? 56 : 76, height: phone ? 56 : 76, borderRadius: '50%', background: '#f1f1f3', flexShrink: 0, border: '3px solid #fff' }} />}
            <div style={{ display: 'grid', gap: 6, flex: 1, width: '100%' }}>{g('80%', phone ? 18 : 24, '#0f1115')}{g('50%', 7)}</div>
          </div>
          <span style={{ display: 'flex', gap: 6 }}>{g(64, 12)}{g(90, 12)}</span>
          {g('90%', 7)}
          <span style={{ display: 'flex', gap: 14, borderTop: '1px solid rgba(10,10,11,.08)', paddingTop: 10 }}>{g(26, 14, 'rgba(15,17,21,.6)')}{g(20, 14, 'rgba(15,17,21,.6)')}{g(30, 14, 'rgba(15,17,21,.6)')}</span>
          {g(phone ? '100%' : '40%', phone ? 22 : 26, accent)}
        </div>
      </div>
    </div>
  );
}

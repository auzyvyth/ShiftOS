import React, { useRef } from 'react';
import { heroPersonStyle, HERO_SHIFT } from '../../utils/heroFrame';

// PAGE-HERO 2: how the hero will look, on a phone or on a desktop, drawn small with the
// SAME size / position maths the page uses (heroPersonStyle). The page's text is shown as
// grey bars so the seller sees where their photo sits against it. Drag the photo to move it.

const clamp = (v) => Math.max(HERO_SHIFT.min, Math.min(HERO_SHIFT.max, Math.round(v)));
const bar = (w, h = 8, bg = 'rgba(255,255,255,.18)') => <span style={{ display: 'block', width: w, height: h, borderRadius: 4, background: bg }} />;

export default function HeroPreview({ mode = 'phone', url, cut, frame, carUrl, accent = '#DC2626', onMove }) {
  const imgRef = useRef(null);
  const drag = useRef(null);
  const phone = mode === 'phone';

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
    <img src={carUrl} alt="" draggable={false} style={phone
      ? { position: 'absolute', zIndex: 2, bottom: -4, left: '50%', translate: '-50% 0', width: '64%', pointerEvents: 'none', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.6))' }
      : { position: 'absolute', zIndex: 2, bottom: -10, left: '46%', translate: '-50% 0', width: '140%', maxWidth: 'none', pointerEvents: 'none', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,.6))' }} />
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

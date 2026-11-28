import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

// "Scroll through a real Premium page" (owner, 2026-11-28): a DESKTOP video (owner: "show it in
// desktop mode") of the example page locked to Perodua (/s/premiummotors?brand=perodua) scrolling
// from the top to the footer, in a browser-window frame, right under the plan tour.
// The ad landing page must stay fast, so the video does not download until the section is
// near the screen (preload none + src set by an IntersectionObserver), then plays the moment it is on
// screen and pauses when it leaves. Muted, looping, inline. Reduced motion: never autoplays, the still
// frame shows and the visitor can press play.
// Words come from `copy` (landingCopy(lang).pageVideo); this file holds only the files and layout.
// Re-record (new -vN filename, the folder is cached for a year) when the Premium page changes.
const VIDEO = "/for-salesmen/premium-page-scroll-v2.mp4";
const POSTER = "/for-salesmen/premium-page-scroll-v2.jpg";

export default function PageVideo({ copy, examplePath, exampleLabel }) {
  const ref = useRef(null);
  const vid = useRef(null);
  const [near, setNear] = useState(false);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // Download when the section is 400px away, so it is ready by the time it shows.
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // Play the moment the video is on screen (owner, 2026-11-28), pause when it leaves. The first time it
  // shows it starts from the top of the page, so nobody lands mid-scroll. Reduced motion: never autoplays.
  useEffect(() => {
    const v = vid.current;
    if (!v || !near || still || typeof IntersectionObserver === "undefined") return undefined;
    let seen = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!seen) { seen = true; try { v.currentTime = 0; } catch { /* not loaded yet */ } }
        const p = v.play(); if (p?.catch) p.catch(() => {});
      } else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [near, still]);

  return (
    <section className="pv" ref={ref} aria-labelledby="pv-title">
      <style>{CSS}</style>
      <div className="pv-wrap">
        <div className="pv-text">
          <p className="pv-kicker">{copy.kicker}</p>
          <h2 className="pv-h2" id="pv-title">{copy.title}</h2>
          <p className="pv-line">{copy.line}</p>
          <Link to={examplePath} className="pv-link">
            {copy.open} <strong>{exampleLabel}</strong> <ExternalLink size={14} />
          </Link>
        </div>
        <figure className="pv-fig">
          <div className="pv-win">
            <div className="pv-bar" aria-hidden="true"><i /><i /><i /><span>drevo.my/s/premiummotors</span></div>
            <video
              ref={vid}
              src={near ? VIDEO : undefined}
              poster={POSTER}
              width="1280" height="800"
              muted loop playsInline
              controls={still}
              preload={near ? "auto" : "none"}
              aria-label={copy.alt}
            />
          </div>
          <figcaption className="pv-cap">{copy.note}</figcaption>
        </figure>
      </div>
    </section>
  );
}

const CSS = `
.pv { background: #0a0a0a; color: #fff; padding: 24px 0 80px; }
.pv-wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; }
.pv-text { text-align: center; max-width: 640px; margin: 0 auto 32px; }
.pv-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #f87171; margin: 0 0 12px; }
.pv-h2 { font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 16px; color: #fff; }
.pv-line { font-size: 17px; line-height: 1.55; color: rgba(255,255,255,0.68); margin: 0 auto 22px; max-width: 520px; }
.pv-link { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; color: rgba(255,255,255,0.72); text-decoration: none; }
.pv-link strong { color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.pv-link:hover strong { color: #f87171; }
.pv-fig { margin: 0; }
.pv-win { border-radius: 14px; overflow: hidden; background: #161616; box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px -30px rgba(0,0,0,0.9); }
.pv-bar { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; background: #1c1c1e; }
.pv-bar i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.18); flex: none; }
.pv-bar span { margin-left: 12px; flex: 1; max-width: 340px; height: 22px; line-height: 22px; border-radius: 6px; background: rgba(255,255,255,0.07); font-size: 12px; color: rgba(255,255,255,0.55); padding: 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pv-win video { display: block; width: 100%; height: auto; aspect-ratio: 1280 / 800; background: #e9eaee; }
.pv-cap { margin-top: 12px; text-align: center; font-size: 12.5px; color: rgba(255,255,255,0.45); }
@media (max-width: 860px) {
  .pv { padding: 8px 0 56px; }
  .pv-text { margin-bottom: 24px; }
  .pv-wrap { padding: 0 16px; }
  .pv-win { border-radius: 10px; }
  .pv-bar { height: 26px; padding: 0 10px; gap: 5px; }
  .pv-bar i { width: 7px; height: 7px; }
  .pv-bar span { height: 16px; line-height: 16px; font-size: 10px; margin-left: 8px; }
}
`;

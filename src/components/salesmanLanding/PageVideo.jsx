import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

// "Scroll through a real Premium page" (owner, 2026-11-28): a phone-sized video of the example
// page (/s/premiummotors) scrolling from the top to the footer, right under the plan tour.
// The ad landing page must stay fast, so the video does not download until the section is
// near the screen (preload none + src set by an IntersectionObserver). Muted, looping, inline.
// Reduced motion: no autoplay, the still frame shows and the visitor can press play.
// Words come from `copy` (landingCopy(lang).pageVideo); this file holds only the files and layout.
// Re-record (new -vN filename, the folder is cached for a year) when the Premium page changes.
const VIDEO = "/for-salesmen/premium-page-scroll-v1.mp4";
const POSTER = "/for-salesmen/premium-page-scroll-v1.jpg";

export default function PageVideo({ copy, examplePath, exampleLabel }) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

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
          <div className="pv-phone">
            <video
              src={near ? VIDEO : undefined}
              poster={POSTER}
              width="600" height="1298"
              muted loop playsInline
              autoPlay={!still}
              controls={still}
              preload="none"
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
.pv-wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 56px; align-items: center; }
.pv-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #f87171; margin: 0 0 12px; }
.pv-h2 { font-size: clamp(28px, 4.5vw, 44px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 16px; color: #fff; }
.pv-line { font-size: 17px; line-height: 1.55; color: rgba(255,255,255,0.68); margin: 0 0 22px; max-width: 460px; }
.pv-link { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; color: rgba(255,255,255,0.72); text-decoration: none; }
.pv-link strong { color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.pv-link:hover strong { color: #f87171; }
.pv-fig { margin: 0; }
.pv-phone { width: 100%; aspect-ratio: 600 / 1298; border-radius: 34px; padding: 8px; background: #161616; box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px -30px rgba(0,0,0,0.9); overflow: hidden; }
.pv-phone video { display: block; width: 100%; height: 100%; border-radius: 27px; object-fit: cover; background: #f2f2f4; }
.pv-cap { margin-top: 12px; text-align: center; font-size: 12.5px; color: rgba(255,255,255,0.45); }
@media (max-width: 860px) {
  .pv { padding: 8px 0 56px; }
  .pv-wrap { grid-template-columns: 1fr; gap: 28px; }
  .pv-text { text-align: center; }
  .pv-line { margin-left: auto; margin-right: auto; }
  .pv-fig { width: min(280px, 78vw); margin: 0 auto; }
}
`;

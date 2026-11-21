// Top banner, version C "Full screen", background Photo (STOREFRONT-2 stage 4): one photo
// across the whole first screen under a dark fade, a small line, the dealer's name (or their
// own banner title) large and centred, and two buttons: WhatsApp and Browse cars.
// The photo is the dealer's own: their first hero slide (Storefront > Banner slides, the same
// read as HeroCarousel, storefront/heroSlides.js), else their newest car's photo. Every word is
// the dealer's (hero_title / hero_subtitle) or a fact we hold (their town). No claim.
// The band stays dark on the Light theme (a photo band, like banner A), so its words are white.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { cdnImg } from "../../../utils/img";
import { buildWaUrl } from "../../../hooks/useCTAContext";
import { loadHeroSlides, firstSlidePhoto } from "../heroSlides";
import { carPhoto, showcaseCars } from "./heroParts";
import { accentOf } from "./shared";

export default function HeroPhoto({ tenant, siteName, carsBase, ctaCtx, featured, loading }) {
  // undefined = still reading the slides: show the dark band, never the car photo first and
  // then a jump to the slide.
  const [slidePhoto, setSlidePhoto] = useState(undefined);
  useEffect(() => {
    let live = true;
    loadHeroSlides(tenant?.id)
      .then((rows) => { if (live) setSlidePhoto(firstSlidePhoto(rows)); })
      .catch(() => { if (live) setSlidePhoto(null); });
    return () => { live = false; };
  }, [tenant?.id]);

  const car = showcaseCars(featured, 1)[0];
  const photo = slidePhoto ? cdnImg(slidePhoto, 1920, 70)
    : slidePhoto === null && !loading && car ? carPhoto(car, 1920) : null;
  const town = tenant?.city || tenant?.state || "";
  const line = tenant?.hero_subtitle?.trim() || town;
  const title = tenant?.hero_title?.trim() || siteName;
  const waHref = tenant?.whatsapp_number
    ? buildWaUrl(ctaCtx?.type !== "loading" && ctaCtx ? ctaCtx : { type: "listing", profile: null, ref: null },
      tenant.whatsapp_number,
      ctaCtx?.type === "salesman" ? `Hi, I need help finding a car — via ${ctaCtx.ref}` : `Hi ${siteName}, I need help finding a car`)
    : null;

  return (
    <section className="hph" style={{ "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .hph { position: relative; overflow: hidden; background: #0C0C0E; color: #fff;
          min-height: max(520px, 100vh); min-height: max(520px, 100svh); display: flex; align-items: center; justify-content: center; }
        .hph-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
        .hph-fade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,8,10,0.72) 0%, rgba(8,8,10,0.55) 45%, rgba(8,8,10,0.85) 100%); }
        .hph-in { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; text-align: center;
          padding: 112px 20px 88px; }
        .hph-line { font-size: clamp(14px, 1.6vw, 18px); font-weight: 600; color: rgba(255,255,255,0.9); margin: 0 0 18px; letter-spacing: 0.01em; }
        .hph-title { font-family: var(--sf-font-head, 'Outfit', sans-serif); font-weight: 800; text-transform: uppercase;
          font-size: calc(clamp(2rem, 5.6vw, 4.2rem) * var(--sf-head-scale, 1)); letter-spacing: 0.01em; line-height: 1.08;
          margin: 0 0 36px; color: #fff; overflow-wrap: anywhere; }
        .hph-btns { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .hph-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px;
          border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; font-family: 'Outfit', sans-serif; transition: background .15s, transform .12s; }
        .hph-wa { background: var(--sf-accent); color: var(--sf-on-accent, #fff); border: 1px solid var(--sf-accent); }
        .hph-browse { background: rgba(255,255,255,0.06); color: #fff; border: 1.5px solid rgba(255,255,255,0.7); }
        @media (hover: hover) { .hph-btn:hover { transform: translateY(-1px); } .hph-browse:hover { background: rgba(255,255,255,0.14); } }
        @media (max-width: 480px) {
          .hph-in { padding: 96px 18px 64px; }
          .hph-title { margin-bottom: 28px; }
          .hph-btns { flex-direction: column; align-items: stretch; }
        }
      `}</style>
      {photo && <img className="hph-img" src={photo} alt="" loading="eager" fetchPriority="high" />}
      <div className="hph-fade" aria-hidden />
      <div className="hph-in">
        {line && <p className="hph-line">{line}</p>}
        <h1 className="hph-title">{title}</h1>
        <div className="hph-btns">
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="hph-btn hph-wa">
              <MessageCircle size={17} /> WhatsApp us
            </a>
          )}
          <Link to={carsBase} className="hph-btn hph-browse">
            Browse cars <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

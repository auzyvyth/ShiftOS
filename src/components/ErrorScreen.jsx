import { Link } from "react-router-dom";
import { getSubdomain, readStorefrontName } from "../hooks/useTenant";
import { SITE_URL } from "../config/site";

// THE full-page error screen (ERR-1, 2026-10-28). One layout, four scenes:
//   load  - a lookup failed or timed out (the DB stalled). Never "it's gone".
//   gone  - a clean answer said the car / page is not there any more.
//   404   - no such route.
//   crash - the React error boundary (src/main.jsx).
// Light marketplace surface (DESIGN.md) with the dark bar on top. The bar says
// DREVO on the marketplace and the dealer's own name on a storefront.
//
// The looping car scene is the owner's SECOND sanctioned exception to "no
// looping animation" (DESIGN.md, after the hero search ring). It is plain CSS
// so it still runs when the app's JS is what broke, it never gates a button,
// and prefers-reduced-motion freezes it.
//
// actions: [{ label, to | href | onClick }], primary (red) first. `to` needs a
// router; the crash screen sits outside it, so it uses href / onClick only.

const CSS = `
.es-root{min-height:100vh;display:flex;flex-direction:column;background:#F7F6F2;font-family:var(--xd-font-body);color:#111827}
.es-bar{height:56px;flex-shrink:0;background:#0f1115;display:flex;align-items:center;padding:0 clamp(20px,4vw,48px)}
.es-mark{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.06em;color:#fff;line-height:1;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.es-main{flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px;padding:32px 20px 48px;max-width:440px;width:100%;margin:0 auto;box-sizing:border-box}
.es-art{display:block;width:100%;max-width:350px;height:auto}
.es-copy{display:flex;flex-direction:column;gap:12px}
.es-eyebrow{margin:0;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6b7280}
.es-title{margin:0;font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:48px;line-height:.95;letter-spacing:.02em;color:#0f1115}
.es-body{margin:0;font-size:15px;line-height:1.5;color:#4b5563}
.es-actions{display:flex;flex-direction:column;gap:10px}
.es-btn{height:48px;box-sizing:border-box;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 28px;font-family:inherit;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.es-btn-primary{background:#dc2626;color:#fff;border:none}
.es-btn-primary:hover{background:#b91c1c;color:#fff}
.es-btn-secondary{background:#fff;color:#0f1115;border:1px solid rgba(0,0,0,.12)}
.es-btn-secondary:hover{border-color:rgba(0,0,0,.24);color:#0f1115}
@media (min-width:900px){
  .es-bar{height:64px}.es-mark{font-size:30px}
  .es-main{flex-direction:row;align-items:center;max-width:1000px;gap:72px;padding:48px}
  .es-art{width:420px;max-width:none;flex-shrink:0}
  .es-text{display:flex;flex-direction:column;gap:24px;flex:1;min-width:0}
  .es-title{font-size:64px}
  .es-actions{flex-direction:row}
}
@media (max-width:899px){.es-text{display:contents}}
.es-wheel{transform-box:fill-box;transform-origin:center;animation:es-spin .5s linear infinite}
.es-bounce{animation:es-bounce .25s ease-in-out infinite alternate}
.es-road{animation:es-road .5s linear infinite}
.es-dot{animation:es-dot 1.2s ease-in-out infinite}
.es-dot2{animation-delay:.2s}.es-dot3{animation-delay:.4s}
.es-sign{transform-box:fill-box;transform-origin:50% 0;animation:es-swing 2.4s ease-in-out infinite alternate}
.es-away{animation:es-away 4.8s cubic-bezier(.5,0,.5,1) infinite}
.es-puff{transform-box:fill-box;transform-origin:center;opacity:0;animation:es-puff 4.8s ease-out infinite}
.es-look{transform-box:fill-box;transform-origin:50% 100%;animation:es-look 2.6s ease-in-out infinite}
.es-q{animation:es-q 1.3s ease-in-out infinite alternate}
.es-arrow{transform-box:fill-box;transform-origin:0% 50%;animation:es-arrow 2.6s ease-in-out infinite}
.es-shake{animation:es-shake 3s ease-in-out infinite}
.es-smoke{transform-box:fill-box;transform-origin:center;opacity:0;animation:es-smoke 2.4s ease-out infinite}
.es-s2{animation-delay:.8s}.es-s3{animation-delay:1.6s}
.es-hood{transform-box:fill-box;transform-origin:0% 100%;animation:es-hood 3s ease-in-out infinite}
@keyframes es-spin{to{transform:rotate(360deg)}}
@keyframes es-bounce{to{transform:translateY(-2px)}}
@keyframes es-road{to{transform:translateX(-40px)}}
@keyframes es-dot{0%,100%{opacity:.2;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
@keyframes es-swing{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}
@keyframes es-away{0%,20%{transform:translateX(0)}50%{transform:translateX(260px)}50.1%{transform:translateX(-260px)}80%,100%{transform:translateX(0)}}
@keyframes es-puff{0%,22%{opacity:0;transform:translate(0,0) scale(.4)}28%{opacity:.7}48%{opacity:0;transform:translate(-30px,-8px) scale(1.4)}100%{opacity:0}}
@keyframes es-look{0%,100%{transform:rotate(0)}25%{transform:rotate(-2deg)}60%{transform:rotate(1.5deg)}}
@keyframes es-q{from{transform:translateY(0)}to{transform:translateY(-8px)}}
@keyframes es-arrow{0%,15%{transform:rotate(0)}45%,60%{transform:rotate(180deg)}90%,100%{transform:rotate(360deg)}}
@keyframes es-shake{0%,70%,100%{transform:translateX(0)}74%{transform:translateX(-2px)}78%{transform:translateX(2px)}82%{transform:translateX(-1px)}86%{transform:translateX(0)}}
@keyframes es-smoke{0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:.85}100%{opacity:0;transform:translate(14px,-46px) scale(1.6)}}
@keyframes es-hood{0%,70%,100%{transform:rotate(0)}78%{transform:rotate(-6deg)}86%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){
  .es-wheel,.es-bounce,.es-road,.es-dot,.es-sign,.es-away,.es-puff,.es-look,.es-q,.es-arrow,.es-shake,.es-smoke,.es-hood{animation:none}
  .es-smoke{opacity:.6}.es-dot{opacity:1}
}
`;

const BODY = "M30 92 Q30 78 44 76 L74 72 L96 52 Q102 46 112 46 L156 46 Q166 46 172 54 L188 72 L206 76 Q216 78 216 90 L216 98 Q216 102 212 102 L34 102 Q30 102 30 98 Z";

function CarBody({ headlight = "#fff4c2" }) {
  return (
    <>
      <path d={BODY} fill="#dc2626" />
      <path d="M102 56 Q106 52 112 52 L132 52 L132 72 L88 72 Z" fill="#EDEAE3" />
      <path d="M138 52 L154 52 Q162 52 166 58 L176 72 L138 72 Z" fill="#EDEAE3" />
      <rect x="207" y="82" width="8" height="5" rx="2" fill={headlight} />
    </>
  );
}

function Wheel({ cx, spin }) {
  return (
    <g className={spin ? "es-wheel" : undefined}>
      <circle cx={cx} cy="104" r="15" fill="#0f1115" />
      <circle cx={cx} cy="104" r="7" fill="#d1d5db" />
      {spin && <rect x={cx - 1} y="97" width="2" height="14" fill="#0f1115" />}
      {spin && <rect x={cx - 7} y="103" width="14" height="2" fill="#0f1115" />}
    </g>
  );
}

const Ground = () => <rect x="0" y="117" width="350" height="2" fill="#e5e1d8" />;

function SceneLoad() {
  return (
    <>
      <g className="es-road">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 40} y="126" width="24" height="4" rx="2" fill="#d6d2c8" />
        ))}
      </g>
      <Ground />
      <g transform="translate(55 0)">
        <g className="es-bounce">
          <CarBody />
          <rect x="30" y="84" width="6" height="5" rx="2" fill="#7f1d1d" />
        </g>
        <Wheel cx={72} spin />
        <Wheel cx={176} spin />
      </g>
      <g transform="translate(284 30)">
        <circle className="es-dot" cx="0" cy="0" r="4" fill="#0f1115" />
        <circle className="es-dot es-dot2" cx="14" cy="0" r="4" fill="#0f1115" />
        <circle className="es-dot es-dot3" cx="28" cy="0" r="4" fill="#0f1115" />
      </g>
    </>
  );
}

function SceneGone() {
  return (
    <>
      <Ground />
      <rect x="36" y="20" width="5" height="98" rx="2" fill="#0f1115" />
      <rect x="36" y="20" width="56" height="5" rx="2" fill="#0f1115" />
      <g className="es-sign">
        <rect x="58" y="25" width="2" height="12" fill="#0f1115" />
        <rect x="76" y="25" width="2" height="12" fill="#0f1115" />
        <rect x="46" y="36" width="44" height="24" rx="4" fill="#fff" stroke="#0f1115" strokeWidth="2" />
        <text x="68" y="54" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="18" fill="#dc2626" letterSpacing="1">SOLD</text>
      </g>
      <g transform="translate(110 30) scale(0.78)">
        <g className="es-away">
          <circle className="es-puff" cx="26" cy="94" r="8" fill="#d6d2c8" />
          <CarBody />
          <Wheel cx={72} spin />
          <Wheel cx={176} spin />
        </g>
      </g>
    </>
  );
}

function Scene404() {
  return (
    <>
      <Ground />
      <rect x="284" y="30" width="5" height="88" rx="2" fill="#0f1115" />
      <g className="es-arrow">
        <path d="M287 34 L327 34 L337 44 L327 54 L287 54 Z" fill="#fff" stroke="#0f1115" strokeWidth="2" strokeLinejoin="round" />
        <text x="309" y="49" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="14" fill="#0f1115">404</text>
      </g>
      <g transform="translate(10 18) scale(0.95)">
        <g className="es-look">
          <CarBody />
          <Wheel cx={72} />
          <Wheel cx={176} />
        </g>
      </g>
      <g className="es-q">
        <text x="150" y="34" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="40" fill="#0f1115">?</text>
      </g>
    </>
  );
}

function SceneCrash() {
  return (
    <>
      <Ground />
      <g transform="translate(50 14)">
        <circle className="es-smoke" cx="196" cy="62" r="9" fill="#9ca3af" />
        <circle className="es-smoke es-s2" cx="190" cy="62" r="11" fill="#b8bcc4" />
        <circle className="es-smoke es-s3" cx="200" cy="62" r="8" fill="#9ca3af" />
        <g className="es-shake">
          <CarBody headlight="#9ca3af" />
          <path className="es-hood" d="M182 70 L214 52 L218 58 L190 74 Z" fill="#b91c1c" />
          <Wheel cx={72} />
          <Wheel cx={176} />
        </g>
      </g>
    </>
  );
}

const SCENES = {
  load: { Art: SceneLoad, label: "A little red car driving on a road" },
  gone: { Art: SceneGone, label: "A swinging sold sign as a red car drives off" },
  404: { Art: Scene404, label: "A confused red car next to a spinning road sign" },
  crash: { Art: SceneCrash, label: "A broken-down red car with smoke coming from the bonnet" },
};

// Storefront: the dealer's name from the device's saved storefront (no fetch,
// so it works on the crash screen too), else the subdomain itself.
function barName() {
  const sub = getSubdomain();
  if (!sub) return "DREVO";
  return readStorefrontName() || sub;
}

function Action({ a, primary }) {
  const cls = `es-btn ${primary ? "es-btn-primary" : "es-btn-secondary"}`;
  if (a.to) return <Link to={a.to} className={cls}>{a.label}</Link>;
  if (a.href) return <a href={a.href} className={cls}>{a.label}</a>;
  return <button type="button" onClick={a.onClick} className={cls}>{a.label}</button>;
}

export default function ErrorScreen({ variant = "load", eyebrow, title, body, actions = [], brand }) {
  const { Art, label } = SCENES[variant] || SCENES.load;
  return (
    <div className="es-root">
      <style>{CSS}</style>
      <div className="es-bar">
        <a href="/" className="es-mark">{(brand || barName()).toUpperCase()}</a>
      </div>
      <main className="es-main">
        <svg className="es-art" role="img" aria-label={label} viewBox="0 0 350 150">
          <Art />
        </svg>
        <div className="es-text">
          <div className="es-copy">
            {eyebrow && <p className="es-eyebrow">{eyebrow}</p>}
            <h1 className="es-title">{title}</h1>
            {body && <p className="es-body">{body}</p>}
          </div>
          {actions.length > 0 && (
            <div className="es-actions">
              {actions.map((a, i) => <Action key={a.label} a={a} primary={i === 0} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// A dealer storefront (<sub>.<domain>) whose dealer lookup came back empty or
// failed. Shared by HomePage and CarListingPage; both used to carry a copy.
export function StorefrontError({ failed }) {
  return failed ? (
    <ErrorScreen
      variant="load"
      eyebrow="Slow connection"
      title="Hold up, we're stuck in traffic"
      body="We couldn't load this dealer's page just now. The dealer is still here, give it another go."
      actions={[
        { label: "Try again", onClick: () => window.location.reload() },
        { label: "Browse all cars", href: `${SITE_URL}/showroom` },
      ]}
    />
  ) : (
    <ErrorScreen
      variant="404"
      eyebrow="Page not found"
      title="Oops, wrong turn"
      body="There's no dealer page at this address. Check the spelling, or find the car you want on Drevo."
      actions={[{ label: "Browse all cars", href: `${SITE_URL}/showroom` }]}
    />
  );
}

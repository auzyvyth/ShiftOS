// The ONE loading screen for every seller and dealer account (owner, 2026-11-16).
// Dealer dashboard = theme "light"; Lite, Premium and the salesman under a dealer
// = "dark". The background colour is each dashboard's own canvas (premiumLight /
// premiumDark in src/theme/tokens.js), under a carbon-fibre weave that fades out
// towards the edges, so the screen hands over to the app with no flash.
// Motion = "Redline": a rev bar climbs into the red, bounces off the limiter, and
// the wordmark shudders with it. It shows nothing that looks like real progress.
import { premiumLight as PL, premiumDark as PD } from "../theme/tokens";
import { useTranslation } from 'react-i18next';

const CSS = `
.al-root{position:fixed;inset:0;z-index:50;display:grid;place-items:center;overflow:hidden}
.al-root::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(circle at 50% 50%,transparent 25%,var(--al-vig) 95%)}
.al-dark{--al-bg:${PD.canvas};--al-vig:rgba(8,9,12,.85);--al-track:#1d2027;--al-fill:#5b6170;--al-tick:#6b717c;
  background:linear-gradient(27deg,#16181e 5px,transparent 5px) 0 5px,linear-gradient(207deg,#16181e 5px,transparent 5px) 10px 0,
  linear-gradient(27deg,#1a1d23 5px,transparent 5px) 0 10px,linear-gradient(207deg,#1a1d23 5px,transparent 5px) 10px 5px,
  linear-gradient(90deg,#0f1115 10px,transparent 10px),
  linear-gradient(#13151a 25%,#0a0b0e 25%,#0a0b0e 50%,transparent 50%,transparent 75%,#181a20 75%,#181a20);
  background-size:20px 20px;background-color:var(--al-bg)}
.al-light{--al-bg:${PL.canvas};--al-vig:rgba(238,240,244,.8);--al-track:#d8dbe1;--al-fill:#9aa0ab;--al-tick:#7c828d;
  background:linear-gradient(27deg,#dcdfe5 5px,transparent 5px) 0 5px,linear-gradient(207deg,#dcdfe5 5px,transparent 5px) 10px 0,
  linear-gradient(27deg,#e0e3e8 5px,transparent 5px) 0 10px,linear-gradient(207deg,#e0e3e8 5px,transparent 5px) 10px 5px,
  linear-gradient(90deg,#e6e8ec 10px,transparent 10px),
  linear-gradient(#e2e5ea 25%,#eef0f4 25%,#eef0f4 50%,transparent 50%,transparent 75%,#dadde3 75%,#dadde3);
  background-size:20px 20px;background-color:var(--al-bg)}
.al-mid{position:relative;z-index:1;width:min(320px,70vw);display:flex;flex-direction:column;align-items:stretch;gap:14px}
.al-logo{display:block;width:100%;height:auto;animation:al-shake 2.4s infinite}
.al-ticks{display:flex;justify-content:space-between;font:600 9px/1 var(--xd-font-body,system-ui);color:var(--al-tick);margin:4px 0 -6px}
.al-track{position:relative;height:5px;border-radius:5px;background:var(--al-track);overflow:hidden}
.al-track b{position:absolute;inset:0;transform-origin:left;transform:scaleX(.04);
  background:linear-gradient(90deg,var(--al-fill) 0%,var(--al-fill) 70%,#F40000 80%);
  animation:al-rev 2.4s infinite cubic-bezier(.3,.1,.3,1)}
@keyframes al-rev{0%{transform:scaleX(.04)}55%{transform:scaleX(1)}60%{transform:scaleX(.94)}64%{transform:scaleX(1)}68%{transform:scaleX(.95)}72%{transform:scaleX(1)}100%{transform:scaleX(.04)}}
@keyframes al-shake{0%,52%{transform:none}55%{transform:translate(1px,-1px)}58%{transform:translate(-1px,1px)}61%{transform:translate(1px,0)}64%{transform:translate(-1px,-1px)}67%{transform:translate(1px,1px)}70%,100%{transform:none}}
@media (prefers-reduced-motion:reduce){.al-logo,.al-track b{animation:none}.al-track b{transform:scaleX(.6)}}
`;

export default function AppLoader({ theme = "dark" }) {
  const { t } = useTranslation();
  return (
    <div className={`al-root ${theme === "light" ? "al-light" : "al-dark"}`} role="status" aria-label={t("appLoader.loading")}>
      <style>{CSS}</style>
      <div className="al-mid">
        <img className="al-logo" src="/drevo-logo.svg" alt="Drevo" width="688" height="120" />
        <div className="al-ticks" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n}>{n}</span>)}
        </div>
        <div className="al-track" aria-hidden="true"><b /></div>
      </div>
    </div>
  );
}

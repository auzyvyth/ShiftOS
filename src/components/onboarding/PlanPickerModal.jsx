import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import { DEALER_PLANS, salesmanPricingCards } from '../../utils/plans';
import { PLAN_CONFIG } from '../../utils/planConfig';
import { useModalHistory } from '../../hooks/useModalHistory';

// Plan switcher inside the signup flows (owner, 2026-11-28: light to match the new
// wizard; Lite + Premium first, dealerships behind a link; "no credit card needed").
// The short feature lines come from salesmanPricingCards (src/utils/plans.js), the
// same words /plans and /for-salesmen show, so the three never disagree. Picking a
// plan routes to that plan's signup; switching between seller and dealer restarts
// that product's onboarding. Used by SalesmanOnboarding + DealerOnboarding.
const TRIAL_DAYS = PLAN_CONFIG.salesman_full.trialDays;

const CSS = `
.ppm-back{position:fixed;inset:0;z-index:2000;background:rgba(17,24,39,0.55);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:32px 16px;font-family:var(--xd-font-body,'Outfit',system-ui,sans-serif);}
.ppm-sheet{width:100%;max-width:780px;background:#f4f5f7;border-radius:22px;padding:26px 24px 22px;box-shadow:0 30px 80px rgba(17,24,39,0.35);color:#111827;}
.ppm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:22px;}
.ppm-title{font-size:24px;font-weight:700;letter-spacing:-0.01em;line-height:1.2;}
.ppm-sub{font-size:14px;color:#4b5563;margin-top:6px;line-height:1.5;}
.ppm-x{width:38px;height:38px;border-radius:12px;border:none;background:#fff;color:#374151;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 2px rgba(17,24,39,0.06);}
.ppm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 14px;}
.ppm-grid3{grid-template-columns:repeat(3,minmax(0,1fr));}
.ppm-card{position:relative;display:flex;flex-direction:column;background:#fff;border-radius:18px;padding:22px 20px 20px;box-shadow:0 1px 2px rgba(17,24,39,0.05),0 6px 20px rgba(17,24,39,0.06);}
.ppm-card.pick{box-shadow:0 0 0 2px #111827,0 6px 20px rgba(17,24,39,0.08);}
.ppm-badge{position:absolute;top:-11px;left:20px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;}
.ppm-name{font-size:15px;font-weight:700;}
.ppm-price{display:flex;align-items:baseline;gap:5px;margin:8px 0 4px;}
.ppm-price b{font-size:32px;font-weight:700;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;}
.ppm-price span{font-size:13px;color:#6b7280;}
.ppm-desc{font-size:13.5px;color:#4b5563;line-height:1.5;margin-bottom:14px;}
.ppm-list{display:flex;flex-direction:column;gap:9px;flex:1;margin-bottom:18px;}
.ppm-li{display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.45;color:#374151;}
.ppm-li svg{flex-shrink:0;margin-top:2px;color:#dc2626;}
.ppm-btn{height:50px;width:100%;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
.ppm-btn.red{background:linear-gradient(180deg,#ef4444,#dc2626);color:#fff;box-shadow:0 2px 0 #991b1b,0 6px 14px rgba(220,38,38,0.28);}
.ppm-btn.red:active{transform:translateY(2px);box-shadow:0 0 0 #991b1b;}
.ppm-btn.grey{background:#f4f5f7;color:#111827;}
.ppm-btn.grey:hover{background:#eceef1;}
.ppm-btn.here{background:#111827;color:#fff;cursor:default;}
.ppm-note{font-size:12.5px;color:#6b7280;text-align:center;margin-top:10px;line-height:1.5;}
.ppm-foot{text-align:center;margin-top:20px;font-size:13.5px;color:#4b5563;}
.ppm-link{background:none;border:none;padding:0;font-family:inherit;font-size:13.5px;font-weight:700;color:#dc2626;cursor:pointer;}
.ppm-link:hover{text-decoration:underline;}
.ppm-trial{font-size:12.5px;font-weight:600;color:#15803d;margin-bottom:10px;}
@media(max-width:700px){
  .ppm-back{padding:0;align-items:flex-end;}
  .ppm-sheet{border-radius:22px 22px 0 0;padding:20px 16px 18px;max-height:94dvh;overflow-y:auto;}
  .ppm-grid,.ppm-grid3{grid-template-columns:1fr;}
  .ppm-first{order:-1;}
}
`;

function Card({ name, price, per, desc, features, caps, trial, badge, picked, current, ctaLabel, hereLabel, onChoose, red, note, first }) {
  return (
    <div className={`ppm-card${picked ? ' pick' : ''}${first ? ' ppm-first' : ''}`}>
      {badge && <span className="ppm-badge">{badge}</span>}
      <p className="ppm-name">{name}</p>
      <div className="ppm-price"><b>{price}</b>{per && <span>{per}</span>}</div>
      {trial && <p className="ppm-trial">{trial}</p>}
      {desc && <p className="ppm-desc">{desc}</p>}
      {caps?.length > 0 && <p className="ppm-desc" style={{ marginBottom: 12 }}>{caps.join(' · ')}</p>}
      <div className="ppm-list">
        {features.map((f) => (
          <div key={f} className="ppm-li"><Check size={15} /><span>{f}</span></div>
        ))}
      </div>
      {current
        ? <button type="button" className="ppm-btn here" disabled><Check size={16} /> {hereLabel}</button>
        : <button type="button" className={`ppm-btn ${red ? 'red' : 'grey'}`} onClick={onChoose}>{ctaLabel}</button>}
      {note && <p className="ppm-note">{note}</p>}
    </div>
  );
}

export default function PlanPickerModal({ currentTier, onClose }) {
  const { t, i18n } = useTranslation();
  useModalHistory(true, onClose);
  const navigate = useNavigate();
  const lang = (i18n.language || 'en').startsWith('ms') ? 'ms' : 'en';
  const [view, setView] = useState(['starter', 'growth', 'pro'].includes(currentTier) ? 'dealer' : 'seller');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const select = (route) => { onClose(); navigate(route); };
  const [lite, premium] = salesmanPricingCards(lang);

  return createPortal(
    <div className="ppm-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div className="ppm-sheet" role="dialog" aria-modal="true" aria-label={t('planPicker.chooseYourPlan')}>
        <div className="ppm-head">
          <div>
            <h2 className="ppm-title">{t('planPicker.chooseYourPlan')}</h2>
            <p className="ppm-sub">{t('planPicker.noCard')} {t('planPicker.switchAny')}</p>
          </div>
          <button type="button" className="ppm-x" onClick={onClose} aria-label={t('planPicker.close')}><X size={18} /></button>
        </div>

        {view === 'seller' ? (
          <>
            <div className="ppm-grid">
              <Card
                name={lite.name} price={lite.price} per={lite.per} desc={lite.desc} features={lite.features}
                current={currentTier === 'lite'} hereLabel={t('planPicker.yourChoice')}
                ctaLabel={t('planPicker.chooseLite')} onChoose={() => select('/salesman-onboarding/lite')}
                note={t('planPicker.liteNote')}
              />
              <Card
                first name={premium.name} price={premium.price} per={premium.per} desc={premium.desc} features={premium.features}
                badge={t('planPicker.trialBadge', { days: TRIAL_DAYS })} picked red
                current={currentTier === 'premium'} hereLabel={t('planPicker.yourChoice')}
                ctaLabel={t('planPicker.startTrial', { days: TRIAL_DAYS })} onChoose={() => select('/salesman-onboarding/premium')}
                note={t('planPicker.trialNote', { days: TRIAL_DAYS })}
              />
            </div>
            <p className="ppm-foot">
              {t('planPicker.dealerQ')}{' '}
              <button type="button" className="ppm-link" onClick={() => setView('dealer')}>{t('planPicker.dealerLink')}</button>
            </p>
          </>
        ) : (
          <>
            <div className="ppm-grid ppm-grid3">
              {DEALER_PLANS.map((p) => (
                <Card
                  key={p.tier} name={p.label} price={p.price} per={p.priceSub} features={p.features} caps={p.caps}
                  trial={p.trial} badge={p.popular ? t('planCard.mostPopular') : null} picked={p.popular} red={p.popular}
                  current={p.tier === currentTier} hereLabel={t('planPicker.yourChoice')}
                  ctaLabel={t('planCard.selectPlan')} onChoose={() => select(p.route)}
                />
              ))}
            </div>
            <p className="ppm-foot">
              {t('planPicker.sellerQ')}{' '}
              <button type="button" className="ppm-link" onClick={() => setView('seller')}>{t('planPicker.sellerLink')}</button>
            </p>
            <p className="ppm-note">{t('planPicker.switchingBetweenSalesmanAndDealer')}</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

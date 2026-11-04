import React, { useState } from 'react';
import { Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { shareInvite } from '../../utils/invite';

// "Share & get 1 month free" (IDEA-32, 2026-11-04): the seller referral
// (REFER-1, ReferralCard in Settings) shown where sellers already look, the
// dashboard. Same programme, same terms, never cash: 30 days of Premium per
// invited seller who has paid for Premium twice, at most 12 a year
// (grant_referral_reward). Do not word it as income.
// Only for standalone sellers (an invite from a dealer-linked rep is refused
// by claim_referral). The X hides it for 7 days on this device, never for good.
const CLOSED_KEY = 'xd_invite_strip_closed';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export const INVITE_COPY = {
  en: {
    title: 'Invite a seller friend, get 1 month free',
    body: 'Once they have paid for Premium twice, you get 30 days of Premium. Up to 12 months a year.',
    btn: 'Share my link',
    close: 'Hide for a week',
    copied: 'Invite link copied',
    failed: "Couldn't share. Your invite link is also in Settings.",
  },
  ms: {
    title: 'Ajak kawan SA, dapat 1 bulan free',
    body: 'Bila dia dah bayar Premium 2 kali, anda dapat 30 hari Premium. Sampai 12 bulan setahun.',
    btn: 'Share link saya',
    close: 'Sembunyi seminggu',
    copied: 'Link jemputan disalin',
    failed: 'Tak dapat share. Link jemputan anda ada juga dalam Tetapan.',
  },
};

export async function runInviteShare(slug, lang) {
  const c = INVITE_COPY[lang === 'ms' ? 'ms' : 'en'];
  const r = await shareInvite(slug, lang);
  if (r === 'copied') toast.success(c.copied);
  else if (r === 'failed') toast.error(c.failed);
}

export default function InviteStrip({ profile, lang, colors }) {
  const [closed, setClosed] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(CLOSED_KEY) || 0) < WEEK; } catch { return false; }
  });
  if (closed || !profile?.slug || profile?.dealer_id) return null;
  const c = INVITE_COPY[String(lang || '').startsWith('ms') ? 'ms' : 'en'];
  const close = () => {
    setClosed(true);
    try { localStorage.setItem(CLOSED_KEY, String(Date.now())); } catch { /* private mode */ }
  };
  return (
    <div data-invite-strip style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: colors.card, borderRadius: colors.radius ?? 16, padding: '14px 44px 14px 18px', margin: '0 0 16px' }}>
      <button type="button" onClick={close} aria-label={c.close} title={c.close}
        style={{ position: 'absolute', top: 4, right: 4, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: 'none', background: 'none', color: colors.sub, cursor: 'pointer' }}>
        <X size={16} />
      </button>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: colors.text, lineHeight: 1.35 }}>{c.title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: colors.sub, lineHeight: 1.5 }}>{c.body}</p>
      </div>
      {/* Raised red key (keys.css): no inline background, or the key goes flat. */}
      <button type="button" className="lk-red" onClick={() => runInviteShare(profile.slug, c === INVITE_COPY.ms ? 'ms' : 'en')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 999, border: 'none', color: colors.onAccent, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flex: 'none' }}>
        <Share2 size={15} /> {c.btn}
      </button>
    </div>
  );
}

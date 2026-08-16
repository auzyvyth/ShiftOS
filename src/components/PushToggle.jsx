import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications, isIOS, isStandalone } from '../hooks/usePushNotifications';

/*
 * One notification toggle, shared by every panel — dealer dashboard, Salesman
 * Lite, Salesman Premium, the linked salesman panel, manager/admin.
 *
 * Deliberately ONE component rather than a copy per panel: the subscribe flow
 * has enough browser-specific traps (iOS install requirement, permission
 * gestures, denied-permission dead end) that maintaining five versions of it
 * would guarantee drift. Panels differ only by `theme`.
 *
 * `theme='light'` for the dealer dashboard (white cards), `theme='dark'` for the
 * salesman panels — see the Theme section of CLAUDE.md. Getting this wrong gives
 * light text on a white card.
 */
export default function PushToggle({ userId, theme = 'dark', style }) {
  const { t } = useTranslation();
  const { supported, configured, permission, subscribed, busy, enable, disable, sendTest } =
    usePushNotifications(userId);

  const light = theme === 'light';
  const c = {
    cardBg: light ? '#ffffff' : 'rgba(255,255,255,0.03)',
    border: light ? '#e5e7eb' : 'rgba(255,255,255,0.08)',
    title: light ? '#111827' : '#f1f5f9',
    body: light ? '#6b7280' : '#94a3b8',
    muted: light ? '#9ca3af' : '#64748b',
  };

  const blocked = !supported
    ? t('push.unsupported')
    : !configured
      ? t('push.notConfigured')
      : permission === 'denied'
        ? t('push.denied')
        : (isIOS() && !isStandalone())
          ? t('push.iosNeedsInstall')
          : null;

  const reasonText = (reason) => ({
    unsupported: t('push.unsupported'),
    not_configured: t('push.notConfigured'),
    denied: t('push.denied'),
    dismissed: t('push.dismissed'),
    ios_needs_install: t('push.iosNeedsInstall'),
    save_failed: t('push.saveFailed'),
    no_devices: t('push.noDevices'),
    send_failed: t('push.sendFailed'),
    not_subscribed: t('push.notSubscribed'),
  }[reason] || t('push.genericError'));

  const handleToggle = async () => {
    if (subscribed) {
      const res = await disable();
      if (res.ok) toast.success(t('push.turnedOff'));
      else toast.error(reasonText(res.reason));
      return;
    }
    const res = await enable();
    if (res.ok) toast.success(t('push.turnedOn'));
    else toast.error(reasonText(res.reason));
  };

  const handleTest = async () => {
    const res = await sendTest();
    if (res.ok) toast.success(t('push.testSent'));
    else toast.error(reasonText(res.reason));
  };

  return (
    <div style={{
      background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: c.title,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {subscribed ? <Bell size={14} /> : <BellOff size={14} />} {t('push.title')}
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: c.body, lineHeight: 1.6 }}>
            {t('push.description')}
          </p>
        </div>
        {subscribed && (
          <span style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, color: '#16a34a',
            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)',
            padding: '3px 8px', borderRadius: 999,
          }}>
            {t('push.on')}
          </span>
        )}
      </div>

      {blocked && (
        <p style={{ margin: 0, fontSize: 11, color: c.muted, lineHeight: 1.6 }}>{blocked}</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={busy || (Boolean(blocked) && !subscribed)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit',
            background: subscribed ? 'transparent' : 'rgba(220,38,38,0.12)',
            border: `1px solid ${subscribed ? c.border : 'rgba(220,38,38,0.3)'}`,
            color: subscribed ? c.body : '#f87171',
            cursor: (busy || (blocked && !subscribed)) ? 'not-allowed' : 'pointer',
            opacity: (busy || (blocked && !subscribed)) ? 0.55 : 1,
          }}
        >
          {subscribed ? <BellOff size={13} /> : <Bell size={13} />}
          {busy ? t('push.working') : subscribed ? t('push.turnOff') : t('push.turnOn')}
        </button>

        {subscribed && (
          <button
            type="button"
            onClick={handleTest}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit',
              background: 'transparent', border: `1px solid ${c.border}`, color: c.body,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1,
            }}
          >
            <Send size={13} /> {t('push.sendTest')}
          </button>
        )}
      </div>
    </div>
  );
}

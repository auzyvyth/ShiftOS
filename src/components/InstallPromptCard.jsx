import React from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, X } from 'lucide-react';

// Presentation only. Lazy-loaded by InstallPrompt so none of this markup rides
// in the entry bundle — the public marketplace is the highest-traffic surface
// and never renders this card at all. (Same reasoning as ConsentBanner's lazy
// LegalModal.) All the gating logic lives in the eager gate; by the time this
// mounts the decision to show has already been made.
export default function InstallPromptCard({ mode, onInstall, onDismiss }) {
  return createPortal(
    <>
      <style>{`@keyframes xdriveInstallIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 99999,
          // The container spans the viewport so the card can centre itself, but
          // must not swallow clicks on the panel either side of it.
          pointerEvents: 'none',
          padding: '12px max(12px, env(safe-area-inset-left, 12px)) max(12px, env(safe-area-inset-bottom, 12px))',
        }}
      >
        <div
          role="region"
          aria-label="Install ShiftOS"
          style={{
            pointerEvents: 'auto',
            maxWidth: 420, margin: '0 auto',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            // Dark card on purpose: the dealer dashboard is light and the
            // salesman panels are dark, and a dark snackbar is the conventional
            // treatment over both. Tokens match the app's sonner <Toaster/>.
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            padding: '13px 14px',
            fontFamily: 'system-ui, sans-serif',
            animation: 'xdriveInstallIn 220ms ease-out',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 9,
              background: 'rgba(220,38,38,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {mode === 'ios'
              ? <Share size={17} color="#f87171" />
              : <Download size={17} color="#f87171" />}
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {mode === 'ios' ? 'Add ShiftOS to your Home Screen' : 'Install ShiftOS'}
            </p>

            {mode === 'ios' ? (
              <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.62)' }}>
                Tap the Share button in Safari, then choose{' '}
                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>Add to Home Screen</span>.
              </p>
            ) : (
              <>
                <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.62)' }}>
                  Open it full screen from your home screen, without the browser bar.
                </p>
                <button
                  type="button"
                  onClick={onInstall}
                  style={{
                    marginTop: 11, padding: '8px 15px', borderRadius: 9, border: 'none',
                    background: '#dc2626', color: '#fff',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  Install
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss install prompt"
            style={{
              flexShrink: 0, background: 'none', border: 'none', padding: 4, margin: -4,
              color: 'rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

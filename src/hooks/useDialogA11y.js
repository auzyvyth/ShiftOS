import { useEffect, useRef } from 'react';

/**
 * Screen-reader + keyboard behaviour for a portalled overlay.
 *
 * Without this a sheet is just a div that appeared: a screen reader keeps
 * reading the page underneath, the user is never told a dialog opened, Tab
 * walks out of the sheet into the page behind it, and there is no Escape.
 *
 * Usage:
 *   const dialog = useDialogA11y(open, onClose, 'Report this listing');
 *   ...
 *   <div {...dialog.overlayProps}>
 *     <div ref={dialog.ref} {...dialog.dialogProps}> ... </div>
 *   </div>
 *
 * Deliberately does NOT lock body scroll — several callers already do that
 * themselves, and doing it in two places means one of them restores `overflow`
 * while the other still needs it.
 */
export function useDialogA11y(open, onClose, label) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  // Remember what had focus, move focus into the sheet, and put it back on
  // close. Without the restore, closing a sheet dumps focus onto <body> and a
  // keyboard user has to tab from the top of the page again.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement;
    const node = ref.current;
    if (node) {
      const first = node.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (first || node).focus?.();
    }
    return () => {
      const back = restoreTo.current;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    };
  }, [open]);

  // Escape closes; Tab is trapped inside the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const node = ref.current;
      if (!node) return;
      const items = [...node.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter(el => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  return {
    ref,
    // Spread onto the element that actually holds the sheet content.
    dialogProps: {
      role: 'dialog',
      'aria-modal': true,
      'aria-label': label,
      tabIndex: -1,
    },
    // Spread onto the full-screen scrim.
    overlayProps: {
      // The scrim is decorative; its click-to-close is duplicated by Escape,
      // so it does not need to be announced or reachable.
      'aria-hidden': false,
    },
  };
}

export default useDialogA11y;

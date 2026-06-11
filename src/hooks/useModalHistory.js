import { useEffect, useRef } from 'react';

/**
 * Pushes a synthetic history entry when a modal/drawer opens so the browser
 * back gesture (or swipe-left on mobile) closes the overlay instead of
 * leaving the page.
 *
 * Usage:
 *   useModalHistory(isOpen, onClose);
 *
 * - When isOpen becomes true  → pushState({ __modal: true })
 * - Back gesture fires popstate → calls onClose()
 * - If modal closed programmatically → history.back() cleans up the pushed entry
 */
export function useModalHistory(isOpen, onClose) {
  const poppedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      poppedRef.current = false;
      return;
    }

    poppedRef.current = false;
    window.history.pushState({ __modal: true }, '');

    const handler = () => {
      poppedRef.current = true;
      onClose();
    };

    window.addEventListener('popstate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      // Closed programmatically — clean up the entry we pushed
      if (!poppedRef.current && window.history.state?.__modal) {
        window.history.back();
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}

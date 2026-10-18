import { useEffect, useRef } from 'react';
import i18n from 'i18next';

/**
 * Makes the phone's back gesture (swipe from the edge, Android back button)
 * close the open overlay instead of switching the tab underneath it.
 *
 * Usage:
 *   useModalHistory(isOpen, onClose);
 *   useModalHistory(isOpen, onClose, { isDirty: () => hasEdits });
 *
 * Tabs are real history entries (/salesman-premium/listings), so an overlay
 * that is not in history gets walked past: Back changed the tab and left the
 * overlay sitting on top of it (TikTok studio, 2026-10-18).
 *
 * Every open overlay shares ONE stack, so Back always closes the top one.
 * The old version gave each overlay its own popstate listener and cleaned up
 * with an immediate history.back(); closing A and opening B in the same tick
 * let A's late back() close B. That is why overlay rule 5 said "don't use it".
 * Now a programmatic close only marks its entry stale, and the next overlay to
 * open reuses that entry (replaceState) instead of racing it. Only if nothing
 * claims it is it removed, after the commit.
 *
 * isDirty: when it returns true, Back asks before closing. Cancel keeps the
 * overlay open and puts its history entry back.
 */

const stack = []; // open overlays, oldest first: { id, closeRef, dirtyRef }
let seq = 0;
let skipPops = 0;
let listening = false;

const stateId = () => window.history.state?.__overlay;

function confirmText() {
  return i18n.t('common.closeUnsaved', {
    defaultValue: 'Close this? What you have done here will be lost.',
  });
}

function onPopState() {
  if (skipPops > 0) { skipPops -= 1; return; }
  const top = stack[stack.length - 1];
  if (!top) return;
  // Back landed on our own entry or below it: the top overlay was popped.
  if (stateId() === top.id) return;
  const dirty = top.dirtyRef.current;
  if (dirty && dirty() && !window.confirm(confirmText())) {
    rawPush({ ...(window.history.state || {}), __overlay: top.id }, '');
    return;
  }
  stack.pop();
  top.popped = true;
  top.closeRef.current?.();
}

let rawPush = null;

function ensureListener() {
  if (listening) return;
  listening = true;
  window.addEventListener('popstate', onPopState);
  // A page change made while an overlay's entry is on top (a nav link in the
  // phone menu closes the menu AND switches tab in one tap) takes that entry
  // over instead of stacking on it. Stacked, the dead overlay entry sat
  // between the two tabs and cost the seller one Back that did nothing.
  // If the overlay is still open after the change, it gets a fresh entry.
  rawPush = window.history.pushState.bind(window.history);
  window.history.pushState = function pushState(state, title, url) {
    const ownerId = stateId();
    const owner = ownerId && stack.find((e) => e.id === ownerId);
    if (!owner || state?.__overlay) return rawPush(state, title, url);
    window.history.replaceState(state, title, url);
    setTimeout(() => {
      if (stack.includes(owner) && !owner.popped) {
        rawPush({ ...(window.history.state || {}), __overlay: owner.id }, '');
      }
    }, 0);
    return undefined;
  };
}

export function useModalHistory(isOpen, onClose, { isDirty } = {}) {
  const closeRef = useRef(onClose);
  const dirtyRef = useRef(isDirty);
  closeRef.current = onClose;
  dirtyRef.current = isDirty;

  useEffect(() => {
    if (!isOpen) return;
    ensureListener();
    const entry = { id: `ov${++seq}`, closeRef, dirtyRef, popped: false };
    // Router state (key/idx) is copied so react-router still knows the entry.
    const base = { ...(window.history.state || {}) };
    const staleHere = base.__overlay && !stack.some((e) => e.id === base.__overlay);
    if (staleHere) window.history.replaceState({ ...base, __overlay: entry.id }, '');
    else rawPush({ ...base, __overlay: entry.id }, '');
    stack.push(entry);

    return () => {
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      if (entry.popped) return;
      // Closed by its own button. Leave the entry for a moment: an overlay
      // opening in the same commit takes it over. Otherwise remove it.
      setTimeout(() => {
        if (stateId() === entry.id) {
          skipPops += 1;
          window.history.back();
        }
      }, 0);
    };
  }, [isOpen]);
}

// Cross-origin session storage for Supabase auth.
//
// Login can happen on any *.xdrive.my origin (apex marketplace, a dealer
// subdomain, the salesman panels). The default supabase-js store is
// localStorage, which is PER-ORIGIN, so a session created on one origin is
// invisible on another — that's why the public showroom on xdrive.my did not
// "see" a login made elsewhere and re-prompted Google sign-in. This adapter
// stores the session in a COOKIE scoped to `.xdrive.my`, which every subdomain
// (and the apex) shares, so there is one session across the whole family.
//
// Design notes:
//  - Cookies cap at ~4KB each; a Supabase session (access JWT + refresh token +
//    user object) can exceed that, so the value is CHUNKED across `<key>.<n>`
//    cookies and reassembled on read.
//  - ONLY used on real xdrive.my hosts (https). On localhost, Vercel previews
//    (*.vercel.app) and shiftos.com a `.xdrive.my` cookie can't be set, so we
//    fall back to localStorage exactly like before — no behaviour change there.
//  - MIGRATION: on the first read after deploy the cookie is absent, so we fall
//    back to the existing per-origin localStorage session and promote it into
//    the cookie. Nobody is forced to re-login.

const COOKIE_DOMAIN = ".xdrive.my";
const CHUNK_SIZE = 3200; // bytes of value per cookie, safely under the ~4KB cap
const MAX_AGE = 60 * 60 * 24 * 400; // 400 days (browser cookie lifetime cap)

function hasDom() {
  return typeof document !== "undefined" && typeof window !== "undefined";
}

// True only on an actual xdrive.my host, where a domain-scoped cookie sticks.
function useCookies() {
  if (!hasDom()) return false;
  const h = window.location.hostname;
  return /(^|\.)xdrive\.my$/.test(h);
}

function ls() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRawCookie(name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp("(?:^|; )" + esc + "=([^;]*)"));
  return m ? m[1] : null;
}

function writeRawCookie(name, value) {
  document.cookie =
    `${name}=${value}; path=/; max-age=${MAX_AGE}; domain=${COOKIE_DOMAIN}; SameSite=Lax; Secure`;
}

function expireCookie(name) {
  // Clear both the domain-scoped and any host-only variant of the cookie.
  document.cookie = `${name}=; path=/; max-age=0; domain=${COOKIE_DOMAIN}; SameSite=Lax`;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

// Remove the single cookie plus every `<key>.<n>` chunk that exists.
function clearChunks(key) {
  expireCookie(key);
  for (let i = 0; ; i++) {
    if (readRawCookie(`${key}.${i}`) == null) break;
    expireCookie(`${key}.${i}`);
  }
}

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export const crossSubdomainStorage = {
  getItem(key) {
    if (!useCookies()) return ls()?.getItem(key) ?? null;

    const single = readRawCookie(key);
    if (single != null) return safeDecode(single);

    const parts = [];
    for (let i = 0; ; i++) {
      const c = readRawCookie(`${key}.${i}`);
      if (c == null) break;
      parts.push(c);
    }
    if (parts.length) return safeDecode(parts.join(""));

    // Migration: adopt a pre-existing per-origin localStorage session and
    // promote it into the shared cookie so it carries across origins next time.
    const legacy = ls()?.getItem(key);
    if (legacy != null) {
      this.setItem(key, legacy);
      return legacy;
    }
    return null;
  },

  setItem(key, value) {
    if (!useCookies()) {
      ls()?.setItem(key, value);
      return;
    }
    clearChunks(key); // drop any prior (possibly longer) chunk set first
    const enc = encodeURIComponent(value);
    if (enc.length <= CHUNK_SIZE) {
      writeRawCookie(key, enc);
    } else {
      const n = Math.ceil(enc.length / CHUNK_SIZE);
      for (let i = 0; i < n; i++) {
        writeRawCookie(`${key}.${i}`, enc.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
    }
  },

  removeItem(key) {
    if (useCookies()) clearChunks(key);
    // Always clear the localStorage copy too (covers the legacy key on sign-out).
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

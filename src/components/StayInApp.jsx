import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isStandalone } from "../utils/installPrompt";

// Inside the INSTALLED app (home-screen PWA), a link that opens a "new tab"
// cannot open a tab: Android opens Chrome's in-app browser instead, with a
// black bar on top (X, page title, address). It does that even for our own
// pages (web.dev "Window management": "opening new windows on Android creates
// a new in-app browser for the URL, even if the URL is within the scope").
// Sellers hit it on View my page, View car, deal sheets and more (46 call
// sites + every target="_blank" link).
//
// So, only in the installed app, a new-tab open of one of OUR pages is turned
// into a normal in-app page change; Back returns to where they were. In a
// normal browser tab nothing changes. Left alone on purpose: other websites
// (wa.me opens WhatsApp itself; Facebook etc. need their own page), /api/*
// (e.g. /api/wa redirects out to WhatsApp), files (anything with an
// extension), blob:/data: downloads, and window.open('') (print windows).

function inAppPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let u;
  try { u = new URL(raw, window.location.href); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.origin !== window.location.origin) return null;
  if (/^\/(api|assets|models)\//.test(u.pathname)) return null;
  const last = u.pathname.split("/").pop() || "";
  if (last.includes(".")) return null; // a file, not a page
  return `${u.pathname}${u.search}${u.hash}`;
}

export default function StayInApp() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isStandalone()) return undefined;

    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.('a[target="_blank"]');
      if (!a || a.hasAttribute("download")) return;
      const path = inAppPath(a.getAttribute("href"));
      if (!path) return;
      e.preventDefault();
      navigate(path);
    };
    document.addEventListener("click", onClick, true);

    const original = window.open;
    window.open = function patchedOpen(url, target, features) {
      const path = (!target || target === "_blank") ? inAppPath(url) : null;
      if (!path) return original.call(window, url, target, features);
      navigate(path);
      // Callers sometimes test the result to fall back to a same-tab jump;
      // a truthy value says "handled".
      return window;
    };

    return () => {
      document.removeEventListener("click", onClick, true);
      window.open = original;
    };
  }, [navigate]);

  return null;
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";
import { readCache, writeCache } from "../utils/localCache";

// Stale-while-revalidate: a dealer's own profile changes rarely, but every
// single subdomain page mounts this hook and otherwise waits on a fresh RPC
// round-trip before painting anything (HomePage/CarDetailPage/etc. all block
// on tenant !== undefined). Caching it here benefits every one of them at
// once. The RPC below always still runs and overwrites tenant + cache the
// moment it lands — this only affects what paints before that response
// arrives, and the realtime subscription further down keeps it correct
// whenever the dealer edits their storefront.
const TENANT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const tenantCacheKey = (subdomain) => `tenant_profile_v1_${subdomain}`;
function readTenantCache(subdomain) {
  return subdomain ? readCache(tenantCacheKey(subdomain), TENANT_CACHE_TTL) : null;
}

export const MARKETPLACE_DOMAIN = "xdrive.my";
export const DASHBOARD_DOMAIN = "shiftos.com";

// The ?tenant= override is a dev/preview convenience only. Allowing it in
// production would let anyone spoof a competitor's storefront under the
// xdrive.my domain (phishing / brand-confusion vector), so it is gated to
// localhost and Vercel preview hosts.
function isDevHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168") ||
    hostname.endsWith(".vercel.app")
  );
}

export function getSubdomain() {
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  if (isDevHost(hostname)) {
    const q = params.get("tenant");
    if (q) {
      try { sessionStorage.setItem("previewTenant", q); } catch {}
      return q;
    }
    // In-app navigation (Browse Cars, card clicks) drops the ?tenant= query, so
    // persist it for the session to keep storefront scoping on preview deploys.
    // Storefront routes only — never the dashboard/app/auth routes.
    const isAppRoute = /^\/(dashboard|admin|manager|accountant|fi|salesman|login|register|onboarding|reset-password|auth)/.test(
      window.location.pathname,
    );
    if (!isAppRoute) {
      try {
        const stored = sessionStorage.getItem("previewTenant");
        if (stored) return stored;
      } catch {}
    }
  }
  // Root domains and local dev → no subdomain, show public marketplace
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168") ||
    hostname === "xdrive.my" ||
    hostname === "www.xdrive.my"
  )
    return null;
  // Extract subdomain from <sub>.xdrive.my (e.g. 'fast' from 'fast.xdrive.my')
  if (hostname.endsWith(".xdrive.my")) {
    const sub = hostname.slice(0, -".xdrive.my".length);
    if (sub && !sub.includes(".")) return sub;
  }
  return null;
}

export function isSubdomain() {
  return !!getSubdomain();
}

// Build the URL to a dealer's storefront. On production this is the real
// subdomain (<sub>.xdrive.my); on a Vercel preview / localhost — where wildcard
// subdomains don't resolve — fall back to the ?tenant= override on the current
// origin, which getSubdomain() honors on dev hosts. Keeps the dashboard
// "view storefront" links working on preview deploys.
export function getStorefrontUrl(subdomain) {
  if (!subdomain) return `https://${MARKETPLACE_DOMAIN}`;
  if (typeof window !== "undefined" && isDevHost(window.location.hostname)) {
    return `${window.location.origin}/?tenant=${encodeURIComponent(subdomain)}`;
  }
  return `https://${subdomain}.${MARKETPLACE_DOMAIN}`;
}

export default function useTenant() {
  // Read once per mount — hostname can't change without a full page reload.
  const cachedTenantRef = useRef(readTenantCache(getSubdomain()));
  const [tenant, setTenant] = useState(() => cachedTenantRef.current || undefined); // undefined = loading
  const [loading, setLoading] = useState(() => !cachedTenantRef.current);
  const tenantIdRef = useRef(null); // used by realtime subscription

  useEffect(() => {
    let realtimeChannel = null;
    let settled = false;
    // Safety net: in-app webviews (Instagram/Facebook) and flaky mobile networks
    // can make Supabase storage/auth/RPC calls throw or hang. Without this the
    // hook would sit at tenant===undefined forever and HomePage shows the
    // full-screen loader indefinitely. Force-resolve after a short timeout so
    // the page always renders — falling back to the cached tenant (if we
    // already painted one) rather than null, so a flaky network degrades to
    // "showing slightly-stale data" instead of "storefront doesn't exist".
    const settle = (value) => {
      if (settled) return;
      settled = true;
      setTenant(value);
      setLoading(false);
    };
    const timer = setTimeout(() => settle(cachedTenantRef.current || null), 6000);

    async function resolve() {
      // Each Supabase/storage touch is individually guarded — a throw here (e.g.
      // localStorage blocked in a partitioned webview) must not abort resolution.
      try {
        const { at: accessToken, rt: refreshToken } = readHandoffTokens();
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          clearHandoffTokens();
        }
      } catch (e) {
        // ignore — handoff is best-effort; storefront still resolves below
      }

      const subdomain = getSubdomain();
      if (!subdomain) {
        try { localStorage.removeItem("tenantSubdomain"); } catch {}
        clearTimeout(timer);
        settle(null); // main domain — show marketplace
        return;
      }

      // RPC (SECURITY DEFINER) — public_dealer_profiles is security_invoker and
      // subject to profiles RLS, which has no anon-read policy for dealer rows.
      // Anonymous storefront visitors must go through this narrow lookup instead.
      // Look up the dealer for this subdomain, retrying on transient RPC
      // failures. A backgrounded mobile tab re-mounts and fires this while the
      // network is still waking up — a FAILED request must never overwrite a
      // shown/cached storefront with "this dealer doesn't exist". Only a clean
      // response that returns no row is a real miss. On persistent failure fall
      // back to the cached tenant (what was showing before) instead of null.
      let profile = null;
      let rpcErrored = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // No .maybeSingle(): against a RETURNS TABLE function it forces the
          // object Accept header, so PostgREST returns 406 for the zero-row case
          // (benign — swallowed to null — but noisy). The function already has
          // LIMIT 1; read the first row so a no-match is a clean 200 [] instead.
          const { data, error } = await supabase
            .rpc("get_dealer_profile_by_subdomain", { p_subdomain: subdomain });
          if (error) {
            rpcErrored = true;
          } else {
            profile = (Array.isArray(data) ? data[0] : data) || null;
            rpcErrored = false;
            break; // clean response (row or genuine miss) — stop retrying
          }
        } catch (e) {
          rpcErrored = true;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
      clearTimeout(timer);
      if (rpcErrored && !profile) {
        // Transient failure — degrade to the cached storefront rather than a
        // false "not found". Don't cache or subscribe off a failed lookup.
        settle(cachedTenantRef.current || null);
        return;
      }
      settle(profile);
      // Don't cache a miss — a transient RPC failure shouldn't make the
      // storefront remember "not found" past this one bad request.
      if (profile) writeCache(tenantCacheKey(subdomain), profile);

      // Subscribe to realtime changes for this dealer's profile row so that
      // when settings are saved in the dashboard, the storefront tab updates
      // without requiring a manual page refresh.
      if (profile?.id) {
        try {
        tenantIdRef.current = profile.id;
        realtimeChannel = supabase
          .channel(`tenant_profile_${profile.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${profile.id}`,
            },
            async () => {
              // Re-fetch the full profile so all storefront fields refresh
              const { data: updatedRows } = await supabase
                .rpc("get_dealer_profile_by_subdomain", { p_subdomain: subdomain });
              const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
              if (updated) {
                setTenant(updated);
                // Keep the cache in step with a dashboard edit, so the next
                // repeat visit paints the latest version instantly too.
                writeCache(tenantCacheKey(subdomain), updated);
              }
            }
          )
          .subscribe();
        } catch (e) {
          // realtime is non-essential — storefront already rendered
        }
      }
    }

    resolve().catch(() => settle(null));

    return () => {
      clearTimeout(timer);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return { tenant, loading };
}

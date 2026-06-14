import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";

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
  const [tenant, setTenant] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);
  const tenantIdRef = useRef(null); // used by realtime subscription

  useEffect(() => {
    let realtimeChannel = null;

    async function resolve() {
      const { at: accessToken, rt: refreshToken } = readHandoffTokens();

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        clearHandoffTokens();
      }

      const subdomain = getSubdomain();
      if (!subdomain) {
        localStorage.removeItem("tenantSubdomain");
        setTenant(null); // main domain — show marketplace
        setLoading(false);
        return;
      }

      // RPC (SECURITY DEFINER) — public_dealer_profiles is security_invoker and
      // subject to profiles RLS, which has no anon-read policy for dealer rows.
      // Anonymous storefront visitors must go through this narrow lookup instead.
      const { data } = await supabase
        .rpc("get_dealer_profile_by_subdomain", { p_subdomain: subdomain })
        .maybeSingle();

      const profile = data || null;
      setTenant(profile);
      setLoading(false);

      // Subscribe to realtime changes for this dealer's profile row so that
      // when settings are saved in the dashboard, the storefront tab updates
      // without requiring a manual page refresh.
      if (profile?.id) {
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
              const { data: updated } = await supabase
                .rpc("get_dealer_profile_by_subdomain", { p_subdomain: subdomain })
                .maybeSingle();
              if (updated) setTenant(updated);
            }
          )
          .subscribe();
      }
    }

    resolve();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return { tenant, loading };
}

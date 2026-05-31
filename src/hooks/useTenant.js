import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";

export const MARKETPLACE_DOMAIN = "xdrive.my";
export const DASHBOARD_DOMAIN = "shiftos.com";

const PROFILE_SELECT =
  "id, dealership, site_name, subdomain, avatar_url, site_logo_url, logo_url, " +
  "email, phone, whatsapp_number, social_facebook, social_instagram, social_tiktok, " +
  "location, city, state, about_text, brand_color, custom_domain, slug, " +
  "storefront_why, storefront_how, storefront_testimonials, storefront_cta, " +
  "hero_title, hero_subtitle, hero_cta_text, " +
  "announcement_bar, announcement_bar_enabled";

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
  if (isDevHost(hostname) && params.get("tenant")) return params.get("tenant");
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

      const { data } = await supabase
        .from("public_dealer_profiles")
        .select(PROFILE_SELECT)
        .eq("subdomain", subdomain)
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
                .from("public_dealer_profiles")
                .select(PROFILE_SELECT)
                .eq("id", profile.id)
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

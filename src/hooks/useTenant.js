import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

export const MARKETPLACE_DOMAIN = "xdrive.my";
export const DASHBOARD_DOMAIN = "shiftos.com";

const PROFILE_SELECT =
  "id, full_name, dealership, site_name, subdomain, avatar_url, site_logo_url, " +
  "whatsapp_number, email, phone, social_facebook, social_instagram, social_tiktok, " +
  "location, about_text, brand_color, " +
  "storefront_why, storefront_how, storefront_testimonials, storefront_cta, " +
  "hero_title, hero_subtitle, hero_cta_text, " +
  "announcement_bar, announcement_bar_enabled";

export function getSubdomain() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tenant")) return params.get("tenant");
  const hostname = window.location.hostname;
  // Never parse subdomains on local dev
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168")
  )
    return null;
  const stripped = hostname.replace(".xdrive.my", "");
  const parts = stripped.split(".");
  const subdomain =
    hostname.includes(".xdrive.my") && parts[0] !== hostname ? parts[0] : null;
  return subdomain;
}

export function isSubdomain() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("tenant")) return true;
  return !!getSubdomain();
}

export default function useTenant() {
  const [tenant, setTenant] = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);
  const tenantIdRef = useRef(null); // used by realtime subscription

  useEffect(() => {
    let realtimeChannel = null;

    async function resolve() {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Clean the URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }

      const subdomain = getSubdomain();
      if (!subdomain) {
        localStorage.removeItem("tenantSubdomain");
        setTenant(null); // main domain — show marketplace
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
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
                .from("profiles")
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

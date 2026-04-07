import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const MARKETPLACE_DOMAIN = "xdrive.my";
export const DASHBOARD_DOMAIN = "shiftos.com";

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

  useEffect(() => {
    async function resolve() {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        // Clean the URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }

      const subdomain = getSubdomain();
      console.log("hostname:", window.location.hostname);
      console.log("subdomain detected:", subdomain);
      if (!subdomain) {
        localStorage.removeItem("tenantSubdomain");
        setTenant(null); // main domain, show all
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, full_name, dealership, site_name, subdomain, avatar_url, site_logo_url, whatsapp_number, email, phone, social_facebook, social_instagram, social_tiktok, location, about_text, storefront_why, storefront_how, storefront_testimonials, storefront_cta",
        )
        .eq("subdomain", subdomain)
        .maybeSingle();
      console.log("tenant resolved:", data);
      setTenant(data || null);
      setLoading(false);
    }
    resolve();
  }, []);

  return { tenant, loading };
}

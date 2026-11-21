// A dealer's own site (<sub>.drevo.my). App.jsx RootRoute renders this ONLY on a dealer
// subdomain; the main domain gets MarketplacePage. This file loads the dealer's cars and
// counts; every section of the page lives in src/components/storefront/sections/
// (STOREFRONT-2, docs/STOREFRONT_PLAN.md), drawn in the dealer's saved layout order
// (src/utils/storefrontLayout.js). ?layout=... = an unsaved preview from the editor.
import React, { useState, useEffect, lazy, Suspense } from "react";
import { Helmet } from "react-helmet";
import Header from "@/components/Header";
import GoogleOneTapSlot from "@/components/GoogleOneTapSlot";
import SciFiLoader from "../components/SciFiLoader";
import Footer from "@/components/Footer";
import StickyWhatsAppButton from "@/components/StickyWhatsAppButton";
import { supabase } from "../supabaseClient";
import { readCache, writeCache } from "../utils/localCache";
import { useCompare } from "../hooks/useCompare";
import { useSiteProfile } from "../hooks/useSiteProfile";
import useTenant, { getSubdomain } from "../hooks/useTenant";
import { SITE_URL, ROOT_DOMAIN } from "../config/site";
import { dealerSchema } from "../utils/dealerSchema";
import { useCTAContext } from "../hooks/useCTAContext";
import { captureRef, getRef } from "../utils/refTracking";
import { getSlugFromURL, trackEvent } from "../utils/analytics";
import { StorefrontError } from "../components/ErrorScreen";
import { StorefrontStyles } from "../components/storefront/sections/ui";
import { SECTION_VERSIONS, AVAILABLE_VERSIONS, SECTION_FALLBACK } from "../components/storefront/sections";
import { cleanLayout, fromDraftParam, cleanFont, draftFont, fontCss, fontSheet, cleanOptions, draftOptions, sectionOn } from "../utils/storefrontLayout";
import { themeOf, draftTheme, themeCss } from "../utils/storefrontTheme";
import { chosenPageColor, PAGE_COLOR_DEFAULT } from "../utils/pageAccent";
import { accentTheme } from "../utils/liveAccent";
import { STOREFRONT_CAR_FIELDS } from "../utils/storefrontStock";
// Load only when the buyer taps "Trade in my car" / "Check my loan" (STOREFRONT-1).
const TradeInSheet = lazy(() => import("../components/storefront/TradeInSheet"));
const LoanCheckSheet = lazy(() => import("../components/storefront/LoanCheckSheet"));

const CAR_FIELDS = STOREFRONT_CAR_FIELDS;

const isHotDeal = (c) => {
  const op = c.original_price,
    sp = c.selling_price;
  return op && op > 0 && sp > 0 && sp <= op * 0.97;
};

// ── HomePage ──────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { siteName, profile } = useSiteProfile();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [tradeInOpen, setTradeInOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  // "See it on my site" from Settings > Storefront > Layout: an unsaved layout in the link.
  // Read through the same cleaner as the saved one, so a link can only reorder or hide the
  // dealer's own sections (never the cars or contact), and buyers still get the saved one.
  const [draftLayout] = useState(() => fromDraftParam(new URLSearchParams(window.location.search).get("layout"), AVAILABLE_VERSIONS));
  const [draftFontId] = useState(() => draftFont(new URLSearchParams(window.location.search).get("layout")));
  const [draftThemeVal] = useState(() => draftTheme(new URLSearchParams(window.location.search).get("layout")));
  const [draftOpts] = useState(() => draftOptions(new URLSearchParams(window.location.search).get("layout")));
  const ctaCtx = useCTAContext();
  const { compareIds, addToCompare, removeFromCompare, isInCompare } = useCompare();

  // PERF-2: resolve dealer_id from URL subdomain immediately — no auth wait.
  // Unblocks the listings + sold-count fetch before useTenant finishes its
  // auth-session setup + full profile RPC.
  const [fastDealerId, setFastDealerId] = useState(undefined);
  useEffect(() => {
    const sub = getSubdomain();
    if (!sub) { setFastDealerId(null); return; }
    supabase.rpc("get_dealer_id_by_subdomain", { p_subdomain: sub })
      .then(({ data }) => setFastDealerId(data || null));
  }, []);
  // Stale-while-revalidate for the storefront's own car grids — keyed by
  // subdomain (known synchronously, before fastDealerId's RPC resolves) so a
  // repeat visit paints instantly. The fetch below always still runs and
  // overwrites both state and cache the moment it lands.
  const HP_CACHE_TTL = 30 * 60 * 1000; // 30 min
  const hpGridCacheKey = (sub) => `hp_grid_v1_${sub}`;
  const initialHpSub = getSubdomain();
  const initialHpCache = initialHpSub ? readCache(hpGridCacheKey(initialHpSub), HP_CACHE_TTL) : null;

  const [featured, setFeatured] = useState(() => initialHpCache?.featured || []);
  const [hotDeals, setHotDeals] = useState(() => initialHpCache?.hotDeals || []);
  const [loading, setLoading] = useState(() => !initialHpCache);
  const [stock, setStock] = useState(() => initialHpCache?.stock || 0);
  const [soldCount, setSoldCount] = useState(() => initialHpCache?.soldCount ?? null);

  // Capture ref slug from URL into sessionStorage on mount
  useEffect(() => {
    captureRef();
  }, []);

  // Fire store_visit once per session — runs after tenant resolves (null on main site, profile on subdomain)
  useEffect(() => {
    if (tenantLoading) return; // wait for useTenant to finish — fires once when loading → false
    const sessionKey = `sv_fired_${tenant?.id ?? "main"}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    trackEvent(supabase, "store_visit", {
      dealer_id: tenant?.id || null,
      metadata: { source: getSlugFromURL() ? "salesman_link" : "organic" },
    });
  }, [tenantLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire page_view for salesman ref links (requires tenant + slug)
  useEffect(() => {
    if (!tenant?.id) return;
    const slug = getRef();
    // Through trackEvent: this insert carried no session_id, so the old
    // policy had rejected every one of these, and it skipped consent.
    if (slug) {
      trackEvent(supabase, "page_view", {
        salesman_slug: slug,
        dealer_id: tenant.id,
        metadata: { page: window.location.pathname },
      });
    }
  }, [tenant?.id]);

  useEffect(() => {
    // PERF-2: gate on fastDealerId (resolves immediately from URL) not tenant
    if (fastDealerId === undefined) return;
    const dealerId = fastDealerId; // stable for this run
    const load = async () => {
      // PERF-3/4: on subdomain where tenant is available, skip the per-row
      // dealer join (all rows are the same dealer — already in tenant).
      // On main marketplace (no dealerId), keep the join for mixed-dealer cards.
      const useJoin = !dealerId || !tenant;
      let query = supabase
        .from("public_car_listings")
        .select(
          useJoin
            ? `${CAR_FIELDS}, dealer:profiles!dealer_id(dealership, site_name, subdomain, whatsapp_number, site_logo_url, brand_color)`
            : CAR_FIELDS,
          { count: "exact" },
        )
        .in("status", ["available", "reserved"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (dealerId) query = query.eq("dealer_id", dealerId);

      const { data, error, count } = await query;
      let result = null;
      if (!error && data) {
        // Attach tenant as dealer object when join was skipped
        const rows = (dealerId && tenant)
          ? data.map((c) => ({ ...c, dealer: tenant }))
          : data;
        const featuredRows = rows.slice(0, 6);
        const stockCount = count || data.length;
        const hotDealsRows = rows
          .filter(isHotDeal)
          .sort(
            (a, b) =>
              (b.original_price - b.selling_price) / b.original_price -
              (a.original_price - a.selling_price) / a.original_price,
          )
          .slice(0, 6);
        setFeatured(featuredRows);
        setStock(stockCount);
        setHotDeals(hotDealsRows);
        result = { featured: featuredRows, stock: stockCount, hotDeals: hotDealsRows };
        // The precacheImages() call that used to sit here wrote into an
        // 'hp-images-v1' Cache Storage bucket that nothing ever read back. Car
        // photos are cached by the service worker's runtime route now
        // (vite.config.js), which serves what the storefront actually renders.
      }
      setLoading(false);
      return result;
    };
    // PERF-5: sold count runs in parallel — no 800ms artificial delay
    const fetchSoldCount = async () => {
      let q = supabase
        .from("public_car_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "sold");
      if (dealerId) q = q.eq("dealer_id", dealerId);
      const { count } = await q;
      const soldCountVal = count || 0;
      setSoldCount(soldCountVal);
      return soldCountVal;
    };
    Promise.all([load(), fetchSoldCount()]).then(([loadResult, soldCountVal]) => {
      // Only the dealer-subdomain storefront caches its grid — the main
      // marketplace domain redirects away before this ever renders.
      const sub = getSubdomain();
      if (dealerId && sub && loadResult) {
        writeCache(hpGridCacheKey(sub), { ...loadResult, soldCount: soldCountVal });
      }
    });
  }, [fastDealerId, tenant]);

  // This page only renders on a dealer subdomain (App.jsx RootRoute), so browsing is /cars.
  const carsBase = "/cars";

  if (tenant === null) {
    // tenantError = the lookup failed (network/database), not a miss.
    // Saying "doesn't exist" there sent a live dealer's buyers away.
    return <StorefrontError failed={tenantError} />;
  }

  const soldDisplay =
    soldCount !== null && soldCount > 0
      ? `${soldCount}+`
      : soldCount === 0
        ? "0"
        : "500+";

  if (tenant === undefined) return <SciFiLoader />;

  // AutoDealer schema for the dealer's own site (STOREFRONT-1), same builder as api/og.js.
  const dealerLd = tenant?.subdomain ? dealerSchema(tenant, `https://${tenant.subdomain}.${ROOT_DOMAIN}`) : null;

  const layout = draftLayout || cleanLayout(tenant?.storefront_layout, AVAILABLE_VERSIONS);
  // The dealer's heading font (stage 4): CSS variables + its stylesheet, nothing for the default.
  const font = draftLayout ? draftFontId : cleanFont(tenant?.storefront_layout);
  const fontVars = fontCss(font);
  const fontHref = fontSheet(font);
  // The dealer's colours (stage 4, storefrontTheme.js): CSS variables on :root, so the trade-in
  // and loan pop-ups (portalled to <body>) follow them too; "" for no theme = the page as before.
  // With no accent picked, the accent is the brand colour from Settings (as accentOf).
  const theme = draftLayout ? draftThemeVal : themeOf(tenant?.storefront_layout);
  const themeVars = themeCss(theme, accentTheme(chosenPageColor(tenant) || PAGE_COLOR_DEFAULT).accent);

  // The look options (storefrontLayout.js OPTIONS: banner C's background, ...), every key present.
  const look = draftLayout ? draftOpts : cleanOptions(tenant?.storefront_layout);

  // The same props for every section; each returns null when it has nothing to show.
  const ctx = {
    look,
    // The Browse bar (phase B) is on: the cars section drops its own body-type chips.
    browseOn: sectionOn(layout, "browse"),
    tenant, siteName, carsBase, ctaCtx, stock, soldCount, soldDisplay, featured, hotDeals, loading,
    compare: { compareIds, addToCompare, removeFromCompare, isInCompare },
    onTradeIn: () => setTradeInOpen(true),
    onLoanCheck: () => setLoanOpen(true),
  };

  return (
    <>
      <StorefrontStyles />
      {fontVars && <style>{fontVars}</style>}
      {themeVars && <style>{themeVars}</style>}

      <Helmet>
        <link
          rel="preconnect"
          href="https://lemdkdizdlcirhbzqlos.supabase.co"
        />
        <title>
          {profile
            ? `${profile.site_name || profile.dealership} — Used Cars in Malaysia`
            : "Drevo — Used & Recon Cars for Sale in Malaysia"}
        </title>
        <meta
          name="robots"
          content={draftLayout ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}
        />
        <meta
          name="description"
          content={
            profile
              ? `Browse used cars from ${profile.site_name || profile.dealership}. Find your perfect car today.`
              : "Used, recon and new cars for sale in Malaysia, with asking prices, photos and seller details from local dealers and agents on Drevo."
          }
        />
        <meta
          property="og:title"
          content={
            profile
              ? `${profile.site_name || profile.dealership} — Used Cars`
              : "Drevo — Used & Recon Cars for Sale in Malaysia"
          }
        />
        <meta
          property="og:image"
          content={profile?.site_logo_url || "https://drevo.my/og-default.jpg"}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href={profile?.subdomain ? `https://${profile.subdomain}.${ROOT_DOMAIN}` : SITE_URL} />
        {fontHref && <link rel="stylesheet" href={fontHref} />}
        {dealerLd && <script type="application/ld+json">{JSON.stringify(dealerLd)}</script>}
        {!profile && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://drevo.my/#organization",
              name: "Drevo",
              alternateName: "Drevo Malaysia",
              url: "https://drevo.my",
              logo: "https://drevo.my/drevo-mark-512.png",
              description:
                "Drevo is a Malaysian marketplace for used, recon and new cars from local dealers and agents, and the maker of DrevoOS, a used-car dealer management system (DMS).",
              areaServed: "MY",
              sameAs: [
                "https://facebook.com/xdrive.my",
                "https://instagram.com/xdrive.my",
                "https://tiktok.com/@xdrive.my",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
                availableLanguage: ["en", "ms"],
              },
            })}
          </script>
        )}
        {!profile && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://drevo.my/#website",
              name: "Drevo",
              alternateName: "Drevo Malaysia",
              url: "https://drevo.my",
              publisher: { "@id": "https://drevo.my/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://drevo.my/showroom?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            })}
          </script>
        )}
      </Helmet>

      <Header look={look} />
      <GoogleOneTapSlot />
      {tradeInOpen && (
        <Suspense fallback={null}>
          <TradeInSheet
            subdomain={tenant?.subdomain}
            siteName={tenant?.site_name || tenant?.dealership}
            whatsappNumber={tenant?.whatsapp_number}
            onClose={() => setTradeInOpen(false)}
          />
        </Suspense>
      )}
      {loanOpen && (
        <Suspense fallback={null}>
          <LoanCheckSheet
            subdomain={tenant?.subdomain}
            dealerId={tenant?.id}
            siteName={tenant?.site_name || tenant?.dealership}
            whatsappNumber={tenant?.whatsapp_number}
            onClose={() => setLoanOpen(false)}
          />
        </Suspense>
      )}

      {draftLayout && (
        <div role="status" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, background: "#F0F0F0", color: "#0B0B0D", textAlign: "center", fontSize: 13, fontWeight: 600, padding: "10px 16px" }}>
          Preview of your unsaved layout. Buyers still see the saved one.
        </div>
      )}
      {layout.filter((r) => r.on).map(({ id, variant }) => {
        const Section = SECTION_VERSIONS[id]?.[variant] || SECTION_VERSIONS[id]?.a;
        return Section ? (
          <Suspense key={id} fallback={SECTION_FALLBACK[id] || null}>
            <Section {...ctx} />
          </Suspense>
        ) : null;
      })}

      <Footer look={look} />
      <StickyWhatsAppButton />
    </>
  );
};

export default HomePage;

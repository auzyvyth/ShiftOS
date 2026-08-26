import React, { lazy, Suspense } from "react";
import { Route, Routes, BrowserRouter as Router, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import * as Sentry from "@sentry/react";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);
import ScrollToTop from "./components/ScrollToTop";
import CompareBar from "./components/CompareBar";
import ConsentBanner from "./components/ConsentBanner";
import InstallPrompt from "./components/InstallPrompt";
import OfflineBanner from "./components/OfflineBanner";
import { isSubdomain } from "./hooks/useTenant";
import { useIdleLogout } from "./hooks/useIdleLogout";
import { usePushHeal } from "./hooks/usePushHeal";
import "./i18n/config";

// Eager — only true above-the-fold entry points. The public marketplace
// (xdrive.my "/") is the highest-traffic page, so it lives in the entry bundle
// and paints with no extra lazy-chunk hop.
import MarketplacePage from "./pages/MarketplacePage";
// Eager — tiny, and must render instantly (no blank Suspense flash) on bad URLs
import NotFoundPage from "./pages/NotFoundPage";

// Lazy — /showroom & /cars are navigated to, never the landing page, so this
// heavy page (its own Header + the 3,700-line CarForm/@dnd-kit graph) must NOT
// ride in the marketplace entry bundle. It was eager before, which is what
// pulled the listing-form + drag-drop library onto the public landing page and
// jammed first paint. Sibling CarDetailPage is already lazy for the same reason.
const CarListingPage  = lazy(() => import("./pages/CarListingPage"));

// Lazy — the dealer subdomain storefront. Only <sub>.xdrive.my visitors render
// it, so its storefront-only weight (HeroCarousel etc.) must stay OUT of the
// marketplace critical bundle. See RootRoute below.
const HomePage        = lazy(() => import("./pages/HomePage"));

// Lazy — navigated to, not landed on directly
const CarDetailPage   = lazy(() => import("./pages/CarDetailPage"));

// Lazy — everything else
const CalculatorPage     = lazy(() => import("./pages/CalculatorPage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const BuyerAuthPage      = lazy(() => import("./pages/BuyerAuthPage"));
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));
const SalesmanPanel      = lazy(() => import("./pages/Salesmanpanel"));
const SalesmanLite       = lazy(() => import("./pages/SalesmanLite"));
const SalesmanPremium    = lazy(() => import("./pages/SalesmanPremium"));
const SalesmanOnboarding = lazy(() => import("./pages/SalesmanOnboarding"));
const DealerOnboarding   = lazy(() => import("./pages/DealerOnboarding"));
const AdminPanel         = lazy(() => import("./pages/AdminPanel"));
const AdminPage          = lazy(() => import("./pages/AdminPage"));
const ManagerPanel       = lazy(() => import("./pages/ManagerPanel"));
const AccountantPanel    = lazy(() => import("./pages/AccountantPanel"));
const FIPanel            = lazy(() => import("./pages/FIPanel"));
const AccountsPanel      = lazy(() => import("./pages/AccountsPanel"));
const ShiftOSPage        = lazy(() => import("./pages/ShiftOSPage"));
const SalesmanLiteLanding = lazy(() => import("./pages/SalesmanLiteLanding"));
const MindMapPage        = lazy(() => import("./pages/MindMapPage"));
const DealerSlugRedirect = lazy(() => import("./pages/DealerSlugRedirect"));
const SalesmanProfilePage= lazy(() => import("./pages/SalesmanProfilePage"));
const AuthConfirmPage    = lazy(() => import("./pages/AuthConfirmPage"));
const AuthCallbackPage   = lazy(() => import("./pages/AuthCallbackPage"));
const ChoosePlanPage     = lazy(() => import("./pages/ChoosePlanPage"));
const ResetPasswordPage  = lazy(() => import("./pages/ResetPasswordPage"));
const SalesmanSetup      = lazy(() => import("./pages/SalesmanSetup"));
const ImportStockPage    = lazy(() => import("./pages/ImportStockPage"));
const ComparePage        = lazy(() => import("./pages/ComparePage"));
const AccountPage        = lazy(() => import("./pages/AccountPage"));
const AccountMessagesPage = lazy(() => import("./pages/AccountMessagesPage"));
const SavedCarsPage      = lazy(() => import("./pages/SavedCarsPage"));
const LoanSharePage      = lazy(() => import("./pages/LoanSharePage"));
const FeaturePage        = lazy(() => import("./pages/FeaturePage"));
const GuidesPage         = lazy(() => import("./pages/GuidesPage"));
const WaitlistPage       = lazy(() => import("./pages/WaitlistPage"));
const TermsPage          = lazy(() => import("./pages/TermsPage"));
const PrivacyPage        = lazy(() => import("./pages/PrivacyPage"));
const DealPage           = lazy(() => import("./pages/DealPage"));
const StyleGuidePage     = lazy(() => import("./pages/StyleGuidePage"));
const ArticlesIndexPage  = lazy(() => import("./pages/ArticlesIndexPage"));
const PuspakomB5B7Article = lazy(() => import("./pages/articles/PuspakomB5B7Article"));
const MySikapArticle     = lazy(() => import("./pages/articles/MySikapArticle"));
const ReconArticle       = lazy(() => import("./pages/articles/ReconArticle"));
const UrusStokDigitalArticle = lazy(() => import("./pages/articles/UrusStokDigitalArticle"));
const AppTerbaikDealerArticle = lazy(() => import("./pages/articles/AppTerbaikDealerArticle"));
const KomisenSalesmanArticle = lazy(() => import("./pages/articles/KomisenSalesmanArticle"));
const ApaItuDmsArticle   = lazy(() => import("./pages/articles/ApaItuDmsArticle"));
const SalesAgreementArticle = lazy(() => import("./pages/articles/SalesAgreementArticle"));

const COMPARE_PATHS = ["/", "/cars", "/showroom", "/compare"];

function CompareBarGate() {
  const { pathname } = useLocation();
  const show = COMPARE_PATHS.includes(pathname) ||
    pathname.startsWith("/cars/") ||
    pathname.startsWith("/showroom/");
  return show ? <CompareBar /> : null;
}

// "/marketplace" used to be its own page with no subdomain awareness — hitting
// it on a dealer's subdomain leaked the full unscoped multi-dealer marketplace
// instead of that dealer's storefront. The marketplace now lives at "/" only
// (HomePage renders it there when there's no tenant), so this just forwards
// old links/bookmarks, preserving any query string (e.g. ?hot_deals=true).
function MarketplaceRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/${search}`} replace />;
}

// "/" serves two different surfaces depending on host. isSubdomain() is a
// SYNCHRONOUS hostname check (no auth/tenant round-trip), so we can pick the
// right component immediately instead of the old path where HomePage mounted,
// showed a loader while useTenant resolved, then handed off to a lazy
// MarketplacePage — a serial waterfall on the busiest page. Main domain
// (xdrive.my) → the eager, self-contained MarketplacePage. A real dealer
// storefront (<sub>.xdrive.my) → the lazy HomePage.
function RootRoute() {
  return isSubdomain() ? <HomePage /> : <MarketplacePage />;
}

function App() {
  useIdleLogout(); // sign out after 24h of inactivity
  usePushHeal();   // silently re-register a push subscription the browser dropped
  return (
    <Router>
      <ScrollToTop />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            fontFamily: "system-ui,sans-serif",
          },
        }}
      />
      <CompareBarGate />
      <ConsentBanner />
      <InstallPrompt />
      <OfflineBanner />
      <Suspense fallback={null}>
        <SentryRoutes>
          {/* Public — XDrive */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/marketplace" element={<MarketplaceRedirect />} />
          <Route path="/showroom" element={<CarListingPage />} />
          <Route path="/showroom/:slug" element={<CarDetailPage />} />
          <Route path="/cars" element={<CarListingPage />} />
          <Route path="/cars/:slug" element={<CarDetailPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/saved" element={<SavedCarsPage />} />
          {/* Buyer-facing loan document checklist, opened from a link the
              salesman sends. Public + token-gated (get_loan_share). */}
          <Route path="/loan/:token" element={<LoanSharePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/messages" element={<AccountMessagesPage />} />
          <Route path="/guides/:slug" element={<GuidesPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/articles" element={<ArticlesIndexPage />} />
          <Route path="/articles/apa-itu-puspakom-b5-b7" element={<PuspakomB5B7Article />} />
          <Route path="/articles/cara-pindah-milik-kereta-mysikap" element={<MySikapArticle />} />
          <Route path="/articles/beza-kereta-recon-dan-terpakai" element={<ReconArticle />} />
          <Route path="/articles/cara-urus-stok-kereta-terpakai-sistem-digital" element={<UrusStokDigitalArticle />} />
          <Route path="/articles/app-terbaik-dealer-kereta-terpakai-malaysia" element={<AppTerbaikDealerArticle />} />
          <Route path="/articles/cara-kira-komisen-salesman-kereta" element={<KomisenSalesmanArticle />} />
          <Route path="/articles/apa-itu-dms-dealer-kereta" element={<ApaItuDmsArticle />} />
          <Route path="/articles/cara-buat-sales-agreement-kereta-terpakai" element={<SalesAgreementArticle />} />

          {/* Auth */}
          <Route path="/style-guide" element={<StyleGuidePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/buyer-login" element={<BuyerAuthPage />} />
          <Route path="/buyer-signup" element={<BuyerAuthPage />} />
          <Route path="/signup"             element={<Navigate to="/salesman-onboarding/lite"    replace />} />
          <Route path="/register"           element={<Navigate to="/salesman-onboarding/lite"    replace />} />
          <Route path="/onboarding"         element={<Navigate to="/salesman-onboarding/lite"    replace />} />
          <Route path="/onboarding/lite"    element={<Navigate to="/salesman-onboarding/lite"    replace />} />
          <Route path="/onboarding/premium" element={<Navigate to="/salesman-onboarding/premium" replace />} />
          <Route path="/onboarding/dealer"  element={<Navigate to="/dealer-onboarding/starter"   replace />} />
          <Route path="/onboarding/:plan"   element={<Navigate to="/salesman-onboarding/lite"    replace />} />
          <Route path="/salesman-onboarding" element={<SalesmanOnboarding />} />
          <Route path="/salesman-onboarding/:tier" element={<SalesmanOnboarding />} />
          <Route path="/dealer-onboarding" element={<DealerOnboarding />} />
          <Route path="/dealer-onboarding/:tier" element={<DealerOnboarding />} />
          <Route path="/choose-plan" element={<ChoosePlanPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/salesman-setup" element={<SalesmanSetup />} />

          {/* Protected — XDrive */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:tab" element={<DashboardPage />} />
          <Route path="/dashboard/import-stock" element={<ImportStockPage />} />
          <Route path="/salesman" element={<SalesmanPanel />} />
          {/* ONE route with an optional :tab segment, not two separate Route
              entries for the same component. Two entries (one for the bare
              path, one for :tab) meant navigating from /salesman-lite to
              /salesman-lite/:tab crossed a route-id boundary and remounted
              SalesmanLite, wiping local state (tourStep). That looped the
              first-run intro: pick a language -> the tour's tab-switch effect
              fires -> remount -> mount effect sees onboarding_tour_done still
              false -> resets to the language chooser, forever. A single
              route (param changes, no remount) fixes it. Do NOT split this
              back into two Routes, and do NOT redirect the bare path with
              <Navigate> either — cross-subdomain login hands the session off
              via tokens in the URL HASH (src/lib/authHandoff.js) landing on
              this exact bare path, and Navigate's `to` does not carry the
              current hash over, which would silently break that handoff. */}
          <Route path="/salesman-lite/:tab?" element={<SalesmanLite />} />
          {/* Same single-route-with-optional-:tab pattern as /salesman-lite above,
              and for the same reason: two separate Route entries for bare path vs
              :tab would cross a route-id boundary on every tab switch and remount
              SalesmanPremium, wiping local state (tourStep, etc). */}
          <Route path="/salesman-premium/:tab?" element={<SalesmanPremium />} />
          <Route path="/manager" element={<ManagerPanel />} />
          <Route path="/accountant" element={<AccountantPanel />} />
          <Route path="/fi" element={<FIPanel />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/accounts" element={<AccountsPanel />} />
          <Route path="/platform" element={<AdminPage />} />

          {/* Public — ShiftOS marketing */}
          <Route path="/shiftos" element={<ShiftOSPage />} />
          <Route path="/features/:slug" element={<FeaturePage />} />
          <Route path="/for-salesmen" element={<SalesmanLiteLanding />} />
          <Route path="/mindmap" element={<MindMapPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/deal/:token" element={<DealPage />} />

          {/* Dealer slug catch-all */}
          <Route path="/s/:slug" element={<SalesmanProfilePage />} />
          <Route path="/:dealerSlug" element={<DealerSlugRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </SentryRoutes>
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;

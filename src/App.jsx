import React, { lazy, Suspense } from "react";
import { Route, Routes, BrowserRouter as Router, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import * as Sentry from "@sentry/react";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);
import ScrollToTop from "./components/ScrollToTop";
import CompareBar from "./components/CompareBar";
import { useIdleLogout } from "./hooks/useIdleLogout";
import "./i18n/config";

// Eager — only true above-the-fold entry points
import HomePage from "./pages/HomePage";
import CarListingPage from "./pages/CarListingPage";
// Eager — tiny, and must render instantly (no blank Suspense flash) on bad URLs
import NotFoundPage from "./pages/NotFoundPage";

// Lazy — navigated to, not landed on directly
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const CarDetailPage   = lazy(() => import("./pages/CarDetailPage"));

// Lazy — everything else
const CalculatorPage     = lazy(() => import("./pages/CalculatorPage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const BuyerAuthPage      = lazy(() => import("./pages/BuyerAuthPage"));
const RegisterPage       = lazy(() => import("./pages/RegisterPage"));
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
const MindMapPage        = lazy(() => import("./pages/MindMapPage"));
const DealerSlugRedirect = lazy(() => import("./pages/DealerSlugRedirect"));
const SalesmanProfilePage= lazy(() => import("./pages/SalesmanProfilePage"));
const AuthConfirmPage    = lazy(() => import("./pages/AuthConfirmPage"));
const AuthCallbackPage   = lazy(() => import("./pages/AuthCallbackPage"));
const ResetPasswordPage  = lazy(() => import("./pages/ResetPasswordPage"));
const SalesmanSetup      = lazy(() => import("./pages/SalesmanSetup"));
const ImportStockPage    = lazy(() => import("./pages/ImportStockPage"));
const ComparePage        = lazy(() => import("./pages/ComparePage"));
const AccountPage        = lazy(() => import("./pages/AccountPage"));
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

const COMPARE_PATHS = ["/", "/cars", "/marketplace", "/showroom", "/compare"];

function CompareBarGate() {
  const { pathname } = useLocation();
  const show = COMPARE_PATHS.includes(pathname) ||
    pathname.startsWith("/cars/") ||
    pathname.startsWith("/showroom/");
  return show ? <CompareBar /> : null;
}

function App() {
  useIdleLogout(); // sign out after 24h of inactivity
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
            fontFamily: "'DM Sans',sans-serif",
          },
        }}
      />
      <CompareBarGate />
      <Suspense fallback={null}>
        <SentryRoutes>
          {/* Public — XDrive */}
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/showroom" element={<CarListingPage />} />
          <Route path="/showroom/:slug" element={<CarDetailPage />} />
          <Route path="/cars" element={<CarListingPage />} />
          <Route path="/cars/:slug" element={<CarDetailPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/account" element={<AccountPage />} />
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
          <Route path="/salesman-lite" element={<SalesmanLite />} />
          <Route path="/salesman-premium" element={<SalesmanPremium />} />
          <Route path="/manager" element={<ManagerPanel />} />
          <Route path="/accountant" element={<AccountantPanel />} />
          <Route path="/fi" element={<FIPanel />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/accounts" element={<AccountsPanel />} />
          <Route path="/platform" element={<AdminPage />} />

          {/* Public — ShiftOS marketing */}
          <Route path="/shiftos" element={<ShiftOSPage />} />
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

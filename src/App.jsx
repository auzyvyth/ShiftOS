import React, { lazy, Suspense } from "react";
import { Route, Routes, BrowserRouter as Router, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import * as Sentry from "@sentry/react";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);
import ScrollToTop from "./components/ScrollToTop";
import CompareBar from "./components/CompareBar";
import "./i18n/config";

// Eager — public pages that must load instantly
import HomePage from "./pages/HomePage";
import ShowroomPage from "./pages/ShowroomPage";
import MarketplacePage from "./pages/MarketplacePage";
import CarsPage from "./pages/CarsPage";
import CarDetailPage from "./pages/CarDetailPage";

// Lazy — everything else
const CalculatorPage     = lazy(() => import("./pages/CalculatorPage"));
const LoginPage          = lazy(() => import("./pages/LoginPage"));
const RegisterPage       = lazy(() => import("./pages/RegisterPage"));
const DashboardPage      = lazy(() => import("./pages/DashboardPage"));
const SalesmanPanel      = lazy(() => import("./pages/Salesmanpanel"));
const SalesmanLite       = lazy(() => import("./pages/SalesmanLite"));
const SalesmanPremium    = lazy(() => import("./pages/SalesmanPremium"));
const OnboardingPage     = lazy(() => import("./pages/OnboardingPage"));
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
const ImportStockPage    = lazy(() => import("./pages/ImportStockPage"));
const ComparePage        = lazy(() => import("./pages/ComparePage"));
const SavedCarsPage      = lazy(() => import("./pages/SavedCarsPage"));
const GuidesPage         = lazy(() => import("./pages/GuidesPage"));
const WaitlistPage       = lazy(() => import("./pages/WaitlistPage"));
const TermsPage          = lazy(() => import("./pages/TermsPage"));
const PrivacyPage        = lazy(() => import("./pages/PrivacyPage"));

const COMPARE_PATHS = ["/", "/cars", "/marketplace", "/showroom", "/compare", "/saved"];

function CompareBarGate() {
  const { pathname } = useLocation();
  const show = COMPARE_PATHS.includes(pathname) ||
    pathname.startsWith("/cars/") ||
    pathname.startsWith("/showroom/");
  return show ? <CompareBar /> : null;
}

function App() {
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
          <Route path="/showroom" element={<ShowroomPage />} />
          <Route path="/showroom/:slug" element={<CarDetailPage />} />
          <Route path="/cars" element={<CarsPage />} />
          <Route path="/cars/:slug" element={<CarDetailPage />} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/saved" element={<SavedCarsPage />} />
          <Route path="/guides/:slug" element={<GuidesPage />} />
          <Route path="/guides" element={<GuidesPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<OnboardingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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

          {/* Dealer slug catch-all */}
          <Route path="/s/:slug" element={<SalesmanProfilePage />} />
          <Route path="/:dealerSlug" element={<DealerSlugRedirect />} />
        </SentryRoutes>
      </Suspense>
      <Analytics />
    </Router>
  );
}

export default App;

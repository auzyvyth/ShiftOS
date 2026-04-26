import React from "react";
import { Route, Routes, BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "sonner";
import ScrollToTop from "./components/ScrollToTop";
import HomePage from "./pages/HomePage";
import CarsPage from "./pages/CarsPage";
import CarDetailPage from "./pages/CarDetailPage";
import CalculatorPage from "./pages/CalculatorPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import SalesmanPanel from "./pages/Salesmanpanel";
import SalesmanLite from "./pages/SalesmanLite";
import OnboardingPage from "./pages/OnboardingPage";
import AdminPanel from "./pages/AdminPanel";
import AdminPage from "./pages/AdminPage";
import ManagerPanel from "./pages/ManagerPanel";
import AccountantPanel from "./pages/AccountantPanel";
import FIPanel from "./pages/FIPanel";
import AccountsPanel from "./pages/AccountsPanel";
import ShiftOSPage from "./pages/ShiftOSPage";
import MindMapPage from "./pages/MindMapPage";
import DealerSlugRedirect from "./pages/DealerSlugRedirect";
import SalesmanProfilePage from "./pages/SalesmanProfilePage";
import AuthConfirmPage from "./pages/AuthConfirmPage";
import ImportStockPage from "./pages/ImportStockPage";
import "./i18n/config";

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
      <Routes>
        {/* Public — XDrive */}
        <Route path="/" element={<HomePage />} />
        <Route path="/cars" element={<CarsPage />} />
        <Route path="/cars/:slug" element={<CarDetailPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<OnboardingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/auth/confirm" element={<AuthConfirmPage />} />

        {/* Protected — XDrive */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/import-stock" element={<ImportStockPage />} />
        <Route path="/salesman" element={<SalesmanPanel />} />
        <Route path="/salesman-lite" element={<SalesmanLite />} />
        <Route path="/manager" element={<ManagerPanel />} />
        <Route path="/accountant" element={<AccountantPanel />} />
        <Route path="/fi" element={<FIPanel />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/accounts" element={<AccountsPanel />} />
        <Route path="/platform" element={<AdminPage />} />

        {/* Public — ShiftOS marketing */}
        <Route path="/shiftos" element={<ShiftOSPage />} />
        <Route path="/mindmap" element={<MindMapPage />} />

        {/* Dealer slug catch-all — redirects to subdomain */}
        <Route path="/s/:slug" element={<SalesmanProfilePage />} />
        <Route path="/:dealerSlug" element={<DealerSlugRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;

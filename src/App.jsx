import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'sonner';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import CarsPage from './pages/CarsPage';
import CarDetailPage from './pages/CarDetailPage';
import CalculatorPage from './pages/CalculatorPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesmanPanel from './pages/Salesmanpanel';
import OnboardingPage from './pages/OnboardingPage';
import AdminPanel from './pages/AdminPanel';
import AccountsPanel from './pages/AccountsPanel';
import './i18n/config';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#111118', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontFamily: "'DM Sans',sans-serif" },
        }}
      />
      <Routes>
        {/* Public — XDrive */}
        <Route path="/"           element={<HomePage />} />
        <Route path="/cars"       element={<CarsPage />} />
        <Route path="/cars/:slug" element={<CarDetailPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />

        {/* Auth */}
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Protected — XDrive */}
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/salesman"   element={<SalesmanPanel />} />
        <Route path="/admin"      element={<AdminPanel />} />
        <Route path="/accounts"   element={<AccountsPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
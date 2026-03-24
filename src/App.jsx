import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import CarsPage from './pages/CarsPage';
import CarDetailPage from './pages/CarDetailPage';
import CalculatorPage from './pages/CalculatorPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesmanPanel from './pages/Salesmanpanel';
import OnboardingPage from './pages/OnboardingPage';
import './i18n/config';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public — Drevo */}
        <Route path="/"           element={<HomePage />} />
        <Route path="/cars"       element={<CarsPage />} />
        <Route path="/cars/:id"   element={<CarDetailPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />

        {/* Auth */}
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Protected — XDrive */}
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/salesman"   element={<SalesmanPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
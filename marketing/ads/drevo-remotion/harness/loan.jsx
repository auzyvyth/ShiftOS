// Loan check (the REAL component) and the buyer's loan page (the REAL LoanSharePage) on a sample
// buyer, for the loan check ad scene. Made-up buyer and number (PDPA). ?lng=ms|en &view=check|result|share
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../../../src/i18n/config.js';
import '../../../../src/index.css';
import './fonts.css';
import LoanCheck from '../../../../src/components/loans/LoanCheck.jsx';
import LoanSharePage from '../../../../src/pages/LoanSharePage.jsx';

const q = new URLSearchParams(location.search);
const lang = q.get('lng') === 'en' ? 'en' : 'ms';
const view = q.get('view') || 'check';
const CAR = { id: 'k5', brand: 'Proton', model: 'X50', variant: '1.5 TGDi Flagship', year: 2025, condition: 'new', selling_price: 113300, status: 'available' };
const LEAD = { id: 'l4', buyer_name: 'Nadia Rahim', phone: '0100000004', car_listing_id: 'k5', car_listings: CAR };
// late once, has not looked at CCRIS yet: the check says what to fix before any bank sees the file
const ANSWERS = { price: '113300', dep: 10, years: 7, eir: '4.8', pay: '5200', commit: '650', late: 'some', ccris: 'notyet',
  history: 'yes', guarantor: 'maybe', earn: 'salary', job: 'gt12', confirmed: 'confirmed' };
const mins = (m) => new Date(Date.now() - m * 60000).toISOString();
globalThis.__STUB_RPC = { get_loan_share: [{
  buyer_name: 'Nadia Rahim', buyer_employment_type: 'Salaried', car_model: 'Proton X50', loan_amount: 101970, loan_tenure: 7,
  doc_ic_front: true, doc_ic_back: true, doc_payslip_1: true, doc_payslip_2: true, doc_payslip_3: false, doc_epf: false, doc_bank_statement: true,
  banks: [{ name: 'Maybank', status: 'Pending' }, { name: 'Public Bank', status: 'Submitted' }],
  salesman_name: 'Aiman', salesman_whatsapp: '0100000000', updated_at: mins(12),
}] };
const noop = () => {};
i18n.changeLanguage(lang).then(() => {
  createRoot(document.getElementById('root')).render(
    view === 'share'
      ? <MemoryRouter initialEntries={['/loan/sample']}><Routes><Route path="/loan/:token" element={<LoanSharePage />} /></Routes></MemoryRouter>
      : <MemoryRouter><LoanCheck lead={LEAD} listings={[CAR]} userId="u1" onClose={noop} onSaved={noop} onApply={noop}
          existing={view === 'result' ? { id: 'c1', answers: ANSWERS, buyer_name: 'Nadia Rahim', listing_id: 'k5' } : null} /></MemoryRouter>
  );
  setTimeout(() => { window.LOAN_READY = true; }, 700);
});

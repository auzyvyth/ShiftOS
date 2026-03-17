import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, AlertCircle, RefreshCw, MessageCircle, Search, TrendingDown, Car, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AmortizationSchedule from './AmortizationSchedule';

// ─── Road tax (JPJ, private, Peninsular Malaysia) ─────────────────────────────
const calcRoadTax = (cc, bodyType = 'Sedan') => {
  if (!cc || cc <= 0) return null;
  const nonSaloon = bodyType && ['SUV', 'MPV', 'Pickup'].includes(bodyType);
  const c = Number(cc);
  if (c <= 1000) return 20;
  if (c <= 1200) return 55;
  if (c <= 1400) return 70;
  if (c <= 1600) return 90;
  if (c <= 1800) return Math.round(200 + (c - 1600) * (nonSaloon ? 0.40 : 0.50));
  if (c <= 2000) return Math.round(280 + (c - 1800) * (nonSaloon ? 0.40 : 0.50));
  if (c <= 2500) return Math.round(380 + (c - 2000) * 1.00);
  if (c <= 3000) return Math.round(880 + (c - 2500) * (nonSaloon ? 2.50 : 4.50));
  return Math.round((nonSaloon ? 2130 : 3130) + (c - 3000) * (nonSaloon ? 2.50 : 4.50));
};

// ─── Insurance estimate ───────────────────────────────────────────────────────
const NCD_TIERS = [0, 25, 30, 38.33, 45, 55];

const calcInsurance = (sum, ncd) => {
  if (!sum || sum <= 0) return null;
  const gross    = sum * 0.03;
  const discount = gross * (ncd / 100);
  return { gross: Math.round(gross), discount: Math.round(discount), net: Math.round(gross - discount) };
};

// ─── Shared sub-components ────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
      active ? 'border-[#1E3A8A] text-[#1E3A8A] bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 bg-transparent'
    }`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);

const RightPanel = ({ children, compact }) => (
  <div className={`${compact ? 'p-5' : 'p-8'} md:w-1/2 bg-[#1E3A8A] text-white flex flex-col justify-between relative overflow-hidden`}>
    <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
    <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
    <div className="relative w-full">{children}</div>
  </div>
);

const BigNumber = ({ value, unit = '/yr', label }) => {
  const numeric = value != null
    ? (typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]+/g, '')))
    : null;
  const display = numeric != null && !Number.isNaN(numeric) ? numeric.toLocaleString('en-MY') : '—';
  return (
    <div className="mb-6">
      <p className="text-blue-200 text-sm font-medium mb-1">{label}</p>
      <motion.div key={String(value)} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-blue-200">RM</span>
        <span className="text-5xl sm:text-6xl font-extrabold tracking-tight">{display}</span>
        <span className="text-lg text-blue-300 font-medium">{unit}</span>
      </motion.div>
    </div>
  );
};

const ResultRow = ({ label, value, highlight, accent }) => (
  <div className={`flex justify-between items-center py-3 ${highlight ? 'bg-white/10 rounded-xl px-3' : 'border-b border-white/10'}`}>
    <span className="text-blue-200 text-sm">{label}</span>
    <span className={`font-bold ${highlight ? 'text-white text-lg' : accent ? 'text-green-300' : 'text-white'}`}>{value}</span>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const FinancingCalculator = ({ initialPrice = 85000, engineCc = null, bodyType = null, flat = false, compact = false }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('loan');

  // — Loan state —
  const [carPrice,    setCarPrice]    = useState(initialPrice);
  const [dpPct,       setDpPct]       = useState(10);
  const [loanTerm,    setLoanTerm]    = useState(7);
  const [intRate,     setIntRate]     = useState(3.5);
  const [error,       setError]       = useState('');

  // — Road tax state —
  const [rtCc,   setRtCc]   = useState(engineCc ? String(engineCc) : '');
  const [rtBody, setRtBody] = useState(bodyType || 'Sedan');

  // — Insurance state —
  const [insSum, setInsSum] = useState(initialPrice);
  const [insNcd, setInsNcd] = useState(55);

  useEffect(() => { setCarPrice(initialPrice); setInsSum(initialPrice); }, [initialPrice]);
  useEffect(() => { if (engineCc) setRtCc(String(engineCc)); }, [engineCc]);
  useEffect(() => { if (bodyType) setRtBody(bodyType); }, [bodyType]);

  const downPayment = (carPrice * dpPct) / 100;

  const validate = () => {
    if (!carPrice || carPrice <= 0)                              return t('calculator.errors.price');
    if (downPayment < 0)                                         return t('calculator.errors.downPaymentNegative');
    if (downPayment >= carPrice)                                 return t('calculator.errors.downPaymentExcess');
    if (loanTerm <= 0 || loanTerm > 15)                         return t('calculator.errors.loanTerm');
    if (!intRate || intRate <= 0 || intRate > 20)               return t('calculator.errors.interestRate');
    return '';
  };

  const loanResults = (() => {
    if (validate()) return null;
    const loanAmt    = carPrice - downPayment;
    const interest   = loanAmt * (intRate / 100) * loanTerm;
    const total      = loanAmt + interest;
    return { loanAmt, monthly: total / (loanTerm * 12), interest, total };
  })();

  useEffect(() => { setError(validate()); }, [carPrice, downPayment, loanTerm, intRate]);

  const reset = () => { setCarPrice(initialPrice); setDpPct(10); setLoanTerm(7); setIntRate(3.5); setError(''); };
  const fmt   = (n, d = 0) => n != null ? n.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d }) : '0';

  const roadTax  = calcRoadTax(Number(rtCc), rtBody);
  const insCalc  = calcInsurance(insSum, insNcd);

  // Debug: surface current inputs and computed outputs in browser console
  try {
    // eslint-disable-next-line no-console
    console.debug('FinancingCalculator debug', { tab, rtCc, rtBody, roadTax, insSum, insNcd, insCalc });
  } catch (e) {
    // ignore in environments where console is unavailable
  }
  const preApprovedLink = 'https://wa.me/60174155191?text=' + encodeURIComponent("Hi! I'm interested in getting pre-approved for car financing. Can you help?");
  const BODY_TYPES = ['Sedan', 'Hatchback', 'Coupe', 'SUV', 'MPV', 'Pickup'];
  const CC_QUICK   = [1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000];

  return (
    <div className={flat ? 'w-full' : 'w-full max-w-5xl mx-auto'}>
      <div className={flat ? 'overflow-hidden' : 'bg-white rounded-2xl shadow-xl overflow-hidden'}>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-4 bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <TabBtn active={tab === 'loan'}      onClick={() => setTab('loan')}      icon={Calculator} label="Financing" />
          <TabBtn active={tab === 'roadtax'}   onClick={() => setTab('roadtax')}   icon={Car}        label="Road Tax" />
          <TabBtn active={tab === 'insurance'} onClick={() => setTab('insurance')} icon={Shield}     label="Insurance Est." />
        </div>

        {/* ══ LOAN ══ */}
        {tab === 'loan' && (
          <div className="flex flex-col md:flex-row">
            {/* Inputs */}
            <div className={`${compact ? 'p-5' : 'p-8'} md:w-1/2 bg-white`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">{t('calculator.inputs.title')}</h2>
                <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1E3A8A] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />{t('common.resetAll')}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 text-red-600 p-3 rounded-lg mb-5 flex items-start gap-2 text-sm overflow-hidden">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-5">
                {/* Price */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('calculator.inputs.price')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">RM</span>
                    <input type="number" value={carPrice || ''} onChange={e => setCarPrice(parseFloat(e.target.value) || 0)} placeholder="e.g. 85000"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 bg-white text-sm" />
                  </div>
                </div>

                {/* Down payment */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('calculator.inputs.downPayment')}</label>
                    <span className="text-xs font-bold text-[#1E3A8A] bg-[#1E3A8A]/10 px-2 py-0.5 rounded-full">{dpPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">RM</span>
                      <input type="number" value={Math.round(downPayment) || ''}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; if (carPrice > 0) setDpPct((v / carPrice) * 100); }}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 bg-white text-sm" />
                    </div>
                    <div className="relative w-24">
                      <input type="number" value={dpPct || ''} onChange={e => setDpPct(parseFloat(e.target.value) || 0)}
                        className="w-full pr-7 pl-3 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 bg-white text-sm" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <input type="range" min="0" max="50" step="5" value={dpPct} onChange={e => setDpPct(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1E3A8A]" />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      {['0%','10%','20%','30%','40%','50%'].map(l => <span key={l}>{l}</span>)}
                    </div>
                  </div>
                </div>

                {/* Term + rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('calculator.inputs.loanTerm')}</label>
                    <div className="relative">
                      <select value={loanTerm} onChange={e => setLoanTerm(parseInt(e.target.value))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 bg-white appearance-none text-sm">
                        {[1,2,3,4,5,6,7,8,9,10].map(y => <option key={y} value={y}>{y} {y === 1 ? t('calculator.inputs.year') : t('calculator.inputs.years')}</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                        <svg className="fill-current h-3.5 w-3.5" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('calculator.inputs.interestRate')}</label>
                    <div className="relative">
                      <input type="number" step="0.1" value={intRate || ''} onChange={e => setIntRate(parseFloat(e.target.value))}
                        className="w-full pr-8 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 bg-white text-sm" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                </div>

                {/* Quick term */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Quick select term</p>
                  <div className="flex gap-2">
                    {[3,5,7,9].map(y => (
                      <button key={y} onClick={() => setLoanTerm(y)}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${loanTerm === y ? 'bg-[#1E3A8A] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {y}yr
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <RightPanel compact={compact}>
              <BigNumber value={loanResults && !error ? fmt(loanResults.monthly) : null} unit="/mo" label={t('calculator.results.monthly')} />
              <div className="space-y-1 mb-6">
                <ResultRow label={t('calculator.results.principal')}   value={`RM ${loanResults && !error ? fmt(loanResults.loanAmt) : '—'}`} />
                <ResultRow label={t('calculator.results.totalInterest')} value={`RM ${loanResults && !error ? fmt(loanResults.interest) : '—'}`} />
                <ResultRow label={t('calculator.results.totalRepay')} value={`RM ${loanResults && !error ? fmt(loanResults.total) : '—'}`} highlight />
              </div>
              {loanResults && !error && (
                <div className="bg-white/10 rounded-xl p-3 flex items-start gap-2 mb-6">
                  <TrendingDown className="w-4 h-4 text-green-300 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-100 leading-relaxed">
                    Increasing down payment to 20% saves{' '}
                    <strong className="text-white">RM {fmt((carPrice * 0.1) * (intRate / 100) * loanTerm)}</strong>{' '}
                    in interest over {loanTerm} years.
                  </p>
                </div>
              )}
              <div className="space-y-2 mt-auto">
                <a href={preApprovedLink} target="_blank" rel="noopener noreferrer"
                  className="w-full bg-[#25D366] text-white py-4 rounded-xl font-bold hover:bg-[#1fba59] transition-all shadow-lg flex items-center justify-center gap-2 hover:-translate-y-0.5">
                  <MessageCircle className="w-5 h-5" />{t('calculator.results.preApprovedBtn')}
                </a>
                <Link to={`/cars?maxPrice=${carPrice}`}
                  className="w-full bg-white/10 text-white border border-white/20 py-4 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" />{t('calculator.results.findCarsBtn')}
                </Link>
              </div>
            </RightPanel>
          </div>
        )}

        {/* ══ ROAD TAX ══ */}
        {tab === 'roadtax' && (
          <div className="flex flex-col md:flex-row">
            <div className={`${compact ? 'p-5' : 'p-8'} md:w-1/2 bg-white`}>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Road Tax Estimate</h2>
              <p className="text-xs text-gray-400 mb-6">JPJ rates for private vehicles — Peninsular Malaysia.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Engine Displacement (CC)</label>
                  <div className="relative">
                    <input type="number" value={rtCc} onChange={e => setRtCc(e.target.value)} placeholder="e.g. 1500" min="50" max="10000"
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 text-sm" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">cc</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {CC_QUICK.map(cc => (
                      <button key={cc} onClick={() => setRtCc(String(cc))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${String(rtCc) === String(cc) ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-[#1E3A8A] hover:text-[#1E3A8A]'}`}>
                        {cc >= 1000 ? (cc / 1000).toFixed(1).replace('.0', '') + 'k' : cc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Body Type</label>
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPES.map(bt => (
                      <button key={bt} onClick={() => setRtBody(bt)}
                        className={`px-3 py-2 rounded-full text-xs font-medium transition-all border ${rtBody === bt ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-[#1E3A8A]'}`}>
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">JPJ Rate Reference</p>
                  <div className="space-y-1.5">
                    {[['≤ 1,000cc','RM 20'],['1,001–1,200cc','RM 55'],['1,201–1,400cc','RM 70'],['1,401–1,600cc','RM 90'],['1,601–1,800cc','RM 200 + 0.50/cc'],['1,801–2,000cc','RM 280 + 0.50/cc'],['2,001–2,500cc','RM 380 + 1.00/cc'],['2,501–3,000cc','RM 880 + 4.50/cc'],['> 3,000cc','RM 3,130 + 4.50/cc']].map(([r, v]) => (
                      <div key={r} className="flex justify-between text-xs">
                        <span className="text-gray-400">{r}</span>
                        <span className="text-gray-700 font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <RightPanel compact={compact}>
              <BigNumber value={roadTax != null ? fmt(roadTax) : null} unit="/yr" label="Annual Road Tax" />
              {rtCc && roadTax != null && (
                <div className="space-y-1 mb-6">
                  <ResultRow label="Engine"         value={`${Number(rtCc).toLocaleString()}cc`} />
                  <ResultRow label="Body type"      value={rtBody} />
                  <ResultRow label="Road tax / year" value={`RM ${fmt(roadTax)}`} highlight />
                  <ResultRow label="Per month"       value={`≈ RM ${fmt(roadTax / 12, 2)}`} />
                </div>
              )}
              {(!rtCc || roadTax == null) && <div className="bg-white/10 rounded-xl p-4 text-blue-200 text-sm mb-6">Enter a valid engine CC on the left to calculate.</div>}
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-blue-100 leading-relaxed">Renew road tax online via JPJ portal, MyEG, or at the post office — usually bundled with your insurance renewal.</p>
              </div>
            </RightPanel>
          </div>
        )}

        {/* ══ INSURANCE ══ */}
        {tab === 'insurance' && (
          <div className="flex flex-col md:flex-row">
            <div className={`${compact ? 'p-5' : 'p-8'} md:w-1/2 bg-white`}>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Insurance Estimate</h2>
              <p className="text-xs text-gray-400 mb-6">Estimated comprehensive premium. Actual rates vary by insurer.</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sum Insured (Market Value)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">RM</span>
                    <input type="number" value={insSum || ''} onChange={e => setInsSum(parseFloat(e.target.value) || 0)} placeholder="e.g. 45000"
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all text-gray-900 text-sm" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">No Claim Discount (NCD)</label>
                    <span className="text-xs font-bold text-[#1E3A8A] bg-[#1E3A8A]/10 px-2 py-0.5 rounded-full">{insNcd}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {NCD_TIERS.map(n => (
                      <button key={n} onClick={() => setInsNcd(n)}
                        className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${insNcd === n ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-[#1E3A8A]'}`}>
                        {n}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">NCD Entitlement Guide</p>
                  {[['0%','First year / after a claim'],['25%','1 claim-free year'],['30%','2 claim-free years'],['38.33%','3 claim-free years'],['45%','4 claim-free years'],['55%','5+ claim-free years']].map(([pct, desc]) => (
                    <div key={pct} className="flex items-center gap-2 py-1 text-xs border-b border-gray-100 last:border-0">
                      <span className="font-bold text-[#1E3A8A] w-12 shrink-0">{pct}</span>
                      <span className="text-gray-500">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <RightPanel compact={compact}>
              <BigNumber value={insCalc ? fmt(insCalc.net) : null} unit="/yr" label="Est. Annual Premium (after NCD)" />
              {insCalc && (
                <div className="space-y-1 mb-6">
                  <ResultRow label="Gross premium (est. 3%)"  value={`RM ${fmt(insCalc.gross)}`} />
                  <ResultRow label={`NCD discount (${insNcd}%)`} value={`− RM ${fmt(insCalc.discount)}`} accent />
                  <ResultRow label="Net premium / year"        value={`RM ${fmt(insCalc.net)}`} highlight />
                  <ResultRow label="Per month"                 value={`≈ RM ${fmt(insCalc.net / 12, 2)}`} />
                </div>
              )}
              {!insCalc && <div className="bg-white/10 rounded-xl p-4 text-blue-200 text-sm mb-6">Enter the sum insured to estimate premium.</div>}
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-blue-100 leading-relaxed">
                  Estimate based on ~3% of sum insured (industry average). Compare actual quotes on <strong className="text-white">PolicyStreet</strong> or <strong className="text-white">CompareHero</strong> for the best rate.
                </p>
              </div>
            </RightPanel>
          </div>
        )}

      </div>

      {/* Amortization — loan tab only */}
      {tab === 'loan' && !error && loanResults?.loanAmt > 0 && (
        <AmortizationSchedule loanAmount={loanResults.loanAmt} interestRate={intRate} years={loanTerm} />
      )}
    </div>
  );
};

export default FinancingCalculator;
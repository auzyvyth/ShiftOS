import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw, MessageCircle, Search, Download, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AmortizationSchedule from './AmortizationSchedule';
import { supabase } from '../supabaseClient';

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

const BODY_TYPES = ['Sedan', 'Hatchback', 'Coupe', 'SUV', 'MPV', 'Pickup'];
const CC_QUICK   = [1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000];

// ─── Shared styled primitives ─────────────────────────────────────────────────

const Label = ({ children }) => (
  <p style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px 0', fontFamily: "'DM Sans',sans-serif" }}>
    {children}
  </p>
);

const InputBase = ({ prefix, suffix, ...props }) => (
  <div style={{ position: 'relative' }}>
    {prefix && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>{prefix}</span>}
    <input
      {...props}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, outline: 'none',
        padding: prefix ? '10px 12px 10px 32px' : suffix ? '10px 32px 10px 12px' : '10px 12px',
        fontFamily: "'DM Sans',sans-serif", transition: 'border-color 0.15s',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(220,38,38,0.5)'; }}
      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
    />
    {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 12, pointerEvents: 'none' }}>{suffix}</span>}
  </div>
);

const SelectBase = ({ children, ...props }) => (
  <div style={{ position: 'relative' }}>
    <select
      {...props}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, outline: 'none',
        padding: '10px 32px 10px 12px', appearance: 'none', cursor: 'pointer',
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      {children}
    </select>
    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
  </div>
);

const ResultRow = ({ label, value, highlight, muted, borderTop }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: highlight ? '10px 12px' : '8px 0',
    background: highlight ? 'rgba(220,38,38,0.08)' : 'transparent',
    borderRadius: highlight ? 8 : 0,
    borderTop: borderTop ? '1px solid rgba(255,255,255,0.07)' : 'none',
    marginTop: borderTop ? 8 : 0,
  }}>
    <span style={{ color: muted ? '#6b7280' : '#9ca3af', fontSize: 13 }}>{label}</span>
    <span style={{ color: highlight ? '#f87171' : muted ? '#6b7280' : 'white', fontWeight: highlight ? 700 : 600, fontSize: highlight ? 15 : 14 }}>
      {value}
    </span>
  </div>
);

// ─── PDF generation ───────────────────────────────────────────────────────────

const generateQuotationPDF = async ({ dealer, salesman, carDetails, calc, fmt }) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });

  const PW = 210, MARGIN = 18, CW = PW - MARGIN * 2;
  let y = 0;

  const setFont = (size, weight = 'normal', color = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', weight);
    doc.setTextColor(...color);
  };

  // ── Red header bar ─────────────────────────────────────────────────────────
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, PW, 22, 'F');

  // Header text
  setFont(14, 'bold', [255, 255, 255]);
  doc.text('VEHICLE FINANCING QUOTATION', MARGIN, 14);
  setFont(9, 'normal', [255, 200, 200]);
  const dateStr = new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Date: ${dateStr}`, PW - MARGIN, 14, { align: 'right' });
  y = 32;

  // ── Dealership info ────────────────────────────────────────────────────────
  if (dealer) {
    setFont(13, 'bold', [30, 30, 30]);
    doc.text(dealer.dealership || dealer.site_name || 'Dealership', MARGIN, y);
    y += 6;
    if (dealer.whatsapp_number) {
      setFont(10, 'normal', [100, 100, 100]);
      doc.text(`WhatsApp / Phone: ${dealer.whatsapp_number}`, MARGIN, y);
      y += 5;
    }
    y += 4;
  }

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 8;

  // ── Two-column: Salesman | Car Details ────────────────────────────────────
  const colW = CW / 2 - 4;

  // Left: Salesman
  setFont(8, 'bold', [150, 150, 150]);
  doc.text('PREPARED BY', MARGIN, y);
  setFont(11, 'bold', [30, 30, 30]);
  doc.text(salesman?.full_name || salesman?.name || 'Sales Consultant', MARGIN, y + 6);
  if (salesman?.phone) {
    setFont(9, 'normal', [80, 80, 80]);
    doc.text(`Contact: ${salesman.phone}`, MARGIN, y + 12);
  }

  // Right: Car Details
  const rx = MARGIN + colW + 8;
  setFont(8, 'bold', [150, 150, 150]);
  doc.text('VEHICLE DETAILS', rx, y);
  setFont(11, 'bold', [30, 30, 30]);
  doc.text(carDetails.name || 'Vehicle', rx, y + 6);
  setFont(9, 'normal', [80, 80, 80]);
  if (carDetails.year) doc.text(`Year: ${carDetails.year}`, rx, y + 12);
  if (carDetails.color) doc.text(`Colour: ${carDetails.color}`, rx, y + 17);
  setFont(10, 'bold', [220, 38, 38]);
  doc.text(`Listed Price: RM ${fmt(carDetails.price)}`, rx, y + (carDetails.color ? 23 : 18));

  y += 32;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 10;

  // ── Financing Breakdown ───────────────────────────────────────────────────
  setFont(10, 'bold', [30, 30, 30]);
  doc.text('FINANCING BREAKDOWN', MARGIN, y);
  y += 8;

  const rows = [
    ['Car Price',            `RM ${fmt(calc.carPrice)}`],
    ['Down Payment',         `RM ${fmt(calc.downPayment)} (${calc.dpPct}%)`],
    ['Loan Amount',          `RM ${fmt(calc.loanAmt)}`],
    ['Loan Tenure',          `${calc.loanTerm} years`],
    ['Interest Rate (flat)', `${calc.intRate}% p.a.`],
    ['Total Interest',       `RM ${fmt(calc.interest)}`],
    ['Total Loan Repayment', `RM ${fmt(calc.totalLoan)}`],
    ['Monthly Installment',  `RM ${fmt(calc.monthly, 2)}/month`],
  ];

  rows.forEach(([label, value], i) => {
    const rowY = y + i * 8;
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(MARGIN, rowY - 4, CW, 8, 'F');
    }
    setFont(9, 'normal', [80, 80, 80]);
    doc.text(label, MARGIN + 3, rowY);
    setFont(9, 'bold', [30, 30, 30]);
    doc.text(value, PW - MARGIN - 3, rowY, { align: 'right' });
  });

  y += rows.length * 8 + 6;

  // Road tax + insurance section
  if (calc.roadTax != null || calc.insurance != null) {
    setFont(10, 'bold', [30, 30, 30]);
    doc.text('ON-ROAD COSTS (ESTIMATE)', MARGIN, y);
    y += 8;

    const onRoadRows = [];
    if (calc.roadTax != null) onRoadRows.push(['Road Tax (annual)', `RM ${fmt(calc.roadTax)}`]);
    if (calc.insurance != null) onRoadRows.push([`Insurance Est. (NCD ${calc.insNcd}%)`, `RM ${fmt(calc.insurance)}`]);

    onRoadRows.forEach(([label, value], i) => {
      const rowY = y + i * 8;
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN, rowY - 4, CW, 8, 'F');
      }
      setFont(9, 'normal', [80, 80, 80]);
      doc.text(label, MARGIN + 3, rowY);
      setFont(9, 'bold', [30, 30, 30]);
      doc.text(value, PW - MARGIN - 3, rowY, { align: 'right' });
    });

    y += onRoadRows.length * 8 + 6;
  }

  // Grand total
  doc.setFillColor(220, 38, 38);
  doc.rect(MARGIN, y, CW, 12, 'F');
  setFont(10, 'bold', [255, 255, 255]);
  doc.text('ESTIMATED ON-ROAD PRICE', MARGIN + 3, y + 8);
  doc.text(`RM ${fmt(calc.onRoadPrice)}`, PW - MARGIN - 3, y + 8, { align: 'right' });
  y += 20;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 6;

  setFont(8, 'italic', [150, 150, 150]);
  doc.text('This quotation is valid for 7 days and is subject to change without prior notice.', MARGIN, y);
  y += 5;
  doc.text('All figures shown are estimates only. Final pricing subject to confirmation from the dealership.', MARGIN, y);

  doc.save(`quotation-${Date.now()}.pdf`);
};

// ─── Main component ───────────────────────────────────────────────────────────

const FinancingCalculator = ({ initialPrice = 85000, engineCc = null, bodyType = null }) => {
  const { t } = useTranslation();

  // Financing inputs
  const [carPrice,  setCarPrice]  = useState(initialPrice);
  const [dpPct,     setDpPct]     = useState(10);
  const [loanTerm,  setLoanTerm]  = useState(7);
  const [intRate,   setIntRate]   = useState(3.5);

  // Road tax inputs
  const [rtCc,   setRtCc]   = useState(engineCc ? String(engineCc) : '');
  const [rtBody, setRtBody] = useState(bodyType || 'Sedan');

  // Insurance inputs
  const [insSum, setInsSum] = useState(initialPrice);
  const [insNcd, setInsNcd] = useState(55);

  // Car details for PDF
  const [carName,  setCarName]  = useState('');
  const [carYear,  setCarYear]  = useState('');
  const [carColor, setCarColor] = useState('');

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => { setCarPrice(initialPrice); setInsSum(initialPrice); }, [initialPrice]);
  useEffect(() => { if (engineCc) setRtCc(String(engineCc)); }, [engineCc]);
  useEffect(() => { if (bodyType) setRtBody(bodyType); }, [bodyType]);

  // Calculations
  const downPayment = (carPrice * dpPct) / 100;
  const loanAmt     = Math.max(0, carPrice - downPayment);
  const interest    = loanAmt * (intRate / 100) * loanTerm;
  const totalLoan   = loanAmt + interest;
  const monthly     = loanTerm > 0 ? totalLoan / (loanTerm * 12) : 0;

  const roadTax  = calcRoadTax(Number(rtCc), rtBody);
  const insCalc  = calcInsurance(insSum || carPrice, insNcd);

  const onRoadPrice = carPrice + (roadTax || 0) + (insCalc?.net || 0);

  const isValid = carPrice > 0 && downPayment < carPrice && loanTerm > 0 && intRate > 0;

  const fmt = (n, d = 0) => n != null && !Number.isNaN(n)
    ? n.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

  const reset = () => { setCarPrice(initialPrice); setDpPct(10); setLoanTerm(7); setIntRate(3.5); setRtCc(engineCc ? String(engineCc) : ''); setRtBody(bodyType || 'Sedan'); setInsSum(initialPrice); setInsNcd(55); };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const [{ data: dealer }, { data: { user } }] = await Promise.all([
        supabase.from('profiles').select('site_name,dealership,whatsapp_number,avatar_url').eq('role', 'dealer').limit(1).single(),
        supabase.auth.getUser(),
      ]);

      let salesmanProfile = null;
      if (user) {
        const { data: sp } = await supabase.from('profiles').select('full_name,phone,role').eq('id', user.id).single();
        salesmanProfile = sp;
      }

      await generateQuotationPDF({
        dealer,
        salesman: salesmanProfile,
        carDetails: {
          name:  carName  || `${carYear ? carYear + ' ' : ''}Vehicle`,
          year:  carYear,
          color: carColor,
          price: carPrice,
        },
        calc: {
          carPrice, downPayment, dpPct, loanAmt, loanTerm, intRate,
          interest, totalLoan, monthly,
          roadTax, insurance: insCalc?.net ?? null, insNcd,
          onRoadPrice,
        },
        fmt,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const preApprovedLink = 'https://wa.me/60174155191?text=' + encodeURIComponent("Hi! I'm interested in getting pre-approved for car financing. Can you help?");

  const card = {
    background: 'linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '20px 22px',
  };

  const sectionTitle = (label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: '#dc2626', borderRadius: 2, flexShrink: 0 }} />
      <p style={{ color: 'white', fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "'DM Sans',sans-serif" }}>{label}</p>
    </div>
  );

  return (
    <>
      <style>{`
        .calc-input::placeholder { color: #374151; }
        .calc-input::-webkit-inner-spin-button,
        .calc-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .calc-pill { cursor:pointer; border-radius:8px; padding:7px 12px; font-size:12px; font-weight:600; transition:all 0.15s; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#9ca3af; font-family:'DM Sans',sans-serif; }
        .calc-pill:hover { border-color:rgba(220,38,38,0.35); color:white; }
        .calc-pill.active { background:rgba(220,38,38,0.12); border-color:rgba(220,38,38,0.45); color:#f87171; }
        .calc-body-pill { cursor:pointer; border-radius:20px; padding:5px 12px; font-size:11px; font-weight:600; transition:all 0.15s; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); color:#9ca3af; font-family:'DM Sans',sans-serif; }
        .calc-body-pill:hover { border-color:rgba(220,38,38,0.35); }
        .calc-body-pill.active { background:rgba(220,38,38,0.12); border-color:rgba(220,38,38,0.45); color:#f87171; }
        select.calc-select option { background:#0d1117; color:white; }
        @media(max-width:768px) {
          .calc-layout { flex-direction: column !important; }
          .calc-results { position: static !important; }
        }
      `}</style>

      <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 1024, margin: '0 auto' }}>

        {/* ── Two-column layout ── */}
        <div className="calc-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ══ LEFT: Inputs ══════════════════════════════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Financing section */}
            <div style={card}>
              {sectionTitle('Financing')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Car Price */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Car Price</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={carPrice || ''}
                    onChange={e => setCarPrice(parseFloat(e.target.value) || 0)}
                    placeholder="85000"
                  />
                </div>

                {/* Down Payment */}
                <div>
                  <Label>Down Payment</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={Math.round(downPayment) || ''}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; if (carPrice > 0) setDpPct((v / carPrice) * 100); }}
                    placeholder="8500"
                  />
                </div>

                <div>
                  <Label>Down %</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    suffix="%"
                    value={dpPct || ''}
                    onChange={e => setDpPct(parseFloat(e.target.value) || 0)}
                    placeholder="10"
                  />
                </div>

                {/* Slider full width */}
                <div style={{ gridColumn: '1 / -1', margin: '-4px 0 4px' }}>
                  <input type="range" min="0" max="50" step="5" value={dpPct} onChange={e => setDpPct(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#dc2626', height: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    {['0%','10%','20%','30%','40%','50%'].map(l => <span key={l} style={{ color:'#374151', fontSize:10 }}>{l}</span>)}
                  </div>
                </div>

                {/* Tenure */}
                <div>
                  <Label>Tenure</Label>
                  <SelectBase
                    className="calc-select"
                    value={loanTerm}
                    onChange={e => setLoanTerm(parseInt(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(y => (
                      <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>
                    ))}
                  </SelectBase>
                </div>

                {/* Interest Rate */}
                <div>
                  <Label>Interest Rate</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    step="0.1"
                    suffix="% p.a."
                    value={intRate || ''}
                    onChange={e => setIntRate(parseFloat(e.target.value))}
                    placeholder="3.5"
                  />
                </div>

                {/* Quick term */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Quick Select Tenure</Label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[3, 5, 7, 9].map(y => (
                      <button key={y} className={`calc-pill${loanTerm === y ? ' active' : ''}`} onClick={() => setLoanTerm(y)} style={{ flex: 1 }}>
                        {y}yr
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Road Tax & Insurance section */}
            <div style={card}>
              {sectionTitle('Road Tax & Insurance')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                {/* Engine CC */}
                <div>
                  <Label>Engine CC</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    suffix="cc"
                    value={rtCc}
                    onChange={e => setRtCc(e.target.value)}
                    placeholder="1500"
                  />
                </div>

                {/* Body Type */}
                <div>
                  <Label>Body Type</Label>
                  <SelectBase className="calc-select" value={rtBody} onChange={e => setRtBody(e.target.value)}>
                    {BODY_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </SelectBase>
                </div>

                {/* CC quick picks */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Quick CC</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {CC_QUICK.map(cc => (
                      <button key={cc} className={`calc-pill${String(rtCc) === String(cc) ? ' active' : ''}`} onClick={() => setRtCc(String(cc))}>
                        {cc >= 1000 ? (cc / 1000).toFixed(1).replace('.0', '') + 'k' : cc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sum insured */}
                <div>
                  <Label>Sum Insured</Label>
                  <InputBase
                    className="calc-input"
                    type="number"
                    prefix="RM"
                    value={insSum || ''}
                    onChange={e => setInsSum(parseFloat(e.target.value) || 0)}
                    placeholder={String(carPrice)}
                  />
                </div>

                {/* NCD */}
                <div>
                  <Label>NCD Tier</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {NCD_TIERS.map(n => (
                      <button key={n} className={`calc-pill${insNcd === n ? ' active' : ''}`} onClick={() => setInsNcd(n)}>
                        {n}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Car Details for PDF (optional) */}
            <div style={card}>
              {sectionTitle('Car Details (for Quotation PDF)')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Label>Car Name / Model</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carName}
                    onChange={e => setCarName(e.target.value)}
                    placeholder="e.g. Honda Civic 1.5 TC-P"
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carYear}
                    onChange={e => setCarYear(e.target.value)}
                    placeholder="2023"
                  />
                </div>
                <div>
                  <Label>Colour (optional)</Label>
                  <InputBase
                    className="calc-input"
                    type="text"
                    value={carColor}
                    onChange={e => setCarColor(e.target.value)}
                    placeholder="Platinum White"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ══ RIGHT: Results ════════════════════════════════════════════════ */}
          <div className="calc-results" style={{ width: 300, flexShrink: 0, position: 'sticky', top: 88 }}>
            <div style={{ ...card, border: '1px solid rgba(220,38,38,0.18)' }}>

              {/* Monthly installment hero */}
              <div style={{ textAlign: 'center', padding: '16px 0 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
                <p style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Monthly Installment</p>
                <motion.div
                  key={isValid ? fmt(monthly, 2) : 'invalid'}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <p style={{ color: isValid ? 'white' : '#374151', fontSize: 38, fontWeight: 800, margin: 0, lineHeight: 1 }}>
                    {isValid ? <>
                      <span style={{ fontSize: 16, color: '#9ca3af', fontWeight: 600, marginRight: 3 }}>RM</span>
                      {fmt(monthly, 0)}
                      <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 500, marginLeft: 3 }}>/mo</span>
                    </> : '—'}
                  </p>
                </motion.div>
              </div>

              {/* Breakdown rows */}
              <div style={{ marginBottom: 14 }}>
                <ResultRow label="Loan Amount"       value={isValid ? `RM ${fmt(loanAmt)}` : '—'} />
                <ResultRow label="Down Payment"      value={isValid ? `RM ${fmt(downPayment)}` : '—'} />
                <ResultRow label="Total Interest"    value={isValid ? `RM ${fmt(interest)}` : '—'} />
                <ResultRow label="Total Repayment"   value={isValid ? `RM ${fmt(totalLoan)}` : '—'} highlight />
              </div>

              {/* Road tax + insurance */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 14 }}>
                <p style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>On-Road Costs</p>
                <ResultRow label="Road Tax (annual)" value={roadTax != null ? `RM ${fmt(roadTax)}` : 'Enter CC'} muted={roadTax == null} />
                <ResultRow label={`Insurance (NCD ${insNcd}%)`} value={insCalc ? `RM ${fmt(insCalc.net)}` : '—'} muted={!insCalc} />
              </div>

              {/* Grand total */}
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>On-Road Price</span>
                  <span style={{ color: '#f87171', fontSize: 18, fontWeight: 800 }}>RM {fmt(onRoadPrice)}</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: 10, margin: '4px 0 0' }}>Incl. road tax + insurance est.</p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: pdfLoading ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                    border: 'none', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700,
                    padding: '11px', cursor: pdfLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 12px rgba(220,38,38,0.3)', transition: 'all 0.2s',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <Download size={14} />
                  {pdfLoading ? 'Generating…' : 'Download Quotation PDF'}
                </button>

                <a href={preApprovedLink} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                    borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 700,
                    padding: '11px', textDecoration: 'none', transition: 'all 0.2s',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <MessageCircle size={14} /> Get Pre-Approved
                </a>

                <Link to={`/cars?max_price=${Math.round(carPrice)}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: '#9ca3af', fontSize: 13, fontWeight: 600,
                    padding: '11px', textDecoration: 'none', transition: 'all 0.2s',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <Search size={14} /> Browse Cars in Budget
                </Link>

                <button onClick={reset}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: 'none', border: 'none', color: '#4b5563', fontSize: 12, cursor: 'pointer',
                    padding: '6px', fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <RefreshCw size={12} /> Reset All
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Amortization schedule */}
        {isValid && loanAmt > 0 && (
          <div style={{ marginTop: 20 }}>
            <AmortizationSchedule loanAmount={loanAmt} interestRate={intRate} years={loanTerm} />
          </div>
        )}
      </div>
    </>
  );
};

export default FinancingCalculator;

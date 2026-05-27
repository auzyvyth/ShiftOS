import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import {
  X,
  Car,
  FileText,
  Printer,
  ChevronDown,
} from "lucide-react";

const T = {
  card: {
    position: 'relative',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008))',
    border: '1px solid rgba(255,255,255,0.055)',
    backdropFilter: 'blur(12px)',
  },
  modal: {
    position: 'relative',
    background: 'rgba(5,7,14,0.99)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all";
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none";

const EMPTY_GEN_FORM = {
  doc_type: 'Sales Agreement', listing_id: '', buyer_name: '', buyer_ic: '',
  buyer_phone: '+60', buyer_address: '', sale_price: '', deposit_amount: '',
  // SA fields
  sa_name: '', sa_phone: '', sa_ic: '',
  // Financing fields
  include_financing: false,
  loan_amount: '', interest_rate: '', loan_tenure_months: '', monthly_payment: '', financing_bank: '',
};

function DocumentsTab({ userId, listings, prefillDocData, onClearPrefill, profile }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ ...EMPTY_GEN_FORM });
  const [genSaving, setGenSaving] = useState(false);
  const [printDoc, setPrintDoc] = useState(null);
  const [listingDropOpen, setListingDropOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const DOC_TYPES = ['Sales Agreement', 'Deposit Receipt', 'Handover Checklist'];

  // Pre-fill from Enquiries shortcut
  useEffect(() => {
    if (!prefillDocData) return;
    const prefillListing = prefillDocData.listing_id ? listings.find(l => l.id === prefillDocData.listing_id) || null : null;
    setSelectedListing(prefillListing);
    setGenForm(p => ({
      ...p,
      doc_type: prefillDocData.doc_type || 'Sales Agreement',
      buyer_name: prefillDocData.buyer_name || '',
      buyer_phone: prefillDocData.buyer_phone || '+60',
      listing_id: prefillDocData.listing_id || '',
      sale_price: prefillListing?.selling_price ? String(prefillListing.selling_price) : p.sale_price,
      sa_name: profile?.full_name || '',
      sa_phone: profile?.whatsapp_number || '',
    }));
    setShowGen(true);
    onClearPrefill?.();
  }, [prefillDocData]);

  // Pre-fill SA name when opening modal
  useEffect(() => {
    if (showGen && profile) {
      setGenForm(p => ({
        ...p,
        sa_name: p.sa_name || profile.full_name || '',
        sa_phone: p.sa_phone || profile.whatsapp_number || '',
      }));
    }
  }, [showGen]);

  // Generic document form calculator — not the same as the standard car estimate in utils/financing.js.
  // This one accepts user-specified rate and tenure from form inputs.
  const calcLoanPayment = (amount, rate, months) => {
    const a = parseFloat(amount), r = parseFloat(rate), m = parseInt(months);
    if (!a || !r || !m) return '';
    return ((a + a * (r / 100) * (m / 12)) / m).toFixed(2);
  };

  const gf = (field, value) => {
    setGenForm(p => {
      const next = { ...p, [field]: value };
      if (['loan_amount', 'interest_rate', 'loan_tenure_months'].includes(field)) {
        next.monthly_payment = calcLoanPayment(
          field === 'loan_amount' ? value : next.loan_amount,
          field === 'interest_rate' ? value : next.interest_rate,
          field === 'loan_tenure_months' ? value : next.loan_tenure_months,
        );
      }
      return next;
    });
  };

  const handleListingSelect = (listing) => {
    setSelectedListing(listing);
    setGenForm(p => ({
      ...p,
      listing_id: listing.id,
      sale_price: listing.selling_price ? String(listing.selling_price) : p.sale_price,
    }));
    setListingDropOpen(false);
  };

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dealer_documents')
      .select('*, car_listings(brand, model, year, plate_number)')
      .eq('dealer_id', userId)
      .order('issued_at', { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDocs(); }, [userId]);

  const handleGenerate = async () => {
    setGenSaving(true);
    const car = selectedListing || listings.find(l => l.id === genForm.listing_id) || null;
    try {
      const { data, error } = await supabase.from('dealer_documents').insert({
        dealer_id: userId,
        listing_id: genForm.listing_id || null,
        buyer_name: genForm.buyer_name,
        buyer_ic: genForm.buyer_ic,
        buyer_phone: genForm.buyer_phone,
        buyer_address: genForm.buyer_address,
        doc_type: genForm.doc_type,
        sale_price: Number(genForm.sale_price) || 0,
        deposit_amount: Number(genForm.deposit_amount) || 0,
        balance_amount: Math.max(0, (Number(genForm.sale_price) || 0) - (Number(genForm.deposit_amount) || 0)),
        issued_at: new Date().toISOString(),
        metadata: {
          car_label: car ? `${car.year} ${car.brand} ${car.model}` : '',
          car_colour: car?.colour || '',
          car_plate: car?.plate_number || '',
          car_mileage: car?.mileage || '',
          car_vin: car?.vin_number || '',
          included_services: car?.included_services || [],
          sa_name: genForm.sa_name,
          sa_phone: genForm.sa_phone,
          sa_ic: genForm.sa_ic,
          include_financing: genForm.include_financing,
          loan_amount: genForm.loan_amount,
          interest_rate: genForm.interest_rate,
          loan_tenure_months: genForm.loan_tenure_months,
          monthly_payment: genForm.monthly_payment,
          financing_bank: genForm.financing_bank,
        },
      }).select().single();
      if (error) throw error;
      setShowGen(false);
      setSelectedListing(null);
      setGenForm({ ...EMPTY_GEN_FORM });
      if (data) setPrintDoc({ ...data, car_listings: car });
      fetchDocs();
    } catch (err) {
      console.error('[DocumentsTab] handleGenerate error:', err.message, err);
      toast.error(`Failed to save document: ${err.message}`);
    } finally {
      setGenSaving(false);
    }
  };

  const renderDocHTML = (doc) => {
    const car = doc.car_listings || {};
    const m = doc.metadata || {};
    const carLabel = m.car_label || (car.brand ? `${car.year || ''} ${car.brand} ${car.model}` : '—');
    const carPlate  = m.car_plate  || car.plate_number || '—';
    const carColour = m.car_colour || car.colour       || '—';
    const carMileage = m.car_mileage || car.mileage     || null;
    const carVin    = m.car_vin    || car.vin_number   || '—';
    const issued = doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const isHandover = doc.doc_type === 'Handover Checklist';
    const isDeposit  = doc.doc_type === 'Deposit Receipt';
    const isSales    = doc.doc_type === 'Sales Agreement';
    const services   = m.included_services || [];
    const saName     = m.sa_name  || '—';
    const saPhone    = m.sa_phone || '—';
    const saIc       = m.sa_ic    || '—';
    const hasFinancing = isSales && m.include_financing && m.loan_amount;

    const row = (label, value) =>
      `<tr><td style="padding:5px 0;font-size:13px;color:#555;width:180px;">${label}</td><td style="padding:5px 0;font-size:13px;">${value || '—'}</td></tr>`;

    const section = (title, content) =>
      `<div style="margin-bottom:22px;"><h3 style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;border-bottom:1px solid #e5e5e5;padding-bottom:6px;margin:0 0 10px;">${title}</h3>${content}</div>`;

    return `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#111;background:#fff;">
        <div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #111;">
          <h1 style="font-size:21px;font-weight:800;margin:0 0 4px;">${doc.doc_type.toUpperCase()}</h1>
          <p style="font-size:12px;color:#555;margin:0;">Date: ${issued}</p>
        </div>

        ${section('Vehicle Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Vehicle', `<strong>${carLabel}</strong>`)}
            ${row('Plate Number', carPlate)}
            ${row('Colour', carColour)}
            ${carMileage ? row('Mileage', `${Number(carMileage).toLocaleString()} km`) : ''}
            ${carVin !== '—' ? row('VIN / Chassis', carVin) : ''}
          </table>`)}

        ${section('Buyer Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Full Name', doc.buyer_name)}
            ${row('IC Number', doc.buyer_ic)}
            ${row('Phone', doc.buyer_phone)}
            ${row('Address', doc.buyer_address)}
          </table>`)}

        ${isHandover ? section('Handover Checklist',
          ['Spare keys','Service booklet','Road tax','Insurance document','Owner manual','Spare tyre','Jack & tools','Accessories agreed']
            .map(item => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f0f0f0;"><div style="width:16px;height:16px;border:2px solid #333;border-radius:3px;flex-shrink:0;"></div><span style="font-size:13px;">${item}</span></div>`).join('')
        ) : section('Financial Summary', `
          <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e5e5e5;"><th style="text-align:left;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Description</th><th style="text-align:right;padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Amount</th></tr>
            ${isDeposit
              ? `<tr><td style="padding:8px 0;font-size:13px;">Deposit for ${carLabel}</td><td style="text-align:right;font-size:13px;font-weight:600;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>`
              : `<tr><td style="padding:8px 0;font-size:13px;">Sale Price</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.sale_price||0).toLocaleString()}</td></tr>
                 <tr><td style="padding:8px 0;font-size:13px;">Deposit Paid</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>
                 <tr style="border-top:2px solid #111;"><td style="padding:8px 0;font-size:14px;font-weight:700;">Balance Due</td><td style="text-align:right;font-size:14px;font-weight:700;">RM ${Number(doc.balance_amount||0).toLocaleString()}</td></tr>`
            }
          </table>`)}

        ${hasFinancing ? section('Financing Details', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Financing Bank', m.financing_bank)}
            ${row('Loan Amount', `RM ${Number(m.loan_amount).toLocaleString()}`)}
            ${row('Interest Rate', `${m.interest_rate}% p.a.`)}
            ${row('Tenure', `${m.loan_tenure_months} months`)}
            ${m.monthly_payment ? row('Monthly Payment', `RM ${Number(m.monthly_payment).toLocaleString()}`) : ''}
          </table>`) : ''}

        ${isSales && services.length > 0 ? section('Included Services / Packages', `
          <table style="width:100%;border-collapse:collapse;">
            ${services.map(s => `<tr><td style="padding:5px 0;font-size:13px;">${s.name || '—'}</td><td style="text-align:right;font-size:13px;color:#555;">RM ${Number(s.selling_price||0).toLocaleString()}</td></tr>`).join('')}
          </table>`) : ''}

        ${isSales ? section('Sales Advisor', `
          <table style="width:100%;border-collapse:collapse;">
            ${row('Name', saName)}
            ${row('Phone', saPhone)}
            ${saIc !== '—' ? row('IC Number', saIc) : ''}
          </table>`) : ''}

        <div style="margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
          <div style="border-top:1px solid #111;padding-top:8px;">
            <p style="font-size:12px;color:#555;margin:0 0 2px;">Buyer Signature</p>
            <p style="font-size:11px;color:#aaa;margin:0;">${doc.buyer_name || ''}</p>
            <p style="font-size:11px;color:#aaa;margin:24px 0 0;">Date: _______________</p>
          </div>
          <div style="border-top:1px solid #111;padding-top:8px;">
            <p style="font-size:12px;color:#555;margin:0 0 2px;">Sales Advisor Signature</p>
            <p style="font-size:11px;color:#aaa;margin:0;">${saName}</p>
            <p style="font-size:11px;color:#aaa;margin:24px 0 0;">Date: _______________</p>
          </div>
        </div>
      </div>`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={T.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Documents</h2>
          <button onClick={() => setShowGen(true)} className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg" style={T.btnRed}><FileText className="w-3.5 h-3.5" />Generate</button>
        </div>
        <div className="table-wrap">
          {loading ? (
            <p className="text-gray-500 text-sm p-6">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-600 text-sm p-6">No documents generated yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Type', 'Buyer', 'Car', 'Issued', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px' }}><span style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '2px 8px' }}>{doc.doc_type}</span></td>
                    <td style={{ padding: '12px 14px', color: '#f3f4f6', fontSize: 13, fontWeight: 500 }}>{doc.buyer_name || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: 13 }}>{doc.car_label || (doc.car_listings ? `${doc.car_listings.brand} ${doc.car_listings.model}` : '—')}</td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY') : '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={() => setPrintDoc(doc)} className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}><Printer className="w-3 h-3" />Print</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {showGen && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white">Generate Document</h3>
              <button onClick={() => setShowGen(false)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Document Type</label>
                <select value={genForm.doc_type} onChange={e => setGenForm(p => ({ ...p, doc_type: e.target.value }))} className={iCls} style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {DOC_TYPES.map(t => <option key={t} value={t} style={{ background: '#111118' }}>{t}</option>)}
                </select>
              </div>
              {/* Rich Car Listing Selector */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Car Listing</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setListingDropOpen(p => !p)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {selectedListing ? (
                      <>
                        {selectedListing.images?.[0] ? (
                          <img src={selectedListing.images[0]} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Car style={{ width: 18, height: 18, color: '#6b7280' }} />
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedListing.year} {selectedListing.brand} {selectedListing.model}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 1 }}>
                            {selectedListing.plate_number && <span>{selectedListing.plate_number}</span>}
                            {selectedListing.colour && <span>{selectedListing.colour}</span>}
                            {selectedListing.mileage && <span>{Number(selectedListing.mileage).toLocaleString()} km</span>}
                          </div>
                        </div>
                        {selectedListing.selling_price && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', flexShrink: 0 }}>RM {Number(selectedListing.selling_price).toLocaleString()}</span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Select a listing…</span>
                    )}
                    <ChevronDown style={{ width: 16, height: 16, color: '#6b7280', marginLeft: 'auto', flexShrink: 0 }} />
                  </button>
                  {listingDropOpen && (
                    <>
                      <div onClick={() => setListingDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 50, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                        {listings.length === 0 ? (
                          <div style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>No active listings</div>
                        ) : listings.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleListingSelect(l)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: genForm.listing_id === l.id ? 'rgba(220,38,38,0.1)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif', transition: 'background 0.15s" }}
                            onMouseEnter={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {l.images?.[0] ? (
                              <img src={l.images[0]} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 44, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Car style={{ width: 16, height: 16, color: '#6b7280' }} />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#f3f4f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.year} {l.brand} {l.model}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, marginTop: 1 }}>
                                {l.plate_number && <span>{l.plate_number}</span>}
                                {l.colour && <span>{l.colour}</span>}
                                {l.mileage && <span>{Number(l.mileage).toLocaleString()} km</span>}
                              </div>
                            </div>
                            {l.selling_price && (
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', flexShrink: 0 }}>RM {Number(l.selling_price).toLocaleString()}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Name</label><input value={genForm.buyer_name} onChange={e => setGenForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Ahmad" className={iCls} /></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer IC</label><input value={genForm.buyer_ic} onChange={e => setGenForm(p => ({ ...p, buyer_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><div className={`flex items-center overflow-hidden ${iCls}`} style={{padding:0}}><span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span><input type="tel" value={(genForm.buyer_phone||'').replace(/^\+?60/,'')} onChange={e => setGenForm(p => ({ ...p, buyer_phone: '+60'+e.target.value.replace(/\D/g,'') }))} placeholder="X-XXXXXXX" className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5" /></div></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Sale Price (RM)</label><input type="number" value={genForm.sale_price} onChange={e => setGenForm(p => ({ ...p, sale_price: e.target.value }))} placeholder="0" className={iCls} /></div>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Address</label><textarea value={genForm.buyer_address} onChange={e => setGenForm(p => ({ ...p, buyer_address: e.target.value }))} rows={2} className={taCls} placeholder="Full address" /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Deposit Amount (RM)</label><input type="number" value={genForm.deposit_amount} onChange={e => setGenForm(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="0" className={iCls} /></div>

              {/* Sales Advisor Details */}
              <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Sales Advisor</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Name</label><input value={genForm.sa_name} onChange={e => setGenForm(p => ({ ...p, sa_name: e.target.value }))} placeholder="SA Name" className={iCls} /></div>
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><div className={`flex items-center overflow-hidden ${iCls}`} style={{padding:0}}><span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span><input type="tel" value={(genForm.sa_phone||'').replace(/^\+?60/,'')} onChange={e => setGenForm(p => ({ ...p, sa_phone: '+60'+e.target.value.replace(/\D/g,'') }))} placeholder="X-XXXXXXX" className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5" /></div></div>
                </div>
                <div style={{ marginTop: 10 }}><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">IC Number</label><input value={genForm.sa_ic} onChange={e => setGenForm(p => ({ ...p, sa_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls} /></div>
              </div>

              {/* Financing — Sales Agreement only */}
              {genForm.doc_type === 'Sales Agreement' && (
                <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: genForm.include_financing ? 12 : 0 }}>
                    <input type="checkbox" checked={genForm.include_financing} onChange={e => setGenForm(p => ({ ...p, include_financing: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#dc2626' }} />
                    <span style={{ fontSize: 13, color: '#d1d5db', fontFamily: "'DM Sans', sans-serif" }}>Include Financing Details</span>
                  </label>
                  {genForm.include_financing && (
                    <div className="space-y-3">
                      <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Financing Bank</label><input value={genForm.financing_bank} onChange={e => gf('financing_bank', e.target.value)} placeholder="e.g. Maybank, CIMB" className={iCls} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Loan Amount (RM)</label><input type="number" value={genForm.loan_amount} onChange={e => gf('loan_amount', e.target.value)} placeholder="0" className={iCls} /></div>
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Interest Rate (% p.a.)</label><input type="number" step="0.01" value={genForm.interest_rate} onChange={e => gf('interest_rate', e.target.value)} placeholder="3.5" className={iCls} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Tenure (months)</label><input type="number" value={genForm.loan_tenure_months} onChange={e => gf('loan_tenure_months', e.target.value)} placeholder="84" className={iCls} /></div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Monthly Payment (RM)</label>
                          <div style={{ position: 'relative' }}>
                            <input readOnly value={genForm.monthly_payment ? `RM ${Number(genForm.monthly_payment).toLocaleString()}` : '—'} className={iCls} style={{ color: '#4ade80', background: 'rgba(74,222,128,0.05)', cursor: 'default' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setShowGen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
              <button onClick={handleGenerate} disabled={genSaving} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={T.btnRed}>{genSaving ? 'Generating...' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printDoc && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ ...T.modal, background: '#fff' }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 text-sm">{printDoc.doc_type}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { const w = window.open('','_blank'); w.document.write(`<html><head><title>${printDoc.doc_type}</title><style>@media print{body{margin:0;}}</style></head><body>${renderDocHTML(printDoc)}</body></html>`); w.document.close(); w.print(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={T.btnRed}><Printer className="w-3.5 h-3.5" />Print</button>
                <button onClick={() => setPrintDoc(null)} className="text-gray-500 hover:text-gray-800 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderDocHTML(printDoc) }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsTab;

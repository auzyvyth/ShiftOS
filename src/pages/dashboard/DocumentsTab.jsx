import { useEffect, useState, useMemo } from "react";
import { useModalHistory } from "../../hooks/useModalHistory";
import DOMPurify from "dompurify";
import { cdnImg, imgFallback } from "../../utils/img";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { logActivity } from "../../utils/activityLog";
import { supabase } from "../../supabaseClient";
import PhoneInput from "../../components/ui/PhoneInput";
import { mergePendingTag } from "../../utils/pendingTag";
import { premiumLight as PL } from "../../theme/tokens";
import { StatusPills, INV_CARD, INV_INPUT, INV_GHOST_BTN } from "../../components/inventory/InventoryUi";
import { T, iCls, taCls, SERVER_URL } from "./shared";
import { DEFAULT_EIR, monthlyPayment, RATE_BASIS, rateLabel } from "../../utils/financing";
import { Car, Trash2, X, Search, AlertTriangle, ChevronDown, FileText, Printer } from "lucide-react";

// ─── DocumentsTab ─────────────────────────────────────────────────────────────
const DOC_TYPES = ['Sales Agreement', 'Deposit Receipt', 'Handover Checklist'];
// Short pill labels: the full names did not fit one row beside the search box.
const DOC_TYPE_PILL = { 'Sales Agreement': 'Agreements', 'Deposit Receipt': 'Receipts', 'Handover Checklist': 'Checklists' };
const DOC_TYPE_PREFIX = { 'Sales Agreement': 'SA', 'Deposit Receipt': 'DR', 'Handover Checklist': 'HC' };
const DEFAULT_HANDOVER_ITEMS = [
  'Geran (Vehicle Ownership Certificate) — original',
  'JPJ transfer forms (K3/K8) — signed',
  'Puspakom B5 inspection report',
  'Puspakom B7 inspection report',
  'Insurance certificate / cover note',
  'Road tax disc',
  'Service booklet (with all stamps)',
  'Owner\'s manual / handbook',
  'Primary key (remote functional)',
  'Spare / master key',
  'Spare tyre',
  'Jack and tools',
  'Warning triangle',
  'Factory floor mats',
];

const EMPTY_GEN_FORM = {
  doc_type: 'Sales Agreement', listing_id: '', buyer_name: '', buyer_ic: '',
  buyer_email: '', buyer_phone: '', buyer_address: '', sale_price: '', deposit_amount: '',
  payment_deadline: '', payment_method: 'Bank Transfer',
  // Dealer (auto-filled from profile)
  dealer_name: '', dealer_ssm: '', dealer_city: '', dealer_state: '',
  // SA (auto-filled from profile)
  sa_name: '', sa_phone: '', sa_ic: '',
  // Vehicle extras (auto-filled from listing)
  engine_number: '', engine_cc: '', transmission: '', variant: '',
  previous_owners: '', road_tax_expiry: '', warranty_months: '',
  odometer_at_delivery: '',
  // Compliance
  puspakom_b5_done: false, puspakom_b7_done: false, encumbrance_declared: false,
  // Financing
  include_financing: false,
  loan_amount: '', interest_rate: '', loan_tenure_months: '', monthly_payment: '', financing_bank: '',
  // Handover
  handover_items: [...DEFAULT_HANDOVER_ITEMS],
  exceptions_noted: '',
};

function DocumentsTab({ userId, listings, prefillDocData, onClearPrefill, profile }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGen, setShowGen] = useState(false);
  useModalHistory(showGen, () => setShowGen(false));
  const [genForm, setGenForm] = useState({ ...EMPTY_GEN_FORM });
  const [genSaving, setGenSaving] = useState(false);
  const [printDoc, setPrintDoc] = useState(null);
  useModalHistory(!!printDoc, () => setPrintDoc(null));
  const [listingDropOpen, setListingDropOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  useModalHistory(!!deleteId, () => setDeleteId(null));
  // Documents pop-ups sit above the page (portal) with the page locked behind them.
  const docOverlayOpen = showGen || !!printDoc || !!deleteId;
  useEffect(() => {
    if (!docOverlayOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [docOverlayOpen]);
  const [newHandoverItem, setNewHandoverItem] = useState('');
  const [linkedStock, setLinkedStock] = useState(null);
  const [emailSendingId, setEmailSendingId] = useState(null);

  // Pre-fill from Enquiries shortcut
  useEffect(() => {
    if (!prefillDocData) return;
    const prefillListing = prefillDocData.listing_id ? listings.find(l => l.id === prefillDocData.listing_id) || null : null;
    setSelectedListing(prefillListing);
    setGenForm(p => ({
      ...p,
      doc_type: prefillDocData.doc_type || 'Sales Agreement',
      buyer_name: prefillDocData.buyer_name || '',
      buyer_phone: prefillDocData.buyer_phone || '',
      listing_id: prefillDocData.listing_id || '',
      sale_price: prefillListing?.selling_price ? String(prefillListing.selling_price) : p.sale_price,
      sa_name: profile?.full_name || '',
      sa_phone: profile?.whatsapp_number || '',
    }));
    setShowGen(true);
    onClearPrefill?.();
  }, [prefillDocData]);

  // Auto-fill dealer + SA from profile when modal opens.
  // The Sales Advisor is ALWAYS the person generating the document (the logged-in
  // user), role-aware by construction: `profile` is the current user's own row, so
  // a manager sees the manager, a salesman sees the salesman, an owner sees the
  // owner. Take the live profile FIRST (not `p.sa_name ||`) so a value that got
  // stuck in the form from a previous doc can never shadow the real generator —
  // that was the "shows the wrong name" bug. Still editable per-document below.
  useEffect(() => {
    if (showGen && profile) {
      setGenForm(p => ({
        ...p,
        sa_name:     profile.full_name        || p.sa_name     || '',
        sa_phone:    profile.whatsapp_number   || p.sa_phone    || '',
        sa_ic:       profile.ic_number         || p.sa_ic       || '',
        dealer_name: p.dealer_name || profile.dealership        || '',
        dealer_ssm:  p.dealer_ssm  || profile.ssm_number        || '',
        dealer_city: p.dealer_city || profile.city              || '',
        dealer_state:p.dealer_state|| profile.state             || '',
      }));
    }
  }, [showGen]);

  // Generic document form calculator — not the same as the standard car estimate in utils/financing.js.
  // This one accepts user-specified rate and tenure from form inputs.
  const calcLoanPayment = (amount, rate, months) => {
    const a = parseFloat(amount), r = parseFloat(rate), m = parseInt(months);
    if (!a || !r || !m) return '';
    // Reducing balance on an EIR (HP (Amendment) Act 2026) — was flat.
    return monthlyPayment(a, r, m).toFixed(2);
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

  const handleListingSelect = async (listing) => {
    setSelectedListing(listing);
    setLinkedStock(null);
    setGenForm(p => ({
      ...p,
      listing_id:           listing.id,
      sale_price:           listing.selling_price     ? String(listing.selling_price)  : p.sale_price,
      engine_number:        listing.engine_number     || p.engine_number,
      engine_cc:            listing.engine_cc         ? String(listing.engine_cc)      : p.engine_cc,
      transmission:         listing.transmission      || p.transmission,
      variant:              listing.variant           || p.variant,
      previous_owners:      listing.previous_owners   != null ? String(listing.previous_owners) : p.previous_owners,
      road_tax_expiry:      listing.road_tax_expiry   || p.road_tax_expiry,
      warranty_months:      listing.warranty_months   != null ? String(listing.warranty_months)  : p.warranty_months,
      odometer_at_delivery: listing.mileage           ? String(listing.mileage)        : p.odometer_at_delivery,
    }));
    setListingDropOpen(false);
    setListingSearch('');
    // Fetch linked stock unit for encumbrance / B5 check
    const { data } = await supabase
      .from('stock_units')
      .select('encumbrance_status, puspakom_b5_date, puspakom_b7_date')
      .eq('listing_id', listing.id)
      .eq('dealer_id', userId)
      .maybeSingle();
    setLinkedStock(data || null);
  };

  const fetchDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dealer_documents')
      .select('*')
      .eq('dealer_id', userId)
      .order('issued_at', { ascending: false })
      .limit(300);
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDocs(); }, [userId]);

  const generateDocRef = async (docType) => {
    const prefix = DOC_TYPE_PREFIX[docType] || 'DOC';
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('dealer_documents')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', userId)
      .eq('doc_type', docType);
    return `${prefix}-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
  };

  const handleSendEmail = async (doc) => {
    if (!doc.buyer_email) { toast.error('No buyer email on this document — edit and add one before sending'); return; }
    setEmailSendingId(doc.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SERVER_URL}/send-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ doc_id: doc.id, dealer_id: userId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the real server error (e.g. "Email service not configured")
        // instead of masking everything as a generic network failure.
        toast.error(body.error || `Failed to send email (status ${res.status})`);
      } else {
        toast.success(`Document emailed to ${doc.buyer_email}`);
        setDocuments(p => p.map(d => d.id === doc.id ? { ...d, email_sent_at: new Date().toISOString() } : d));
      }
    } catch (e) { toast.error(`Couldn't reach the email service${e?.message ? ` (${e.message})` : ''} — try again`); }
    setEmailSendingId(null);
  };

  const handleGenerate = async () => {
    const needsIc = ['Sales Agreement', 'Deposit Receipt'].includes(genForm.doc_type);
    if (needsIc && !genForm.buyer_ic.trim()) {
      toast.error('Buyer IC is required for ' + genForm.doc_type);
      return;
    }
    if (!genForm.buyer_name.trim()) {
      toast.error('Buyer name is required');
      return;
    }
    setGenSaving(true);
    const car = selectedListing || listings.find(l => l.id === genForm.listing_id) || null;
    try {
      const docRef = await generateDocRef(genForm.doc_type);
      const { data, error } = await supabase.from('dealer_documents').insert({
        dealer_id: userId,
        listing_id: genForm.listing_id || null,
        buyer_name: genForm.buyer_name,
        buyer_ic: genForm.buyer_ic,
        buyer_email: genForm.buyer_email.trim() || null,
        buyer_phone: genForm.buyer_phone,
        buyer_address: genForm.buyer_address,
        doc_type: genForm.doc_type,
        doc_ref: docRef,
        sale_price: Number(genForm.sale_price) || 0,
        deposit_amount: Number(genForm.deposit_amount) || 0,
        balance_amount: Math.max(0, (Number(genForm.sale_price) || 0) - (Number(genForm.deposit_amount) || 0)),
        issued_at: null,
        doc_status: 'draft',
        car_brand: car?.brand || null,
        car_model: car?.model || null,
        car_year: car?.year || null,
        car_colour: car?.colour || null,
        car_plate: car?.plate_number || null,
        car_vin: car?.vin_number || null,
        car_mileage: car?.mileage ? Number(car.mileage) : null,
        included_services_snapshot: car?.included_services || null,
        sa_name: genForm.sa_name,
        sa_phone: genForm.sa_phone,
        sa_ic: genForm.sa_ic,
        loan_amount: genForm.include_financing && genForm.loan_amount ? Number(genForm.loan_amount) : null,
        interest_rate: genForm.include_financing && genForm.interest_rate ? Number(genForm.interest_rate) : null,
        loan_tenure_months: genForm.include_financing && genForm.loan_tenure_months ? Number(genForm.loan_tenure_months) : null,
        monthly_payment: genForm.include_financing && genForm.monthly_payment ? Number(genForm.monthly_payment) : null,
        financing_bank: genForm.include_financing ? genForm.financing_bank : null,
        metadata: {
          // New documents state their rate as EIR; older ones have no key and
          // keep printing "flat", which is what they were computed with.
          rate_basis:          genForm.include_financing ? RATE_BASIS : null,
          car_label:           car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : '',
          car_variant:         genForm.variant,
          car_engine_number:   genForm.engine_number,
          car_engine_cc:       genForm.engine_cc,
          car_transmission:    genForm.transmission,
          car_previous_owners: genForm.previous_owners,
          car_road_tax_expiry: genForm.road_tax_expiry,
          car_warranty_months: genForm.warranty_months,
          odometer_at_delivery:genForm.odometer_at_delivery,
          dealer_name:         genForm.dealer_name,
          dealer_ssm:          genForm.dealer_ssm,
          dealer_city:         genForm.dealer_city,
          dealer_state:        genForm.dealer_state,
          payment_deadline:    genForm.payment_deadline,
          payment_method:      genForm.payment_method,
          puspakom_b5_done:    genForm.puspakom_b5_done,
          puspakom_b7_done:    genForm.puspakom_b7_done,
          encumbrance_declared:genForm.encumbrance_declared,
          include_financing:   genForm.include_financing,
          handover_items:      mergePendingTag(genForm.handover_items, newHandoverItem),
          exceptions_noted:    genForm.exceptions_noted,
        },
      }).select().single();
      if (error) throw error;
      logActivity({ dealerId: userId, actor: profile, tableName: 'dealer_documents', recordId: data?.id, action: 'created', summary: `${genForm.doc_type} draft generated — ${genForm.buyer_name || 'unknown buyer'}${data?.doc_ref ? ` · ${data.doc_ref}` : ''}` });
      setShowGen(false);
      setSelectedListing(null);
      setLinkedStock(null);
      setGenForm({ ...EMPTY_GEN_FORM });
      setNewHandoverItem('');
      if (data) setPrintDoc(data);
      fetchDocs();
    } catch (err) {
      console.error('[DocumentsTab] handleGenerate error:', err.message, err);
      toast.error(`Failed to save document: ${err.message}`);
    } finally {
      setGenSaving(false);
    }
  };

  const handleIssue = async (doc) => {
    const now = new Date().toISOString();
    const issuedBy = profile?.full_name || profile?.email || 'Unknown';
    const { error } = await supabase
      .from('dealer_documents')
      .update({ doc_status: 'issued', issued_at: now, issued_by: issuedBy })
      .eq('id', doc.id)
      .eq('dealer_id', userId);
    if (error) { toast.error('Failed to issue document'); return; }
    const updated = { ...doc, doc_status: 'issued', issued_at: now, issued_by: issuedBy };
    logActivity({ dealerId: userId, actor: profile, tableName: 'dealer_documents', recordId: doc.id, action: 'issued', summary: `${doc.doc_type} issued — ${doc.buyer_name || 'unknown buyer'}${doc.doc_ref ? ` · ${doc.doc_ref}` : ''}` });
    setDocuments(p => p.map(d => d.id === doc.id ? updated : d));
    setPrintDoc(updated);
    toast.success(`${doc.doc_type} issued`);
  };

  const handleDelete = async (id) => {
    const doc = documents.find(d => d.id === id);
    if (doc?.doc_status === 'issued') { toast.error('Cannot delete an issued document'); setDeleteId(null); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'dealer_documents', recordId: id, action: 'deleted', summary: `${doc?.doc_type || 'Document'} draft deleted — ${doc?.buyer_name || 'unknown buyer'}${doc?.doc_ref ? ` · ${doc.doc_ref}` : ''}` });
    const { error } = await supabase.from('dealer_documents').delete().eq('id', id).eq('dealer_id', userId);
    if (error) { toast.error('Failed to delete document'); return; }
    setDocuments(prev => prev.filter(d => d.id !== id));
    setDeleteId(null);
    toast.success('Document deleted');
  };

  const filteredDocs = useMemo(() => {
    let d = documents;
    if (docTypeFilter) d = d.filter(x => x.doc_type === docTypeFilter);
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase();
      d = d.filter(x =>
        x.buyer_name?.toLowerCase().includes(q) ||
        x.doc_ref?.toLowerCase().includes(q) ||
        x.metadata?.car_label?.toLowerCase().includes(q) ||
        (x.car_brand && `${x.car_year || ''} ${x.car_brand} ${x.car_model || ''}`.toLowerCase().includes(q))
      );
    }
    return d;
  }, [documents, docSearch, docTypeFilter]);

  const filteredListings = useMemo(() => {
    if (!listingSearch.trim()) return listings;
    const q = listingSearch.toLowerCase();
    return listings.filter(l =>
      `${l.year || ''} ${l.brand || ''} ${l.model || ''}`.toLowerCase().includes(q) ||
      l.plate_number?.toLowerCase().includes(q)
    );
  }, [listings, listingSearch]);

  const renderDocHTML = (doc) => {
    const m           = doc.metadata || {};
    const carLabel    = m.car_label || (doc.car_brand ? `${doc.car_year || ''} ${doc.car_brand} ${doc.car_model || ''}`.trim() : '—');
    const carVariant  = m.car_variant   || '';
    const carPlate    = doc.car_plate   || '—';
    const carColour   = doc.car_colour  || '—';
    const carMileage  = m.odometer_at_delivery || doc.car_mileage || null;
    const carVin      = doc.car_vin     || null;
    const engineNo    = m.car_engine_number || null;
    const engineCc    = m.car_engine_cc || null;
    const transmission= m.car_transmission || null;
    const prevOwners  = m.car_previous_owners != null ? m.car_previous_owners : null;
    const rtExpiry    = m.car_road_tax_expiry || null;
    const warrantyMo  = m.car_warranty_months || null;
    const dealerName  = m.dealer_name  || '';
    const dealerSsm   = m.dealer_ssm   || '';
    const dealerCity  = m.dealer_city  || '';
    const dealerState = m.dealer_state || '';
    const saName      = doc.sa_name    || '—';
    const saPhone     = doc.sa_phone   || '—';
    const saIc        = doc.sa_ic      || null;
    const payDeadline = m.payment_deadline || null;
    const payMethod   = m.payment_method   || null;
    const b5Done      = m.puspakom_b5_done;
    const b7Done      = m.puspakom_b7_done;
    const enFree      = m.encumbrance_declared;
    const hasFinancing= doc.doc_type === 'Sales Agreement' && m.include_financing && doc.loan_amount;
    const services    = doc.included_services_snapshot || [];
    const handoverItems = m.handover_items?.length ? m.handover_items : [...DEFAULT_HANDOVER_ITEMS];
    const exceptions  = m.exceptions_noted || '';
    // A draft has no issue date. It printed "Date: —", which reads like a real
    // receipt with a missing date; say plainly that it is not issued.
    const issued      = doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : 'DRAFT, not issued';
    const isHandover  = doc.doc_type === 'Handover Checklist';
    const isDeposit   = doc.doc_type === 'Deposit Receipt';
    const isSales     = doc.doc_type === 'Sales Agreement';

    const row  = (label, val) => val ? `<tr><td style="padding:5px 0;font-size:13px;color:#555;width:190px;vertical-align:top;">${label}</td><td style="padding:5px 0;font-size:13px;">${val}</td></tr>` : '';
    const sect = (title, content) => `<div style="margin-bottom:24px;"><h3 style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#999;border-bottom:1px solid #e5e5e5;padding-bottom:5px;margin:0 0 12px;">${title}</h3>${content}</div>`;
    const tick = (label, done) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f5f5f5;"><div style="width:15px;height:15px;border:1.5px solid ${done?'#16a34a':'#aaa'};border-radius:3px;flex-shrink:0;background:${done?'#dcfce7':'transparent'};display:flex;align-items:center;justify-content:center;"><span style="font-size:10px;color:#16a34a;">${done?'✓':''}</span></div><span style="font-size:13px;">${label}</span></div>`;

    const dealerHeader = (dealerName || dealerSsm) ? `
      <div style="text-align:right;font-size:12px;color:#555;line-height:1.6;">
        ${dealerName ? `<div style="font-weight:700;font-size:13px;color:#111;">${dealerName}</div>` : ''}
        ${dealerSsm  ? `<div>SSM Reg: ${dealerSsm}</div>` : ''}
        ${[dealerCity,dealerState].filter(Boolean).join(', ') || ''}
      </div>` : '';

    /* ── Sales Agreement ─────────────────────────────────── */
    if (isSales) return `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#111;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111;">
          <div>
            <h1 style="font-size:20px;font-weight:800;margin:0 0 3px;">VEHICLE SALES AGREEMENT</h1>
            <p style="font-size:12px;color:#555;margin:0;">Date: ${issued}</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${doc.doc_ref ? `<div style="text-align:right;"><span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Ref. No.</span><br><span style="font-size:14px;font-weight:700;font-family:monospace;">${doc.doc_ref}</span></div>` : ''}
            ${dealerHeader}
          </div>
        </div>

        ${sect('Vehicle Details', `<table style="width:100%;border-collapse:collapse;">
          ${row('Vehicle', `<strong>${carLabel}${carVariant ? ' ' + carVariant : ''}</strong>`)}
          ${row('Registration No.', carPlate)}
          ${row('Colour', carColour)}
          ${engineNo  ? row('Engine No.', engineNo) : ''}
          ${carVin    ? row('Chassis / VIN', carVin) : ''}
          ${engineCc  ? row('Engine Capacity', `${Number(engineCc).toLocaleString()} cc`) : ''}
          ${transmission ? row('Transmission', transmission) : ''}
          ${carMileage ? row('Odometer at Sale', `${Number(carMileage).toLocaleString()} km`) : ''}
          ${prevOwners != null ? row('Previous Owners', prevOwners) : ''}
          ${rtExpiry  ? row('Road Tax Expiry', new Date(rtExpiry).toLocaleDateString('en-MY',{day:'2-digit',month:'long',year:'numeric'})) : ''}
        </table>`)}

        ${sect('Seller / Dealer', `<table style="width:100%;border-collapse:collapse;">
          ${row('Company Name', dealerName)}
          ${row('SSM / Reg. No.', dealerSsm)}
          ${row('Address', [dealerCity,dealerState].filter(Boolean).join(', '))}
          ${row('Sales Advisor', saName)}
          ${row('SA Contact', saPhone)}
          ${saIc ? row('SA IC No.', saIc) : ''}
        </table>`)}

        ${sect('Buyer Details', `<table style="width:100%;border-collapse:collapse;">
          ${row('Full Name', doc.buyer_name)}
          ${row('IC No.', doc.buyer_ic)}
          ${row('Phone', doc.buyer_phone)}
          ${row('Address', doc.buyer_address)}
        </table>`)}

        ${sect('Financial Terms', `<table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e5e5e5;"><th style="text-align:left;padding:5px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Description</th><th style="text-align:right;padding:5px 0;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Amount (RM)</th></tr>
          <tr><td style="padding:8px 0;font-size:13px;">Agreed Sale Price</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.sale_price||0).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;">Deposit Paid</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>
          <tr style="border-top:2px solid #111;"><td style="padding:8px 0;font-size:14px;font-weight:700;">Balance Due</td><td style="text-align:right;font-size:14px;font-weight:700;">RM ${Number(doc.balance_amount||0).toLocaleString()}</td></tr>
          ${payDeadline ? `<tr><td style="padding:4px 0;font-size:12px;color:#555;">Balance payment due by</td><td style="text-align:right;font-size:12px;color:#555;">${new Date(payDeadline).toLocaleDateString('en-MY',{day:'2-digit',month:'long',year:'numeric'})}</td></tr>` : ''}
          ${payMethod   ? `<tr><td style="padding:4px 0;font-size:12px;color:#555;">Payment method</td><td style="text-align:right;font-size:12px;color:#555;">${payMethod}</td></tr>` : ''}
        </table>`)}

        ${hasFinancing ? sect('Hire Purchase / Financing', `<table style="width:100%;border-collapse:collapse;">
          ${row('Financing Bank', doc.financing_bank)}
          ${row('Loan Amount', `RM ${Number(doc.loan_amount).toLocaleString()}`)}
          ${row(rateLabel(doc.metadata?.rate_basis) === 'EIR' ? 'Interest Rate (EIR)' : 'Flat Interest Rate', `${doc.interest_rate}% p.a.`)}
          ${row('Tenure', `${doc.loan_tenure_months} months`)}
          ${doc.monthly_payment ? row('Est. Monthly Instalment', `RM ${Number(doc.monthly_payment).toLocaleString()}`) : ''}
        </table>`) : ''}

        ${services.length > 0 ? sect('Included Services & Packages', `<table style="width:100%;border-collapse:collapse;">
          ${services.map(s => `<tr><td style="padding:5px 0;font-size:13px;">${s.name||'—'}</td><td style="text-align:right;font-size:13px;color:#555;">RM ${Number(s.selling_price||0).toLocaleString()}</td></tr>`).join('')}
        </table>`) : ''}

        ${warrantyMo ? sect('Dealer Warranty', `<p style="font-size:13px;margin:0;">Dealer provides <strong>${warrantyMo} month(s)</strong> warranty on this vehicle from the date of handover, covering major mechanical faults as agreed.</p>`) : ''}

        ${sect('Declarations', `
          ${tick('Vehicle is free from any outstanding hire-purchase / encumbrances', enFree)}
          ${tick('Puspakom B5 (chassis inspection) completed', b5Done)}
          ${tick('Puspakom B7 (engine inspection) completed', b7Done)}
          <p style="font-size:11px;color:#777;margin:12px 0 0;line-height:1.6;">The seller declares that all information above is true and correct. Ownership of the vehicle passes to the buyer upon receipt of full payment. This agreement is governed by the laws of Malaysia (Contracts Act 1950, Consumer Protection Act 1999, Road Transport Act 1987).</p>
        `)}

        <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Buyer</p>
            <p style="font-size:11px;color:#555;margin:0;">${doc.buyer_name || ''} &nbsp;|&nbsp; IC: ${doc.buyer_ic || ''}</p>
            <p style="font-size:11px;color:#aaa;margin:28px 0 0;">Signature &amp; Date: _______________</p>
          </div></div>
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Dealer / Sales Advisor</p>
            <p style="font-size:11px;color:#555;margin:0;">${saName}</p>
            <p style="font-size:11px;color:#aaa;margin:28px 0 0;">Signature, Stamp &amp; Date: _______________</p>
          </div></div>
        </div>
      </div>`;

    /* ── Deposit Receipt ─────────────────────────────────── */
    if (isDeposit) return `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#111;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111;">
          <div>
            <h1 style="font-size:20px;font-weight:800;margin:0 0 3px;">DEPOSIT RECEIPT</h1>
            <p style="font-size:12px;color:#555;margin:0;">Date: ${issued}</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${doc.doc_ref ? `<div style="text-align:right;"><span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Receipt No.</span><br><span style="font-size:14px;font-weight:700;font-family:monospace;">${doc.doc_ref}</span></div>` : ''}
            ${dealerHeader}
          </div>
        </div>

        ${sect('Received From', `<table style="width:100%;border-collapse:collapse;">
          ${row('Buyer Name', doc.buyer_name)}
          ${row('IC No.', doc.buyer_ic)}
          ${row('Contact', doc.buyer_phone)}
        </table>`)}

        ${sect('Vehicle Reserved', `<table style="width:100%;border-collapse:collapse;">
          ${row('Vehicle', `<strong>${carLabel}${carVariant ? ' ' + carVariant : ''}</strong>`)}
          ${row('Registration No.', carPlate)}
          ${row('Colour', carColour)}
          ${engineNo ? row('Engine No.', engineNo) : ''}
          ${carVin   ? row('Chassis / VIN', carVin) : ''}
        </table>`)}

        ${sect('Payment', `<table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-size:13px;">Agreed Sale Price</td><td style="text-align:right;font-size:13px;">RM ${Number(doc.sale_price||0).toLocaleString()}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:10px;font-size:15px;font-weight:700;">Deposit Received</td><td style="text-align:right;padding:10px;font-size:15px;font-weight:700;">RM ${Number(doc.deposit_amount||0).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#555;">Balance Remaining</td><td style="text-align:right;font-size:13px;color:#555;">RM ${Number(doc.balance_amount||0).toLocaleString()}</td></tr>
          ${payMethod ? `<tr><td style="padding:4px 0;font-size:12px;color:#888;">Payment Method</td><td style="text-align:right;font-size:12px;color:#888;">${payMethod}</td></tr>` : ''}
        </table>`)}

        ${sect('Terms & Conditions', `
          <p style="font-size:12px;line-height:1.8;margin:0 0 8px;">1. This deposit reserves the above vehicle exclusively for the buyer${payDeadline ? ` until <strong>${new Date(payDeadline).toLocaleDateString('en-MY',{day:'2-digit',month:'long',year:'numeric'})}</strong>` : ''}.</p>
          <p style="font-size:12px;line-height:1.8;margin:0 0 8px;">2. <strong>If the buyer's loan/financing application is rejected by all banks:</strong> the full deposit is refundable within 14 days of written notification of rejection.</p>
          <p style="font-size:12px;line-height:1.8;margin:0 0 8px;">3. <strong>If the buyer cancels for other reasons:</strong> a cancellation fee of up to 5% of the sale price may be retained by the dealer.</p>
          <p style="font-size:12px;line-height:1.8;margin:0 0 8px;">4. <strong>If the dealer fails to deliver the reserved vehicle:</strong> the full deposit shall be refunded to the buyer within 14 days.</p>
          <p style="font-size:12px;line-height:1.8;margin:0;">5. Disputes may be referred to the Tribunal for Consumer Claims Malaysia (TTPM).</p>
        `)}

        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Buyer Acknowledgment</p>
            <p style="font-size:11px;color:#555;margin:0;">${doc.buyer_name || ''}</p>
            <p style="font-size:11px;color:#aaa;margin:28px 0 0;">Signature &amp; Date: _______________</p>
          </div></div>
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Authorised by</p>
            <p style="font-size:11px;color:#555;margin:0;">${saName}${dealerName ? ' · ' + dealerName : ''}</p>
            <p style="font-size:11px;color:#aaa;margin:28px 0 0;">Signature &amp; Stamp: _______________</p>
          </div></div>
        </div>
      </div>`;

    /* ── Handover Checklist ─────────────────────────────── */
    return `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:40px;color:#111;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111;">
          <div>
            <h1 style="font-size:20px;font-weight:800;margin:0 0 3px;">VEHICLE HANDOVER CHECKLIST</h1>
            <p style="font-size:12px;color:#555;margin:0;">Date: ${issued}</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${doc.doc_ref ? `<div style="text-align:right;"><span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;">Ref. No.</span><br><span style="font-size:14px;font-weight:700;font-family:monospace;">${doc.doc_ref}</span></div>` : ''}
            ${dealerHeader}
          </div>
        </div>

        ${sect('Vehicle', `<table style="width:100%;border-collapse:collapse;">
          ${row('Vehicle', `<strong>${carLabel}${carVariant ? ' ' + carVariant : ''}</strong>`)}
          ${row('Registration No.', carPlate)}
          ${row('Colour', carColour)}
          ${engineNo  ? row('Engine No.', engineNo) : ''}
          ${carVin    ? row('Chassis / VIN', carVin) : ''}
          ${carMileage ? row('Odometer at Delivery', `<strong>${Number(carMileage).toLocaleString()} km</strong>`) : ''}
        </table>`)}

        ${sect('Buyer', `<table style="width:100%;border-collapse:collapse;">
          ${row('Name', doc.buyer_name)}
          ${row('IC No.', doc.buyer_ic)}
          ${row('Contact', doc.buyer_phone)}
        </table>`)}

        ${sect('Handover Items', handoverItems.map(item => tick(item, false)).join(''))}

        ${exceptions ? sect('Noted Exceptions / Agreed Defects', `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;font-size:13px;line-height:1.7;">${exceptions}</div>`) : ''}

        ${sect('Odometer Declaration', `<p style="font-size:13px;margin:0;line-height:1.8;">I, the Sales Advisor, declare that the odometer reading at the time of vehicle handover is <strong>${carMileage ? Number(carMileage).toLocaleString() + ' km' : '_______ km'}</strong> and has not been tampered with or altered.</p>`)}

        <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Buyer</p>
            <p style="font-size:11px;color:#555;margin:0;">${doc.buyer_name || ''} &nbsp;|&nbsp; IC: ${doc.buyer_ic || ''}</p>
            <p style="font-size:11px;color:#aaa;margin:4px 0 0;line-height:1.6;">I confirm receipt of the above vehicle and all listed items in the condition stated. Any exceptions are noted above.</p>
            <p style="font-size:11px;color:#aaa;margin:20px 0 0;">Signature &amp; Date: _______________</p>
          </div></div>
          <div><div style="border-top:1.5px solid #111;padding-top:8px;">
            <p style="font-size:12px;font-weight:600;margin:0 0 2px;">Sales Advisor / Dealer Representative</p>
            <p style="font-size:11px;color:#555;margin:0;">${saName}${dealerName ? ' · ' + dealerName : ''}</p>
            <p style="font-size:11px;color:#aaa;margin:28px 0 0;">Signature, Stamp &amp; Date: _______________</p>
          </div></div>
        </div>
      </div>`;
  };

  return (
    <div className="space-y-4">
      {/* ── Document list (premiumLight, 2026-11-10). The Sold pill names the page, so
          no second "Documents" heading; type is a pill row, not a drop-down; the one red
          button is New document; a draft's Issue is the dark key. ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <StatusPills
            items={[{ key: '', label: 'All', count: documents.length }, ...DOC_TYPES.map(t => ({ key: t, label: DOC_TYPE_PILL[t] || t, count: documents.filter(d => d.doc_type === t).length }))]}
            active={docTypeFilter} onChange={setDocTypeFilter} />
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: PL.textMuted, pointerEvents: 'none' }} />
          <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search ref, buyer, car"
            style={{ ...INV_INPUT, paddingLeft: 32, background: PL.card, boxShadow: PL.shadow }} />
        </div>
        <button onClick={() => setShowGen(true)} style={{ ...INV_GHOST_BTN, background: PL.accent, color: PL.onAccent }}>
          <FileText style={{ width: 14, height: 14 }} />New document
        </button>
      </div>

      <div style={{ ...INV_CARD, padding: 8 }}>
        {loading ? (
          <p style={{ padding: '28px 16px', margin: 0, fontSize: 14, color: PL.textMuted }}>Loading…</p>
        ) : filteredDocs.length === 0 ? (
          <p style={{ padding: '36px 16px', margin: 0, fontSize: 14, color: PL.textMuted, textAlign: 'center' }}>
            {documents.length === 0 ? 'No documents yet. Make a sales agreement or deposit receipt from a buyer\'s lead, or press New document.' : 'No document matches that search.'}
          </p>
        ) : filteredDocs.map((doc, i) => {
          const issued = doc.doc_status === 'issued';
          const car = doc.metadata?.car_label || (doc.car_brand ? `${doc.car_year || ''} ${doc.car_brand} ${doc.car_model || ''}`.trim() : null);
          const btn = { ...INV_GHOST_BTN, padding: '7px 12px', fontSize: 12 };
          return (
            <div key={doc.id} className="doc-row" style={{ display: 'grid', gap: '8px 16px', alignItems: 'center', padding: '12px 10px', borderTop: i ? `1px solid ${PL.line}` : 'none' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PL.text }}>
                  {doc.buyer_name || 'No buyer named'}
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: issued ? PL.textMuted : PL.accentText }}>{issued ? 'Issued' : 'Draft'}</span>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[doc.doc_type, car, doc.issued_at ? new Date(doc.issued_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : null].filter(Boolean).join(' · ')}
                  {doc.doc_ref && <span style={{ fontFamily: 'monospace', marginLeft: 6 }}>{doc.doc_ref}</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setPrintDoc(doc)} style={btn}><Printer style={{ width: 13, height: 13 }} />View</button>
                {issued ? (
                  <button onClick={() => handleSendEmail(doc)} disabled={!doc.buyer_email || emailSendingId === doc.id}
                    title={doc.buyer_email ? `Send to ${doc.buyer_email}` : 'No buyer email. Open the document to add one.'}
                    style={{ ...btn, opacity: !doc.buyer_email || emailSendingId === doc.id ? 0.5 : 1, cursor: doc.buyer_email ? 'pointer' : 'not-allowed' }}>
                    {emailSendingId === doc.id ? 'Sending…' : !doc.buyer_email ? 'No email' : doc.email_sent_at ? 'Resend' : 'Send to buyer'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleIssue(doc)} style={{ ...btn, background: PL.text, color: '#fff' }}>Issue</button>
                    <button onClick={() => setDeleteId(doc.id)} aria-label="Delete draft" style={{ ...btn, padding: 8, color: PL.textMuted }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .doc-row { grid-template-columns: 1fr; }
        @media (min-width: 760px) { .doc-row { grid-template-columns: minmax(0,1fr) auto; } }
      `}</style>

      {/* ── Generate Modal ── */}
      {showGen && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Generate Document</h3>
              <button onClick={() => setShowGen(false)} className="text-gray-400 hover:text-gray-800 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Document Type</label>
                <select value={genForm.doc_type} onChange={e => setGenForm(p => ({ ...p, doc_type: e.target.value }))} className={iCls} style={{ background: '#fff' }}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Car listing selector with search */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Car Listing</label>
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setListingDropOpen(p => !p)}
                    style={{ width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', fontFamily: "system-ui, sans-serif" }}>
                    {selectedListing ? (
                      <>
                        {selectedListing.images?.[0] ? (
                          <img src={cdnImg(selectedListing.images[0], 96, 70)} onError={imgFallback(selectedListing.images[0])} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} loading="lazy" decoding="async" />
                        ) : (
                          <div style={{ width: 44, height: 34, borderRadius: 6, background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 18, height: 18, color: '#6b7280' }} /></div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedListing.year} {selectedListing.brand} {selectedListing.model}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, marginTop: 1 }}>
                            {selectedListing.plate_number && <span>{selectedListing.plate_number}</span>}
                            {selectedListing.colour && <span>{selectedListing.colour}</span>}
                            {selectedListing.mileage && <span>{Number(selectedListing.mileage).toLocaleString()} km</span>}
                          </div>
                        </div>
                        {selectedListing.selling_price && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', flexShrink: 0 }}>RM {Number(selectedListing.selling_price).toLocaleString()}</span>}
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Select a listing…</span>
                    )}
                    <ChevronDown style={{ width: 16, height: 16, color: '#6b7280', marginLeft: 'auto', flexShrink: 0 }} />
                  </button>
                  {listingDropOpen && (
                    <>
                      <div onClick={() => { setListingDropOpen(false); setListingSearch(''); }} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, zIndex: 50, maxHeight: 280, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                          <input
                            value={listingSearch} onChange={e => setListingSearch(e.target.value)}
                            placeholder="Search by car or plate…"
                            autoFocus
                            style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#f9fafb', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ overflowY: 'auto' }}>
                          {filteredListings.length === 0 ? (
                            <div style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af' }}>No listings match</div>
                          ) : filteredListings.map(l => (
                            <button key={l.id} type="button" onClick={() => handleListingSelect(l)}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: genForm.listing_id === l.id ? 'rgba(220,38,38,0.07)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "system-ui, sans-serif" }}
                              onMouseEnter={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = '#f9fafb'; }}
                              onMouseLeave={e => { if (genForm.listing_id !== l.id) e.currentTarget.style.background = 'transparent'; }}>
                              {l.images?.[0] ? (
                                <img src={cdnImg(l.images[0], 96, 70)} onError={imgFallback(l.images[0])} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} loading="lazy" decoding="async" />
                              ) : (
                                <div style={{ width: 44, height: 34, borderRadius: 6, background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 16, height: 16, color: '#6b7280' }} /></div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.year} {l.brand} {l.model}</div>
                                <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', gap: 8, marginTop: 1 }}>
                                  {l.plate_number && <span>{l.plate_number}</span>}
                                  {l.colour && <span>{l.colour}</span>}
                                  {l.mileage && <span>{Number(l.mileage).toLocaleString()} km</span>}
                                </div>
                              </div>
                              {l.selling_price && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', flexShrink: 0 }}>RM {Number(l.selling_price).toLocaleString()}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Name</label>
                  <input value={genForm.buyer_name} onChange={e => setGenForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Ahmad" className={iCls} style={!genForm.buyer_name.trim() ? { borderColor: '#fca5a5' } : {}} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Buyer IC
                    {['Sales Agreement','Deposit Receipt'].includes(genForm.doc_type) && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  </label>
                  <input value={genForm.buyer_ic} onChange={e => setGenForm(p => ({ ...p, buyer_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls}
                    style={['Sales Agreement','Deposit Receipt'].includes(genForm.doc_type) && !genForm.buyer_ic.trim() ? { borderColor: '#fca5a5' } : {}} />
                  {['Sales Agreement','Deposit Receipt'].includes(genForm.doc_type) && !genForm.buyer_ic.trim() && (
                    <p style={{ fontSize: 10, color: '#dc2626', marginTop: 3 }}>Required for {genForm.doc_type}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><PhoneInput value={genForm.buyer_phone} onChange={(v) => setGenForm(p => ({ ...p, buyer_phone: v }))} className={iCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" /></div>
                <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Sale Price (RM)</label><input type="number" value={genForm.sale_price} onChange={e => setGenForm(p => ({ ...p, sale_price: e.target.value }))} placeholder="0" className={iCls} /></div>
              </div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Email <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— for document delivery</span></label><input type="email" value={genForm.buyer_email} onChange={e => setGenForm(p => ({ ...p, buyer_email: e.target.value }))} placeholder="buyer@email.com" className={iCls} /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Buyer Address</label><textarea value={genForm.buyer_address} onChange={e => setGenForm(p => ({ ...p, buyer_address: e.target.value }))} rows={2} className={taCls} placeholder="Full address" /></div>
              <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Deposit Amount (RM)</label><input type="number" value={genForm.deposit_amount} onChange={e => setGenForm(p => ({ ...p, deposit_amount: e.target.value }))} placeholder="0" className={iCls} /></div>

              {/* Balance due — auto-computed (sale price − deposit), never typed. Shows the
                  same figure that gets saved to the document so there's no surprise. */}
              {(Number(genForm.sale_price) > 0 || Number(genForm.deposit_amount) > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Balance Due <span style={{ color: '#9ca3af', fontWeight: 400 }}>(auto)</span></span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>RM {Math.max(0, (Number(genForm.sale_price) || 0) - (Number(genForm.deposit_amount) || 0)).toLocaleString('en-MY')}</span>
                </div>
              )}

              {genForm.doc_type !== 'Handover Checklist' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Payment Deadline</label>
                    <input type="date" value={genForm.payment_deadline} onChange={e => setGenForm(p => ({ ...p, payment_deadline: e.target.value }))} className={iCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Payment Method</label>
                    <select value={genForm.payment_method} onChange={e => setGenForm(p => ({ ...p, payment_method: e.target.value }))} className={iCls} style={{ background: '#fff' }}>
                      {['Bank Transfer','Cash','Cheque','Online Transfer'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Sales Advisor */}
              <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Sales Advisor</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Name</label><input value={genForm.sa_name} onChange={e => setGenForm(p => ({ ...p, sa_name: e.target.value }))} placeholder="SA Name" className={iCls} /></div>
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Phone</label><PhoneInput value={genForm.sa_phone} onChange={(v) => setGenForm(p => ({ ...p, sa_phone: v }))} className={iCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" /></div>
                </div>
                <div style={{ marginTop: 10 }}><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">IC Number</label><input value={genForm.sa_ic} onChange={e => setGenForm(p => ({ ...p, sa_ic: e.target.value }))} placeholder="XXXXXX-XX-XXXX" className={iCls} /></div>
              </div>

              {/* Vehicle Details */}
              <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Vehicle Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Engine No.</label><input value={genForm.engine_number} onChange={e => setGenForm(p => ({ ...p, engine_number: e.target.value }))} placeholder="e.g. 2AR-FE 123456" className={iCls} /></div>
                  <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Engine CC</label><input type="number" value={genForm.engine_cc} onChange={e => setGenForm(p => ({ ...p, engine_cc: e.target.value }))} placeholder="2000" className={iCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3" style={{ marginTop: 10 }}>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Odometer at Delivery (km)</label>
                    <input type="number" value={genForm.odometer_at_delivery} onChange={e => setGenForm(p => ({ ...p, odometer_at_delivery: e.target.value }))} placeholder="e.g. 45000" className={iCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Previous Owners</label>
                    <input type="number" value={genForm.previous_owners} onChange={e => setGenForm(p => ({ ...p, previous_owners: e.target.value }))} placeholder="1" className={iCls} />
                  </div>
                </div>
              </div>

              {/* Handover Checklist item editor */}
              {genForm.doc_type === 'Handover Checklist' && (
                <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Handover Items</p>
                  <div className="space-y-1.5">
                    {genForm.handover_items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f9fafb', borderRadius: 7, border: '1px solid #e5e7eb' }}>
                        <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{item}</span>
                        <button onClick={() => setGenForm(p => ({ ...p, handover_items: p.handover_items.filter((_, i) => i !== idx) }))} style={{ color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.color='#dc2626'} onMouseLeave={e => e.currentTarget.style.color='#d1d5db'}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={newHandoverItem} onChange={e => setNewHandoverItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newHandoverItem.trim()) { setGenForm(p => ({ ...p, handover_items: [...p.handover_items, newHandoverItem.trim()] })); setNewHandoverItem(''); e.preventDefault(); } }}
                      placeholder="Add item…" className={iCls} style={{ flex: 1 }} />
                    <button onClick={() => { if (newHandoverItem.trim()) { setGenForm(p => ({ ...p, handover_items: [...p.handover_items, newHandoverItem.trim()] })); setNewHandoverItem(''); } }}
                      style={{ padding: '0 14px', borderRadius: 8, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>Add</button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Exceptions / Agreed Defects</label>
                    <textarea value={genForm.exceptions_noted} onChange={e => setGenForm(p => ({ ...p, exceptions_noted: e.target.value }))} rows={2} className={taCls} placeholder="List any agreed cosmetic defects, missing items, or conditions noted at handover…" />
                  </div>
                </div>
              )}

              {/* Compliance declarations — Sales Agreement only */}
              {genForm.doc_type === 'Sales Agreement' && (
                <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Compliance Declarations</p>
                  <div className="space-y-2">
                    {[
                      ['puspakom_b5_done', 'Puspakom B5 inspection completed (chassis/body)'],
                      ['puspakom_b7_done', 'Puspakom B7 inspection completed (engine, valid 30 days)'],
                      ['encumbrance_declared', 'Vehicle free from hire purchase / encumbrance'],
                    ].map(([field, label]) => (
                      <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', background: genForm[field] ? 'rgba(22,163,74,0.06)' : '#f9fafb', borderRadius: 7, border: `1px solid ${genForm[field] ? 'rgba(22,163,74,0.2)' : '#e5e7eb'}` }}>
                        <input type="checkbox" checked={genForm[field]} onChange={e => setGenForm(p => ({ ...p, [field]: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#16a34a', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#374151', fontFamily: "system-ui, sans-serif" }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Financing — Sales Agreement only */}
              {genForm.doc_type === 'Sales Agreement' && (
                <div style={{ paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: genForm.include_financing ? 12 : 0 }}>
                    <input type="checkbox" checked={genForm.include_financing} onChange={e => setGenForm(p => ({ ...p, include_financing: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#dc2626' }} />
                    <span style={{ fontSize: 13, color: '#374151', fontFamily: "system-ui, sans-serif" }}>Include Financing Details</span>
                  </label>
                  {genForm.include_financing && (
                    <div className="space-y-3">
                      <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Financing Bank</label><input value={genForm.financing_bank} onChange={e => gf('financing_bank', e.target.value)} placeholder="e.g. Maybank, CIMB" className={iCls} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Loan Amount (RM)</label><input type="number" value={genForm.loan_amount} onChange={e => gf('loan_amount', e.target.value)} placeholder="0" className={iCls} /></div>
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Interest Rate (% EIR)</label><input type="number" step="0.01" value={genForm.interest_rate} onChange={e => gf('interest_rate', e.target.value)} placeholder={String(DEFAULT_EIR)} className={iCls} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Tenure (months)</label><input type="number" value={genForm.loan_tenure_months} onChange={e => gf('loan_tenure_months', e.target.value)} placeholder="84" className={iCls} /></div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Monthly Payment (RM)</label>
                          <input readOnly value={genForm.monthly_payment ? `RM ${Number(genForm.monthly_payment).toLocaleString()}` : '—'} className={iCls} style={{ color: '#16a34a', background: 'rgba(22,163,74,0.04)', cursor: 'default' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {(() => {
              const encBlocked = genForm.doc_type === 'Handover Checklist' && linkedStock && linkedStock.encumbrance_status === 'under_hp';
              return (
                <div className="p-5 border-t border-gray-100 space-y-3">
                  {encBlocked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10 }}>
                      <AlertTriangle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#dc2626', fontFamily: "system-ui,sans-serif" }}>
                        This vehicle is marked <strong>Under HP</strong> in stock. Clear the encumbrance before issuing a Handover Checklist.
                      </span>
                    </div>
                  )}
                  {linkedStock && linkedStock.encumbrance_status === 'unknown' && genForm.doc_type === 'Handover Checklist' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
                      <AlertTriangle style={{ width: 14, height: 14, color: '#f59e0b', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#92400e', fontFamily: "system-ui,sans-serif" }}>Encumbrance status not verified in stock. Confirm before handover.</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setShowGen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200">Cancel</button>
                    <button onClick={handleGenerate} disabled={genSaving || encBlocked} className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold" style={encBlocked ? { background: '#9ca3af', cursor: 'not-allowed' } : T.btnRed}>
                      {genSaving ? 'Generating…' : 'Generate'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      , document.body)}

      {/* ── Print Preview Modal ── */}
      {printDoc && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 className="font-semibold text-gray-800 text-sm">{printDoc.doc_type}</h3>
                  {printDoc.doc_status !== 'issued'
                    ? <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 5, padding: '1px 7px' }}>DRAFT</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 5, padding: '1px 7px' }}>Issued</span>
                  }
                </div>
                {printDoc.doc_ref && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0', fontFamily: 'monospace' }}>{printDoc.doc_ref}</p>}
                {printDoc.issued_by && <p style={{ fontSize: 10, color: '#9ca3af', margin: '1px 0 0' }}>Issued by {printDoc.issued_by}</p>}
              </div>
              <div className="flex items-center gap-2">
                {printDoc.doc_status !== 'issued' && (
                  <button onClick={() => handleIssue(printDoc)} style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Issue Document</button>
                )}
                <button onClick={() => { const escHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); const w = window.open('','_blank'); w.document.write(`<html><head><title>${escHtml(printDoc.doc_ref || printDoc.doc_type)}</title><style>@media print{body{margin:0;}}</style></head><body>${DOMPurify.sanitize(renderDocHTML(printDoc))}</body></html>`); w.document.close(); w.print(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={T.btnRed}><Printer className="w-3.5 h-3.5" />Print</button>
                <button onClick={() => setPrintDoc(null)} className="text-gray-500 hover:text-gray-800 p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            {printDoc.doc_status !== 'issued' && (
              <div style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ width: 13, height: 13, color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#92400e', fontFamily: "system-ui,sans-serif" }}>This is a draft — review all details then click <strong>Issue Document</strong> to lock and finalise.</span>
              </div>
            )}
            <div className="overflow-y-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderDocHTML(printDoc)) }} />
          </div>
        </div>
      , document.body)}

      {/* ── Delete Confirmation ── */}
      {deleteId && createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 max-w-xs w-full mx-4" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Delete document?</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 500, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13, border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default DocumentsTab;

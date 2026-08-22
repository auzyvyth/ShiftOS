import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Gauge,
  Zap,
  Settings,
  Droplets,
  Palette,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowLeftRight,
  ZoomIn,
  ZoomOut,
  CreditCard,
  X,
  Check,
  Calculator,
  Shield,
  Eye,
  BadgeCheck,
  ShieldCheck,
  FileText,
  Wrench,
  Star,
  Package,
  PlayCircle,
  Phone,
  ExternalLink,
  Camera,
  Download,
  Share2,
  Link as LinkIcon,
  TrendingDown,
  
  TrendingUp,
  Minus,
  MapPin,
  Clock,
  Building2,
} from "lucide-react";
import HeartButton from "../components/HeartButton";
import { useCompare } from "../hooks/useCompare";
import { getCategoryCfg } from "../utils/serviceCategories";
import { getChassisCode } from "../utils/chassisCodes";
import DamageMap from "../components/DamageMap";
import { getEmbedUrl } from "../utils/videoEmbed";
import { supabase } from "../supabaseClient";
import FinancingCalculator from "../components/FinancingCalculator";
import CarCard from "../components/CarCard";
import BookingCalendar from "../components/BookingCalendar";
import Turnstile from "../components/Turnstile";
import LegalModal from "../components/LegalModal";
import { useCTAContext, buildWaUrl } from "../hooks/useCTAContext";
import { captureRef, getRef } from "../utils/refTracking";
import { loadBuyerDetails, saveBuyerDetails } from "../utils/consent";
import { isSubdomain } from "../hooks/useTenant";
import { geranStatusLabel } from "../utils/trustDocs";
import { trackEvent, getSlugFromURL } from "../utils/analytics";
import { useMarketplaceTracking } from "../hooks/useMarketplaceTracking";
import { calcMonthly, HIGH_VALUE_THRESHOLD } from "../utils/financing";
import { estimateRoadTax } from "../utils/roadTax";
import ReviewsSection from "../components/reviews/ReviewsSection";
import CommentsSection from "../components/comments/CommentsSection";
import { cdnImg } from "../utils/img";
import { toast } from "sonner";

/* ─── helpers ─── */
const fmt = (n) => Number(n).toLocaleString("en-MY");
const fmtPrice = (n) => `RM ${fmt(n)}`;

/* Range-calculator fuel estimate — shared by the mobile and desktop Running
   Costs blocks so the formula can't drift between the two layouts again.
   RON95 subsidy pricing doesn't realistically apply above ~2,500cc; larger
   performance/luxury engines are estimated on RON97 at market price. */
const FUEL_PRICE_RON95 = 2.05;
const FUEL_PRICE_RON97 = 3.15;
const estimateFuelCost = (cc, dealerConsumption, distanceKm) => {
  const isPerformance = cc > 2500;
  const pricePerLiter = isPerformance ? FUEL_PRICE_RON97 : FUEL_PRICE_RON95;
  const fuelLabel = isPerformance ? "RON97" : "RON95";
  const consumption = dealerConsumption || (
    cc <= 1600 ? 14 :
    cc <= 2000 ? 10 :
    cc <= 2500 ? 7 :
    cc <= 4000 ? 5 : 3.5
  );
  const totalCost = Math.round((distanceKm / consumption) * pricePerLiter);
  return { pricePerLiter, fuelLabel, consumption, totalCost };
};

/* Market-price position indicator — a meter (not a pill): the marker dot
   encodes where this car's asking price sits on the cheap→expensive spectrum
   relative to the market average for similar cars. */
/* A confident "Below market" printed off three comparables is a guess wearing a
   badge, so under MARKET_SAMPLE_FLOOR the verdict and the slider are withheld and
   only the raw average is shown, labelled as thin.

   The wording changed too. compute_market_avg averages OTHER XDRIVE LISTINGS —
   asking prices, not sale prices, from a catalogue of 69 cars — so "market
   average" claimed knowledge of the Malaysian market that the query does not
   have. It now says what it actually compares against, and the method note
   spells out the rest. */
const MARKET_SAMPLE_FLOOR = 5;

const MarketPriceTag = ({ car, isXdrive, th }) => {
  if (!car?.market_avg_price || !(car.selling_price > 0)) return null;
  const avg = Number(car.market_avg_price);
  const price = Number(car.selling_price);
  const n = Number(car.market_sample_count) || 0;
  const thin = n < MARKET_SAMPLE_FLOOR;
  const ratio = price / avg;
  const band = ratio <= 0.93 ? "below" : ratio >= 1.07 ? "above" : "fair";
  const cfg = {
    below: { color: isXdrive ? "#15803d" : "#4ade80", Icon: TrendingDown, label: "Priced below similar XDrive listings" },
    fair:  { color: isXdrive ? "#1d4ed8" : "#93c5fd", Icon: Minus,        label: "In line with similar XDrive listings" },
    above: { color: isXdrive ? "#b45309" : "#fbbf24", Icon: TrendingUp,   label: "Priced above similar XDrive listings" },
  }[band];
  const diff = Math.round(Math.abs(price - avg));
  // map ratio across a 0.85–1.15 window onto the track
  const pos = Math.max(4, Math.min(96, ((ratio - 0.85) / 0.3) * 100));
  const ringBg = isXdrive ? "#ffffff" : "#0d1117";

  const method = [
    `Average asking price of ${n} other listing${n === 1 ? '' : 's'} on XDrive for the same model,`,
    car.market_mileage_match === false
      ? 'within two years of this one, any mileage.'
      : 'within a year of this one and within 35,000 km.',
    'Asking prices, not sale prices, and only cars listed on XDrive — not the whole Malaysian market.',
  ].join(' ');

  if (thin) {
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: th.textSec, margin: 0, lineHeight: 1.6 }}>
          Similar XDrive listings average <strong style={{ color: th.text }}>RM {avg.toLocaleString("en-MY")}</strong>
          {` — but only ${n} comparable ${n === 1 ? 'car was' : 'cars were'} found, too few to call this price high or low.`}
        </p>
        <p style={{ fontSize: 11, color: th.textMuted, margin: '6px 0 0', lineHeight: 1.6 }}>{method}</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: cfg.color, letterSpacing: "0.01em", minWidth: 0, lineHeight: 1.35 }}>
          <cfg.Icon size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {cfg.label}
        </span>
        <span style={{ fontSize: 12, color: th.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>
          {band === "fair" ? "About the same" : `RM ${diff.toLocaleString("en-MY")} ${band === "below" ? "under" : "over"}`}
        </span>
      </div>
      <div style={{ position: "relative", height: 4, borderRadius: 4, background: "linear-gradient(to right, rgba(34,197,94,0.55) 0%, rgba(59,130,246,0.55) 50%, rgba(245,158,11,0.55) 100%)" }}>
        <div style={{ position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", background: cfg.color, border: `2px solid ${ringBg}`, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, color: th.textMuted, cursor: "pointer", listStyle: "none" }}>
          Average <strong style={{ color: th.textMuted }}>RM {avg.toLocaleString("en-MY")}</strong>
          {` across ${n} similar XDrive listings · how is this worked out?`}
        </summary>
        <p style={{ fontSize: 11, color: th.textMuted, margin: "6px 0 0", lineHeight: 1.6 }}>{method}</p>
      </details>
    </div>
  );
};
const fmtFinancing = (car) => {
  const pt = car.payment_type || car.financing_type;
  if (pt === "cash") return "Cash Only";
  if (pt === "sambung_bayar") return "Sambung Bayar";
  if (pt === "loan") return "Loan Available";
  return car.loan_eligible === false ? "Cash Only" : "Loan Available";
};

// A sambung bayar car isn't sold at a full price — the buyer takes over the loan —
// so the price area leads with the real monthly + upfront cash + months left + bank,
// not the (meaningless) selling_price and a bogus loan estimate.
const isSambungCar = (car) => car.payment_type === "sambung_bayar" && Number(car.sambung_monthly) > 0;

const SambungPriceBlock = ({ car, th, big }) => {
  const rm = (n) => "RM " + Number(n || 0).toLocaleString("en-MY");
  const parts = [
    Number(car.sambung_deposit) > 0 ? `${rm(car.sambung_deposit)} deposit` : null,
    Number(car.sambung_months_left) > 0 ? `${car.sambung_months_left} bulan lagi` : null,
    Number(car.sambung_balance) > 0 ? `baki ${rm(car.sambung_balance)}` : null,
    car.sambung_bank ? car.sambung_bank : null,
  ].filter(Boolean);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: big, color: th.text, lineHeight: 1, margin: 0 }}>
          {rm(car.sambung_monthly)}<span style={{ fontSize: "0.42em", letterSpacing: "0.02em" }}>/bulan</span>
        </p>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", padding: "3px 8px", borderRadius: 4 }}>
          Sambung Bayar
        </span>
      </div>
      {parts.length > 0 && (
        <p style={{ fontSize: 12, color: th.textMuted, marginTop: 6 }}>{parts.join("  ·  ")}</p>
      )}
    </div>
  );
};

/* Spec Highlights — surfaces the dealer's own feature tags as scannable chips
   right under the price. Data-backed (real car.features), capped so it stays a
   highlight, not the full list (the Features tab below holds everything). */
const SpecHighlights = ({ car, th }) => {
  const tags = parseTags(car.features).slice(0, 8);
  if (tags.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {tags.map((tag, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12, color: th.text, background: th.card2, fontWeight: 500, lineHeight: 1.25, minWidth: 0 }}>
          <Check size={13} strokeWidth={3} style={{ color: '#dc2626', flexShrink: 0 }} /> {tag}
        </span>
      ))}
    </div>
  );
};

/* Prominent warranty banner — promotes the dealer's warranty months from a thin
   line to a highlighted strip directly under the price. Real data only. */
const WarrantyBanner = ({ car, isXdrive }) => {
  if (!(car.warranty_months > 0)) return null;
  const head = isXdrive ? '#16a34a' : '#4ade80';
  const sub = isXdrive ? '#15803d' : 'rgba(74,222,128,0.75)';
  // "Drive with peace of mind" told the buyer nothing. The only warranty facts on
  // record are the month count and whether a certificate was uploaded, so say that
  // and point at the question worth asking instead of inventing reassurance.
  const hasCert = (car.car_documents || []).some((d) => d.type === 'warranty');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '11px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 10 }}>
      <ShieldCheck size={18} style={{ color: head, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: head }}>{car.warranty_months}-month warranty included</p>
        <p style={{ margin: '1px 0 0', fontSize: 11, color: sub }}>
          {hasCert
            ? 'Covered by the dealer · certificate attached under Documents'
            : 'Covered by the dealer · ask which parts and labour are included before paying a deposit'}
        </p>
      </div>
    </div>
  );
};

/* Recon trust signals — turns is_recon + import + grades into clear chips
   ("Japan Spec", "Unregistered", "Auction Grade 4.5"). */
const ReconTrust = ({ car, isXdrive }) => {
  if (!car.is_recon) return null;
  const chipBg = isXdrive ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)';
  const chipBorder = isXdrive ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.08)';
  const chipText = isXdrive ? '#0F172A' : '#e2e8f0';
  const origin = car.import_country ? `${car.import_country} Spec` : 'Recon Unit';
  const chips = [
    { label: origin },
    car.local_reg_date ? null : { label: 'Unregistered' },
    car.auction_grade ? { label: `Grade ${car.auction_grade} exterior` } : null,
    car.interior_grade ? { label: `Grade ${car.interior_grade} interior` } : null,
  ].filter(Boolean);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
      {chips.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, lineHeight: 1.25, color: chipText, background: chipBg, border: `1px solid ${chipBorder}`, minWidth: 0 }}>
          <BadgeCheck size={13} strokeWidth={2.5} style={{ color: '#dc2626', flexShrink: 0 }} /> {c.label}
        </span>
      ))}
    </div>
  );
};


const isImageUrl = (url) =>
  /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i.test(url || "");

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* Every accent on this page was picked against the dark subdomain theme. On the
   white XDrive card the same values collapse — #4ade80 on white is 1.7:1, #f87171
   is 2.9:1 — which is why the "theme leak" bugs keep reappearing one hardcode at a
   time. Same hue, darker on light, resolved at the point of use. */
const LIGHT_ACCENT = {
  '#38bdf8': '#0369a1',
  '#60a5fa': '#1d4ed8',
  '#4ade80': '#15803d',
  '#34d399': '#047857',
  '#f87171': '#dc2626',
  '#fbbf24': '#b45309',
  '#a78bfa': '#6d28d9',
  '#fb923c': '#c2410c',
  '#f59e0b': '#b45309',
  '#94a3b8': '#475569',
};
const accent = (c, isXdrive) => (isXdrive && LIGHT_ACCENT[c]) || c;

const CDP_DOC_TYPES = {
  registration_card: { label: "Geran / Registration Card", color: "#0ea5e9" },
  puspakom: { label: "Puspakom Inspection", color: "#22c55e" },
  service_history: { label: "Service History", color: "#60a5fa" },
  insurance: { label: "Insurance Certificate", color: "#a78bfa" },
  ownership: { label: "Ownership / VOC", color: "#fbbf24" },
  warranty: { label: "Warranty Certificate", color: "#34d399" },
  import_ap: { label: "Import / AP Permit", color: "#fb923c" },
  loan_clearance: { label: "Loan Clearance Letter", color: "#94a3b8" },
  other: { label: "Document", color: "#6b7280" },
};

const fmtCdpDate = (d) => { try { return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

// Buying-intent qualifier on the viewing form — lets the dealer triage serious
// buyers vs window-shoppers. Value stored on appointments.booking_type.
const BUYING_INTENT = [
  { v: 'ready', l: "I'm ready to buy now" },
  { v: 'two_weeks', l: 'Looking to buy within 2 weeks' },
  { v: 'one_month', l: 'Looking to buy within a month' },
  { v: 'browsing', l: 'Just exploring for now' },
];
const intentLabel = (v) => BUYING_INTENT.find((o) => o.v === v)?.l || '';

// Shown in the Puspakom row when the dealer logged B5/B7 inspection dates
// (a verified trust signal) even if no certificate file was uploaded.
function PuspakomDates({ b5, b7, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {b5 && <div style={{ fontSize: 12, color }}>PUSPAKOM B5 (chassis &amp; body) inspected {fmtCdpDate(b5)}</div>}
      {b7 && <div style={{ fontSize: 12, color }}>PUSPAKOM B7 (roadworthiness) certified {fmtCdpDate(b7)}</div>}
      {/* "Inspection verified by the dealer" was circular — the dealer verifying
          their own car is not verification. This branch only renders when NO
          certificate was uploaded, so the dates are a dealer's word, not a document. */}
      <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
        Dates entered by the dealer — no PUSPAKOM certificate uploaded. Ask to see it.
      </p>
    </div>
  );
}

/* Dealer identity (TRUST-2/3) — the business facts a buyer can check for
   themselves: who they are legally, where they trade from, when they are open.
   Stanford's web-credibility work puts "show the real organisation behind the
   site" first, and the page had none of it — just a name and a shield.

   Two rules here:
   - Only render what the dealer actually filled in. A row of "—" placeholders
     is worse than no block, and inventing a "trading since" would be a claim,
     not a fact.
   - Self-reported and platform-checked facts are labelled differently. Years
     trading is the dealer's own number; the verified line is XDrive's check.
   Rendered once and used at both breakpoints, deliberately: the two hardcoded
   copies of the sidebar are why the theme leaks in TRUST-8 exist. */
/* TRUST-10 — the asking price is not the amount a buyer parts with, and the page
   never said so. These are the official Malaysian transfer fees, taken from the
   same schedule the handover checklist runs on (src/utils/postSaleSteps.js), not
   estimates: JPJ pindah milik RM100, Puspakom B5 RM30, B7 RM60 when financed.
   Whether road tax and insurance land on the buyer depends on the dealer
   (profiles.handles_roadtax_insurance). A dealer may add a handling fee on top,
   which is why the total is framed as a floor, not a quote. */
const TRANSFER_FEES = [
  { label: 'JPJ ownership transfer (pindah milik)', amount: 100, always: true },
  { label: 'Puspakom B5 inspection', amount: 30, always: true },
  { label: 'Puspakom B7 inspection', amount: 60, always: false, note: 'only if you finance' },
];

function PriceIncludes({ car, dealer, th }) {
  if (!(car.selling_price > 0) || isSambungCar(car)) return null;
  const fixed = TRANSFER_FEES.filter((f) => f.always).reduce((t, f) => t + f.amount, 0);
  const dealerHandlesRti = dealer?.handles_roadtax_insurance !== false;
  const includedCount = Array.isArray(car.included_services) ? car.included_services.length : 0;

  return (
    <details style={{ marginBottom: 10 }}>
      <summary style={{ fontSize: 11.5, color: th.textSec, cursor: 'pointer', listStyle: 'none', borderBottom: `1px dotted ${th.textMuted}`, display: 'inline-block', paddingBottom: 2 }}>
        {`From RM ${fmt(fixed)} more in transfer fees · what the price covers`}
      </summary>
      <div style={{ marginTop: 10, background: th.card2, border: `1px solid ${th.border}`, borderRadius: 10, padding: '12px 13px' }}>
        <p style={{ margin: 0, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: th.textMuted, fontWeight: 700 }}>
          On top of the asking price
        </p>
        {TRANSFER_FEES.map((f) => (
          <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 7, fontSize: 12, color: th.textSec }}>
            <span style={{ minWidth: 0 }}>
              {f.label}
              {f.note && <span style={{ color: th.textMuted }}> · {f.note}</span>}
            </span>
            <span style={{ flexShrink: 0, color: th.text }}>RM {fmt(f.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 7, fontSize: 12, color: th.textSec }}>
          <span>Road tax and insurance</span>
          <span style={{ flexShrink: 0, color: th.textMuted }}>
            {dealerHandlesRti ? 'Handled by the dealer' : 'Buyer arranges'}
          </span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: th.textMuted, lineHeight: 1.6 }}>
          Official government rates. A dealer may charge a runner or handling fee on top —
          ask for the out-the-door figure in writing before you pay a deposit.
        </p>
        {includedCount > 0 && (
          <p style={{ margin: '7px 0 0', fontSize: 11, color: th.textSec, lineHeight: 1.6 }}>
            {`Already included in the asking price: ${includedCount} service${includedCount === 1 ? '' : 's'} listed under What’s Included.`}
          </p>
        )}
      </div>
    </details>
  );
}

/* The deposit ask was an 11px muted caption — the highest-anxiety moment on the
   page rendered at its lowest emphasis, with no answer to the only question that
   matters: do I get this back? Policy is per-dealer (profiles.deposit_policy).
   When the dealer has not set one we say exactly that instead of guessing a
   policy on their behalf. */
const DEPOSIT_POLICY_COPY = {
  refundable: 'Refundable if you decide not to go ahead.',
  refundable_on_loan_rejection:
    'Refunded in full if your loan is rejected. Otherwise it is held against the purchase price.',
  non_refundable: 'Non-refundable once paid.',
};

function DepositTerms({ amount, dealer, th, isXdrive }) {
  if (!(amount > 0)) return null;
  const policy = dealer?.deposit_policy || null;
  const copy = policy ? DEPOSIT_POLICY_COPY[policy] : null;
  const unstated = !copy;
  const tone = unstated
    ? { fg: isXdrive ? '#b45309' : '#fbbf24', bg: 'rgba(245,158,11,0.08)', bd: 'rgba(245,158,11,0.25)' }
    : policy === 'non_refundable'
      ? { fg: isXdrive ? '#b45309' : '#fbbf24', bg: 'rgba(245,158,11,0.08)', bd: 'rgba(245,158,11,0.25)' }
      : { fg: isXdrive ? '#15803d' : '#4ade80', bg: 'rgba(34,197,94,0.07)', bd: 'rgba(34,197,94,0.22)' };

  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 10, padding: '11px 13px', marginBottom: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: th.text }}>
        RM {fmt(amount)} deposit to reserve
      </p>
      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: tone.fg, lineHeight: 1.55 }}>
        {copy || 'This dealer has not stated whether the deposit is refundable — ask, and get the answer in writing, before you pay.'}
      </p>
      {dealer?.deposit_terms && (
        <p style={{ margin: '5px 0 0', fontSize: 11, color: th.textSec, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {dealer.deposit_terms}
        </p>
      )}
    </div>
  );
}

/* Seller rating, shown next to the name rather than three sections down the page
   — the buyer decides who they are dealing with at the price block, not after
   scrolling past Running Costs. Below the floor the count is shown WITHOUT an
   average: "5.0 from 1 review" is a single opinion formatted as a statistic. */
function SellerRating({ summary, floor, anchorId, th }) {
  if (!summary || summary.count === 0) return null;
  const { count, avg } = summary;
  const label = `${count} review${count === 1 ? '' : 's'}`;
  return (
    <a href={`#${anchorId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3, textDecoration: 'none' }}>
      {count >= floor && (
        <>
          <Star size={11} fill="#f59e0b" style={{ color: '#f59e0b', flexShrink: 0 }} strokeWidth={2} />
          <span style={{ fontSize: 11, fontWeight: 700, color: th.text }}>{avg.toFixed(1)}</span>
        </>
      )}
      <span style={{ fontSize: 11, color: th.textSec, borderBottom: `1px dotted ${th.textMuted}` }}>{label}</span>
    </a>
  );
}

// One predicate for "is there anything real to show about this dealer", shared by
// the block below and the sidebar badge that links down to it — so the link can
// never point at a section that decided not to render.
function hasDealerIdentity(dealer) {
  if (!dealer) return false;
  return !!(dealer.is_verified || dealer.ssm_number || dealer.location || dealer.city ||
    dealer.business_hours || dealer.phone || dealer.stat_years > 0);
}

function DealerIdentity({ dealer, dealerName, th, isXdrive, anchorId }) {
  if (!hasDealerIdentity(dealer)) return null;

  const addressLine = [dealer.location, [dealer.postcode, dealer.city].filter(Boolean).join(' '), dealer.state]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

  const rows = [
    dealer.ssm_number && {
      icon: Building2,
      label: 'Company registration (SSM)',
      value: dealer.ssm_number,
    },
    addressLine && {
      icon: MapPin,
      label: 'Trading address',
      value: addressLine,
      href: `https://www.google.com/maps/search/${encodeURIComponent(addressLine + ', Malaysia')}`,
      hrefLabel: 'Directions',
    },
    dealer.business_hours && {
      icon: Clock,
      label: 'Business hours',
      value: dealer.business_hours,
    },
    dealer.phone && {
      icon: Phone,
      label: 'Landline',
      value: dealer.phone,
      href: `tel:${dealer.phone}`,
      hrefLabel: 'Call',
    },
    dealer.stat_years > 0 && {
      icon: Star,
      label: 'Years trading',
      value: `${dealer.stat_years} years`,
      note: 'self-reported',
    },
  ].filter(Boolean);

  const accent = isXdrive ? '#2563eb' : '#60a5fa';

  return (
    <div id={anchorId} style={{ marginTop: 40 }}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: th.textMuted, fontWeight: 700, marginBottom: 14 }}>
        About this dealer
      </p>
      <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: 14, padding: '20px 22px' }}>
        <p style={{ fontSize: 15, color: th.text, fontWeight: 600, margin: 0 }}>{dealerName}</p>

        {dealer.is_verified && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10 }}>
            <ShieldCheck size={14} strokeWidth={2.5} style={{ color: accent, flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: th.textSec, margin: 0, lineHeight: 1.6 }}>
              Verified by XDrive — SSM certificate and the owner&apos;s IC were checked
              {dealer.verified_at ? ` on ${fmtCdpDate(dealer.verified_at)}` : ''}.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map(({ icon: Icon, label, value, note, href, hrefLabel }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Icon size={14} style={{ color: th.textMuted, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: th.textMuted, fontWeight: 700, margin: '0 0 3px' }}>
                    {label}{note ? <span style={{ fontWeight: 400, letterSpacing: '0.04em', textTransform: 'none' }}> · {note}</span> : null}
                  </p>
                  <p style={{ fontSize: 13, color: th.text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</p>
                </div>
                {href && (
                  <a href={href} target={href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer"
                    style={{ flexShrink: 0, fontSize: 11, color: accent, textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {hrefLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = (focused, th) => ({
  width: "100%",
  background: th?.inputBg ?? "rgba(255,255,255,0.03)",
  border: `1px solid ${focused ? "rgba(220,38,38,0.5)" : (th?.inputBorder ?? "rgba(255,255,255,0.08)")}`,
  borderRadius: "10px",
  padding: "10px 14px",
  color: th?.text ?? "white",
  fontSize: "13px",
  fontFamily: "system-ui, sans-serif",
  outline: "none",
  marginBottom: "8px",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
});

/* ─── skeleton ─── */
function Skeleton() {
  const isXdrive = !isSubdomain();
  const pageBg    = isXdrive ? '#F6F7F9' : '#060c14';
  const card      = isXdrive ? '#ffffff' : '#0a1220';
  const shimmerGr = isXdrive
    ? 'linear-gradient(90deg,#e7eaef 25%,#f1f3f6 50%,#e7eaef 75%)'
    : 'linear-gradient(90deg,#0a1220 25%,#111e30 50%,#0a1220 75%)';
  const border    = isXdrive ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.06)';
  const headerBg  = isXdrive ? 'rgba(246,247,249,0.9)' : 'rgba(6,12,20,0.93)';
  const mosaicGap = isXdrive ? '#e2e6ec' : '#000';

  return (
    <div style={{ background: pageBg, minHeight: '100vh' }}>
      <style>{`
        @keyframes sk-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .sk-b { background:${shimmerGr}; background-size:600px 100%; animation:sk-shimmer 1.5s infinite; border-radius:4px; }
        @media (max-width:900px) { .sk-desktop { display:none !important; } }
        @media (min-width:901px) { .sk-mobile  { display:none !important; } }
      `}</style>

      {/* Header — same on all breakpoints */}
      <div style={{ height:60, background:headerBg, borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', boxSizing:'border-box' }}>
        <div className="sk-b" style={{ width:56, height:14 }} />
        <div style={{ display:'flex', gap:8 }}>
          <div className="sk-b" style={{ width:60, height:28, borderRadius:6 }} />
          <div className="sk-b" style={{ width:80, height:28, borderRadius:6 }} />
        </div>
      </div>

      {/* ── DESKTOP (>900px) ── */}
      {/* Mosaic — matches .cdp-mosaic-grid */}
      <div className="sk-desktop" style={{ display:'grid', gridTemplateColumns:'1.65fr 1fr', gridTemplateRows:'1fr 1fr', gap:3, background:mosaicGap, height:'58vh', minHeight:400, maxHeight:660 }}>
        <div className="sk-b" style={{ gridRow:'1/3', borderRadius:0 }} />
        <div className="sk-b" style={{ borderRadius:0 }} />
        <div className="sk-b" style={{ borderRadius:0 }} />
      </div>

      {/* Body — matches .cdp-body-wrap */}
      <div className="sk-desktop" style={{ maxWidth:1280, margin:'0 auto', padding:'40px 32px', display:'flex', gap:48, alignItems:'flex-start' }}>
        {/* Left — flex 1.55 */}
        <div style={{ flex:1.55, minWidth:0 }}>
          <div className="sk-b" style={{ height:10, width:'14%', marginBottom:10 }} />
          <div className="sk-b" style={{ height:52, width:'72%', marginBottom:10 }} />
          <div className="sk-b" style={{ height:13, width:'38%', marginBottom:20 }} />
          <div className="sk-b" style={{ height:1, marginBottom:28 }} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2, border:`1px solid ${border}`, borderRadius:12, overflow:'hidden', marginBottom:32 }}>
            {[...Array(8)].map((_,i) => (
              <div key={i} className="sk-b" style={{ height:70, borderRadius:0 }} />
            ))}
          </div>
          <div className="sk-b" style={{ height:10, width:'10%', marginBottom:14 }} />
          <div className="sk-b" style={{ height:13, marginBottom:8 }} />
          <div className="sk-b" style={{ height:13, width:'88%', marginBottom:8 }} />
          <div className="sk-b" style={{ height:13, width:'74%' }} />
        </div>

        {/* Sidebar — 360px */}
        <div style={{ width:360, flexShrink:0, background:card, border:`1px solid ${border}`, borderRadius:16, padding:'28px 24px', boxSizing:'border-box' }}>
          <div className="sk-b" style={{ height:11, width:'36%', marginBottom:12 }} />
          <div className="sk-b" style={{ height:46, width:'68%', marginBottom:8 }} />
          <div className="sk-b" style={{ height:11, width:'50%', marginBottom:20 }} />
          <div className="sk-b" style={{ height:1, marginBottom:16 }} />
          <div className="sk-b" style={{ height:48, borderRadius:10, marginBottom:8 }} />
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <div className="sk-b" style={{ flex:1, height:44, borderRadius:10 }} />
            <div className="sk-b" style={{ flex:1, height:44, borderRadius:10 }} />
          </div>
          <div className="sk-b" style={{ height:1, margin:'14px 0' }} />
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div className="sk-b" style={{ width:36, height:36, borderRadius:'50%', flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div className="sk-b" style={{ height:12, width:'60%', marginBottom:6 }} />
              <div className="sk-b" style={{ height:10, width:'40%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE (≤900px) ── */}
      {/* M1 — full-width image */}
      <div className="sk-mobile sk-b" style={{ height:'clamp(200px,50vw,360px)', borderRadius:0 }} />

      {/* M2 — identity block */}
      <div className="sk-mobile" style={{ padding:'20px 20px 0' }}>
        <div className="sk-b" style={{ height:10, width:'18%', marginBottom:10 }} />
        <div className="sk-b" style={{ height:44, width:'72%', marginBottom:8 }} />
        <div className="sk-b" style={{ height:13, width:'42%', marginBottom:16 }} />
        <div className="sk-b" style={{ height:38, width:'55%', marginBottom:4 }} />
        <div className="sk-b" style={{ height:1, margin:'16px 0 20px' }} />
      </div>

      {/* M3 — 2-col stats grid */}
      <div className="sk-mobile" style={{ padding:'0 20px', marginBottom:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, border:`1px solid ${border}`, borderRadius:12, overflow:'hidden' }}>
          {[...Array(8)].map((_,i) => (
            <div key={i} className="sk-b" style={{ height:52, borderRadius:0 }} />
          ))}
        </div>
      </div>

      {/* M4 — CTA card */}
      <div className="sk-mobile" style={{ padding:'0 20px', marginBottom:24 }}>
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:'20px' }}>
          <div className="sk-b" style={{ height:48, borderRadius:10, marginBottom:8 }} />
          <div style={{ display:'flex', gap:8 }}>
            <div className="sk-b" style={{ flex:1, height:44, borderRadius:10 }} />
            <div className="sk-b" style={{ flex:1, height:44, borderRadius:10 }} />
          </div>
          <div className="sk-b" style={{ height:1, margin:'14px 0' }} />
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div className="sk-b" style={{ width:32, height:32, borderRadius:'50%', flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div className="sk-b" style={{ height:12, width:'55%', marginBottom:6 }} />
              <div className="sk-b" style={{ height:10, width:'38%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── structured data ─── */
function useCarSchema(listing, dealer) {
  useEffect(() => {
    if (!listing) return;
    const name = [listing.year, listing.brand, listing.model, listing.variant]
      .filter(Boolean)
      .join(" ");
    const schema = {
      "@context": "https://schema.org",
      "@type": "Car",
      name,
      description: listing.specs || listing.description || undefined,
      brand: { "@type": "Brand", name: listing.brand },
      model: listing.model,
      vehicleModelDate: String(listing.year ?? ""),
      vehicleConfiguration: listing.variant ?? undefined,
      bodyType: listing.body_type ?? undefined,
      vehicleTransmission: listing.transmission ?? undefined,
      fuelType: listing.fuel_type ?? undefined,
      color: listing.colour ?? undefined,
      mileageFromOdometer: listing.mileage
        ? {
            "@type": "QuantitativeValue",
            value: listing.mileage,
            unitCode: "KMT",
          }
        : undefined,
      image: listing.images ?? undefined,
      url: dealer?.subdomain
        ? `https://${dealer.subdomain}.xdrive.my/cars/${listing.slug}`
        : `https://xdrive.my/showroom/${listing.slug}`,
      offers: {
        "@type": "Offer",
        price: listing.selling_price,
        priceCurrency: "MYR",
        availability:
          listing.status === "available"
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        itemCondition: listing.is_recon
          ? "https://schema.org/RefurbishedCondition"
          : "https://schema.org/UsedCondition",
        seller: dealer
          ? { "@type": "Organization", name: dealer.site_name || dealer.dealership }
          : undefined,
      },
    };
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "car-schema";
    el.textContent = JSON.stringify(JSON.parse(JSON.stringify(schema)));
    document.head.appendChild(el);
    return () => {
      document.getElementById("car-schema")?.remove();
    };
  }, [listing?.id, dealer?.id]);
}

/* Compact horizontal strip of small vertical cards (image + name + price).
   Used for "More From This Seller" — minimal info, clean, Carlist-style. */
function SellerStrip({ cars, title, th }) {
  const navigate = useNavigate();
  if (!cars || cars.length === 0) return null;
  const go = (c) => {
    if (!(c.slug || c.id)) return;
    navigate((isSubdomain() ? "/cars/" : "/showroom/") + (c.slug || c.id));
  };
  return (
    <div>
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.2rem", letterSpacing: "0.06em", color: th.text, margin: "0 0 16px", borderLeft: "3px solid #dc2626", paddingLeft: "12px" }}>
        {title}
      </h2>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", paddingBottom: 4, scrollSnapType: "x mandatory" }}>
        {cars.map((c) => {
          const img   = cdnImg(Array.isArray(c.images) ? c.images[0] : null, 400, 70);
          const name  = [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ");
          const price = c.selling_price ? "RM " + Number(c.selling_price).toLocaleString("en-MY") : "P.O.R";
          return (
            <button key={c.id} onClick={() => go(c)} style={{ flexShrink: 0, width: 152, scrollSnapAlign: "start", textAlign: "left", background: th.card, border: `1px solid ${th.border}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", padding: 0, fontFamily: "system-ui, sans-serif" }}>
              <div style={{ position: "relative", aspectRatio: "4 / 3", background: th.card2 }}>
                {img && <img src={img} alt={name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                {c.is_recon && (
                  <span style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 6, background: "rgba(109,40,217,0.92)", color: "#fff" }}>RECON</span>
                )}
              </div>
              <div style={{ padding: "8px 9px 10px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: th.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 31 }}>{name}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: th.text, letterSpacing: "-0.01em" }}>{price}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── main ─── */
export default function CarDetailPage() {
  const isXdrive = !isSubdomain();
  useMarketplaceTracking(isXdrive);

  /* ── Light-theme colour tokens (xdrive.my only) ── */
  const th = isXdrive ? {
    pageBg:    '#F6F7F9',
    card:      '#ffffff',
    card2:     '#EEF1F5',
    text:      '#0F172A',
    textSec:   '#475569',
    textMuted: '#64748b',
    border:    'rgba(15,23,42,0.08)',
    borderSec: 'rgba(15,23,42,0.05)',
    inputBg:   '#ffffff',
    inputBorder:'rgba(15,23,42,0.12)',
    shimmer:   'linear-gradient(90deg,#e7eaef 25%,#f1f3f6 50%,#e7eaef 75%)',
  } : {
    pageBg:    '#060c14',
    card:      '#0a1220',
    card2:     '#09111f',
    text:      '#e2e8f0',
    textSec:   '#94a3b8',
    textMuted: '#64748b',
    border:    'rgba(255,255,255,0.07)',
    borderSec: 'rgba(255,255,255,0.04)',
    inputBg:   'rgba(255,255,255,0.05)',
    inputBorder:'rgba(255,255,255,0.12)',
    shimmer:   'linear-gradient(90deg,#0a1220 25%,#111e30 50%,#0a1220 75%)',
  };

  const { slug } = useParams();
  const navigate = useNavigate();
  const [reviewSummary, setReviewSummary] = useState(null);
  const handleReviewSummary = React.useCallback((next) => {
    setReviewSummary((prev) =>
      prev && prev.count === next.count && prev.avg === next.avg ? prev : next,
    );
  }, []);

  // Smart back: React Router stamps history.state.idx = 0 on a fresh landing
  // (shared link / new tab, no in-app history) and increments it as the user
  // navigates within the app. So idx > 0 means there's a real previous page to
  // return to; idx 0 (or missing) means they arrived cold -> send them to the
  // marketplace front page instead of leaving the site.
  const handleBack = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate('/');
  };

  const [car, setCar] = useState(null);
  const [dealer, setDealer] = useState(null);
  const ctaCtx = useCTAContext();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [similarCars, setSimilarCars] = useState([]);
  const [sellerCars, setSellerCars] = useState([]);
  const [salesmanProfile, setSalesmanProfile] = useState(null);

  /* gallery */
  const [activeIdx, setActiveIdx] = useState(0);
  const [slideDir, setSlideDir] = useState("next");
  const [slideKey, setSlideKey] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgLoaded(false);
  }, [slideKey]);

  /* sticky title */
  const [showTitle, setShowTitle] = useState(false);
  const heroRef = useRef(null);
  const autoRef = useRef(null);

  /* current user — used to suppress booking button on own listings */
  const [currentUserId, setCurrentUserId] = useState(null);
  // The signed-in buyer's saved name/phone (from their account — set in
  // AccountPage "Your Details"). Used to pre-fill the enquiry and booking forms
  // so the "we pre-fill these so you don't retype" promise holds across devices,
  // not just from this device's remembered details.
  const [buyerProfile, setBuyerProfile] = useState(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const uid = data?.session?.user?.id || null;
      setCurrentUserId(uid);
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles").select("full_name, phone").eq("id", uid).maybeSingle();
      if (active && prof) setBuyerProfile({ id: uid, ...prof });
    });
    return () => { active = false; };
  }, []);

  /* booking */
  const [form, setForm] = useState({
    name: "",
    phone: "+60",
    date: "",
    time: "",
    timeline: "",
    notes: "",
    state: "",
  });
  const [focusedField, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showReservedPopup, setShowReservedPopup] = useState(false);
  const [bookingConsent, setBookingConsent] = useState({ appear: true, whatsapp: true });
  const [legalDoc, setLegalDoc] = useState(null);
  const bookingRef = useRef(null);

  /* enquiry modal */
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: "", phone: "", state: "" });
  const [enquiryToken, setEnquiryToken] = useState(null);
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);
  // Who this enquiry is aimed at. null = the listing's default contact (dealer,
  // else the listing's agent). Set to { phone, slug, name } by the salesman
  // card's "Chat with X" button so the buyer reaches THAT rep and the lead is
  // attributed to them via ref_slug (resolve_lead_salesman rule 2).
  const [enquiryTarget, setEnquiryTarget] = useState(null);
  // Call button is async now (number is fetched on tap, never shipped with the
  // page) — guard against double-taps while the request is in flight.
  const [callLoading, setCallLoading] = useState(false);

  /* view count */
  const [viewCount, setViewCount] = useState(0);

  /* calculator */
  const [calcOpen, setCalcOpen] = useState(false);

  /* share */
  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = async () => {
    const url = window.location.href;
    const title = carTitle;
    const infoLines = [
      car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString('en-MY')}` : null,
      car?.mileage       ? `${Number(car.mileage).toLocaleString('en-MY')} km`        : null,
      [car?.city, car?.state].filter(Boolean).join(', ') || null,
      car?.body_type     || null,
      car?.transmission  || null,
    ].filter(Boolean);
    const text = `${title}\n${infoLines.join(' · ')}`;

    /* attribute share to the listing's dealer/agent */
    trackEvent(supabase, 'share', {
      car_id:       car?.id,
      dealer_id:    car?.dealer_id,
      salesman_slug: car?.salesman_slug || null,
      metadata: { brand: car?.brand, model: car?.model, year: car?.year, price: car?.selling_price },
    });

    if (navigator.share) {
      /* try with thumbnail */
      const thumb = car?.images?.[0];
      if (thumb && !thumb.startsWith('/') && typeof navigator.canShare === 'function') {
        try {
          const resp = await fetch(thumb);
          const blob = await resp.blob();
          const file = new File([blob], 'car.jpg', { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title, text: infoLines.join(' · '), url, files: [file] });
            return;
          }
        } catch {} // CORS or unsupported — fall through
      }
      try { await navigator.share({ title, text, url }); return; } catch {}
    }

    /* clipboard fallback */
    try {
      await navigator.clipboard.writeText(`${title}\n${infoLines.join(' · ')}\n${url}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {} // clipboard blocked (page unfocused / no permission) — nothing to recover
  };

  /* document accordion */
  const [openDocKey, setOpenDocKey] = useState(null);
  const toggleDoc = (key) => setOpenDocKey(prev => prev === key ? null : key);

  /* fuel range calculator */
  const [fuelDist, setFuelDist] = useState(250);

  /* detail tabs — default to "What You Get" the instant a car with included
     perks loads, since that's the highest-value info on the page and was
     previously buried below the specs tabs (the original complaint: buyers
     had to scroll well past the fold to find it). */
  const [detailTab, setDetailTab] = useState("specs");
  const detailTabDefaultedRef = useRef(false);
  useEffect(() => {
    if (detailTabDefaultedRef.current) return;
    if (Array.isArray(car?.included_services) && car.included_services.length > 0) {
      setDetailTab("included");
      detailTabDefaultedRef.current = true;
    }
  }, [car?.id]);

  /* lightbox */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPan, setLbPan] = useState({ x: 0, y: 0 });
  const lbDrag = useRef({ active: false, ox: 0, oy: 0 });
  const lbOpenRef = useRef(false);
  const lbTouch = useRef({ startX: 0, startY: 0 });
  const pauseRef = useRef(false);
  const resumeTimer = useRef(null);
  const galleryTouch = useRef({ startX: 0, startY: 0 });
  // Set when a touch turns out to be a swipe, so the trailing click (which fires
  // on touchend) doesn't also open the lightbox — tap opens, swipe changes slide.
  const gallerySwiped = useRef(false);

  function closeLb() {
    setLbOpen(false);
    setLbZoom(1);
    setLbPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    lbOpenRef.current = lbOpen;
    if (!lbOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLb();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbOpen]);

  function lbWheel(e) {
    e.preventDefault();
    setLbZoom((z) => Math.min(5, Math.max(0.5, z - e.deltaY * 0.0012)));
  }
  function lbMouseDown(e) {
    e.preventDefault();
    lbDrag.current = {
      active: true,
      ox: e.clientX - lbPan.x,
      oy: e.clientY - lbPan.y,
    };
  }
  function lbMouseMove(e) {
    if (!lbDrag.current.active) return;
    setLbPan({
      x: e.clientX - lbDrag.current.ox,
      y: e.clientY - lbDrag.current.oy,
    });
  }
  function lbMouseUp() {
    lbDrag.current.active = false;
  }

  function lbTouchStart(e) {
    lbTouch.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
  }
  function lbTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - lbTouch.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - lbTouch.current.startY);
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return;
    const dir = dx < 0 ? "next" : "prev";
    setSlideDir(dir);
    setSlideKey((k) => k + 1);
    setLbZoom(1);
    setLbPan({ x: 0, y: 0 });
    setActiveIdx((prev) => {
      const len = car?.images?.length || 1;
      return dir === "next" ? (prev + 1) % len : (prev - 1 + len) % len;
    });
  }

  useEffect(() => {
    captureRef();
  }, []);

  /* ── fetch ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      // seller_role (from the public_car_listings view) is the authoritative signal
      // for agent-vs-dealer below — without it in the select, carData.seller_role is
      // always undefined and the get_salesman_by_id lookup never fires, so a Salesman
      // Lite listing silently falls through to a nameless "Seller" with no mini-page link.
      const PUBLIC_FIELDS = "id,brand,model,variant,year,state,mileage,colour,condition,registration_date,specs,options,features,selling_price,images,created_at,transmission,city,body_type,fuel_type,status,engine_cc,previous_price,original_price,dealer_id,vin_number,auction_grade,interior_grade,is_recon,import_country,damage_map,local_reg_date,auction_house,chassis_status,assigned_to,slug,plate_number,video_url,salesman_slug,car_documents,previous_owners,road_tax_expiry,loan_eligible,warranty_months,deposit_amount,ai_captions,financing_type,dealer_perks,canonical_variant,description,included_services,included_services_cost,vin,co2_emissions,fuel_consumption,insurance_group,horsepower,acceleration,top_speed,boot_size,doors,seats,safety_rating,cylinders,market_avg_price,market_sample_count,puspakom_b5_date,puspakom_b7_date,seller_role,payment_type,sambung_monthly,sambung_months_left,sambung_balance,sambung_deposit,sambung_bank,docs_verified,geran_status,condition_declared_at";
      let { data: carData, error } = await supabase
        .from("public_car_listings")
        .select(PUBLIC_FIELDS)
        .eq("slug", slug)
        .maybeSingle();
      if (!carData && !error) {
        const res = await supabase
          .from("public_car_listings")
          .select(PUBLIC_FIELDS)
          .eq("id", slug)
          .maybeSingle();
        carData = res.data;
        error = res.error;
      }
      if (error || !carData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fire analytics immediately — no need to block page load on it
      const refSlug = getRef();
      if (refSlug && carData.dealer_id) {
        supabase
          .from("analytics_events")
          .insert({
            event_type: "page_view",
            salesman_slug: refSlug,
            dealer_id: carData.dealer_id,
            metadata: { page: window.location.pathname },
          })
          .then(() => {});
      }

      const simFields =
        "id, slug, year, brand, model, variant, selling_price, original_price, mileage, transmission, state, fuel_type, status, created_at, images, is_recon, auction_grade, interior_grade, import_country, car_documents";

      const [visibleServices, dealerData, salesmanData, similarCarsData, sellerCarsData] =
        await Promise.all([
          // Filter included_services against active dealer_products
          (async () => {
            let services = carData.included_services || [];
            if (carData.dealer_id && services.length > 0) {
              const { data: activeProducts } = await supabase
                .from("dealer_products")
                .select("id, is_active")
                .eq("dealer_id", carData.dealer_id);
              if (activeProducts && activeProducts.length > 0) {
                const activeIds = new Set(
                  activeProducts
                    .filter((p) => p.is_active !== false)
                    .map((p) => p.id),
                );
                services = services.filter((s) => !s.id || activeIds.has(s.id));
              }
            }
            return services;
          })(),

          // Dealer profile — via SECURITY DEFINER RPC so anonymous marketplace
          // visitors get it (the public_dealer_profiles view is RLS-blocked for anon)
          carData.dealer_id
            ? supabase
                .rpc("get_dealer_profile_by_id", { p_dealer_id: carData.dealer_id })
                .maybeSingle()
                .then((r) => r.data)
            : Promise.resolve(null),

          // Salesman/agent profile — via SECURITY DEFINER RPC (get_salesman_by_id)
          // so anonymous visitors get it; the direct profiles query was RLS-blocked
          // for anon, which made standalone agents (Salesman Lite, dealer_id = own id)
          // silently render as a nameless "dealer" with no mini-page link. Keyed by
          // dealer_id (the agent's own profile id — see getDealerIdFromProfile), not
          // salesman_slug, which isn't reliably stamped on every listing row.
          // seller_role (from public_car_listings) is the authoritative signal for
          // whether this dealer_id belongs to a salesman.
          carData.seller_role === "salesman" && carData.dealer_id
            ? supabase
                .rpc("get_salesman_by_id", { p_id: carData.dealer_id })
                .maybeSingle()
                .then((r) => r.data)
            : Promise.resolve(null),

          // Similar cars (2-step chain internally)
          (async () => {
            let similar = [];
            if (carData.dealer_id) {
              const { data } = await supabase
                .from("public_car_listings")
                .select(simFields)
                .eq("dealer_id", carData.dealer_id)
                .eq("brand", carData.brand)
                .in("status", ["available", "reserved"])
                .neq("id", carData.id)
                .order("created_at", { ascending: false })
                .limit(6);
              similar = data || [];
            }
            if (similar.length < 3) {
              const seen = new Set([carData.id, ...similar.map((c) => c.id)]);
              const { data } = await supabase
                .from("public_car_listings")
                .select(simFields)
                .eq("brand", carData.brand)
                .in("status", ["available", "reserved"])
                .neq("id", carData.id)
                .order("created_at", { ascending: false })
                .limit(9);
              similar = [
                ...similar,
                ...(data || []).filter((c) => !seen.has(c.id)),
              ].slice(0, 6);
            }
            return similar;
          })(),

          // More from this seller — the dealer's other live listings (any brand),
          // newest first. Only fetched when the listing has a dealer_id.
          carData.dealer_id
            ? supabase
                .from("public_car_listings")
                .select(simFields)
                .eq("dealer_id", carData.dealer_id)
                .in("status", ["available", "reserved"])
                .neq("id", carData.id)
                .order("created_at", { ascending: false })
                .limit(12)
                .then((r) => r.data || [])
            : Promise.resolve([]),
        ]);

      setCar({ ...carData, included_services: visibleServices });
      setDealer(dealerData);
      setSalesmanProfile(salesmanData);
      setSimilarCars(similarCarsData);
      setSellerCars(sellerCarsData);
      setLoading(false);

      // Fire the mileage-aware market avg in the background.
      // The view already provides a rough bucket avg; this overwrites it
      // with a precise result (year ±1, mileage ±35 000 km, condition-matched).
      if (carData?.id) {
        supabase
          .rpc('compute_market_avg', { p_car_id: carData.id })
          .then(({ data }) => {
            const r = data?.[0];
            if (r?.avg_price) {
              setCar((prev) => prev ? {
                ...prev,
                market_avg_price: r.avg_price,
                market_sample_count: r.sample_count,
                // Whether the comparison set was mileage-matched, or had to fall
                // back to year +-2 with no mileage filter. The verdict looked
                // identical either way until now.
                market_mileage_match: r.mileage_match,
              } : prev);
            }
          });
      }
    }
    load();
  }, [slug]);

  useCarSchema(car, dealer);

  useEffect(() => {
    if (!car) return;
    trackEvent(supabase, "car_view", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      salesman_slug: getSlugFromURL() || car.salesman_slug || salesmanProfile?.slug || null,
      page_path: window.location.pathname,
      metadata: { price: car.selling_price, colour: car.colour },
    });
  }, [car?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!car?.id) return;
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("car_id", car.id)
      .eq("event_type", "car_view")
      .then(({ count }) => {
        if (count != null) setViewCount(count);
      });
  }, [car?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!car) return;
    const imgs = car?.images?.length ? car.images : [];
    if (imgs.length <= 1) return;
    autoRef.current = setInterval(() => {
      if (lbOpenRef.current || pauseRef.current) return;
      setSlideDir("next");
      setSlideKey((k) => k + 1);
      setActiveIdx((i) => (i + 1) % imgs.length);
    }, 5000);
    return () => clearInterval(autoRef.current);
  }, [car]);

  // Preload next 2 images so the slide never shows an unloaded frame
  const preloadedSet = useRef(new Set());
  useEffect(() => {
    const imgs = car?.images;
    if (!imgs?.length) return;
    [(activeIdx + 1) % imgs.length, (activeIdx + 2) % imgs.length].forEach((i) => {
      if (preloadedSet.current.has(i)) return;
      preloadedSet.current.add(i);
      const img = new Image();
      img.src = imgs[i];
    });
  }, [activeIdx, car]);

  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => setShowTitle(!e.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, [car]);

  function go(idx, dir) {
    pauseRef.current = true;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      pauseRef.current = false;
    }, 4000);
    setSlideDir(dir);
    setSlideKey((k) => k + 1);
    setActiveIdx(idx);
    setLbZoom(1);
    setLbPan({ x: 0, y: 0 });
  }

  function galleryTouchStart(e) {
    galleryTouch.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
  }
  function galleryTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - galleryTouch.current.startX;
    const dy = Math.abs(
      e.changedTouches[0].clientY - galleryTouch.current.startY,
    );
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return;
    gallerySwiped.current = true;
    const dir = dx < 0 ? "next" : "prev";
    const len = car?.images?.length || 1;
    go(
      dir === "next" ? (activeIdx + 1) % len : (activeIdx - 1 + len) % len,
      dir,
    );
  }

  function handleWhatsApp(target) {
    // Most call sites are onClick={handleWhatsApp}, so the first arg is a
    // MouseEvent — only treat it as a target when it actually carries a phone.
    setEnquiryTarget(target && typeof target === "object" && target.phone ? target : null);
    // Prefill from device-remembered details (preferences consent tier; returns
    // null when not granted) first, then fall back to the signed-in buyer's
    // saved account details so a logged-in buyer never retypes — even on a
    // fresh device. Only fills empty gaps; never overwrites what's typed.
    const saved = loadBuyerDetails() || {};
    setEnquiryForm((p) => ({
      name: p.name || saved.name || buyerProfile?.full_name || "",
      phone: p.phone || saved.phone || buyerProfile?.phone || "",
      state: p.state || saved.state || "",
    }));
    setShowEnquiryModal(true);
  }

  function handleBookingClick() {
    if (car?.status === 'reserved') {
      setShowReservedPopup(true);
      return;
    }
    trackEvent(supabase, 'booking_click', { car_id: car.id, car_name: `${car.brand} ${car.model} ${car.year}`, dealer_id: car.dealer_id, metadata: { source: 'car_detail' } });
    // Pre-fill name/phone from device-remembered details, then the signed-in
    // buyer's saved account details — same promise as the enquiry form. Fills
    // only empty gaps ("+60" counts as empty phone); never clobbers typed input.
    const saved = loadBuyerDetails() || {};
    setForm((f) => ({
      ...f,
      name: f.name || saved.name || buyerProfile?.full_name || "",
      phone: (f.phone && f.phone !== "+60" ? f.phone : (saved.phone || buyerProfile?.phone || "+60")),
    }));
    setBooked(false);
    setBookingConsent({ appear: true, whatsapp: true });
    setShowBookingModal(true);
  }

  // The call number is deliberately NOT part of the page payload — it is fetched
  // on tap from /api/call-number, which resolves the seller responsible for THIS
  // listing (the assigned rep, else the dealer) and prefers profiles.phone over
  // the WhatsApp number. Keeping it off the page means there is nothing for a
  // scraper to lift out of the HTML, and the endpoint is rate-limited per IP.
  async function handleCall() {
    if (callLoading) return;
    setCallLoading(true);
    trackEvent(supabase, "call_click", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      salesman_slug: getSlugFromURL() || car.salesman_slug || salesmanProfile?.slug || null,
      metadata: { source: "car_detail" },
    });
    try {
      const res = await fetch("/api/call-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: car.id }),
      });
      const data = await res.json().catch(() => ({}));
      const phone = String(data.phone || "").replace(/\D/g, "");
      if (!res.ok || !phone) {
        toast.error(
          res.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "This seller hasn't added a phone number yet. Try WhatsApp instead.",
        );
        return;
      }
      window.location.href = `tel:+${phone}`;
    } catch (err) {
      console.error("[handleCall]", err);
      toast.error("Couldn't reach the seller right now. Try WhatsApp instead.");
    } finally {
      setCallLoading(false);
    }
  }

  function handleEnquirySubmit() {
    // Open WhatsApp immediately — must happen synchronously in the click handler
    // before any await, otherwise popup blockers will intercept window.open.
    const message = `Hi, I'm ${enquiryForm.name}. I'm interested in the ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""} listed at RM ${car.selling_price?.toLocaleString()}.`;
    // A targeted enquiry ("Chat with <agent>") must reach THAT agent, not the
    // dealer's main line that buildWaUrl would otherwise prefer.
    const targetPhone = enquiryTarget?.phone?.replace(/\D/g, "") || null;
    const waUrl = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`
      : buildWaUrl(ctaCtx, contactPhone, message);
    // buildWaUrl returns '#' when no phone is resolvable — opening that just
    // reloads the current page in a new tab, so guard against it.
    if (waUrl && waUrl !== "#") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.error("This dealer hasn't added a WhatsApp number yet. We've saved your enquiry instead.");
    }
    // Remember on this device for next time (no-ops without preferences consent).
    saveBuyerDetails({ name: enquiryForm.name, phone: enquiryForm.phone, state: enquiryForm.state });
    setShowEnquiryModal(false);
    setEnquiryForm({ name: "", phone: "", state: "" });

    // Fire analytics + backend record non-blocking after WhatsApp is already open
    trackEvent(supabase, "whatsapp_click", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      salesman_slug: enquiryTarget?.slug || getSlugFromURL() || car.salesman_slug || salesmanProfile?.slug || null,
      metadata: { source: "storefront", price: car.selling_price },
    });
    // /api/enquiry records the enquiry + creates the pipeline lead DB-side (via
    // the enquiry_to_lead trigger on whatsapp_enquiries) behind the Turnstile
    // gate. Do NOT also call create_lead_from_whatsapp directly here — that
    // produced a duplicate lead per enquiry.
    fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carId: car.id,
        name: enquiryForm.name,
        phone: enquiryForm.phone,
        state: enquiryForm.state || null,
        // The targeted agent wins over the ?ref= that brought the buyer here —
        // they tapped that rep's own button. The slug is stored on the enquiry
        // row and resolved DB-side by enquiry_to_lead -> resolve_lead_salesman.
        refSlug: enquiryTarget?.slug || getRef() || car.salesman_slug || null,
        token: enquiryToken,
      }),
    }).catch((err) => console.error("[handleEnquirySubmit] fetch error:", err));
    setEnquiryToken(null);
    setEnquiryTarget(null);
  }

  async function handleBook(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const [h, m] = form.time.split(":");
    const dt = new Date(`${form.date}T${h.padStart(2, "0")}:${m}:00`);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: car.id,
          dealerId: car.dealer_id,
          assignedTo: car.assigned_to || null,
          name: form.name,
          phone: form.phone,
          state: form.state || null,
          appointmentDate: dt.toISOString(),
          bookingType: form.timeline || null,
          notes: form.notes || null,
          // Same fallback chain the enquiry path uses. Without car.salesman_slug
          // a booking on an agent's listing with no ?ref= lost that attribution
          // hop and leaned on assigned_to alone.
          refSlug: getRef() || car.salesman_slug || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          alert("Too many bookings. Please wait a moment and try again.");
        } else {
          console.error("[handleBook]", data.error);
          alert("Booking failed. Please try again.");
        }
        setSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("[handleBook] fetch error:", err);
      alert("Booking failed. Please try again.");
      setSubmitting(false);
      return;
    }
    // Fire Telegram notification to dealer (non-blocking)
    supabase.from("profiles").select("telegram_bot_token,telegram_channel_id,dealership")
      .eq("id", car.dealer_id).maybeSingle()
      .then(({ data: dp }) => {
        if (!dp?.telegram_bot_token || !dp?.telegram_channel_id) return;
        const dateStr = dt.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" });
        const timeStr = dt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
        const stateStr = form.state ? ` (${form.state})` : "";
        const intentStr = form.timeline ? `\n🎯 ${intentLabel(form.timeline)}` : "";
        const msg = `🗓️ New Booking!\n\n*${form.name}*${stateStr} booked a viewing for the *${car.brand} ${car.model} ${car.year}*\n\n📅 ${dateStr} · ${timeStr}\n📞 ${form.phone}${intentStr}${form.notes ? `\n💬 "${form.notes}"` : ""}`;
        fetch(`https://api.telegram.org/bot${dp.telegram_bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: dp.telegram_channel_id, text: msg, parse_mode: "Markdown" }),
        }).catch(() => {});
      });
    setSubmitting(false);
    setBooked(true);
    setBookingConsent({ appear: true, whatsapp: true });
  }

  /* ── early returns ── */
  if (loading) return <Skeleton />;
  if (notFound)
    return (
      <div
        style={{
          background: "#060c14",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <p style={{ fontSize: 15, color: th.textMuted, marginBottom: 20 }}>
          This listing is no longer available.
        </p>
        <Link
          to="/showroom"
          style={{ color: "#dc2626", fontSize: 13, textDecoration: "none" }}
        >
          ← Browse all cars
        </Link>
      </div>
    );

  const images = car.images?.length ? car.images : ["/placeholder-car.jpg"];
  // Resized WebP for the on-page gallery (full-res is kept for the lightbox zoom).
  const disp = (u, w = 1280) => cdnImg(u, w, 72);
  const onImgErr = (orig) => (e) => {
    if (orig && !e.currentTarget.dataset.fb && e.currentTarget.src !== orig) {
      e.currentTarget.dataset.fb = '1';
      e.currentTarget.src = orig;
    } else {
      e.currentTarget.src = '/placeholder-car.jpg';
    }
  };
  const contactPhone =
    dealer?.whatsapp_number || salesmanProfile?.whatsapp_number || null;
  const isOwnListing = !!currentUserId && (
    currentUserId === car.dealer_id || currentUserId === car.assigned_to
  );
  const isRecon = car.is_recon;
  // Condition report. An empty damage map on its own means nothing — it is only
  // "no visible damage" once the dealer has declared the walkaround
  // (car_listings.condition_declared_at), otherwise it is "never inspected" and
  // we show nothing rather than imply a clean car.
  const damageMarks = Array.isArray(car.damage_map) ? car.damage_map : [];
  const conditionDeclaredAt = car.condition_declared_at || null;
  const showConditionMap = damageMarks.length > 0 || !!conditionDeclaredAt;
  const conditionSummary = damageMarks.length > 0
    ? `Dealer marked ${damageMarks.length} area${damageMarks.length > 1 ? 's' : ''} of damage on this car.`
    : 'Dealer walked around this car and found no visible damage.';
  const conditionDeclaredOn = conditionDeclaredAt
    ? new Date(conditionDeclaredAt).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' })
    : null;
  const isReserved = car.status === 'reserved';
  const isHot =
    car.original_price &&
    car.original_price > 0 &&
    car.selling_price > 0 &&
    car.selling_price <= car.original_price * 0.97;
  const saving = isHot ? car.original_price - car.selling_price : 0;
  const hasDocuments =
    (Array.isArray(car.car_documents) && car.car_documents.length > 0) ||
    !!(car.puspakom_b5_date || car.puspakom_b7_date);
  // Only claim "Verified" when a superadmin actually reviewed the paperwork;
  // otherwise the badge honestly reads "Docs on File" (a file merely exists).
  const docsVerified = !!car.docs_verified;
  const carTitle = `${car.year} ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""}`;
  // Display nameplate: model, then trim, then engine size (derived from cc so it
  // reads "6.5L" not the raw "6.5" baked into the variant), then year — e.g.
  // "812 Superfast 6.5L 2021". The variant often carries a leading displacement
  // ("6.5 Superfast"); strip it when we already show the litre token to avoid
  // "6.5 Superfast 6.5L".
  const engineL = car.engine_cc ? (car.engine_cc / 1000).toFixed(1) : null;
  // Uploaded model/variant strings very often already bake in the displacement
  // ("HARRIER 2.0L", "2.5L Z", "300 2.0L(T)", "6.5 Superfast"), so appending the
  // derived litre rendered the engine size twice. Only append it when neither the
  // model nor the variant already states a displacement (any "d.d" token).
  const mentionsDisplacement = /\d\.\d/.test(`${car.model || ""} ${car.variant || ""}`);
  const showEngineL = engineL && !mentionsDisplacement;
  const nameplate = [car.model, car.variant, showEngineL ? `${engineL}L` : "", car.year]
    .filter(Boolean).join(" ")
    // Non-breaking hyphen so multi-part trims ("TYPE-R", "CX-5") don't split
    // across lines mid-word in the big display nameplate.
    .replace(/-/g, "‑");
  const dealerName =
    dealer?.site_name || dealer?.dealership || dealer?.full_name || "Dealer";
  // Seller mini-page link: dealer subdomain/slug, or the standalone agent's /s/slug.
  // Standalone agents (Salesman Lite) have no dealer profile, so without this their
  // listing showed no "Visit page" link at all.
  const sellerPageUrl = dealer?.subdomain
    ? `https://${dealer.subdomain}.xdrive.my`
    : dealer?.slug
      ? `https://xdrive.my/s/${dealer.slug}`
      : salesmanProfile?.slug
        ? `https://xdrive.my/s/${salesmanProfile.slug}`
        : null;
  const sellerPageLabel = salesmanProfile && !dealer ? "Visit Agent's Page" : "Visit Dealer's Page";
  // The sidebar had two green buttons opening the SAME enquiry modal — a generic
  // "WhatsApp" and a "Chat with <rep>" — differing only in which rep the resulting
  // lead was attributed to. One button now does both jobs: it carries the rep's
  // routing target and is named after them, so the buyer knows who answers.
  // Review tally, lifted out of ReviewsSection so it can sit beside the seller's
  // name. Below REVIEW_FLOOR the average is withheld: an average of one review is
  // a single stranger's opinion wearing the clothes of a statistic.
  const REVIEW_FLOOR = 3;
  const repFirstName = (salesmanProfile?.full_name || '').trim().split(' ')[0] || null;
  const repEnquiryTarget = (() => {
    const digits = (salesmanProfile?.whatsapp_number || '').replace(/\D/g, '');
    if (!digits) return null;
    return {
      phone: digits.startsWith('6') ? digits : '6' + digits,
      slug: salesmanProfile.slug,
      name: repFirstName || 'Agent',
    };
  })();
  const enquiryClick = repEnquiryTarget ? () => handleWhatsApp(repEnquiryTarget) : handleWhatsApp;
  const enquiryLabel = repFirstName ? `WhatsApp ${repFirstName}` : 'WhatsApp';
  const listedDays = daysAgo(car.created_at);
  // A booking is submittable only once a real slot is chosen and both consent
  // boxes are ticked — the commitment gate.
  const bookReady = bookingConsent.appear && bookingConsent.whatsapp && !!form.date && !!form.time;
  const imgCount = images.length;
  const prevIdx = (activeIdx - 1 + imgCount) % imgCount;
  const nextIdx = (activeIdx + 1) % imgCount;
  const siteName = dealer?.site_name || dealer?.dealership || "XDrive";
  // Chassis/generation code (e.g. "G82") so buyers searching "m4 g82" match us.
  const chassis = car ? getChassisCode(car.brand, car.model, car.year, car.variant) : null;
  const chassisSuffix = chassis ? ` (${chassis})` : "";

  return (
    <>
      <Helmet>
        <title>
          {car
            ? `${car.year} ${car.brand} ${car.model}${chassisSuffix} for sale in Malaysia | ${siteName}`
            : `Car Listing | ${siteName}`}
        </title>
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        {(() => {
          const desc = car
            ? `${car.year} ${car.brand} ${car.model}${car.variant ? ` ${car.variant}` : ""}${chassisSuffix} for sale${car.state ? ` in ${car.state}` : ' in Malaysia'}. RM ${Number(car.selling_price).toLocaleString("en-MY")}. ${car.mileage ? `${Number(car.mileage).toLocaleString("en-MY")}km` : ""}${car.transmission ? `, ${car.transmission}` : ""}${car.fuel_type ? `, ${car.fuel_type}` : ""}. Verified dealer on XDrive.`
            : "";
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://xdrive.my';
          const img = car?.images?.[0] || `${origin}/og-default.jpg`;
          const url = car
            ? (dealer?.subdomain
                ? `https://${dealer.subdomain}.xdrive.my/cars/${car.slug}`
                : `https://xdrive.my/showroom/${car.slug}`)
            : origin;
          // react-helmet can't traverse a Fragment child (dev invariant crash,
          // tags dropped) — return a flat keyed array instead.
          return [
            <meta key="d" name="description" content={desc} />,
            <meta key="ot" property="og:type" content="website" />,
            <meta key="ol" property="og:locale" content="en_MY" />,
            <meta key="os" property="og:site_name" content="XDrive" />,
            <meta key="oti" property="og:title" content={car ? `${car.year} ${car.brand} ${car.model} | ${siteName}` : siteName} />,
            <meta key="od" property="og:description" content={desc} />,
            <meta key="oi" property="og:image" content={img} />,
            <meta key="ou" property="og:url" content={url} />,
            <meta key="tc" name="twitter:card" content="summary_large_image" />,
            <meta key="tt" name="twitter:title" content={car ? `${car.year} ${car.brand} ${car.model} | ${siteName}` : siteName} />,
            <meta key="td" name="twitter:description" content={desc} />,
            <meta key="ti" name="twitter:image" content={img} />,
            car ? <link key="c" rel="canonical" href={url} /> : null,
          ].filter(Boolean);
        })()}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": typeof window !== 'undefined' ? window.location.origin : 'https://xdrive.my' },
            { "@type": "ListItem", "position": 2, "name": "Showroom", "item": `${typeof window !== 'undefined' ? window.location.origin : 'https://xdrive.my'}/showroom` },
            { "@type": "ListItem", "position": 3, "name": carTitle, "item": `${typeof window !== 'undefined' ? window.location.origin : 'https://xdrive.my'}/showroom/${car.slug}` }
          ]
        })}</script>
      </Helmet>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060c14; overflow-x: hidden; }

        @keyframes cdp-from-right { from { transform: translateX(48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes cdp-from-left  { from { transform: translateX(-48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .cdp-slide-next { animation: cdp-from-right 0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        .cdp-slide-prev { animation: cdp-from-left  0.42s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        @keyframes cdp-shimmer-sweep { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .cdp-img-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, #0a1220 25%, #111e30 50%, #0a1220 75%);
          background-size: 400px 100%;
          animation: cdp-shimmer-sweep 1.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .sk { background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%); background-size: 600px 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }

        @keyframes cdp-fadeUp    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cdp-fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdp-slideRight { from { width: 0; } to { width: var(--w); } }
        @keyframes cdp-scanLine  { 0% { top: 0; opacity: .6; } 100% { top: 100%; opacity: 0; } }
        @keyframes cdp-pulse     { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes cdp-shimmerIn { from { opacity: 0; transform: scaleX(0); } to { opacity: 1; transform: scaleX(1); } }
        @keyframes cdp-redline   { from { width: 0; } to { width: 100%; } }

        .cdp-root { background: #060c14; min-height: 100vh; font-family: system-ui, sans-serif; color: #e2e8f0; }

        /* ── header ── */
        .cdp-header {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 60px;
          background: rgba(6,12,20,0.93);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cdp-back-btn {
          display: flex; align-items: center; gap: 7px;
          background: none; border: none; color: #64748b;
          font-size: 13px; cursor: pointer;
          font-family: system-ui, sans-serif; padding: 0;
          transition: color 0.2s; letter-spacing: 0.02em;
        }
        .cdp-back-btn:hover { color: #e2e8f0; }
        .cdp-header-title {
          font-size: 13px; font-weight: 500; color: white;
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
          max-width: 40%; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cdp-header-title.visible { opacity: 1; }
        .cdp-enquire-btn {
          background: #dc2626; border: none;
          color: white; border-radius: 6px; padding: 6px 18px;
          font-size: 11px; cursor: pointer; letter-spacing: 0.08em;
          font-family: system-ui, sans-serif; transition: all 0.2s;
          text-transform: uppercase; font-weight: 600;
        }
        .cdp-enquire-btn:hover { background: #b91c1c; }
        .cdp-header-redline {
          position: absolute; bottom: 0; left: 0; height: 1px;
          background: linear-gradient(to right, #dc2626, rgba(220,38,38,0.3), transparent);
          animation: cdp-redline 3s ease forwards; pointer-events: none;
        }

        /* ── mosaic ── */
        .cdp-mosaic-grid {
          display: grid; grid-template-columns: 1.65fr 1fr; grid-template-rows: 1fr 1fr;
          gap: 3px; background: #000;
          height: 58vh; min-height: 400px; max-height: 660px;
        }
        .cdp-mosaic-cell { overflow: hidden; position: relative; cursor: zoom-in; transition: filter 0.3s; }
        .cdp-mosaic-cell:hover { filter: brightness(1.08); }
        .cdp-mosaic-cell img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s ease; }
        .cdp-mosaic-cell:hover img { transform: scale(1.03); }
        .cdp-mosaic-primary { grid-row: 1 / 3; }
        .cdp-mosaic-mobile { display: none; position: relative; overflow: hidden; background: #080f18; }

        /* ── mobile nav arrows (shared with mosaic-mobile) ── */
        .cdp-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(6,12,20,0.6); border: 1px solid rgba(255,255,255,0.1); color: white;
          width: 38px; height: 38px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; z-index: 4;
        }
        .cdp-arrow:hover { background: rgba(220,38,38,0.3); border-color: rgba(220,38,38,0.5); }
        .cdp-arrow-l { left: 14px; }
        .cdp-arrow-r { right: 14px; }
        .cdp-dots { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); max-width: 54px; overflow: hidden; z-index: 4; padding: 4px 0; }
        .cdp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: rgba(255,255,255,0.35); padding: 0; border: none; cursor: pointer; transition: transform 0.35s ease, opacity 0.35s ease, background 0.2s; }
        .cdp-dot.active { background: white; }
        .cdp-main-img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; will-change: transform; }

        /* ── body layout ── */
        .cdp-body-wrap {
          max-width: 1280px; margin: 0 auto;
          padding: 40px 32px 100px;
          display: flex; gap: 48px; align-items: flex-start;
        }
        .cdp-body-left { flex: 1.55; min-width: 0; }
        .cdp-sidebar {
          width: 360px; flex-shrink: 0;
          position: sticky; top: 76px;
          max-height: calc(100vh - 92px); overflow-y: auto; scrollbar-width: none;
          background: linear-gradient(160deg, #09111f 0%, #0a1220 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 28px 24px;
        }
        .cdp-sidebar::-webkit-scrollbar { display: none; }

        /* ── stats grid ── */
        .cdp-stats-grid {
          display: grid; grid-template-columns: repeat(4,1fr);
          gap: 2px; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; overflow: hidden; margin-bottom: 40px;
        }
        .cdp-stat-cell { padding: 16px 14px; background: #0a1220; border-right: 1px solid rgba(255,255,255,0.04); transition: background 0.2s; }
        .cdp-stat-cell:hover { background: rgba(220,38,38,0.05); }
        .cdp-stat-cell:last-child { border-right: none; }

        /* ── rows ── */
        .cdp-row {
          padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.04);
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          border-radius: 6px; transition: background .2s;
        }
        .cdp-row:hover { background: rgba(220,38,38,0.04); }

        /* ── similar ── */
        .cdp-similar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .cdp-similar-scroll { display: none; }

        /* ── mobile bar ── */
        .cdp-mobile-bar { display: none; }

        /* ── CTA button hover ── */
        .cdp-wa-btn:hover { transform: scale(1.015); box-shadow: 0 6px 24px rgba(34,197,94,0.3) !important; }

        /* ── header actions ── */
        .cdp-header-actions { display: flex; align-items: center; gap: 8px; }
        .cdp-mobile-enquire { display: none !important; }
        .cdp-mobile-share   { display: none !important; }
        @media (max-width: 900px) {
          .cdp-header { padding: 0 20px; }
          .cdp-header-actions { display: none; }
          .cdp-mobile-enquire { display: inline-flex !important; }
          .cdp-mobile-share   { display: inline-flex !important; }
        }

        /* ── lightbox ── */
        .cdp-lb-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.96); display: flex; align-items: center; justify-content: center; user-select: none; }
        .cdp-lb-img { max-width: 90vw; max-height: 88vh; object-fit: contain; display: block; transition: transform 0.08s linear; pointer-events: none; }
        .cdp-lb-close { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.08); border: none; color: white; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 2; }
        .cdp-lb-close:hover { background: rgba(255,255,255,0.18); }
        .cdp-lb-zoom-bar { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 40px; padding: 8px 16px; }
        .cdp-lb-zoom-btn { background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; transition: color 0.15s; }
        .cdp-lb-zoom-btn:hover { color: white; }
        .cdp-lb-zoom-label { font-size: 12px; color: rgba(255,255,255,0.6); font-family: system-ui, sans-serif; min-width: 40px; text-align: center; }
        .cdp-lb-counter { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); font-size: 12px; color: rgba(255,255,255,0.5); font-family: system-ui, sans-serif; }
        .cdp-lb-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: none; color: white; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 2; }
        .cdp-lb-arrow:hover { background: rgba(255,255,255,0.18); }
        .cdp-lb-arrow-l { left: 20px; }
        .cdp-lb-arrow-r { right: 20px; }

        /* ── show/hide helpers ── */
        @media (min-width: 901px) { .cdp-mobile-only { display: none !important; } }
        @media (max-width: 900px)  { .cdp-desktop-only { display: none !important; } }

        /* ── mobile bar (≤900px) ── */
        @media (max-width: 900px) {
          .cdp-root { padding-bottom: 74px; }
          .cdp-mobile-bar {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
            background: rgba(6,12,20,0.98); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
            border-top: 1px solid rgba(255,255,255,0.07); padding: 12px 16px; gap: 8px;
          }
          .cdp-mobile-bar-wa { flex: 0 0 auto; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: system-ui, sans-serif; border: 1px solid rgba(34,197,94,0.3); cursor: pointer; background: rgba(34,197,94,0.08); color: #4ade80; padding: 12px 14px; }
          .cdp-mobile-bar-book { flex: 1; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: system-ui, sans-serif; cursor: pointer; background: #dc2626; color: white; padding: 12px 0; border: none; border-top: 2px solid #b91c1c; box-shadow: 0 2px 12px rgba(220,38,38,0.3); }
        }
        @media (max-width: 480px) { .cdp-arrow { display: none; } }
      `}</style>

      {/* ── XDrive light-theme overrides ── */}
      {isXdrive && <style>{`
        body { background: #F6F7F9 !important; }
        .cdp-root { background: #F6F7F9 !important; color: #0F172A !important; }
        .cdp-header { background: rgba(246,247,249,0.85) !important; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom-color: rgba(15,23,42,0.07) !important; }
        .cdp-back-btn { color: #64748b !important; }
        .cdp-back-btn:hover { color: #0F172A !important; }
        .cdp-header-title { color: #0F172A !important; }
        .cdp-img-shimmer { background: linear-gradient(90deg,#e7eaef 25%,#f1f3f6 50%,#e7eaef 75%) !important; background-size: 400px 100% !important; }
        .sk { background: linear-gradient(90deg,#e7eaef 25%,#f1f3f6 50%,#e7eaef 75%) !important; background-size: 600px 100% !important; }
        .cdp-mosaic-grid { background: #e2e6ec !important; }
        .cdp-mosaic-mobile { background: #EEF1F5 !important; }
        .cdp-arrow { background: rgba(246,247,249,0.92) !important; border-color: rgba(15,23,42,0.12) !important; color: #334155 !important; }
        .cdp-arrow:hover { background: rgba(220,38,38,0.1) !important; border-color: rgba(220,38,38,0.3) !important; color: #dc2626 !important; }
        .cdp-stats-grid { border-color: rgba(15,23,42,0.07) !important; background: rgba(15,23,42,0.06) !important; }
        .cdp-stat-cell { background: #ffffff !important; border-right-color: rgba(15,23,42,0.06) !important; }
        .cdp-stat-cell:hover { background: rgba(220,38,38,0.035) !important; }
        .cdp-row { border-bottom-color: rgba(15,23,42,0.06) !important; }
        .cdp-row:hover { background: rgba(220,38,38,0.03) !important; }
        .cdp-sidebar { background: #ffffff !important; border-color: rgba(15,23,42,0.08) !important; box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.06) !important; }
        .cdp-mobile-bar { background: rgba(246,247,249,0.9) !important; border-top-color: rgba(15,23,42,0.07) !important; }
        .cdp-mobile-bar-wa { border-color: rgba(22,163,74,0.3) !important; background: rgba(22,163,74,0.06) !important; color: #16a34a !important; }
        .cdp-header-redline { background: linear-gradient(to right, #dc2626, rgba(220,38,38,0.25), transparent) !important; }
      `}</style>}

      <div className="cdp-root">
        {/* ── header ── */}
        <header className="cdp-header" style={{ position: "sticky" }}>
          <button className="cdp-back-btn" onClick={handleBack}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className={`cdp-header-title${showTitle ? " visible" : ""}`}>
            {carTitle}
          </span>
          <div className="cdp-header-actions">
            <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${th.inputBorder}`, borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
              <HeartButton listingId={car?.id} size={16} />
            </div>
            <button
              onClick={() => { if (!car?.id) return; isInCompare(car.id) ? removeFromCompare(car.id) : addToCompare(car.id); }}
              style={{ background: car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.15)' : th.card2, border: `1px solid ${car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.4)' : th.border}`, borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, color: car?.id && isInCompare(car.id) ? (isXdrive ? '#dc2626' : '#f87171') : th.textSec, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "system-ui,sans-serif", transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
              <ArrowLeftRight size={13} />
              {car?.id && isInCompare(car.id) ? 'In Compare' : 'Compare'}
            </button>
            <button
              onClick={handleShare}
              style={{ background: shareCopied ? 'rgba(22,163,74,0.1)' : th.card2, border: `1px solid ${shareCopied ? 'rgba(22,163,74,0.35)' : th.border}`, borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, color: shareCopied ? '#16a34a' : th.textSec, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "system-ui,sans-serif", transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
              {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
              {shareCopied ? 'Copied!' : 'Share'}
            </button>
            <button className="cdp-enquire-btn" onClick={handleWhatsApp}>Enquire</button>
          </div>
          <button
            className="cdp-mobile-share"
            onClick={handleShare}
            style={{ alignItems: 'center', gap: 5, background: shareCopied ? 'rgba(22,163,74,0.1)' : th.card2, border: `1px solid ${shareCopied ? 'rgba(22,163,74,0.35)' : th.border}`, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "system-ui,sans-serif", color: shareCopied ? '#16a34a' : th.textSec, transition: 'all 0.18s', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {shareCopied ? <Check size={13}/> : <Share2 size={13}/>}
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
          <button className="cdp-enquire-btn cdp-mobile-enquire" onClick={handleWhatsApp}>Enquire</button>
          <div className="cdp-header-redline" />
        </header>

        {/* ── SECTION 1: Photo Mosaic ── */}
        <div ref={heroRef}>
          {/* Desktop 3-cell grid */}
          <div className="cdp-mosaic-grid cdp-desktop-only">
            {/* Primary — spans both rows, swipeable */}
            <div
              className="cdp-mosaic-cell cdp-mosaic-primary"
              onClick={() => setLbOpen(true)}
            >
              <img
                key={slideKey}
                src={disp(images[activeIdx], 1600)}
                alt={carTitle}
                fetchPriority="high"
                decoding="async"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 6s ease",
                  transform: "scale(1.03)",
                }}
                onLoad={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                onError={onImgErr(images[activeIdx])}
              />
              {imgCount > 1 && (
                <>
                  <button
                    className="cdp-arrow cdp-arrow-l"
                    onClick={(e) => { e.stopPropagation(); go(prevIdx, "prev"); }}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="cdp-arrow cdp-arrow-r"
                    onClick={(e) => { e.stopPropagation(); go(nextIdx, "next"); }}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      zIndex: 4,
                      background: "rgba(6,8,15,0.62)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 20,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.9)",
                      fontFamily: "system-ui,sans-serif",
                      letterSpacing: "0.03em",
                      pointerEvents: "none",
                    }}
                  >
                    {activeIdx + 1} / {imgCount}
                  </div>
                </>
              )}
            </div>

            {/* Cell 2 — top right */}
            <div
              className="cdp-mosaic-cell"
              style={{ gridRow: 1, gridColumn: 2 }}
              onClick={() => {
                go(Math.min(1, imgCount - 1), "next");
                setLbOpen(true);
              }}
            >
              <img
                src={disp(images[1] || images[0], 760)}
                alt={`${carTitle} view 2`}
                loading="lazy"
                decoding="async"
                onError={onImgErr(images[1] || images[0])}
              />
            </div>

            {/* Cell 3 — bottom right */}
            <div
              className="cdp-mosaic-cell"
              style={{ gridRow: 2, gridColumn: 2 }}
              onClick={() => {
                go(Math.min(2, imgCount - 1), "next");
                setLbOpen(true);
              }}
            >
              <img
                src={disp(images[2] || images[0], 760)}
                alt={`${carTitle} view 3`}
                loading="lazy"
                decoding="async"
                onError={onImgErr(images[2] || images[0])}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(0, "next");
                  setLbOpen(true);
                }}
                style={{
                  position: "absolute",
                  bottom: 14,
                  right: 14,
                  zIndex: 4,
                  background: "rgba(6,8,15,0.75)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "system-ui,sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  letterSpacing: "0.03em",
                }}
              >
                <Camera size={13} style={{ color: "#dc2626" }} />
                View all {imgCount} photos
              </button>
            </div>
          </div>

          {/* Thumbnail strip (desktop) — jump straight to any photo */}
          {imgCount > 1 && (
            <div className="cdp-desktop-only" style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => go(i, i > activeIdx ? 'next' : 'prev')}
                  aria-label={`View photo ${i + 1}`}
                  style={{ flex: '0 0 auto', width: 84, height: 60, padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none', border: `2px solid ${i === activeIdx ? '#dc2626' : 'transparent'}`, opacity: i === activeIdx ? 1 : 0.6, transition: 'opacity .15s, border-color .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = i === activeIdx ? 1 : 0.6; }}
                >
                  <img src={disp(src, 200)} alt={`${carTitle} thumbnail ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={onImgErr(src)} />
                </button>
              ))}
            </div>
          )}

          {/* Mobile single swipeable panel — desktop-only since M1 handles mobile */}
          <div
            className="cdp-mosaic-mobile cdp-desktop-only"
            onTouchStart={galleryTouchStart}
            onTouchEnd={galleryTouchEnd}
          >
            {!imgLoaded && <div className="cdp-img-shimmer" />}
            <img
              key={slideKey}
              className={`cdp-main-img cdp-slide-${slideDir}`}
              src={disp(images[activeIdx], 1280)}
              alt={carTitle}
              fetchPriority={activeIdx === 0 ? "high" : "auto"}
              loading={activeIdx === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{
                opacity: 0,
                transform: "scale(1.04)",
                transition: "opacity 1.2s ease, transform 6s ease",
              }}
              onClick={() => setLbOpen(true)}
              onLoad={(e) => {
                setImgLoaded(true);
                e.currentTarget.style.opacity = "0.9";
                e.currentTarget.style.transform = "scale(1)";
              }}
              onError={(e) => {
                if (images[activeIdx] && !e.currentTarget.dataset.fb && e.currentTarget.src !== images[activeIdx]) {
                  e.currentTarget.dataset.fb = '1';
                  e.currentTarget.src = images[activeIdx];
                } else {
                  e.target.src = "/placeholder-car.jpg";
                }
                setImgLoaded(true);
              }}
            />
            {imgCount > 1 && (
              <>
                <button
                  className="cdp-arrow cdp-arrow-l"
                  onClick={() => go(prevIdx, "prev")}
                  aria-label="Previous"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="cdp-arrow cdp-arrow-r"
                  onClick={() => go(nextIdx, "next")}
                  aria-label="Next"
                >
                  <ChevronRight size={18} />
                </button>
                {(() => {
                  const DOT_SLOT = 12;
                  const rawOffset = -(activeIdx - 2) * DOT_SLOT;
                  const minOffset =
                    imgCount > 5 ? -(imgCount - 5) * DOT_SLOT : 0;
                  const trackShift = Math.min(
                    0,
                    Math.max(minOffset, rawOffset),
                  );
                  return (
                    <div className="cdp-dots">
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          transform: `translateX(${trackShift}px)`,
                          transition: "transform 0.35s ease",
                        }}
                      >
                        {images.map((_, i) => {
                          const dist = Math.abs(i - activeIdx);
                          return (
                            <button
                              key={i}
                              className={`cdp-dot${i === activeIdx ? " active" : ""}`}
                              onClick={() =>
                                go(i, i > activeIdx ? "next" : "prev")
                              }
                              aria-label={`Image ${i + 1}`}
                              style={{
                                opacity:
                                  dist === 0
                                    ? 1
                                    : dist === 1
                                      ? 0.65
                                      : dist === 2
                                        ? 0.35
                                        : 0,
                                transform:
                                  dist === 0
                                    ? "scaleX(2.8)"
                                    : dist === 1
                                      ? "scale(0.9)"
                                      : dist === 2
                                        ? "scale(0.7)"
                                        : "scale(0)",
                                pointerEvents: dist > 2 ? "none" : "auto",
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            MOBILE LAYOUT (≤900px) — M1 through M8
            ══════════════════════════════════════════ */}

        {/* M1 — Swipeable image. `contain` (not `cover`) + a slightly taller frame
            so every uploaded photo is shown whole, never cropped, whatever its
            aspect ratio. Letterbox fills with the dark frame colour. */}
        <div className="cdp-mobile-only" style={{ position:'relative', height:'clamp(240px,64vw,420px)', overflow:'hidden', background:'#080f18', cursor:'zoom-in' }}
          onTouchStart={galleryTouchStart} onTouchEnd={galleryTouchEnd}
          onClick={() => { if (gallerySwiped.current) { gallerySwiped.current = false; return; } setLbOpen(true); }}>
          {!imgLoaded && <div className="cdp-img-shimmer" />}
          <img key={slideKey} className={`cdp-main-img cdp-slide-${slideDir}`}
            src={disp(images[activeIdx], 1280)} alt={carTitle} fetchPriority="high" decoding="async"
            style={{ width:'100%', height:'100%', objectFit:'contain', opacity:0, transition:'opacity 0.8s ease' }}
            onLoad={e => { setImgLoaded(true); e.currentTarget.style.opacity = '1'; }}
            onError={e => {
              if (images[activeIdx] && !e.currentTarget.dataset.fb && e.currentTarget.src !== images[activeIdx]) {
                e.currentTarget.dataset.fb = '1'; e.currentTarget.src = images[activeIdx];
              } else { e.target.src='/placeholder-car.jpg'; }
              setImgLoaded(true);
            }}
          />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'45%', background:'linear-gradient(to top, rgba(6,8,15,0.8), transparent)', pointerEvents:'none', zIndex:3 }} />
          <div style={{ position:'absolute', bottom:14, left:14, zIndex:5, background:'rgba(6,8,15,0.7)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 12px', fontSize:11, color:'rgba(255,255,255,0.8)', fontFamily:"system-ui,sans-serif", fontWeight:500 }}>
            {activeIdx + 1} / {imgCount}
          </div>
          {imgCount > 1 && (() => {
            const DOT_SLOT = 12;
            const rawOffset = -(activeIdx - 2) * DOT_SLOT;
            const minOffset = imgCount > 5 ? -(imgCount - 5) * DOT_SLOT : 0;
            const trackShift = Math.min(0, Math.max(minOffset, rawOffset));
            return (
              <div className="cdp-dots" style={{ zIndex:4 }}>
                <div style={{ display:'flex', gap:6, transform:`translateX(${trackShift}px)`, transition:'transform 0.35s ease' }}>
                  {images.map((_, i) => {
                    const dist = Math.abs(i - activeIdx);
                    return (
                      <button key={i} className={`cdp-dot${i === activeIdx ? ' active' : ''}`}
                        onClick={() => go(i, i > activeIdx ? 'next' : 'prev')} aria-label={`Image ${i + 1}`}
                        style={{ opacity: dist===0?1:dist===1?0.65:dist===2?0.35:0, transform: dist===0?'scaleX(2.8)':dist===1?'scale(0.9)':dist===2?'scale(0.7)':'scale(0)', pointerEvents: dist>2?'none':'auto' }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Thumbnail strip (mobile) */}
        {imgCount > 1 && (
          <div className="cdp-mobile-only" style={{ display: 'flex', gap: 7, padding: '10px 20px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => go(i, i > activeIdx ? 'next' : 'prev')}
                aria-label={`View photo ${i + 1}`}
                style={{ flex: '0 0 auto', width: 64, height: 46, padding: 0, borderRadius: 7, overflow: 'hidden', cursor: 'pointer', background: 'none', border: `2px solid ${i === activeIdx ? '#dc2626' : 'transparent'}`, opacity: i === activeIdx ? 1 : 0.55 }}
              >
                <img src={disp(src, 160)} alt={`${carTitle} thumbnail ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={onImgErr(src)} />
              </button>
            ))}
          </div>
        )}

        {/* M2 — Identity block */}
        <div className="cdp-mobile-only" style={{ padding:'14px 20px 0' }}>
          {/* Title strip — sits directly under the image, compact like the
              marketplace cards: brand (strong) + model/variant/engine/year
              (secondary) on a small line that wraps to a 2nd line if long, with
              the financing calculator shortcut kept on the right. All colours are
              from `th` so the strip stays legible on the light xdrive theme AND
              the dark dealer-subdomain theme (was a hardcoded grey masthead that
              went invisible on dark storefronts). */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:14 }}>
            <h1 style={{
              flex:1,
              minWidth:0,
              fontFamily:"'Bebas Neue',sans-serif",
              fontSize:'clamp(1.7rem,7.5vw,2.4rem)',
              lineHeight:1.05,
              letterSpacing:'0.01em',
              color: th.text,
              margin:0,
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
            }}>
              {car.brand} {nameplate}
            </h1>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <button
                onClick={() => { if (!car?.id) return; isInCompare(car.id) ? removeFromCompare(car.id) : addToCompare(car.id); }}
                aria-label={car?.id && isInCompare(car.id) ? 'Remove from compare' : 'Add to compare'}
                title={car?.id && isInCompare(car.id) ? 'Remove from compare' : 'Add to compare'}
                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:38, height:38, borderRadius:10, background: car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.12)' : th.card2, border: `1px solid ${car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.4)' : th.border}`, color: car?.id && isInCompare(car.id) ? '#dc2626' : th.textSec, cursor:'pointer' }}
              >
                <ArrowLeftRight size={18} />
              </button>
              <button
                onClick={() => setCalcOpen(true)}
                aria-label="Open financing calculator"
                title="Financing calculator"
                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:38, height:38, borderRadius:10, background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.25)', color:'#dc2626', cursor:'pointer' }}
              >
                <Calculator size={18} />
              </button>
            </div>
          </div>
          {/* Mini details (body · transmission · fuel) — sits directly under the
              title, per layout */}
          <p style={{ fontSize:12, color: th.textMuted, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600, margin:'0 0 12px' }}>
            {[car.body_type, car.transmission, car.fuel_type].filter(Boolean).join('  ·  ')}
          </p>
          {/* Price section — directly under the title / mini details */}
          {isSambungCar(car) ? (
            <div style={{ marginBottom:4 }}>
              <SambungPriceBlock car={car} th={th} big="2.6rem" />
            </div>
          ) : (
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4, flexWrap:'wrap' }}>
            <p style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2.6rem', color: th.text, lineHeight:1, margin:0 }}>
              {fmtPrice(car.selling_price)}
            </p>
            {calcMonthly(car.selling_price) ? (
              <span style={{ fontSize:12, color: th.textSec }}>
                ~<span style={{ color: th.textMuted }}>RM {fmt(calcMonthly(car.selling_price))}</span>/mo
              </span>
            ) : car.selling_price > HIGH_VALUE_THRESHOLD ? (
              <span style={{ fontSize:12, color: th.textSec }}>Financing available on request</span>
            ) : null}
          </div>
          )}
          {!isSambungCar(car) && <MarketPriceTag car={car} isXdrive={isXdrive} th={th} />}
          {!isSambungCar(car) && isHot && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:13, color: th.textMuted, textDecoration:'line-through' }}>{fmtPrice(car.original_price)}</span>
              <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', color: isXdrive ? '#dc2626' : '#f87171', fontSize:'11px', padding:'2px 10px', borderRadius:'20px', fontWeight:600, letterSpacing:'0.04em' }}>SAVE {fmtPrice(saving)}</span>
            </div>
          )}
          {/* Seller storefront link — kept high up, right under the price, so
              buyers actually see whose showroom this is */}
          {dealer?.subdomain && !isSubdomain() && (
            <a
              href={`https://${dealer.subdomain}.xdrive.my`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, color: th.textSec, textDecoration:'none', margin:'12px 0 0', letterSpacing:'0.02em', fontWeight:600, borderBottom:'1px solid rgba(220,38,38,0.4)', paddingBottom:1, width:'fit-content' }}
            >
              Sold by {dealer.site_name || dealer.dealership} <ExternalLink size={12} style={{ color:'#dc2626' }} />
            </a>
          )}
          {/* Status badges — the plain "Recon" chip is dropped here; the icon'd
              Recon chip in ReconTrust below is the single source for that. */}
          {(isReserved || isHot || hasDocuments) && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, minWidth:0, margin:'12px 0 0' }}>
              {isReserved && <span style={{ background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.22)', color:'#dc2626', fontSize:'10px', padding:'4px 10px', borderRadius:'5px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700 }}>Reserved</span>}
              {isHot   && <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.28)', color:'#dc2626', fontSize:'10px', padding:'4px 10px', borderRadius:'5px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700 }}>Hot Deal</span>}
              {hasDocuments && (docsVerified
                ? <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.25)', color: isXdrive ? '#16a34a' : '#4ade80', fontSize:'10px', padding:'4px 10px', borderRadius:'5px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700 }}><BadgeCheck size={11} /> Verified Docs</span>
                : <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.25)', color: isXdrive ? '#475569' : '#94a3b8', fontSize:'10px', padding:'4px 10px', borderRadius:'5px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700 }}><FileText size={11} /> Docs on File</span>
              )}
            </div>
          )}
          {/* Quick stats grid — moved ABOVE the badges */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, border:`1px solid ${th.border}`, borderRadius:12, overflow:'hidden', marginTop:16 }}>
            {[
              { label:'Mileage',      value: car.mileage ? fmt(car.mileage)+' km' : '—' },
              { label:'Engine',       value: car.engine_cc ? fmt(car.engine_cc)+' cc' : '—' },
              { label:'Transmission', value: car.transmission || '—' },
              { label:'Fuel',         value: car.fuel_type || '—' },
              { label:'Colour',       value: car.colour || '—' },
              { label:'Owners',       value: car.previous_owners != null ? car.previous_owners+' owner'+(car.previous_owners!==1?'s':'') : '—' },
              { label:'Road Tax',     value: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY',{month:'short',year:'numeric'}) : '—' },
              { label:'Financing',    value: fmtFinancing(car) },
              ...(car.cylinders ? [{ label:'Cylinders', value:`${car.cylinders}-cyl` }] : []),
              ...(car.fuel_consumption ? [{ label:'Fuel Economy', value:`${car.fuel_consumption} km/L` }] : []),
            ].filter(({ value }) => value && value !== '—').map(({ label, value }) => (
              <div key={label} style={{ padding:'14px', background: th.card, borderRight:`1px solid ${th.borderSec}`, borderBottom:`1px solid ${th.borderSec}` }}>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.14em', color: th.textMuted, fontWeight:700, marginBottom:5 }}>{label}</p>
                <p style={{ fontSize:13, color: th.text, fontWeight:500, margin:0 }}>{value}</p>
              </div>
            ))}
          </div>
          {/* Trust + feature badges — moved BELOW the stats grid, tidied into an
              even 2-column grid (see ReconTrust / SpecHighlights) */}
          <div style={{ marginTop:16 }}>
            <WarrantyBanner car={car} isXdrive={isXdrive} />
            <ReconTrust car={car} isXdrive={isXdrive} />
            <SpecHighlights car={car} th={th} />
          </div>
          <div style={{ height:1, margin:'20px 0', background:'linear-gradient(to right,rgba(220,38,38,0.3),rgba(255,255,255,0.04),transparent)' }} />
        </div>

        {/* M4 — CTA card */}
        <div className="cdp-mobile-only" style={{ padding:'0 20px', marginBottom:24 }}>
          <div style={{ background: th.card, border:`1px solid ${th.border}`, borderRadius:14, padding:'20px' }}>
            {!isOwnListing && (
            <button
              onClick={handleBookingClick}
              style={{ width:'100%', background:'#dc2626', color:'white', border:'none', borderTop:'2px solid #b91c1c', borderRadius:10, padding:'14px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"system-ui,sans-serif", boxShadow:'0 4px 20px rgba(220,38,38,0.25)', marginBottom:8, letterSpacing:'0.02em' }}>
              Book a Viewing
            </button>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={enquiryClick}
                style={{ flex:1, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', color: accent('#4ade80', isXdrive), borderRadius:10, padding:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif", minWidth:0 }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{enquiryLabel}</span>
              </button>
              {contactPhone && (
                <button onClick={handleCall} disabled={callLoading} aria-busy={callLoading}
                  style={{ flex:1, background: th.card2, border:`1px solid ${th.border}`, color: th.textSec, borderRadius:10, padding:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:500, cursor: callLoading ? 'wait' : 'pointer', opacity: callLoading ? 0.6 : 1, fontFamily:"system-ui,sans-serif" }}>
                  <Phone size={13} /> {callLoading ? 'Connecting' : 'Call'}
                </button>
              )}
            </div>
            <div style={{ marginTop:10 }}>
              <PriceIncludes car={car} dealer={dealer} th={th} />
              <DepositTerms amount={car.deposit_amount} dealer={dealer} th={th} isXdrive={isXdrive} />
            </div>
            {/* Tertiary actions — quiet text links, not more buttons */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:18, marginTop:14, flexWrap:'wrap' }}>
              <button onClick={() => setCalcOpen(true)}
                style={{ background:'none', border:'none', padding:'0 0 2px', display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color: th.textSec, cursor:'pointer', fontFamily:"system-ui,sans-serif", borderBottom:'1px solid rgba(220,38,38,0.35)' }}>
                <Calculator size={13} style={{ color:'#dc2626' }} /> Financing calculator
              </button>
              {sellerPageUrl && !isSubdomain() && (
                <a href={sellerPageUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color: th.textSec, textDecoration:'none', fontFamily:"system-ui,sans-serif", borderBottom:`1px solid ${th.border}`, paddingBottom:2 }}>
                  <ExternalLink size={13} /> {sellerPageLabel}
                </a>
              )}
            </div>
            <div style={{ height:1, background: th.border, margin:'14px 0' }} />
            {/* Dealer row */}
            {(() => {
              const isAgent = car.seller_role === 'salesman' || !!salesmanProfile;
              const displayName = isAgent ? (salesmanProfile?.full_name || 'Agent') : (dealer ? dealerName : 'Seller');
              const avatarSrc = isAgent ? salesmanProfile?.avatar_url : (dealer?.avatar_url || dealer?.site_logo_url);
              return (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt={displayName} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:32, height:32, borderRadius:'50%', background: isAgent ? '#1d4ed8' : '#111e2e', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', border:'1px solid rgba(255,255,255,0.08)' }}>
                        {displayName[0]?.toUpperCase()}
                      </div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, color: th.text, fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</p>
                    <SellerRating summary={reviewSummary} floor={REVIEW_FLOOR} anchorId="reviews-m" th={th} />
                    <p style={{ fontSize:11, color: th.textSec }}>
                      {isAgent ? 'Independent Agent' : dealer ? (
                        /* The badge used to be a dead end — a shield with no referent.
                           When there are real details below it, it links to them. */
                        hasDealerIdentity(dealer) ? (
                          <a href="#dealer-identity-m" style={{ display:'inline-flex', alignItems:'center', gap:4, color: 'inherit', textDecoration:'none', borderBottom:`1px dotted ${th.textMuted}` }}>
                            {dealer.is_verified && <ShieldCheck size={12} strokeWidth={2.5} style={{ color: isXdrive ? '#2563eb' : '#60a5fa' }} />}
                            {dealer.is_verified ? 'Verified Dealer' : 'Dealer'} · details
                          </a>
                        ) : 'Dealer'
                      ) : 'Seller'}
                    </p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {listedDays !== null && <p style={{ fontSize:10, color: th.textMuted }}>{listedDays}d ago</p>}
                    {viewCount > 0 && <p style={{ fontSize:10, color: th.textMuted, display:'flex', alignItems:'center', gap:3 }}><Eye size={10} /> {viewCount}</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* M5 — Description + tabs + sections */}
        <div className="cdp-mobile-only" style={{ padding:'0 20px', marginBottom:32 }}>
          <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.2em', color: th.textMuted, fontWeight:700, marginBottom:12 }}>About this car</p>
          <p style={{ fontSize:14, color: th.textSec, lineHeight:1.85, marginBottom:28, whiteSpace:'pre-wrap' }}>
            {car.specs || `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
          </p>
          {/* Tabs */}
          {(() => {
            const tabs = [
              ...(Array.isArray(car.included_services) && car.included_services.length > 0 ? [{ key:'included', label:'What You Get' }] : []),
              { key:'specs', label:'Specs' },
              ...(parseTags(car.features).length > 0 ? [{ key:'features', label:'Features' }] : []),
              ...(parseTags(car.options).length  > 0 ? [{ key:'options',  label:'Options'  }] : []),
            ];
            return (
              <>
                <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:`1px solid ${th.border}` }}>
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setDetailTab(t.key)}
                      style={{ background: detailTab===t.key ? 'rgba(220,38,38,0.04)' : 'none', border:'none', borderBottom:`2px solid ${detailTab===t.key ? '#dc2626' : 'transparent'}`, color: detailTab===t.key ? th.text : th.textMuted, padding:'10px 24px 12px', marginBottom:-1, fontSize:'13px', fontWeight: detailTab===t.key ? 600 : 400, cursor:'pointer', fontFamily:"system-ui,sans-serif", transition:'all .2s', letterSpacing:'0.05em' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {detailTab === 'included' && (
                  <div>
                    <p style={{ fontSize:12, color: th.textSec, marginBottom:14, lineHeight:1.6 }}>
                      Included free with this car — no extra cost to you.
                    </p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {car.included_services.map((svc, i) => {
                        const cfg = getCategoryCfg(svc.category);
                        const CatIcon = cfg.icon;
                        return (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, background:`${cfg.color}10`, border:`1px solid ${cfg.color}28`, borderRadius:8, padding:'6px 13px' }}>
                            <CatIcon size={13} style={{ color:cfg.color, flexShrink:0 }} />
                            <span style={{ fontSize:12, color:cfg.color, fontWeight:600 }}>{svc.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    {car.included_services_cost > 0 && (
                      <p style={{ fontSize:11, color: th.textMuted, marginTop:12 }}>Total value included at no extra cost: <span style={{ color:'#dc2626', fontWeight:700 }}>RM {Number(car.included_services_cost).toLocaleString()}</span></p>
                    )}
                  </div>
                )}
                {detailTab === 'specs' && (
                  <div>
                    {[
                      { key:'Registration Date', val: car.registration_date || car.local_reg_date || '—' },
                      { key:'VIN / Chassis',     val: car.vin_number || '—' },
                      { key:'Condition',         val: car.condition || '—' },
                      { key:'Chassis Status',    val: <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: car.chassis_status==='clean'?'#22c55e':car.chassis_status==='repaired'?'#eab308':car.chassis_status==='written_off'?'#dc2626':th.textMuted }} />{car.chassis_status||'—'}</span> },
                      { key:'Location',          val: [car.city, car.state].filter(Boolean).join(', ') || '—' },
                      { key:'Previous Owners',   val: car.previous_owners ?? '—' },
                      { key:'Road Tax Expiry',   val: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY') : '—' },
                      { key:'Financing',         val: fmtFinancing(car) },
                      { key:'Warranty',          val: car.warranty_months > 0 ? car.warranty_months+' months' : 'None' },
                      { key:'Deposit to Reserve',val: car.deposit_amount > 0 ? 'RM '+fmt(car.deposit_amount) : '—' },
                      ...(isRecon ? [
                        { key:'Import Country', val: car.import_country || '—' },
                        { key:'Auction House',  val: car.auction_house  || '—' },
                      ] : []),
                    ].filter(({ val }) => val !== '—').map(({ key, val }) => (
                      <div key={key} className="cdp-row">
                        <span style={{ fontSize:'13px', color: th.textSec }}>{key}</span>
                        <span style={{ fontSize:'13px', color: th.text, textAlign:'right' }}>{val}</span>
                      </div>
                    ))}
                    {showConditionMap && (
                      <div style={{ marginTop:24, paddingTop:20, borderTop:`1px solid ${th.border}` }}>
                        <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.16em', color: th.textMuted, fontWeight:700, marginBottom:14 }}>Condition Report</p>
                        <div style={{ background: th.card, border:`1px solid ${th.border}`, borderRadius:12, padding:'16px 20px' }}>
                          <DamageMap value={damageMarks} readOnly />
                          <p style={{ fontSize:12, color: th.textSec, marginTop:14, lineHeight:1.6 }}>{conditionSummary}</p>
                          {conditionDeclaredOn && (
                            <p style={{ fontSize:11, color: th.textMuted, marginTop:4 }}>Declared by the dealer on {conditionDeclaredOn}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {detailTab === 'features' && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {parseTags(car.features).map((tag, i) => (
                      <span key={i} style={{ padding:'5px 12px', border:`1px solid ${th.border}`, borderRadius:'6px', fontSize:'12px', color: th.textSec, background: th.card2 }}>{tag}</span>
                    ))}
                  </div>
                )}
                {detailTab === 'options' && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {parseTags(car.options).map((tag, i) => (
                      <span key={i} style={{ padding:'5px 12px', border:`1px solid ${th.border}`, borderRadius:'6px', fontSize:'12px', color: th.textSec, background: th.card2 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          {/* Video */}
          {car.video_url && getEmbedUrl(car.video_url) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:`1px solid ${th.border}` }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color: th.textMuted, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                <PlayCircle size={13} style={{ color:'#dc2626' }} /> Watch Walkthrough
              </p>
              <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
                <iframe src={getEmbedUrl(car.video_url)} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }} allowFullScreen title={`${car.year} ${car.brand} ${car.model} walkthrough`} />
              </div>
            </div>
          )}

          {/* Car History — only when there's at least one real signal to show */}
          {(car.car_documents?.length > 0 || car.geran_status || car.puspakom_b5_date || car.puspakom_b7_date || car.previous_owners != null || car.warranty_months > 0 || (Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0)) && (
          <div style={{ marginTop:32, paddingTop:28, borderTop:`1px solid ${th.border}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <Shield size={13} style={{ color:'#dc2626' }} />
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color: th.textMuted, fontWeight:700 }}>Car History</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {[
                { key:'registration_card', icon:<CreditCard size={13} />, label:'Geran / Registration Card', okColor:'#38bdf8', okBg:'rgba(56,189,248,0.1)', okBorder:'rgba(56,189,248,0.3)' },
                { key:'puspakom',      icon:<ShieldCheck size={13} />, label:'Puspakom Inspection', okColor:'#4ade80', okBg:'rgba(34,197,94,0.1)',   okBorder:'rgba(34,197,94,0.3)'   },
                { key:'service_history',icon:<FileText size={13} />,   label:'Service History',      okColor:'#60a5fa', okBg:'rgba(96,165,250,0.1)',  okBorder:'rgba(96,165,250,0.3)'  },
                { key:'loan_clearance', icon:<BadgeCheck size={13} />, label:'Loan Clearance',       okColor:'#34d399', okBg:'rgba(52,211,153,0.1)',  okBorder:'rgba(52,211,153,0.3)'  },
                { key:'ownership',      icon:<Eye size={13} />,        label:'Ownership Docs',       okColor:'#fbbf24', okBg:'rgba(251,191,36,0.1)',  okBorder:'rgba(251,191,36,0.3)'  },
              ].map(({ key, icon, label, okColor: baseColor, okBg: baseBg, okBorder: baseBorder }) => {
                const doc = car.car_documents?.find(d => d.type === key);
                const isPusp = key === 'puspakom';
                const b5 = isPusp ? car.puspakom_b5_date : null;
                const b7 = isPusp ? car.puspakom_b7_date : null;
                const byDate = isPusp && (b5 || b7);
                // No geran attached, but the seller declared why (bank holds it /
                // unregistered recon). The row still renders — the buyer learns it
                // here rather than at the deposit stage.
                const geranNote = key === 'registration_card' && !doc ? geranStatusLabel(car.geran_status) : null;
                const okColor  = accent(geranNote ? '#f59e0b' : baseColor, isXdrive);
                const okBg     = geranNote ? 'rgba(245,158,11,0.1)' : baseBg;
                const okBorder = geranNote ? 'rgba(245,158,11,0.3)' : baseBorder;
                const available = !!doc || byDate || !!geranNote;
                if (!available) return null;
                const rk = `m-${key}`;
                const isOpen = openDocKey === rk;
                const asImage = isImageUrl(doc?.url);
                return (
                  <div key={key} style={{ background: th.card, border:`1px solid ${isOpen && available ? okBorder : th.border}`, borderRadius:9, overflow:'hidden', transition:'border-color 0.2s' }}>
                    <div onClick={() => available && toggleDoc(rk)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor: available ? 'pointer' : 'default' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ color: available ? okColor : th.textMuted }}>{icon}</span>
                        <p style={{ fontSize:12, color: th.text, fontWeight:500, margin:0 }}>{label}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: available ? okBg : 'rgba(100,116,139,0.08)', border:`1px solid ${available ? okBorder : 'rgba(100,116,139,0.15)'}`, color: available ? okColor : th.textSec, whiteSpace:'nowrap' }}>
                          {doc ? '✓ Available' : byDate ? 'Dates given' : geranNote ? 'Not available' : 'Not Provided'}
                        </span>
                        {available && <ChevronDown size={12} style={{ color: okColor, transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }} />}
                      </div>
                    </div>
                    {isOpen && available && (
                      <div style={{ borderTop:`1px solid ${okBorder}40`, padding:'12px 14px', background:`${okColor}08` }}>
                        {doc ? (asImage ? (
                          <>
                            <img src={doc.url} alt={doc.name || label} style={{ width:'100%', maxHeight:220, objectFit:'contain', borderRadius:7, marginBottom:10, display:'block' }} />
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              style={{ display:'inline-flex', alignItems:'center', gap:5, background:okBg, border:`1px solid ${okBorder}`, borderRadius:7, padding:'6px 12px', fontSize:11, color:okColor, textDecoration:'none', fontWeight:600 }}>
                              <Download size={11} /> Download
                            </a>
                          </>
                        ) : (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:6, background:okBg, border:`1px solid ${okBorder}`, borderRadius:7, padding:'8px 14px', fontSize:12, color:okColor, textDecoration:'none', fontWeight:600 }}>
                            <Download size={13} /> {doc.name || label}
                          </a>
                        )) : geranNote ? (
                          <p style={{ fontSize:12, color:okColor, margin:0 }}>{geranNote}</p>
                        ) : (
                          <PuspakomDates b5={b5} b7={b7} color={okColor} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Any other document types not in the 4 main rows */}
              {car.car_documents?.filter(d => !['registration_card','puspakom','service_history','loan_clearance','ownership'].includes(d.type)).map((doc, i) => {
                const cfg = CDP_DOC_TYPES[doc.type] || CDP_DOC_TYPES.other;
                const rk = `m-extra-${i}`;
                const isOpen = openDocKey === rk;
                const asImage = isImageUrl(doc.url);
                return (
                  <div key={rk} style={{ background: th.card, border:`1px solid ${isOpen ? cfg.color+'40' : th.border}`, borderRadius:9, overflow:'hidden', transition:'border-color 0.2s' }}>
                    <div onClick={() => toggleDoc(rk)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer' }}>
                      <p style={{ fontSize:12, color: th.text, fontWeight:500, margin:0 }}>{cfg.label}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, color:cfg.color }}>✓ Available</span>
                        <ChevronDown size={12} style={{ color: th.textSec, transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }} />
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${cfg.color}30`, padding:'12px 14px', background:`${cfg.color}08` }}>
                        {asImage ? (
                          <>
                            <img src={doc.url} alt={doc.name || cfg.label} style={{ width:'100%', maxHeight:220, objectFit:'contain', borderRadius:7, marginBottom:10, display:'block' }} />
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              style={{ display:'inline-flex', alignItems:'center', gap:5, background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, borderRadius:7, padding:'6px 12px', fontSize:11, color:cfg.color, textDecoration:'none', fontWeight:600 }}>
                              <Download size={11} /> Download
                            </a>
                          </>
                        ) : (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, borderRadius:7, padding:'8px 14px', fontSize:12, color:cfg.color, textDecoration:'none', fontWeight:600 }}>
                            <Download size={13} /> {doc.name || cfg.label}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {car.previous_owners != null && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background: th.card, border:`1px solid ${th.border}`, borderRadius:9 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Star size={13} style={{ color:'#fbbf24' }} />
                  <p style={{ fontSize:12, color: th.text, fontWeight:500, margin:0 }}>Previous Owners</p>
                </div>
                <span style={{ fontSize:12, color: th.text, fontWeight:600 }}>
                  {`${car.previous_owners} owner${car.previous_owners!==1?'s':''}`}
                </span>
              </div>
              )}
              {car.warranty_months > 0 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background: th.card, border:`1px solid ${th.border}`, borderRadius:9 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Shield size={13} style={{ color: accent('#34d399', isXdrive) }} />
                  <p style={{ fontSize:12, color: th.text, fontWeight:500, margin:0 }}>Warranty</p>
                </div>
                <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', color: accent('#34d399', isXdrive) }}>
                  {`${car.warranty_months} months`}
                </span>
              </div>
              )}
              {Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0 && (() => {
                const PC = [
                  { key:'part_exchange',    label:'Part Exchange',      color:'#60a5fa' },
                  { key:'whatsapp_chat',    label:'WhatsApp Chat',      color:'#4ade80' },
                  { key:'video_walkthrough',label:'Video Walkthrough',  color: isXdrive ? '#dc2626' : '#f87171' },
                  { key:'warranty_incl',    label:'Warranty Included',  color:'#34d399' },
                  { key:'verified_docs',    label:'Verified Docs',      color:'#4ade80' },
                  { key:'book_viewing',     label:'Book a Viewing',     color:'#60a5fa' },
                ].filter(p => car.dealer_perks.includes(p.key));
                if (!PC.length) return null;
                return (
                  <>
                    <div style={{ height:1, background:'rgba(255,255,255,0.04)', margin:'2px 0' }} />
                    {PC.map(({ key, label, color }) => (
                      <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background: th.card, border:`1px solid ${th.border}`, borderRadius:9 }}>
                        <p style={{ fontSize:12, color: th.text, fontWeight:500, margin:0 }}>{label}</p>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:`${color}15`, border:`1px solid ${color}30`, color: accent(color, isXdrive) }}>✓ Available</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
          )}

          {/* Performance */}
          {(car.horsepower || car.acceleration || car.top_speed || car.boot_size || car.doors || car.seats) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:`1px solid ${th.border}` }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color: th.textMuted, fontWeight:700, marginBottom:14 }}>Performance &amp; Details</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, border:`1px solid ${th.border}`, borderRadius:12, overflow:'hidden' }}>
                {[
                  { label:'Power', value: car.horsepower ? `${car.horsepower} bhp` : null },
                  { label:'Doors', value: car.doors ? `${car.doors} doors` : null },
                  { label:'Seats', value: car.seats ? `${car.seats} seats` : null },
                  { label:'0–100 km/h', value: car.acceleration ? `${car.acceleration}s` : null },
                  { label:'Top Speed', value: car.top_speed ? `${car.top_speed} km/h` : null },
                  { label:'Boot Space', value: car.boot_size ? `${car.boot_size}L` : null },
                ].filter(s => s.value).map(({ label, value }) => (
                  <div key={label} style={{ padding:'12px 14px', background: th.card, borderRight:`1px solid ${th.borderSec}`, borderBottom:`1px solid ${th.borderSec}` }}>
                    <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.14em', color: th.textMuted, fontWeight:700, marginBottom:4 }}>{label}</p>
                    <p style={{ fontSize:13, color: th.text, fontWeight:500, margin:0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Running Costs */}
          {(() => {
            const cc = car.engine_cc || 0;
            const roadTax = estimateRoadTax(cc);
            const insGrp = car.insurance_group ? Number(car.insurance_group) : null;
            const { pricePerLiter, fuelLabel, consumption, totalCost: totalFuelCost } = estimateFuelCost(cc, car.fuel_consumption, fuelDist);
            return (
              <div style={{ marginTop:32, paddingTop:28, borderTop:`1px solid ${th.border}` }}>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color: th.textMuted, fontWeight:700, marginBottom:16 }}>Running Costs</p>
                {roadTax && (
                  <div style={{ marginBottom:10, padding:'12px 14px', background: th.card, border:`1px solid ${th.border}`, borderRadius:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                      <span style={{ fontSize:12, color: th.textSec }}>Road Tax (est.)</span>
                      <span style={{ fontSize:14, color: th.text, fontWeight:600 }}>RM {fmt(roadTax)}/yr</span>
                    </div>
                    {cc > 0 && <p style={{ fontSize:10, color: th.textMuted, margin:0 }}>JPJ private saloon rate — {fmt(cc)}cc</p>}
                  </div>
                )}
                {car.co2_emissions && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, color: th.textSec }}>CO₂ Emissions</span>
                      <span style={{ fontSize:13, color: th.text, fontWeight:600 }}>{car.co2_emissions} g/km</span>
                    </div>
                    <div style={{ display:'flex', gap:2, height:8, borderRadius:5, overflow:'hidden' }}>
                      {[{limit:100,color:'#22c55e'},{limit:130,color:'#86efac'},{limit:150,color:'#fde047'},{limit:170,color:'#fb923c'},{limit:200,color:'#ef4444'},{limit:999,color:'#991b1b'}].map((band,i)=>{
                        const isActive = car.co2_emissions > [0,100,130,150,170,200][i] && car.co2_emissions <= band.limit;
                        return <div key={i} style={{ flex:1, background: isActive ? band.color : `${band.color}25`, borderRadius: i===0?'5px 0 0 5px':i===5?'0 5px 5px 0':0 }} />;
                      })}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color: th.textMuted, marginTop:4 }}>
                      <span>0</span><span>100</span><span>130</span><span>150</span><span>170</span><span>200+</span>
                    </div>
                  </div>
                )}
                {insGrp && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background: th.card, border:`1px solid ${th.border}`, borderRadius:10, marginBottom:6 }}>
                      <span style={{ fontSize:12, color: th.textSec }}>Insurance Group</span>
                      <span style={{ fontSize:14, color: th.text, fontWeight:600 }}>{insGrp} / 26</span>
                    </div>
                    <div style={{ background: th.card2, borderRadius:5, height:7, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ width:`${Math.min(100,(insGrp/26)*100)}%`, height:'100%', background:`hsl(${Math.round(120-(insGrp/26)*120)},75%,50%)`, borderRadius:5 }} />
                    </div>
                    <p style={{ fontSize:10, color: th.textMuted }}>{insGrp<=8?'Low cost to insure':insGrp<=16?'Moderate insurance cost':'Higher insurance cost'}</p>
                  </div>
                )}
                <div style={{ background: th.card, border:`1px solid ${th.border}`, borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color: th.textSec }}>Range Calculator</span>
                    <span style={{ fontSize:10, color: th.textMuted }}>{fuelLabel} @ RM{pricePerLiter}/L</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:12 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color: th.text, lineHeight:1 }}>RM {totalFuelCost}</span>
                    <span style={{ fontSize:12, color: th.textSec }}>for {fuelDist} km</span>
                  </div>
                  <input type="range" min={10} max={1000} step={10} value={fuelDist}
                    onChange={e => setFuelDist(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'#dc2626', cursor:'pointer' }}
                  />
                  <p style={{ fontSize:10, color: th.textMuted, marginTop:6 }}>
                    {car.fuel_consumption ? `${car.fuel_consumption} km/L (manufacturer figure)` : `~${consumption} km/L estimated`}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Location */}
          {(car.city || car.state) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:`1px solid ${th.border}` }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color: th.textMuted, fontWeight:700, marginBottom:14 }}>Location</p>
              <div style={{ background: th.card, border:`1px solid ${th.border}`, borderRadius:10, padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div>
                  <p style={{ fontSize:14, color: th.text, fontWeight:600, margin:'0 0 3px' }}>{[car.city, car.state].filter(Boolean).join(', ')}</p>
                  <p style={{ fontSize:11, color: th.textSec, margin:0 }}>Malaysia</p>
                </div>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent([car.city, car.state, 'Malaysia'].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:5, background: th.card2, border:`1px solid ${th.border}`, borderRadius:7, padding:'7px 12px', fontSize:11, color: th.textSec, textDecoration:'none', flexShrink:0 }}>
                  <Eye size={12} /> View Map
                </a>
              </div>
            </div>
          )}

          {/* About this dealer (mobile) */}
          <DealerIdentity dealer={dealer} dealerName={dealerName} th={th} isXdrive={isXdrive} anchorId="dealer-identity-m" />

          {/* Reviews (mobile) */}
          <ReviewsSection dealerId={car.dealer_id} listingId={car.id} sellerName={dealerName} th={th} isXdrive={isXdrive} anchorId="reviews-m" onSummary={handleReviewSummary} />

          {/* Q&A (mobile) */}
          <CommentsSection dealerId={car.dealer_id} listingId={car.id} sellerName={dealerName} th={th} />

        </div>


        {/* M7 — Salesman card */}
        {salesmanProfile && (() => {
          const firstName = (salesmanProfile.full_name || 'Agent').split(' ')[0];
          return (
            <div className="cdp-mobile-only" style={{ padding:'0 20px', marginBottom:32 }}>
              <div style={{ background: th.card, border:`1px solid ${th.border}`, borderRadius:14, padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                  {salesmanProfile.avatar_url
                    ? <img src={salesmanProfile.avatar_url} alt={salesmanProfile.full_name} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:52, height:52, borderRadius:'50%', background:'#1d4ed8', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>
                        {(salesmanProfile.full_name || 'S')[0].toUpperCase()}
                      </div>
                  }
                  <div>
                    <p style={{ fontSize:15, fontWeight:700, color: th.text, margin:0 }}>{salesmanProfile.full_name || 'Agent'}</p>
                    {salesmanProfile.job_title && <p style={{ fontSize:12, color: th.textSec, margin:'3px 0 0' }}>{salesmanProfile.job_title}</p>}
                    <p style={{ fontSize:11, color: th.textMuted, margin:'2px 0 0', letterSpacing:'0.05em' }}>Independent Agent · XDrive</p>
                  </div>
                </div>
                {/* The green "Chat with <rep>" button that used to sit here opened the
                    same enquiry modal as the WhatsApp button in the CTA card above it.
                    Its routing moved onto that button; a second saturated green CTA for
                    one job is exactly what the anti-slop rule forbids. The dealer-page
                    link that followed it pointed at the same URL as "Visit Dealer's
                    Page" in the CTA card, so it went too. */}
                {salesmanProfile.slug && (
                  <Link to={`/s/${salesmanProfile.slug}`} style={{ display:'block', textAlign:'center', fontSize:12, color: th.textSec, fontWeight:600, textDecoration:'none' }}>
                    {firstName}&apos;s other listings &rarr;
                  </Link>
                )}
              </div>
            </div>
          );
        })()}

        {/* More from this seller (mobile) — above the "More {brand}" section */}
        {sellerCars.length > 0 && (
          <div className="cdp-mobile-only" style={{ background: th.pageBg, padding:'28px 20px 0' }}>
            <SellerStrip cars={sellerCars} title="More From This Seller" th={th} />
          </div>
        )}

        {/* M8 — Similar cars */}
        {similarCars.length > 0 && (
          <div className="cdp-mobile-only" style={{ background: th.pageBg, padding:'28px 20px', marginBottom:80 }}>
            <p style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.2em', color:'#dc2626', margin:'0 0 4px', fontWeight:700 }}>You might also like</p>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'2.2rem', letterSpacing:'0.06em', color: th.text, margin:'0 0 20px', borderLeft:'3px solid #dc2626', paddingLeft:'12px' }}>
              More {car.brand}
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {similarCars.map(s => (
                <CarCard key={s.id} car={s} ctaContext={ctaCtx} showCompare />
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 2: Body (desktop only) ── */}
        <div className="cdp-body-wrap cdp-desktop-only">
          {/* ── LEFT COLUMN ── */}
          <div className="cdp-body-left">
            {/* Title block — brand sits at the same scale as the nameplate below it
                (was a tiny 10px caption dwarfed by the 3-4.4rem heading), so brand
                and model read as one masthead, differentiated by color only. */}
         <h1
  style={{
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: "clamp(3rem,5vw,4.4rem)",
    lineHeight: 0.98,
    letterSpacing: "0.01em",
    marginBottom: 12,
  }}
>
  {/* Masthead, theme-aware via `th` (was hardcoded #374151) — brand and
      model/variant/year share one strong colour. */}
  <span style={{ color: th.text }}>{car.brand} {nameplate}</span>
</h1>
            <p
              style={{
                fontSize: 12,
                color: th.textMuted,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              {[car.body_type, car.transmission, car.fuel_type]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            {/* Plain "Recon" chip dropped — the icon'd Recon chip in ReconTrust
                below is the single source, so it isn't shown twice in one view. */}
            {(isReserved || isHot || hasDocuments) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 24,
                }}
              >
                {isReserved && (
                  <span
                    style={{
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.22)",
                      color: "#dc2626",
                      fontSize: "10px",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    Reserved
                  </span>
                )}
                {isHot && (
                  <span
                    style={{
                      background: "rgba(220,38,38,0.1)",
                      border: "1px solid rgba(220,38,38,0.28)",
                      color: "#dc2626",
                      fontSize: "10px",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    Hot Deal
                  </span>
                )}
                {hasDocuments && (docsVerified ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "rgba(22,163,74,0.08)",
                      border: "1px solid rgba(22,163,74,0.25)",
                      color: isXdrive ? "#16a34a" : "#4ade80",
                      fontSize: "10px",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    <BadgeCheck size={11} /> Verified Docs
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "rgba(148,163,184,0.1)",
                      border: "1px solid rgba(148,163,184,0.25)",
                      color: isXdrive ? "#475569" : "#94a3b8",
                      fontSize: "10px",
                      padding: "4px 10px",
                      borderRadius: "5px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    <FileText size={11} /> Docs on File
                  </span>
                ))}
              </div>
            )}
            <div
              style={{
                height: 1,
                background:
                  "linear-gradient(to right, rgba(220,38,38,0.3), rgba(255,255,255,0.05), transparent)",
                marginBottom: 32,
              }}
            />

            {/* Quick stats grid — 8 cells */}
            <div className="cdp-stats-grid">
              {[
                {
                  label: "Mileage",
                  value: car.mileage ? fmt(car.mileage) + " km" : "—",
                },
                {
                  label: "Engine",
                  value: car.engine_cc ? fmt(car.engine_cc) + " cc" : "—",
                },
                { label: "Transmission", value: car.transmission || "—" },
                { label: "Fuel", value: car.fuel_type || "—" },
                { label: "Colour", value: car.colour || "—" },
                {
                  label: "Owners",
                  value:
                    car.previous_owners != null
                      ? car.previous_owners +
                        " owner" +
                        (car.previous_owners !== 1 ? "s" : "")
                      : "—",
                },
                {
                  label: "Road Tax",
                  value: car.road_tax_expiry
                    ? new Date(car.road_tax_expiry).toLocaleDateString(
                        "en-MY",
                        { month: "short", year: "numeric" },
                      )
                    : "—",
                },
                {
                  label: "Financing",
                  value: fmtFinancing(car),
                },
                ...(car.cylinders ? [{ label: "Cylinders", value: `${car.cylinders}-cyl` }] : []),
                ...(car.fuel_consumption ? [{ label: "Fuel Economy", value: `${car.fuel_consumption} km/L` }] : []),
              ].filter(({ value }) => value && value !== "—").map(({ label, value }) => (
                <div key={label} className="cdp-stat-cell">
                  <p
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      color: th.textMuted,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      color: th.text,
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Recon trust signals + spec highlights */}
            <div style={{ marginBottom: 32 }}>
              <ReconTrust car={car} isXdrive={isXdrive} />
              <SpecHighlights car={car} th={th} />
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: th.textMuted,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              About
            </p>
            <p
              style={{
                fontSize: 14,
                color: th.textMuted,
                lineHeight: 2,
                marginBottom: 40,
                whiteSpace: "pre-wrap",
              }}
            >
              {car.specs ||
                `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
            </p>

            {/* Tabbed specs / features / options */}
            {(() => {
              const tabs = [
                ...(Array.isArray(car.included_services) && car.included_services.length > 0
                  ? [{ key: "included", label: "What You Get" }]
                  : []),
                { key: "specs", label: "Specs" },
                ...(parseTags(car.features).length > 0
                  ? [{ key: "features", label: "Features" }]
                  : []),
                ...(parseTags(car.options).length > 0
                  ? [{ key: "options", label: "Options" }]
                  : []),
              ];
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 0,
                      marginBottom: 24,
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setDetailTab(t.key)}
                        style={{
                          background:
                            detailTab === t.key
                              ? "rgba(220,38,38,0.04)"
                              : "none",
                          border: "none",
                          borderBottom: `2px solid ${detailTab === t.key ? "#dc2626" : "transparent"}`,
                          color: detailTab === t.key ? "#dc2626" : th.textSec,
                          padding: "10px 24px 12px",
                          marginBottom: -1,
                          fontSize: "13px",
                          fontWeight: detailTab === t.key ? 600 : 400,
                          cursor: "pointer",
                          fontFamily: "system-ui,sans-serif",
                          transition: "all .2s",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {detailTab === "included" && (
                    <div>
                      <p style={{ fontSize: 12, color: th.textSec, marginBottom: 14, lineHeight: 1.6 }}>
                        Included free with this car — no extra cost to you.
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {car.included_services.map((svc, i) => {
                          const cfg = getCategoryCfg(svc.category);
                          const CatIcon = cfg.icon;
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: `${cfg.color}10`,
                                border: `1px solid ${cfg.color}28`,
                                borderRadius: 8,
                                padding: "6px 13px",
                              }}
                            >
                              <CatIcon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{svc.name}</span>
                            </div>
                          );
                        })}
                      </div>
                      {car.included_services_cost > 0 && (
                        <p style={{ fontSize: 11, color: th.textMuted, marginTop: 12 }}>
                          Total value included at no extra cost:{" "}
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>
                            RM {Number(car.included_services_cost).toLocaleString()}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {detailTab === "specs" && (
                    <div>
                      {[
                        {
                          key: "Registration Date",
                          val:
                            car.registration_date || car.local_reg_date || "—",
                        },
                        { key: "VIN / Chassis", val: car.vin_number || "—" },
                        { key: "Condition", val: car.condition || "—" },
                        {
                          key: "Chassis Status",
                          val: (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  background:
                                    car.chassis_status === "clean"
                                      ? "#22c55e"
                                      : car.chassis_status === "repaired"
                                        ? "#eab308"
                                        : car.chassis_status === "written_off"
                                          ? "#dc2626"
                                          : "#334155",
                                }}
                              />
                              {car.chassis_status || "—"}
                            </span>
                          ),
                        },
                        {
                          key: "Location",
                          val:
                            [car.city, car.state].filter(Boolean).join(", ") ||
                            "—",
                        },
                        {
                          key: "Previous Owners",
                          val: car.previous_owners ?? "—",
                        },
                        {
                          key: "Road Tax Expiry",
                          val: car.road_tax_expiry
                            ? new Date(car.road_tax_expiry).toLocaleDateString(
                                "en-MY",
                              )
                            : "—",
                        },
                        {
                          key: "Financing",
                          val: fmtFinancing(car),
                        },
                        {
                          key: "Warranty",
                          val:
                            car.warranty_months > 0
                              ? car.warranty_months + " months"
                              : "None",
                        },
                        {
                          key: "Deposit to Reserve",
                          val:
                            car.deposit_amount > 0
                              ? "RM " + fmt(car.deposit_amount)
                              : "—",
                        },
                        ...(isRecon
                          ? [
                              {
                                key: "Import Country",
                                val: car.import_country || "—",
                              },
                              {
                                key: "Auction House",
                                val: car.auction_house || "—",
                              },
                            ]
                          : []),
                      ].filter(({ val }) => val !== "—").map(({ key, val }) => (
                        <div key={key} className="cdp-row">
                          <span style={{ fontSize: "13px", color: th.textMuted }}>
                            {key}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              color: th.text,
                              textAlign: "right",
                            }}
                          >
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailTab === "specs" && showConditionMap && (
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 20,
                          borderTop: `1px solid ${th.border}`,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.16em",
                            color: th.textMuted,
                            fontWeight: 700,
                            marginBottom: 14,
                          }}
                        >
                          Condition Report
                        </p>
                        <div
                          style={{
                            background: th.card,
                            border: `1px solid ${th.border}`,
                            borderRadius: 12,
                            padding: "16px 20px",
                          }}
                        >
                          <DamageMap value={damageMarks} readOnly />
                          <p
                            style={{
                              fontSize: 12,
                              color: th.textSec,
                              marginTop: 14,
                              lineHeight: 1.6,
                            }}
                          >
                            {conditionSummary}
                          </p>
                          {conditionDeclaredOn && (
                            <p
                              style={{
                                fontSize: 11,
                                color: th.textMuted,
                                marginTop: 4,
                              }}
                            >
                              Declared by the dealer on {conditionDeclaredOn}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {detailTab === "features" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {parseTags(car.features).map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "5px 12px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: th.textMuted,
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {detailTab === "options" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {parseTags(car.options).map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "5px 12px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: th.textMuted,
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* VIDEO WALKTHROUGH */}
            {car.video_url && getEmbedUrl(car.video_url) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <PlayCircle size={13} style={{ color: '#dc2626' }} /> Watch Walkthrough
                </p>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', border: `1px solid ${th.border}` }}>
                  <iframe src={getEmbedUrl(car.video_url)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} allowFullScreen title={`${car.year} ${car.brand} ${car.model} walkthrough`} />
                </div>
              </div>
            )}

            {/* ── CAR HISTORY — only when there's at least one real signal to show ── */}
            {(car.car_documents?.length > 0 || car.geran_status || car.puspakom_b5_date || car.puspakom_b7_date || car.previous_owners != null || car.warranty_months > 0 || (Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0)) && (
            <div style={{ marginTop: 40, paddingTop: 32, borderTop: `1px solid ${th.borderSec}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Shield size={13} style={{ color: '#dc2626' }} />
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700 }}>Car History</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'registration_card', icon: <CreditCard size={15} />, label: 'Geran / Registration Card', sub: 'JPJ ownership record', okColor: '#38bdf8', okBorder: 'rgba(56,189,248,0.3)' },
                  { key: 'puspakom', icon: <ShieldCheck size={15} />, label: 'Puspakom Inspection', sub: 'Structural & mechanical check', okColor: '#4ade80', okBorder: 'rgba(34,197,94,0.3)' },
                  { key: 'service_history', icon: <FileText size={15} />, label: 'Service History', sub: 'Maintenance records', okColor: '#60a5fa', okBorder: 'rgba(96,165,250,0.3)' },
                  { key: 'loan_clearance', icon: <BadgeCheck size={15} />, label: 'Loan Clearance', sub: 'No outstanding finance', okColor: '#34d399', okBorder: 'rgba(52,211,153,0.3)' },
                  { key: 'ownership', icon: <Eye size={15} />, label: 'Ownership Docs', sub: 'VOC / transfer documents', okColor: '#fbbf24', okBorder: 'rgba(251,191,36,0.3)' },
                ].map(({ key, icon, label, sub, okColor: baseColor, okBorder: baseBorder }) => {
                  const doc = car.car_documents?.find(d => d.type === key);
                  const isPusp = key === 'puspakom';
                  const b5 = isPusp ? car.puspakom_b5_date : null;
                  const b7 = isPusp ? car.puspakom_b7_date : null;
                  const byDate = isPusp && (b5 || b7);
                  // See the mobile row above — a declared reason keeps the row alive.
                  const geranNote = key === 'registration_card' && !doc ? geranStatusLabel(car.geran_status) : null;
                  const okColor  = accent(geranNote ? '#f59e0b' : baseColor, isXdrive);
                  const okBorder = geranNote ? 'rgba(245,158,11,0.3)' : baseBorder;
                  const available = !!doc || byDate || !!geranNote;
                  if (!available) return null;
                  const rk = `d-${key}`;
                  const isOpen = openDocKey === rk;
                  const asImage = doc && isImageUrl(doc.url);
                  return (
                    <div key={key} style={{ background: th.card, border: `1px solid ${isOpen && available ? okBorder : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      <div onClick={() => available && toggleDoc(rk)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: available ? 'pointer' : 'default' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: available ? okColor : th.textMuted }}>{icon}</span>
                          <div>
                            <p style={{ fontSize: 13, color: th.textSec, fontWeight: 500, margin: 0 }}>{label}</p>
                            <p style={{ fontSize: 11, color: th.textMuted, margin: '2px 0 0' }}>{sub}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: available ? `${okColor}15` : 'rgba(100,116,139,0.08)', border: `1px solid ${available ? okBorder : 'rgba(100,116,139,0.15)'}`, color: available ? okColor : th.textSec, whiteSpace: 'nowrap' }}>
                            {doc ? '✓ Available' : byDate ? 'Dates given' : geranNote ? 'Not available' : 'Not Provided'}
                          </span>
                          {available && <ChevronDown size={15} style={{ color: okColor, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />}
                        </div>
                      </div>
                      {isOpen && available && (
                        <div style={{ borderTop: `1px solid ${okBorder}40`, padding: '14px 16px', background: `${okColor}08` }}>
                          {doc ? (asImage ? (
                            <>
                              <img src={doc.url} alt={doc.name || label} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, marginBottom: 12 }} />
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: okColor, textDecoration: 'none', background: `${okColor}15`, border: `1px solid ${okBorder}`, borderRadius: 6, padding: '5px 12px' }}>
                                <Download size={12} /> Download
                              </a>
                            </>
                          ) : (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: okColor, textDecoration: 'none', background: `${okColor}15`, border: `1px solid ${okBorder}`, borderRadius: 6, padding: '5px 12px' }}>
                              <Download size={14} /> {doc.name || label}
                            </a>
                          )) : geranNote ? (
                            <p style={{ fontSize: 12, color: okColor, margin: 0 }}>{geranNote}</p>
                          ) : (
                            <PuspakomDates b5={b5} b7={b7} color={okColor} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {car.car_documents?.filter(d => !['registration_card','puspakom','service_history','loan_clearance','ownership'].includes(d.type)).map((doc, i) => {
                  const cfg = CDP_DOC_TYPES[doc.type] || CDP_DOC_TYPES.other;
                  const rk = `d-extra-${i}`;
                  const isOpen = openDocKey === rk;
                  const asImage = isImageUrl(doc.url);
                  return (
                    <div key={rk} style={{ background: th.card, border: `1px solid ${isOpen ? `${cfg.color}50` : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      <div onClick={() => toggleDoc(rk)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <BadgeCheck size={15} style={{ color: cfg.color }} />
                          <p style={{ fontSize: 13, color: th.textSec, fontWeight: 500, margin: 0 }}>{cfg.label}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>✓ Available</span>
                          <ChevronDown size={15} style={{ color: cfg.color, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: `1px solid ${cfg.color}30`, padding: '14px 16px', background: `${cfg.color}08` }}>
                          {asImage ? (
                            <>
                              <img src={doc.url} alt={doc.name || cfg.label} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, marginBottom: 12 }} />
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: cfg.color, textDecoration: 'none', background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, borderRadius: 6, padding: '5px 12px' }}>
                                <Download size={12} /> Download
                              </a>
                            </>
                          ) : (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: cfg.color, textDecoration: 'none', background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, borderRadius: 6, padding: '5px 12px' }}>
                              <Download size={14} /> {doc.name || cfg.label}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {car.previous_owners != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Star size={15} style={{ color: '#fbbf24' }} />
                    <div>
                      <p style={{ fontSize: 13, color: th.textSec, fontWeight: 500, margin: 0 }}>Previous Owners</p>
                      {(car.registration_date || car.local_reg_date) && <p style={{ fontSize: 11, color: th.textMuted, margin: '2px 0 0' }}>Registered {new Date(car.registration_date || car.local_reg_date).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}</p>}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: th.text, fontWeight: 600 }}>
                    {`${car.previous_owners} owner${car.previous_owners !== 1 ? 's' : ''}`}
                  </span>
                </div>
                )}
                {car.warranty_months > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={15} style={{ color: accent('#34d399', isXdrive) }} />
                    <div>
                      <p style={{ fontSize: 13, color: th.textSec, fontWeight: 500, margin: 0 }}>Warranty</p>
                      <p style={{ fontSize: 11, color: th.textMuted, margin: '2px 0 0' }}>Included with purchase</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: accent('#34d399', isXdrive) }}>
                    {`${car.warranty_months} months`}
                  </span>
                </div>
                )}
                {Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0 && (() => {
                  const PERK_CFG = [
                    { key: 'part_exchange',    label: 'Part Exchange',      color: '#60a5fa' },
                    { key: 'whatsapp_chat',    label: 'WhatsApp Chat',      color: '#4ade80' },
                    { key: 'video_walkthrough',label: 'Video Walkthrough',  color: isXdrive ? '#dc2626' : '#f87171' },
                    { key: 'warranty_incl',    label: 'Warranty Included',  color: '#34d399' },
                    { key: 'verified_docs',    label: 'Verified Docs',      color: '#4ade80' },
                    { key: 'book_viewing',     label: 'Book a Viewing',     color: '#60a5fa' },
                  ].filter(p => car.dealer_perks.includes(p.key));
                  if (!PERK_CFG.length) return null;
                  return (
                    <>
                      <div style={{ height: 1, background: th.inputBg, margin: '2px 0' }} />
                      {PERK_CFG.map(({ key, label, color }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 10 }}>
                          <p style={{ fontSize: 13, color: th.textSec, fontWeight: 500, margin: 0 }}>{label}</p>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, color: accent(color, isXdrive) }}>✓ Available</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
            )}

            {/* ── PERFORMANCE & DETAILS ── */}
            {(car.horsepower || car.acceleration || car.top_speed || car.boot_size || car.doors || car.seats || car.co2_emissions || car.insurance_group || car.safety_rating) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: `1px solid ${th.borderSec}` }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, marginBottom: 20 }}>Performance &amp; Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, border: `1px solid ${th.borderSec}`, borderRadius: 12, overflow: 'hidden' }}>
                  {[
                    { label: 'Power', value: car.horsepower ? `${Number(car.horsepower).toLocaleString()} bhp` : null },
                    { label: 'Doors', value: car.doors ? `${car.doors} doors` : null },
                    { label: 'Seats', value: car.seats ? `${car.seats} seats` : null },
                    { label: '0–100 km/h', value: car.acceleration ? `${car.acceleration}s` : null },
                    { label: 'Top Speed', value: car.top_speed ? `${car.top_speed} km/h` : null },
                    { label: 'Boot Space', value: car.boot_size ? `${car.boot_size}L` : null },
                    { label: 'CO₂', value: car.co2_emissions ? `${car.co2_emissions} g/km` : null },
                    { label: 'Ins. Group', value: car.insurance_group ? String(car.insurance_group) : null },
                    { label: 'Safety Rating', value: car.safety_rating ? `${car.safety_rating}★` : null },
                  ].filter(s => s.value).map(({ label, value }) => (
                    <div key={label} style={{ padding: '14px', background: th.card, borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: th.textMuted, fontWeight: 700, marginBottom: 5 }}>{label}</p>
                      <p style={{ fontSize: 14, color: th.text, fontWeight: 500, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RUNNING COSTS ── */}
            {(() => {
              const cc = car.engine_cc || 0;
              const roadTax = estimateRoadTax(cc);
              const co2 = car.co2_emissions;
              const insGrp = car.insurance_group ? Number(car.insurance_group) : null;
              // fuel_consumption is km/L (CarForm's "Fuel Economy" field) — the old
              // L/100km math here disagreed with the mobile layout's estimate for
              // the same car and inverted dealer-entered values.
              const { pricePerLiter: petrolPrice, fuelLabel, consumption, totalCost: totalFuelCost } = estimateFuelCost(cc, car.fuel_consumption, fuelDist);
              return (
                <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, marginBottom: 24 }}>Running Costs</p>
                  {roadTax && (
                    <div style={{ marginBottom: 24, padding: '16px 18px', background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: th.textSec }}>Road Tax (estimated)</span>
                        <span style={{ fontSize: 15, color: th.text, fontWeight: 600 }}>RM {fmt(roadTax)} / year</span>
                      </div>
                      <p style={{ fontSize: 11, color: th.textMuted, margin: 0 }}>JPJ private saloon rate — {fmt(cc)}cc</p>
                    </div>
                  )}
                  {co2 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: th.textSec }}>CO₂ Emissions</span>
                        <span style={{ fontSize: 15, color: th.text, fontWeight: 600 }}>{co2} g/km</span>
                      </div>
                      <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 6, overflow: 'hidden' }}>
                        {[
                          { limit: 100, color: '#22c55e' },
                          { limit: 130, color: '#86efac' },
                          { limit: 150, color: '#fde047' },
                          { limit: 170, color: '#fb923c' },
                          { limit: 200, color: '#ef4444' },
                          { limit: 999, color: '#991b1b' },
                        ].map((band, i) => {
                          const prevLimit = [0,100,130,150,170,200][i];
                          const isActive = co2 > prevLimit && co2 <= band.limit;
                          return <div key={i} style={{ flex: 1, background: isActive ? band.color : `${band.color}25`, borderRadius: i === 0 ? '6px 0 0 6px' : i === 5 ? '0 6px 6px 0' : 0 }} />;
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: th.textMuted, marginTop: 5 }}>
                        <span>0</span><span>100</span><span>130</span><span>150</span><span>170</span><span>200+</span>
                      </div>
                    </div>
                  )}
                  {insGrp && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: th.textSec }}>Insurance Group</span>
                        <span style={{ fontSize: 15, color: th.text, fontWeight: 600 }}>{insGrp} / 26</span>
                      </div>
                      <div style={{ background: th.inputBg, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (insGrp / 26) * 100)}%`, height: '100%', background: `hsl(${Math.round(120 - (insGrp / 26) * 120)}, 75%, 50%)`, borderRadius: 6 }} />
                      </div>
                      <p style={{ fontSize: 11, color: th.textMuted, marginTop: 5 }}>
                        {insGrp <= 8 ? 'Low cost to insure' : insGrp <= 16 ? 'Moderate insurance cost' : 'Higher insurance cost'}
                      </p>
                    </div>
                  )}
                  <div style={{ background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: th.textSec }}>Range Calculator</span>
                      <span style={{ fontSize: 10, color: th.textMuted }}>{fuelLabel} @ RM {petrolPrice}/L</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', color: th.text, lineHeight: 1 }}>RM {totalFuelCost}</span>
                      <span style={{ fontSize: 12, color: th.textMuted }}>for {fuelDist} km</span>
                    </div>
                    <input type="range" min={10} max={1000} step={10} value={fuelDist}
                      onChange={e => setFuelDist(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: th.textMuted, marginTop: 4 }}>
                      <span>10 km</span><span>500 km</span><span>1,000 km</span>
                    </div>
                    <p style={{ fontSize: 11, color: th.textMuted, marginTop: 10 }}>
                      {car.fuel_consumption ? `${car.fuel_consumption} km/L (manufacturer figure)` : `~${consumption} km/L estimated from engine size`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── LOCATION ── */}
            {(car.city || car.state) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, marginBottom: 16 }}>Location</p>
                <div style={{ background: th.card, border: `1px solid ${th.borderSec}`, borderRadius: 12, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 16, color: th.text, fontWeight: 600, margin: '0 0 4px' }}>{[car.city, car.state].filter(Boolean).join(', ')}</p>
                    <p style={{ fontSize: 12, color: th.textMuted, margin: 0 }}>Malaysia · {dealerName}</p>
                  </div>
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent([car.city, car.state, 'Malaysia'].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: th.inputBg, border: `1px solid ${th.inputBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: th.textSec, textDecoration: 'none', flexShrink: 0, letterSpacing: '0.03em' }}>
                    <Eye size={13} /> View on Map
                  </a>
                </div>
                <p style={{ fontSize: 11, color: th.textMuted, marginTop: 8 }}>Approximate area only — confirm address when enquiring.</p>
              </div>
            )}

            {/* ── ABOUT THIS DEALER (desktop) ── */}
            <DealerIdentity dealer={dealer} dealerName={dealerName} th={th} isXdrive={isXdrive} anchorId="dealer-identity-d" />

            {/* ── REVIEWS (desktop) ── */}
            <ReviewsSection dealerId={car.dealer_id} listingId={car.id} sellerName={dealerName} th={th} isXdrive={isXdrive} anchorId="reviews-d" onSummary={handleReviewSummary} />

            {/* ── Q&A (desktop) ── */}
            <CommentsSection dealerId={car.dealer_id} listingId={car.id} sellerName={dealerName} th={th} />

            {/* BOOKING ANCHOR */}
            <div ref={bookingRef} id="booking-form" style={{ marginTop: 56 }} />

            {/* MORE FROM THIS SELLER — above the "More {brand}" section */}
            {sellerCars.length > 0 && (
              <div style={{ marginTop: 64, background: th.card2, border: `1px solid ${th.borderSec}`, borderRadius: 16, padding: '32px 28px' }}>
                <SellerStrip cars={sellerCars} title="More From This Seller" th={th} />
              </div>
            )}

            {/* SIMILAR CARS */}
            {similarCars.length > 0 && (
              <div style={{ marginTop: 64, background: th.card2, border: `1px solid ${th.borderSec}`, borderRadius: 16, padding: '32px 28px' }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#dc2626', margin: '0 0 4px', fontWeight: 700 }}>You might also like</p>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', letterSpacing: '0.06em', color: th.text, margin: '0 0 28px', borderLeft: '3px solid #dc2626', paddingLeft: '14px' }}>
                  More {car.brand}
                </h2>
                <div className="cdp-similar-grid">
                  {similarCars.map(s => <CarCard key={s.id} car={s} ctaContext={ctaCtx} showCompare />)}
                </div>
                <div className="cdp-similar-scroll">
                  {similarCars.map(s => (
                    <div key={s.id} style={{ flexShrink: 0, width: '72vw', scrollSnapAlign: 'start' }}>
                      <CarCard car={s} ctaContext={ctaCtx} showCompare />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>{/* end left column */}

          {/* ── RIGHT SIDEBAR ── */}
          <div className="cdp-sidebar" style={{ width: 360, flexShrink: 0, position: 'sticky', top: 76, maxHeight: 'calc(100vh - 92px)', overflowY: 'auto', scrollbarWidth: 'none', background: isXdrive ? '#ffffff' : 'linear-gradient(160deg, #09111f 0%, #0a1220 100%)', border: `1px solid ${isXdrive ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: '28px 24px' }}>

            {/* DEALER TOPBAR */}
            {(() => {
              const isAgent = car.seller_role === 'salesman' || !!salesmanProfile;
              const displayName = isAgent ? (salesmanProfile?.full_name || 'Agent') : (dealer ? dealerName : 'Seller');
              const avatarSrc = isAgent ? salesmanProfile?.avatar_url : (dealer?.avatar_url || dealer?.site_logo_url);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${th.borderSec}` }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt={displayName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%', background: isAgent ? '#1d4ed8' : '#111e2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', border: `1px solid ${th.border}` }}>
                        {displayName[0]?.toUpperCase()}
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: th.text, fontWeight: 600, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                    <SellerRating summary={reviewSummary} floor={REVIEW_FLOOR} anchorId="reviews-d" th={th} />
                    <p style={{ fontSize: 11, color: th.textSec }}>
                      {isAgent ? 'Independent Agent' : dealer ? (
                        hasDealerIdentity(dealer) ? (
                          <a href="#dealer-identity-d" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'inherit', textDecoration: 'none', borderBottom: `1px dotted ${th.textMuted}` }}>
                            {dealer.is_verified && <ShieldCheck size={12} strokeWidth={2.5} style={{ color: isXdrive ? '#2563eb' : '#60a5fa' }} />}
                            {dealer.is_verified ? 'Verified Dealer' : 'Dealer'} · details
                          </a>
                        ) : 'Dealer'
                      ) : 'Seller'}
                    </p>
                  </div>
                  {listedDays !== null && (
                    <p style={{ fontSize: 10, color: th.textMuted, textAlign: 'right' }}>{listedDays}d ago</p>
                  )}
                </div>
              );
            })()}

            {/* PRICE BLOCK */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: th.textMuted, fontWeight: 700, margin: 0 }}>Asking Price</p>
                {sellerPageUrl && !isSubdomain() && (
                  <a
                    href={sellerPageUrl}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: th.textSec, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.02em', borderBottom: '1px solid rgba(220,38,38,0.4)', paddingBottom: 1 }}
                  >
                    {dealer?.site_name || dealer?.dealership || salesmanProfile?.full_name || 'Seller'} ↗
                  </a>
                )}
              </div>
              {isSambungCar(car) ? (
                <SambungPriceBlock car={car} th={th} big="clamp(2.4rem,3.5vw,3rem)" />
              ) : (
                <>
                  <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,3.5vw,3rem)', color: th.text, lineHeight: 1 }}>{fmtPrice(car.selling_price)}</p>
                  {calcMonthly(car.selling_price) ? (
                    <p style={{ fontSize: 12, color: th.textMuted, marginTop: 4 }}>~RM {fmt(calcMonthly(car.selling_price))}/mo</p>
                  ) : car.selling_price > HIGH_VALUE_THRESHOLD ? (
                    <p style={{ fontSize: 12, color: th.textMuted, marginTop: 4 }}>Financing available on request</p>
                  ) : null}
                  {isHot && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 13, color: th.textMuted, textDecoration: 'line-through' }}>{fmtPrice(car.original_price)}</span>
                      <span style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: isXdrive ? '#dc2626' : '#f87171', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.04em' }}>SAVE {fmtPrice(saving)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {!isSambungCar(car) && (
            <div style={{ marginTop: 16 }}>
              <MarketPriceTag car={car} isXdrive={isXdrive} th={th} />
            </div>
            )}
            <div style={{ height: 1, background: 'linear-gradient(to right, rgba(220,38,38,0.35), transparent)', margin: '14px 0 16px' }} />
            <WarrantyBanner car={car} isXdrive={isXdrive} />
            <PriceIncludes car={car} dealer={dealer} th={th} />
            <DepositTerms amount={car.deposit_amount} dealer={dealer} th={th} isXdrive={isXdrive} />

            {/* CTA BUTTONS */}
            {!isOwnListing && (
            <button
              onClick={handleBookingClick}
              style={{ width: '100%', background: '#dc2626', color: 'white', border: 'none', borderTop: '2px solid #b91c1c', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "system-ui,sans-serif", letterSpacing: '0.02em', boxShadow: '0 4px 24px rgba(220,38,38,0.25)', transition: 'transform .15s, box-shadow .2s' }}>
              Book a Viewing
            </button>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={enquiryClick}
                style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: accent('#4ade80', isXdrive), borderRadius: 10, padding: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: "system-ui,sans-serif", fontSize: 13, fontWeight: 600, transition: 'all .2s', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enquiryLabel}</span>
              </button>
              {contactPhone && (
                <button onClick={handleCall} disabled={callLoading} aria-busy={callLoading}
                  style={{ flex: 1, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.textSec, borderRadius: 10, padding: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: callLoading ? 'wait' : 'pointer', opacity: callLoading ? 0.6 : 1, fontFamily: "system-ui,sans-serif", fontSize: 13, transition: 'all .2s' }}>
                  <Phone size={13} /> {callLoading ? 'Connecting' : 'Call'}
                </button>
              )}
            </div>

            {/* Tertiary actions — quiet text links, not more buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14 }}>
              <button onClick={() => setCalcOpen(true)}
                style={{ background: 'none', border: 'none', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: th.textSec, cursor: 'pointer', fontFamily: "system-ui,sans-serif", borderBottom: '1px solid rgba(220,38,38,0.35)', paddingBottom: 2 }}>
                <Calculator size={13} style={{ color: '#dc2626' }} /> Financing calculator
              </button>
              {sellerPageUrl && !isSubdomain() && (
                <a href={sellerPageUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: th.textSec, textDecoration: 'none', fontFamily: "system-ui,sans-serif", borderBottom: `1px solid ${th.border}`, paddingBottom: 2 }}>
                  <ExternalLink size={13} /> {sellerPageLabel}
                </a>
              )}
            </div>

            {/* SALESMAN CARD */}
            {salesmanProfile && (() => {
              const firstName = (salesmanProfile.full_name || 'Agent').split(' ')[0];
              return (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    {salesmanProfile.avatar_url
                      ? <img src={salesmanProfile.avatar_url} alt={salesmanProfile.full_name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1d4ed8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                          {(salesmanProfile.full_name || 'S')[0].toUpperCase()}
                        </div>
                    }
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: th.text, margin: 0 }}>{salesmanProfile.full_name || 'Agent'}</p>
                      {salesmanProfile.job_title && <p style={{ fontSize: 12, color: th.textMuted, margin: '3px 0 0' }}>{salesmanProfile.job_title}</p>}
                      <p style={{ fontSize: 11, color: th.textMuted, margin: '2px 0 0', letterSpacing: '0.05em' }}>Independent Agent · XDrive</p>
                    </div>
                  </div>
                  {salesmanProfile.slug && (
                    <Link to={`/s/${salesmanProfile.slug}`} style={{ display: 'block', textAlign: 'center', fontSize: 12, color: th.textSec, fontWeight: 600, textDecoration: 'none' }}>
                      {firstName}&apos;s other listings &rarr;
                    </Link>
                  )}
                </div>
              );
            })()}
          </div>{/* end sidebar */}
        </div>{/* end body wrap */}

        {/* ── calculator modal ── */}
        {calcOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "system-ui,sans-serif" }}>
            <div style={{ width: '100%', maxWidth: 860, background: th.card, border: `1px solid ${th.border}`, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: th.text, fontWeight: 700, fontSize: 14, margin: '0 0 2px', letterSpacing: '0.02em' }}>Financing &amp; Cost Calculator</p>
                  <p style={{ color: th.textMuted, fontSize: 12, margin: 0 }}>{carTitle}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  style={{ background: th.inputBg, border: `1px solid ${th.border}`, borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: th.textMuted, transition: 'all .2s' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <FinancingCalculator
                  initialPrice={car.selling_price}
                  engineCc={car.engine_cc}
                  bodyType={car.body_type}
                  carName={carTitle}
                  carYear={car.year ? String(car.year) : ''}
                  carColor={car.colour || ''}
                  carImage={car.images?.length ? car.images[0] : null}
                  light={isXdrive}
                  dealer={dealer}
                  salesman={salesmanProfile}
                  sellerPageUrl={sellerPageUrl}
                  resolveFromSession={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── lightbox ── */}
        {lbOpen && (
          <div className="cdp-lb-overlay"
            onClick={e => { if (e.target === e.currentTarget) closeLb(); }}
            onMouseMove={lbMouseMove} onMouseUp={lbMouseUp} onMouseLeave={lbMouseUp}>
            <button className="cdp-lb-close" onClick={closeLb} aria-label="Close"><X size={18} /></button>
            {imgCount > 1 && <span className="cdp-lb-counter">{activeIdx + 1} / {imgCount}</span>}
            {imgCount > 1 && (
              <>
                <button className="cdp-lb-arrow cdp-lb-arrow-l" onClick={() => go(prevIdx, 'prev')} aria-label="Previous"><ChevronLeft size={22} /></button>
                <button className="cdp-lb-arrow cdp-lb-arrow-r" onClick={() => go(nextIdx, 'next')} aria-label="Next"><ChevronRight size={22} /></button>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: lbZoom > 1 ? (lbDrag.current.active ? 'grabbing' : 'grab') : 'default', overflow: 'hidden' }}
              onMouseDown={lbMouseDown} onWheel={lbWheel} onTouchStart={lbTouchStart} onTouchEnd={lbTouchEnd}>
              <img className="cdp-lb-img" src={images[activeIdx]} alt={carTitle} draggable={false}
                style={{ transform: `translate(${lbPan.x}px,${lbPan.y}px) scale(${lbZoom})`, transformOrigin: 'center center', transition: lbDrag.current.active ? 'none' : 'transform 0.08s ease' }}
                onError={e => { e.target.src = '/placeholder-car.jpg'; }}
              />
            </div>
            <div className="cdp-lb-zoom-bar">
              <button className="cdp-lb-zoom-btn" onClick={() => { setLbZoom(z => Math.max(0.5, z - 0.25)); setLbPan({ x: 0, y: 0 }); }} aria-label="Zoom out"><ZoomOut size={16} /></button>
              <span className="cdp-lb-zoom-label">{Math.round(lbZoom * 100)}%</span>
              <button className="cdp-lb-zoom-btn" onClick={() => setLbZoom(z => Math.min(5, z + 0.25))} aria-label="Zoom in"><ZoomIn size={16} /></button>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
              <button className="cdp-lb-zoom-btn" onClick={() => { setLbZoom(1); setLbPan({ x: 0, y: 0 }); }}
                style={{ fontSize: 11, fontFamily: "system-ui,sans-serif", color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>Reset</button>
            </div>
          </div>
        )}

      </div>

      {/* ── mobile sticky bar ── */}
      <div className="cdp-mobile-bar">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'0 4px', flexShrink:0 }}>
          <HeartButton listingId={car?.id} size={20} style={isXdrive ? { color: 'rgba(0,0,0,0.5)' } : undefined} />
          <span style={{ fontSize:9, color: isXdrive ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)', fontFamily:"system-ui,sans-serif" }}>Save</span>
        </div>
        {/* Compare moved up beside the calculator in the title strip so it isn't
            missed; kept out of this bar to avoid duplicating it. */}
        <button className="cdp-mobile-bar-wa" onClick={handleWhatsApp}>WhatsApp</button>
        {!isOwnListing && (
        <button className="cdp-mobile-bar-book" onClick={handleBookingClick}>Book a Viewing</button>
        )}
      </div>

      {/* ── reserved popup ── */}
      {showReservedPopup && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReservedPopup(false); }}
        >
          <div style={{ background: th.card, width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:'28px 28px 40px', boxShadow:'0 -12px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ height:3, background:'linear-gradient(to right,#fbbf24,#f59e0b)', borderRadius:'20px 20px 0 0', margin:'-28px -28px 24px' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <p style={{ fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#fbbf24', fontWeight:700, margin:'0 0 4px', fontFamily:"system-ui,sans-serif" }}>Status Update</p>
                <h2 style={{ fontSize:'1.8rem', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.06em', color: th.text, margin:0, lineHeight:1 }}>Car Reserved</h2>
              </div>
              <button onClick={() => setShowReservedPopup(false)} style={{ background:'none', border:'none', cursor:'pointer', color: th.textMuted, padding:4 }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize:14, color: th.textSec, lineHeight:1.6, margin:'0 0 24px', fontFamily:"system-ui,sans-serif" }}>
              This car is currently reserved. WhatsApp the seller for confirmation or to find out when it becomes available.
            </p>
            <button
              onClick={() => { setShowReservedPopup(false); handleWhatsApp(); }}
              style={{ width:'100%', background:'#16a34a', color:'#fff', border:'none', borderRadius:10, padding:'14px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"system-ui,sans-serif", letterSpacing:'0.02em' }}
            >
              WhatsApp Seller
            </button>
          </div>
        </div>
      )}

      {/* ── enquiry modal ── */}
      {showEnquiryModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowEnquiryModal(false); }}>
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '20px' }} className="p-6 w-full max-w-sm">
            <h3 className="font-semibold text-lg mb-1" style={{ color: th.text }}>
              {enquiryTarget?.name ? `Contact ${enquiryTarget.name}` : 'Contact Dealer'}
            </h3>
            <p className="text-sm mb-4" style={{ color: th.textMuted }}>
              {enquiryTarget?.name
                ? `Enter your details to continue to ${enquiryTarget.name} on WhatsApp`
                : 'Enter your details to continue to WhatsApp'}
            </p>
            <input
              placeholder="Your name"
              aria-label="Your name"
              value={enquiryForm.name}
              onChange={e => setEnquiryForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('cdp-enq-phone')?.focus(); } }}
              onFocus={() => setFocused('enq_name')} onBlur={() => setFocused(null)}
              style={inputStyle(focusedField === 'enq_name', th)}
            />
            <input
              id="cdp-enq-phone"
              placeholder="Phone number (optional)"
              aria-label="Phone number"
              inputMode="tel"
              value={enquiryForm.phone}
              onChange={e => setEnquiryForm(p => ({ ...p, phone: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && enquiryForm.name) { e.preventDefault(); handleEnquirySubmit(); } }}
              onFocus={() => setFocused('enq_phone')} onBlur={() => setFocused(null)}
              style={inputStyle(focusedField === 'enq_phone', th)}
            />
            <select
              value={enquiryForm.state}
              aria-label="Your state"
              onChange={e => setEnquiryForm(p => ({ ...p, state: e.target.value }))}
              onFocus={() => setFocused('enq_state')} onBlur={() => setFocused(null)}
              style={{ ...inputStyle(focusedField === 'enq_state', th), cursor: 'pointer', marginBottom: 16 }}
            >
              <option value="" style={{ background: th.card, color: th.text }}>Your state (optional)</option>
              {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => (
                <option key={s} value={s} style={{ background: th.card, color: th.text }}>{s}</option>
              ))}
            </select>
            <Turnstile onToken={setEnquiryToken} action="enquiry" className="cdp-enq-turnstile" />
            <p style={{ fontSize: 11, color: th.textMuted, lineHeight: 1.5, marginTop: 8 }}>
              By continuing, you agree to our <button type="button" onClick={() => setLegalDoc('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Privacy Policy</button> and to being contacted about your enquiry.
            </p>
            <button
              onClick={handleEnquirySubmit}
              disabled={!enquiryForm.name || enquirySubmitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm"
              style={{ borderTop: '2px solid #16a34a', letterSpacing: '0.02em', marginTop: 4 }}
            >
              {enquirySubmitting ? 'Opening WhatsApp...' : 'Continue to WhatsApp'}
            </button>
            <button onClick={() => setShowEnquiryModal(false)} className="w-full mt-2 text-sm py-2" style={{ color: th.textMuted }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── booking modal ── */}
      {showBookingModal && (
        <>
          <style>{`
            .cdp-bk-overlay { display:flex; align-items:flex-end; justify-content:center; padding:0; }
            .cdp-bk-card { border-radius:20px 20px 0 0; }
            .cdp-bk-top-bar { border-radius:20px 20px 0 0; }
            @media (min-width:640px) {
              .cdp-bk-overlay { align-items:center; padding:24px; }
              .cdp-bk-card { border-radius:20px !important; }
              .cdp-bk-top-bar { border-radius:20px 20px 0 0 !important; }
            }
          `}</style>
          <div
            className="cdp-bk-overlay"
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', zIndex:200, display:'flex' }}
            onClick={e => { if (e.target === e.currentTarget) { setShowBookingModal(false); } }}
          >
            <div
              className="cdp-bk-card"
              style={{ background: th.card, width:'100%', maxWidth:500, maxHeight:'92vh', overflowY:'auto', position:'relative', boxShadow:'0 -12px 60px rgba(0,0,0,0.5)' }}
            >
              {/* red accent bar */}
              <div className="cdp-bk-top-bar" style={{ height:3, background:'linear-gradient(to right,#dc2626,#b91c1c)', flexShrink:0 }} />

              {/* header */}
              <div style={{ padding:'24px 28px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#dc2626', fontWeight:700, margin:0, fontFamily:"system-ui,sans-serif" }}>Schedule a Visit</p>
                  <h2 style={{ fontSize:'2.1rem', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.06em', color:th.text, margin:'4px 0 3px', lineHeight:1 }}>Book a Viewing</h2>
                  <p style={{ fontSize:12, color:th.textMuted, margin:0, fontFamily:"system-ui,sans-serif" }}>{car?.year} {car?.brand} {car?.model}</p>
                </div>
                <button
                  onClick={() => setShowBookingModal(false)}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', color:th.textMuted, display:'flex', alignItems:'center', marginTop:2, flexShrink:0 }}
                >
                  <X size={20} />
                </button>
              </div>

              {booked ? (
                <div style={{ padding:'44px 28px 36px', textAlign:'center' }}>
                  <div style={{ width:60, height:60, borderRadius:'50%', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                    <Check size={26} color="#4ade80" strokeWidth={2.5} />
                  </div>
                  <h3 style={{ fontSize:18, fontWeight:700, color:th.text, margin:'0 0 8px', fontFamily:"system-ui,sans-serif" }}>Viewing Requested</h3>
                  <p style={{ fontSize:13, color:th.textMuted, margin:'0 0 4px', fontFamily:"system-ui,sans-serif" }}>Your slot is held, pending the seller's confirmation.</p>
                  <p style={{ fontSize:13, color:th.textMuted, margin:'0 0 32px', fontFamily:"system-ui,sans-serif" }}>They'll confirm on WhatsApp shortly — please keep the time free.</p>
                  <button
                    onClick={() => setShowBookingModal(false)}
                    style={{ background:'#dc2626', color:'white', border:'none', borderRadius:10, padding:'12px 36px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"system-ui,sans-serif", letterSpacing:'0.02em' }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBook} style={{ padding:'20px 28px 32px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:0 }}>
                    <input type="text" placeholder="Your name" aria-label="Your name" required value={form.name}
                      onChange={e => setForm(f => ({...f, name: e.target.value}))}
                      onFocus={() => setFocused('bk_name')} onBlur={() => setFocused(null)}
                      style={inputStyle(focusedField === 'bk_name', th)} />
                    <input type="tel" placeholder="Phone number" aria-label="Phone number" required value={form.phone}
                      onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                      onFocus={() => setFocused('bk_phone')} onBlur={() => setFocused(null)}
                      style={inputStyle(focusedField === 'bk_phone', th)} />
                  </div>
                  <div style={{ margin:'4px 0 8px' }}>
                    <BookingCalendar
                      carId={car.id}
                      refSlug={getRef() || null}
                      th={th}
                      isXdrive={isXdrive}
                      value={{ date: form.date, time: form.time }}
                      onChange={({ date, time }) => setForm(f => ({ ...f, date, time }))}
                    />
                  </div>
                  <select aria-label="When are you looking to buy?" required value={form.timeline}
                    onChange={e => setForm(f => ({...f, timeline: e.target.value}))}
                    onFocus={() => setFocused('bk_timeline')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'bk_timeline', th), cursor:'pointer', width:'100%' }}>
                    <option value="" style={{ background: th.card }}>When are you looking to buy?</option>
                    {BUYING_INTENT.map(o => (
                      <option key={o.v} value={o.v} style={{ background: th.card }}>{o.l}</option>
                    ))}
                  </select>
                  <select aria-label="Your state" value={form.state}
                    onChange={e => setForm(f => ({...f, state: e.target.value}))}
                    onFocus={() => setFocused('bk_state')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'bk_state', th), cursor:'pointer', width:'100%' }}>
                    <option value="" style={{ background: th.card }}>Your state (optional)</option>
                    {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => (
                      <option key={s} value={s} style={{ background: th.card }}>{s}</option>
                    ))}
                  </select>
                  <textarea placeholder="Notes (optional)" aria-label="Notes (optional)" rows={2} value={form.notes}
                    onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                    onFocus={() => setFocused('bk_notes')} onBlur={() => setFocused(null)}
                    style={{ ...inputStyle(focusedField === 'bk_notes', th), resize:'none', width:'100%' }} />

                  {/* consent */}
                  <div style={{ borderTop:`1px solid ${th.border}`, paddingTop:16, marginTop:4, marginBottom:16 }}>
                    <label
                      onClick={() => setBookingConsent(c => ({...c, appear: !c.appear}))}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:12, userSelect:'none' }}
                    >
                      <div style={{ width:18, height:18, borderRadius:4, border: bookingConsent.appear ? '2px solid #dc2626' : `2px solid ${th.inputBorder}`, background: bookingConsent.appear ? '#dc2626' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1, transition:'all 0.15s' }}>
                        {bookingConsent.appear && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize:12, color:th.textSec, fontFamily:"system-ui,sans-serif", lineHeight:1.5 }}>
                        This is a real commitment — I will show up for this viewing at the time I picked
                      </span>
                    </label>
                    <label
                      onClick={() => setBookingConsent(c => ({...c, whatsapp: !c.whatsapp}))}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', userSelect:'none' }}
                    >
                      <div style={{ width:18, height:18, borderRadius:4, border: bookingConsent.whatsapp ? '2px solid #dc2626' : `2px solid ${th.inputBorder}`, background: bookingConsent.whatsapp ? '#dc2626' : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1, transition:'all 0.15s' }}>
                        {bookingConsent.whatsapp && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize:12, color:th.textSec, fontFamily:"system-ui,sans-serif", lineHeight:1.5 }}>
                        I agree to receive a WhatsApp confirmation message
                      </span>
                    </label>
                  </div>

                  <p style={{ fontSize:11, color:th.textMuted, lineHeight:1.5, marginBottom:10 }}>
                    By continuing, you agree to our <button type="button" onClick={() => setLegalDoc('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Privacy Policy</button> and to being contacted about your booking.
                  </p>

                  <button
                    type="submit"
                    disabled={submitting || !bookReady}
                    style={{
                      width:'100%',
                      background: !bookReady ? (isXdrive ? '#e5e7eb' : 'rgba(255,255,255,0.06)') : '#dc2626',
                      color: !bookReady ? th.textMuted : 'white',
                      border:'none',
                      borderTop: !bookReady ? 'none' : '2px solid #b91c1c',
                      borderRadius:10,
                      padding:'14px',
                      fontWeight:700,
                      fontSize:14,
                      cursor: (submitting || !bookReady) ? 'not-allowed' : 'pointer',
                      fontFamily:"system-ui,sans-serif",
                      letterSpacing:'0.02em',
                      transition:'all 0.2s',
                      boxShadow: !bookReady ? 'none' : '0 4px 20px rgba(220,38,38,0.25)',
                    }}
                  >
                    {submitting ? 'Requesting…' : (!form.date || !form.time) ? 'Pick a date & time' : 'Request This Viewing'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  );
}
                 

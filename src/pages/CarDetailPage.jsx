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
  X,
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
} from "lucide-react";
import HeartButton from "../components/HeartButton";
import { useCompare } from "../hooks/useCompare";
import { getCategoryCfg } from "../utils/serviceCategories";
import DamageMap from "../components/DamageMap";
import { getEmbedUrl } from "../utils/videoEmbed";
import { supabase } from "../supabaseClient";
import FinancingCalculator from "../components/FinancingCalculator";
import CarCard from "../components/CarCard";
import { useCTAContext, buildWaUrl } from "../hooks/useCTAContext";
import { captureRef, getRef } from "../utils/refTracking";
import { isSubdomain } from "../hooks/useTenant";
import { trackEvent } from "../utils/analytics";

/* ─── helpers ─── */
const fmt = (n) => Number(n).toLocaleString("en-MY");
const fmtPrice = (n) => `RM ${fmt(n)}`;
const fmtFinancing = (car) => {
  if (car.financing_type === "cash") return "Cash Only";
  if (car.financing_type === "sambung_bayar") return "Sambung Bayar";
  if (car.financing_type === "loan") return "Loan Available";
  return car.loan_eligible === false ? "Cash Only" : "Loan Available";
};

/* 90% loan, 3.5% flat p.a., 7-year tenure */
const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12));
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

const CDP_DOC_TYPES = {
  puspakom: { label: "Puspakom Inspection", color: "#22c55e" },
  service_history: { label: "Service History", color: "#60a5fa" },
  insurance: { label: "Insurance Certificate", color: "#a78bfa" },
  ownership: { label: "Ownership / VOC", color: "#fbbf24" },
  warranty: { label: "Warranty Certificate", color: "#34d399" },
  import_ap: { label: "Import / AP Permit", color: "#fb923c" },
  loan_clearance: { label: "Loan Clearance Letter", color: "#94a3b8" },
  other: { label: "Document", color: "#6b7280" },
};

const inputStyle = (focused) => ({
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${focused ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)"}`,
  borderRadius: "10px",
  padding: "10px 14px",
  color: "white",
  fontSize: "13px",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  marginBottom: "8px",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
});

/* ─── skeleton ─── */
function Skeleton() {
  return (
    <div style={{ background: "#0d0d0d", minHeight: "100vh" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .sk { background: linear-gradient(90deg, #111111 25%, #1a1a1a 50%, #111111 75%);
              background-size: 600px 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
      `}</style>
      <div
        style={{
          height: 52,
          background: "rgba(8,12,20,0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          gap: 32,
          height: "calc(100vh - 52px)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 1.3, display: "flex", gap: 8 }}>
          <div className="sk" style={{ flex: 1 }} />
          <div
            style={{
              width: 68,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {[...Array(5)].map((_, i) => (
              <div key={i} className="sk" style={{ height: 50 }} />
            ))}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div className="sk" style={{ height: 14, width: "35%" }} />
          <div className="sk" style={{ height: 44, width: "80%" }} />
          <div className="sk" style={{ height: 12, width: "55%" }} />
          <div
            className="sk"
            style={{ height: 1, width: "100%", marginTop: 8 }}
          />
          <div className="sk" style={{ height: 48, width: "60%" }} />
          <div
            className="sk"
            style={{ height: 160, borderRadius: 12, marginTop: 16 }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── structured data ─── */
function useCarSchema(listing) {
  useEffect(() => {
    if (!listing) return;
    const name = [listing.year, listing.brand, listing.model, listing.variant]
      .filter(Boolean)
      .join(" ");
    const schema = {
      "@context": "https://schema.org",
      "@type": "Car",
      name,
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
      url: `https://xdrive.my/cars/${listing.slug}`,
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
  }, [listing?.id]);
}

/* ─── main ─── */
export default function CarDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [car, setCar] = useState(null);
  const [dealer, setDealer] = useState(null);
  const ctaCtx = useCTAContext();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [similarCars, setSimilarCars] = useState([]);
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

  /* booking */
  const [form, setForm] = useState({
    name: "",
    phone: "+60",
    date: "",
    time: "09:00",
    notes: "",
    state: "",
  });
  const [focusedField, setFocused] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const bookingRef = useRef(null);

  /* enquiry modal */
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: "", phone: "", state: "" });
  const [enquirySubmitting, setEnquirySubmitting] = useState(false);

  /* view count */
  const [viewCount, setViewCount] = useState(0);

  /* calculator */
  const [calcOpen, setCalcOpen] = useState(false);

  /* document accordion */
  const [openDocKey, setOpenDocKey] = useState(null);
  const toggleDoc = (key) => setOpenDocKey(prev => prev === key ? null : key);

  /* fuel range calculator */
  const [fuelDist, setFuelDist] = useState(250);

  /* detail tabs */
  const [detailTab, setDetailTab] = useState("specs");

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
      let { data: carData, error } = await supabase
        .from("car_listings")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!carData && !error) {
        const res = await supabase
          .from("car_listings")
          .select("*")
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
      let visibleServices = carData.included_services || [];
      if (carData.dealer_id && visibleServices.length > 0) {
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
          visibleServices = visibleServices.filter(
            (s) => !s.id || activeIds.has(s.id),
          );
        }
      }
      setCar({ ...carData, included_services: visibleServices });

      if (carData.dealer_id) {
        const { data: d } = await supabase
          .from("public_dealer_profiles")
          .select(
            "dealership,site_name,whatsapp_number,avatar_url,site_logo_url,slug,subdomain",
          )
          .eq("id", carData.dealer_id)
          .maybeSingle();
        setDealer(d);
        const { data: salesmanData } = await supabase
          .from("profiles")
          .select(
            "full_name, avatar_url, job_title, whatsapp_number, slug, plan",
          )
          .eq("id", carData.dealer_id)
          .eq("role", "salesman")
          .maybeSingle();
        setSalesmanProfile(salesmanData);
      }
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

      if (carData.dealer_id) {
        const simFields =
          "id, slug, year, brand, model, variant, selling_price, original_price, mileage, transmission, state, fuel_type, status, created_at, images, is_recon, auction_grade, interior_grade, import_country, car_documents";
        const { data: simBrand } = await supabase
          .from("car_listings")
          .select(simFields)
          .eq("dealer_id", carData.dealer_id)
          .eq("brand", carData.brand)
          .neq("status", "sold")
          .neq("id", carData.id)
          .order("created_at", { ascending: false })
          .limit(6);
        if ((simBrand || []).length >= 3) {
          setSimilarCars(simBrand);
        } else {
          const { data: simAny } = await supabase
            .from("car_listings")
            .select(simFields)
            .eq("dealer_id", carData.dealer_id)
            .neq("status", "sold")
            .neq("id", carData.id)
            .order("created_at", { ascending: false })
            .limit(6);
          const a = simBrand || [],
            b = simAny || [];
          setSimilarCars(b.length > a.length ? b : a);
        }
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  useCarSchema(car);

  useEffect(() => {
    if (!car) return;
    trackEvent(supabase, "car_view", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
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
    }, 2000);
    return () => clearInterval(autoRef.current);
  }, [car]);

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
    const dir = dx < 0 ? "next" : "prev";
    const len = car?.images?.length || 1;
    go(
      dir === "next" ? (activeIdx + 1) % len : (activeIdx - 1 + len) % len,
      dir,
    );
  }

  function handleWhatsApp() {
    setShowEnquiryModal(true);
  }

  function handleCall() {
    const phone = contactPhone?.replace(/\D/g, "");
    if (!phone) return;
    trackEvent(supabase, "call_click", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      metadata: { source: "car_detail" },
    });
    window.location.href = `tel:+${phone}`;
  }

  async function handleEnquirySubmit() {
    setEnquirySubmitting(true);
    trackEvent(supabase, "whatsapp_click", {
      car_id: car.id,
      car_name: `${car.brand} ${car.model} ${car.year}`,
      dealer_id: car.dealer_id,
      metadata: { source: "storefront", price: car.selling_price },
    });
    const { data: listing } = await supabase
      .from("car_listings")
      .select("dealer_id, assigned_to")
      .eq("id", car.id)
      .single();
    if (listing) {
      const { error: enqErr } = await supabase
        .from("whatsapp_enquiries")
        .insert({
          dealer_id: listing.dealer_id,
          salesman_id: listing.assigned_to,
          listing_id: car.id,
          buyer_name: enquiryForm.name,
          buyer_phone: enquiryForm.phone,
          buyer_state: enquiryForm.state || null,
          buyer_message:
            `Enquiry about ${car.brand} ${car.model} ${car.variant || ""}`.trim(),
          ref_slug: getRef() || null,
          source: "storefront",
          status: "new",
        });
      if (enqErr)
        console.error(
          "[handleEnquirySubmit] insert error:",
          enqErr.message,
          enqErr,
        );
      // Create leads row so buyer_state feeds the demand heatmap
      await supabase.from("leads").insert({
        dealer_id: listing.dealer_id,
        salesman_id: listing.assigned_to || null,
        car_listing_id: car.id,
        buyer_name: enquiryForm.name,
        phone: enquiryForm.phone,
        buyer_state: enquiryForm.state || null,
        lead_source: "whatsapp",
        stage: "new",
      });
    }
    const message = `Hi, I'm ${enquiryForm.name}. I'm interested in the ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""} listed at RM ${car.selling_price?.toLocaleString()}. My number is ${enquiryForm.phone}.`;
    window.open(buildWaUrl(ctaCtx, contactPhone, message), "_blank");
    setShowEnquiryModal(false);
    setEnquirySubmitting(false);
    setEnquiryForm({ name: "", phone: "", state: "" });
  }

  async function handleBook(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    let salesmanId = car.assigned_to || null;
    const refSlug = getRef();
    if (refSlug) {
      const { data: sm } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", refSlug)
        .maybeSingle();
      if (sm?.id) salesmanId = sm.id;
    }
    const [h, m] = form.time.split(":");
    const dt = new Date(`${form.date}T${h.padStart(2, "0")}:${m}:00`);
    const { error: bookErr } = await supabase
      .from("appointments")
      .insert({
        dealer_id: car.dealer_id,
        salesman_id: salesmanId,
        car_listing_id: car.id,
        buyer_name: form.name,
        buyer_phone: form.phone,
        appointment_date: dt.toISOString(),
        notes: form.notes || null,
        status: "confirmed",
      });
    if (bookErr) {
      setSubmitting(false);
      console.error("[handleBook] insert error:", bookErr.message, bookErr);
      alert("Booking failed. Please try again.");
      return;
    }
    // Create leads row so buyer_state feeds the demand heatmap
    await supabase.from("leads").insert({
      dealer_id: car.dealer_id,
      salesman_id: salesmanId,
      car_listing_id: car.id,
      buyer_name: form.name,
      phone: form.phone,
      buyer_state: form.state || null,
      lead_source: "enquiry",
      stage: "new",
    });
    setSubmitting(false);
    setBooked(true);
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
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <p style={{ fontSize: 15, color: "#475569", marginBottom: 20 }}>
          This listing is no longer available.
        </p>
        <Link
          to="/cars"
          style={{ color: "#dc2626", fontSize: 13, textDecoration: "none" }}
        >
          ← Browse all cars
        </Link>
      </div>
    );

  const images = car.images?.length ? car.images : ["/placeholder-car.jpg"];
  const contactPhone =
    dealer?.whatsapp_number || salesmanProfile?.whatsapp_number || null;
  const isRecon = car.is_recon;
  const isHot =
    car.original_price &&
    car.original_price > 0 &&
    car.selling_price > 0 &&
    car.selling_price <= car.original_price * 0.97;
  const saving = isHot ? car.original_price - car.selling_price : 0;
  const hasDocuments =
    Array.isArray(car.car_documents) && car.car_documents.length > 0;
  const carTitle = `${car.year} ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""}`;
  const dealerName =
    dealer?.site_name || dealer?.dealership || dealer?.full_name || "Dealer";
  const listedDays = daysAgo(car.created_at);
  const today = new Date().toISOString().split("T")[0];
  const imgCount = images.length;
  const prevIdx = (activeIdx - 1 + imgCount) % imgCount;
  const nextIdx = (activeIdx + 1) % imgCount;
  const siteName = dealer?.site_name || dealer?.dealership || "XDrive";

  return (
    <>
      <Helmet>
        <title>
          {car
            ? `${car.year} ${car.brand} ${car.model} for sale in Malaysia | ${siteName}`
            : `Car Listing | ${siteName}`}
        </title>
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        {(() => {
          const desc = car
            ? `${car.year} ${car.brand} ${car.model}${car.variant ? ` ${car.variant}` : ""} for sale in Malaysia. RM ${Number(car.selling_price).toLocaleString("en-MY")}, ${car.mileage ? `${Number(car.mileage).toLocaleString("en-MY")}km, ` : ""}${car.transmission || ""}. Verified dealer on XDrive.`
            : "";
          const img = car?.images?.[0] || "https://xdrive.my/og-default.jpg";
          const url = car ? `https://xdrive.my/cars/${car.slug}` : "https://xdrive.my";
          return <>
            <meta name="description" content={desc} />
            <meta property="og:type" content="website" />
            <meta property="og:locale" content="en_MY" />
            <meta property="og:site_name" content="XDrive" />
            <meta property="og:title" content={car ? `${car.year} ${car.brand} ${car.model} | ${siteName}` : siteName} />
            <meta property="og:description" content={desc} />
            <meta property="og:image" content={img} />
            <meta property="og:url" content={url} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={car ? `${car.year} ${car.brand} ${car.model} | ${siteName}` : siteName} />
            <meta name="twitter:description" content={desc} />
            <meta name="twitter:image" content={img} />
            {car && <link rel="canonical" href={url} />}
          </>;
        })()}
      </Helmet>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
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

        .cdp-root { background: #060c14; min-height: 100vh; font-family: 'DM Sans', sans-serif; color: #e2e8f0; }

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
          font-family: 'DM Sans', sans-serif; padding: 0;
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
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
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
          height: 72vh; min-height: 480px; max-height: 820px;
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
        @media (max-width: 900px) {
          .cdp-header-actions { display: none; }
          .cdp-mobile-enquire { display: inline-flex !important; }
        }

        /* ── lightbox ── */
        .cdp-lb-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.96); display: flex; align-items: center; justify-content: center; user-select: none; }
        .cdp-lb-img { max-width: 90vw; max-height: 88vh; object-fit: contain; display: block; transition: transform 0.08s linear; pointer-events: none; }
        .cdp-lb-close { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.08); border: none; color: white; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; z-index: 2; }
        .cdp-lb-close:hover { background: rgba(255,255,255,0.18); }
        .cdp-lb-zoom-bar { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 40px; padding: 8px 16px; }
        .cdp-lb-zoom-btn { background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; transition: color 0.15s; }
        .cdp-lb-zoom-btn:hover { color: white; }
        .cdp-lb-zoom-label { font-size: 12px; color: rgba(255,255,255,0.6); font-family: 'DM Sans', sans-serif; min-width: 40px; text-align: center; }
        .cdp-lb-counter { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); font-size: 12px; color: rgba(255,255,255,0.5); font-family: 'DM Sans', sans-serif; }
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
          .cdp-mobile-bar-wa { flex: 0 0 auto; border-radius: 10px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: 1px solid rgba(34,197,94,0.3); cursor: pointer; background: rgba(34,197,94,0.08); color: #4ade80; padding: 12px 14px; }
          .cdp-mobile-bar-book { flex: 1; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; background: #dc2626; color: white; padding: 12px 0; border: none; border-top: 2px solid #b91c1c; box-shadow: 0 2px 12px rgba(220,38,38,0.3); }
        }
        @media (max-width: 480px) { .cdp-arrow { display: none; } }
      `}</style>

      <div className="cdp-root">
        {/* ── header ── */}
        <header className="cdp-header" style={{ position: "sticky" }}>
          <button className="cdp-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className={`cdp-header-title${showTitle ? " visible" : ""}`}>
            {carTitle}
          </span>
          <div className="cdp-header-actions">
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
              <HeartButton listingId={car?.id} size={16} />
            </div>
            <button
              onClick={() => { if (!car?.id) return; isInCompare(car.id) ? removeFromCompare(car.id) : addToCompare(car.id); }}
              style={{ background: car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${car?.id && isInCompare(car.id) ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, color: car?.id && isInCompare(car.id) ? '#f87171' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
              <ArrowLeftRight size={13} />
              {car?.id && isInCompare(car.id) ? 'In Compare' : 'Compare'}
            </button>
            <button className="cdp-enquire-btn" onClick={handleWhatsApp}>Enquire</button>
          </div>
          <button className="cdp-enquire-btn cdp-mobile-enquire" onClick={handleWhatsApp}>Enquire</button>
          <div className="cdp-header-redline" />
        </header>

        {/* ── SECTION 1: Photo Mosaic ── */}
        <div ref={heroRef}>
          {/* Desktop 3-cell grid */}
          <div className="cdp-mosaic-grid cdp-desktop-only">
            {/* Primary — spans both rows */}
            <div
              className="cdp-mosaic-cell cdp-mosaic-primary"
              onClick={() => {
                go(0, "next");
                setLbOpen(true);
              }}
            >
              <img
                src={images[0]}
                alt={carTitle}
                fetchPriority="high"
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
                onError={(e) => {
                  e.target.src = "/placeholder-car.jpg";
                }}
              />
              {/* gradients */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(6,8,15,0.55), transparent 50%)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to right, rgba(6,8,15,0.2), transparent 30%)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
              {/* title overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: 20,
                  zIndex: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.24em",
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  {car.brand}
                </p>
                <p
                  style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: "clamp(1.8rem,3vw,2.8rem)",
                    color: "white",
                    lineHeight: 1,
                    letterSpacing: "0.04em",
                    margin: 0,
                  }}
                >
                  {car.model}
                  {car.variant ? " " + car.variant : ""}
                </p>
              </div>
              {/* scan line */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 2,
                  background:
                    "linear-gradient(to right,transparent,rgba(220,38,38,0.5),transparent)",
                  animation: "cdp-scanLine 2s ease-out 0.3s 1 forwards",
                  top: 0,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
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
                src={images[1] || images[0]}
                alt={`${carTitle} view 2`}
                loading="lazy"
                onError={(e) => {
                  e.target.src = "/placeholder-car.jpg";
                }}
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
                src={images[2] || images[0]}
                alt={`${carTitle} view 3`}
                loading="lazy"
                onError={(e) => {
                  e.target.src = "/placeholder-car.jpg";
                }}
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
                  fontFamily: "'DM Sans',sans-serif",
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
              src={images[activeIdx]}
              alt={carTitle}
              fetchPriority={activeIdx === 0 ? "high" : "auto"}
              loading={activeIdx === 0 ? "eager" : "lazy"}
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
                e.target.src = "/placeholder-car.jpg";
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

        {/* M1 — Swipeable image */}
        <div className="cdp-mobile-only" style={{ position:'relative', height:'clamp(240px,62vw,420px)', overflow:'hidden', background:'#080f18' }}
          onTouchStart={galleryTouchStart} onTouchEnd={galleryTouchEnd}>
          {!imgLoaded && <div className="cdp-img-shimmer" />}
          <img key={slideKey} className={`cdp-main-img cdp-slide-${slideDir}`}
            src={images[activeIdx]} alt={carTitle} fetchPriority="high"
            style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0, transition:'opacity 0.8s ease' }}
            onLoad={e => { setImgLoaded(true); e.currentTarget.style.opacity = '1'; }}
            onError={e => { e.target.src='/placeholder-car.jpg'; setImgLoaded(true); }}
          />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'45%', background:'linear-gradient(to top, rgba(6,8,15,0.8), transparent)', pointerEvents:'none', zIndex:3 }} />
          <div style={{ position:'absolute', bottom:14, left:14, zIndex:5, background:'rgba(6,8,15,0.7)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 12px', fontSize:11, color:'rgba(255,255,255,0.8)', fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>
            {activeIdx + 1} / {imgCount}
          </div>
          <button onClick={() => setLbOpen(true)}
            style={{ position:'absolute', bottom:12, right:14, zIndex:5, background:'rgba(6,8,15,0.7)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'6px 12px', fontSize:11, color:'white', fontWeight:600, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
            <Camera size={11} style={{ color:'#dc2626' }} /> All photos
          </button>
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

        {/* M2 — Identity block */}
        <div className="cdp-mobile-only" style={{ padding:'20px 18px 0' }}>
          {(isRecon || isHot || hasDocuments) && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
              {isRecon && <span style={{ background:'rgba(168,85,247,0.1)', border:'1px solid rgba(168,85,247,0.25)', color:'#c084fc', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>Recon</span>}
              {isHot   && <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.28)', color:'#f87171', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>Hot Deal</span>}
              {hasDocuments && <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.28)', color:'#4ade80', fontSize:'10px', padding:'3px 10px', borderRadius:'4px', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}><BadgeCheck size={11} /> Verified Docs</span>}
            </div>
          )}
          <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.26em', color:'#dc2626', fontWeight:700, marginBottom:4 }}>{car.brand}</p>
          <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(2.4rem,9vw,3.2rem)', color:'white', lineHeight:0.95, letterSpacing:'0.03em', marginBottom:8 }}>
            {car.model}{car.variant ? ' '+car.variant : ''}
          </h1>
          <p style={{ fontSize:12, color:'#475569', letterSpacing:'0.04em', marginBottom:6 }}>
            {[car.year, car.body_type, car.transmission].filter(Boolean).join('  ·  ')}
          </p>
          {(dealer?.subdomain || dealer?.slug) && !isSubdomain() && (
            <a
              href={dealer.subdomain ? `https://${dealer.subdomain}.xdrive.my` : `https://xdrive.my/s/${dealer.slug}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#60a5fa', textDecoration:'none', marginBottom:16, letterSpacing:'0.04em' }}
            >
              {dealer.site_name || dealer.dealership} ↗
            </a>
          )}
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4, flexWrap:'wrap' }}>
            <p style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'2.6rem', color:'white', lineHeight:1, margin:0 }}>
              {fmtPrice(car.selling_price)}
            </p>
            {calcMonthly(car.selling_price) && (
              <span style={{ fontSize:12, color:'#475569' }}>
                ~<span style={{ color:'#64748b' }}>RM {fmt(calcMonthly(car.selling_price))}</span>/mo
              </span>
            )}
          </div>
          {isHot && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <span style={{ fontSize:13, color:'#1e293b', textDecoration:'line-through' }}>{fmtPrice(car.original_price)}</span>
              <span style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', color:'#f87171', fontSize:'11px', padding:'2px 10px', borderRadius:'20px', fontWeight:600, letterSpacing:'0.04em' }}>SAVE {fmtPrice(saving)}</span>
            </div>
          )}
          <div style={{ height:1, marginBottom:20, background:'linear-gradient(to right,rgba(220,38,38,0.3),rgba(255,255,255,0.04),transparent)' }} />
        </div>

        {/* M3 — Quick stats 2×4 */}
        <div className="cdp-mobile-only" style={{ padding:'0 18px', marginBottom:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
            {[
              { label:'Mileage',      value: car.mileage ? fmt(car.mileage)+' km' : '—' },
              { label:'Engine',       value: car.engine_cc ? fmt(car.engine_cc)+' cc' : '—' },
              { label:'Transmission', value: car.transmission || '—' },
              { label:'Fuel',         value: car.fuel_type || '—' },
              { label:'Colour',       value: car.colour || '—' },
              { label:'Owners',       value: car.previous_owners != null ? car.previous_owners+' owner'+(car.previous_owners!==1?'s':'') : '—' },
              { label:'Road Tax',     value: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY',{month:'short',year:'numeric'}) : '—' },
              { label:'Financing',    value: fmtFinancing(car) },
              ...(car.horsepower ? [{ label:'Power', value:`${car.horsepower} bhp` }] : []),
              ...(car.doors ? [{ label:'Doors', value:`${car.doors} doors` }] : []),
              ...(car.seats ? [{ label:'Seats', value:`${car.seats} seats` }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ padding:'14px', background:'#0a1220', borderRight:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.14em', color:'#334155', fontWeight:700, marginBottom:5 }}>{label}</p>
                <p style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, margin:0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* M4 — CTA card */}
        <div className="cdp-mobile-only" style={{ padding:'0 18px', marginBottom:24 }}>
          <div style={{ background:'#0a1625', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px' }}>
            <button
              onClick={() => {
                trackEvent(supabase, 'booking_click', { car_id: car.id, car_name: `${car.brand} ${car.model} ${car.year}`, dealer_id: car.dealer_id, metadata: { source: 'car_detail' } });
                document.getElementById('booking-form-mobile')?.scrollIntoView({ behavior:'smooth', block:'start' });
              }}
              style={{ width:'100%', background:'#dc2626', color:'white', border:'none', borderTop:'2px solid #b91c1c', borderRadius:10, padding:'14px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 4px 20px rgba(220,38,38,0.25)', marginBottom:8, letterSpacing:'0.02em' }}>
              Book a Viewing
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleWhatsApp}
                style={{ flex:1, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', color:'#4ade80', borderRadius:10, padding:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                WhatsApp
              </button>
              {contactPhone && (
                <button onClick={handleCall}
                  style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', borderRadius:10, padding:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  <Phone size={13} /> Call
                </button>
              )}
            </div>
            {car.warranty_months > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, padding:'8px 12px', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:9 }}>
                <ShieldCheck size={13} style={{ color:'#4ade80', flexShrink:0 }} />
                <span style={{ fontSize:12, color:'#4ade80', fontWeight:600 }}>{car.warranty_months}-month warranty included</span>
              </div>
            )}
            {car.deposit_amount > 0 && (
              <p style={{ fontSize:11, color:'#475569', marginTop:8, textAlign:'center' }}>RM {fmt(car.deposit_amount)} deposit to reserve</p>
            )}
            <button onClick={() => setCalcOpen(true)}
              style={{ width:'100%', background:'none', border:'1px solid rgba(255,255,255,0.06)', color:'#475569', borderRadius:10, padding:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:12, letterSpacing:'0.05em', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
              <Calculator size={13} /> Financing Calculator
            </button>
            {dealer?.subdomain && !isSubdomain() && (
              <a href={`https://${dealer.subdomain}.xdrive.my`} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, width:'100%', marginTop:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:'#94a3b8', borderRadius:10, padding:'10px', fontSize:12, letterSpacing:'0.05em', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", textDecoration:'none', boxSizing:'border-box' }}>
                <ExternalLink size={13} /> Visit Dealer's Page
              </a>
            )}
            <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'14px 0' }} />
            {/* Dealer row */}
            {(() => {
              const isAgent = !!salesmanProfile;
              const displayName = isAgent ? (salesmanProfile.full_name || 'Agent') : dealerName;
              const avatarSrc = isAgent ? salesmanProfile.avatar_url : (dealer?.site_logo_url || dealer?.avatar_url);
              return (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt={displayName} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:32, height:32, borderRadius:'50%', background: isAgent ? '#1d4ed8' : '#111e2e', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', border:'1px solid rgba(255,255,255,0.08)' }}>
                        {displayName[0]?.toUpperCase()}
                      </div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, color:'white', fontWeight:600, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</p>
                    <p style={{ fontSize:11, color: isAgent ? '#60a5fa' : '#334155' }}>
                      {isAgent ? 'Independent Agent' : (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'cdp-pulse 2s ease infinite' }} />
                          Verified Dealer
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {listedDays !== null && <p style={{ fontSize:10, color:'#1e293b' }}>{listedDays}d ago</p>}
                    {viewCount > 0 && <p style={{ fontSize:10, color:'#1e293b' }}>👁 {viewCount}</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* M5 — Description + tabs + sections */}
        <div className="cdp-mobile-only" style={{ padding:'0 18px', marginBottom:32 }}>
          <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.2em', color:'#334155', fontWeight:700, marginBottom:12 }}>About this car</p>
          <p style={{ fontSize:14, color:'#64748b', lineHeight:1.9, marginBottom:28 }}>
            {car.specs || `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
          </p>
          {/* Tabs */}
          {(() => {
            const tabs = [
              { key:'specs', label:'Specs' },
              ...(parseTags(car.features).length > 0 ? [{ key:'features', label:'Features' }] : []),
              ...(parseTags(car.options).length  > 0 ? [{ key:'options',  label:'Options'  }] : []),
            ];
            return (
              <>
                <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {tabs.map(t => (
                    <button key={t.key} onClick={() => setDetailTab(t.key)}
                      style={{ background: detailTab===t.key ? 'rgba(220,38,38,0.04)' : 'none', border:'none', borderBottom:`2px solid ${detailTab===t.key ? '#dc2626' : 'transparent'}`, color: detailTab===t.key ? 'white' : '#334155', padding:'10px 24px 12px', marginBottom:-1, fontSize:'13px', fontWeight: detailTab===t.key ? 600 : 400, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all .2s', letterSpacing:'0.05em' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {detailTab === 'specs' && (
                  <div>
                    {[
                      { key:'Registration Date', val: car.registration_date || car.local_reg_date || '—' },
                      { key:'VIN / Chassis',     val: car.vin_number || '—' },
                      { key:'Condition',         val: car.condition || '—' },
                      { key:'Chassis Status',    val: <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: car.chassis_status==='clean'?'#22c55e':car.chassis_status==='repaired'?'#eab308':car.chassis_status==='written_off'?'#dc2626':'#334155' }} />{car.chassis_status||'—'}</span> },
                      { key:'Location',          val: [car.city, car.state].filter(Boolean).join(', ') || '—' },
                      { key:'Previous Owners',   val: car.previous_owners ?? '—' },
                      { key:'Road Tax Expiry',   val: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY') : '—' },
                      { key:'Financing',         val: fmtFinancing(car) },
                      { key:'Warranty',          val: car.warranty_months > 0 ? car.warranty_months+' months' : 'None' },
                      { key:'Deposit to Reserve',val: car.deposit_amount > 0 ? 'RM '+fmt(car.deposit_amount) : '—' },
                      ...(isRecon ? [
                        { key:'Import Country', val: car.import_country || '—' },
                        { key:'Auction House',  val: car.auction_house  || '—' },
                        { key:'Exterior Grade', val: car.auction_grade  || '—' },
                        { key:'Interior Grade', val: car.interior_grade || '—' },
                      ] : []),
                    ].map(({ key, val }) => (
                      <div key={key} className="cdp-row">
                        <span style={{ fontSize:'13px', color:'#64748b' }}>{key}</span>
                        <span style={{ fontSize:'13px', color:'#f1f5f9', textAlign:'right' }}>{val}</span>
                      </div>
                    ))}
                    {isRecon && Array.isArray(car.damage_map) && car.damage_map.length > 0 && (
                      <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.16em', color:'#334155', fontWeight:700, marginBottom:14 }}>Condition Map</p>
                        <div style={{ background:'#0a1220', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'16px 20px' }}>
                          <DamageMap value={car.damage_map} readOnly />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {detailTab === 'features' && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {parseTags(car.features).map((tag, i) => (
                      <span key={i} style={{ padding:'5px 12px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', fontSize:'12px', color:'#64748b', background:'rgba(255,255,255,0.02)' }}>{tag}</span>
                    ))}
                  </div>
                )}
                {detailTab === 'options' && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                    {parseTags(car.options).map((tag, i) => (
                      <span key={i} style={{ padding:'5px 12px', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'6px', fontSize:'12px', color:'#64748b', background:'rgba(255,255,255,0.02)' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          {/* What's included */}
          {Array.isArray(car.included_services) && car.included_services.length > 0 && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:14 }}>What's Included</p>
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
                <p style={{ fontSize:11, color:'#334155', marginTop:12 }}>Estimated add-on value: <span style={{ color:'#60a5fa', fontWeight:700 }}>RM {Number(car.included_services_cost).toLocaleString()}</span></p>
              )}
            </div>
          )}
          {/* Video */}
          {car.video_url && getEmbedUrl(car.video_url) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
                <PlayCircle size={13} style={{ color:'#dc2626' }} /> Watch Walkthrough
              </p>
              <div style={{ position:'relative', paddingBottom:'56.25%', height:0, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.07)' }}>
                <iframe src={getEmbedUrl(car.video_url)} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }} allowFullScreen title={`${car.year} ${car.brand} ${car.model} walkthrough`} />
              </div>
            </div>
          )}

          {/* Car History */}
          <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <Shield size={13} style={{ color:'#60a5fa' }} />
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700 }}>Car History</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {[
                { key:'puspakom',      icon:<ShieldCheck size={13} />, label:'Puspakom Inspection', okColor:'#4ade80', okBg:'rgba(34,197,94,0.1)',   okBorder:'rgba(34,197,94,0.3)'   },
                { key:'service_history',icon:<FileText size={13} />,   label:'Service History',      okColor:'#60a5fa', okBg:'rgba(96,165,250,0.1)',  okBorder:'rgba(96,165,250,0.3)'  },
                { key:'loan_clearance', icon:<BadgeCheck size={13} />, label:'Loan Clearance',       okColor:'#34d399', okBg:'rgba(52,211,153,0.1)',  okBorder:'rgba(52,211,153,0.3)'  },
                { key:'ownership',      icon:<Eye size={13} />,        label:'Ownership Docs',       okColor:'#fbbf24', okBg:'rgba(251,191,36,0.1)',  okBorder:'rgba(251,191,36,0.3)'  },
              ].map(({ key, icon, label, okColor, okBg, okBorder }) => {
                const doc = car.car_documents?.find(d => d.type === key);
                const rk = `m-${key}`;
                const isOpen = openDocKey === rk;
                const asImage = isImageUrl(doc?.url);
                return (
                  <div key={key} style={{ background:'#0a1220', border:`1px solid ${isOpen && doc ? okBorder : 'rgba(255,255,255,0.05)'}`, borderRadius:9, overflow:'hidden', transition:'border-color 0.2s' }}>
                    <div onClick={() => doc && toggleDoc(rk)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor: doc ? 'pointer' : 'default' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ color: doc ? okColor : '#334155' }}>{icon}</span>
                        <p style={{ fontSize:12, color:'#cbd5e1', fontWeight:500, margin:0 }}>{label}</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: doc ? okBg : 'rgba(100,116,139,0.08)', border:`1px solid ${doc ? okBorder : 'rgba(100,116,139,0.15)'}`, color: doc ? okColor : '#475569', whiteSpace:'nowrap' }}>
                          {doc ? '✓ Available' : 'Not Provided'}
                        </span>
                        {doc && <ChevronDown size={12} style={{ color:'#475569', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }} />}
                      </div>
                    </div>
                    {isOpen && doc && (
                      <div style={{ borderTop:`1px solid ${okBorder}40`, padding:'12px 14px', background:`${okColor}08` }}>
                        {asImage ? (
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
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Any other document types not in the 4 main rows */}
              {car.car_documents?.filter(d => !['puspakom','service_history','loan_clearance','ownership'].includes(d.type)).map((doc, i) => {
                const cfg = CDP_DOC_TYPES[doc.type] || CDP_DOC_TYPES.other;
                const rk = `m-extra-${i}`;
                const isOpen = openDocKey === rk;
                const asImage = isImageUrl(doc.url);
                return (
                  <div key={rk} style={{ background:'#0a1220', border:`1px solid ${isOpen ? cfg.color+'40' : 'rgba(255,255,255,0.05)'}`, borderRadius:9, overflow:'hidden', transition:'border-color 0.2s' }}>
                    <div onClick={() => toggleDoc(rk)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer' }}>
                      <p style={{ fontSize:12, color:'#cbd5e1', fontWeight:500, margin:0 }}>{cfg.label}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, color:cfg.color }}>✓ Available</span>
                        <ChevronDown size={12} style={{ color:'#475569', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', flexShrink:0 }} />
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
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#0a1220', border:'1px solid rgba(255,255,255,0.05)', borderRadius:9 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Star size={13} style={{ color:'#fbbf24' }} />
                  <p style={{ fontSize:12, color:'#cbd5e1', fontWeight:500, margin:0 }}>Previous Owners</p>
                </div>
                <span style={{ fontSize:12, color:'#e2e8f0', fontWeight:600 }}>
                  {car.previous_owners != null ? `${car.previous_owners} owner${car.previous_owners!==1?'s':''}` : '—'}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#0a1220', border:'1px solid rgba(255,255,255,0.05)', borderRadius:9 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Shield size={13} style={{ color: car.warranty_months > 0 ? '#34d399' : '#334155' }} />
                  <p style={{ fontSize:12, color:'#cbd5e1', fontWeight:500, margin:0 }}>Warranty</p>
                </div>
                <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background: car.warranty_months>0?'rgba(52,211,153,0.1)':'rgba(100,116,139,0.08)', border:`1px solid ${car.warranty_months>0?'rgba(52,211,153,0.3)':'rgba(100,116,139,0.15)'}`, color: car.warranty_months>0?'#34d399':'#475569' }}>
                  {car.warranty_months > 0 ? `${car.warranty_months} months` : 'No Warranty'}
                </span>
              </div>
              {Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0 && (() => {
                const PC = [
                  { key:'part_exchange',    label:'Part Exchange',      color:'#60a5fa' },
                  { key:'whatsapp_chat',    label:'WhatsApp Chat',      color:'#4ade80' },
                  { key:'video_walkthrough',label:'Video Walkthrough',  color:'#f87171' },
                  { key:'warranty_incl',    label:'Warranty Included',  color:'#34d399' },
                  { key:'verified_docs',    label:'Verified Docs',      color:'#4ade80' },
                  { key:'book_viewing',     label:'Book a Viewing',     color:'#60a5fa' },
                ].filter(p => car.dealer_perks.includes(p.key));
                if (!PC.length) return null;
                return (
                  <>
                    <div style={{ height:1, background:'rgba(255,255,255,0.04)', margin:'2px 0' }} />
                    {PC.map(({ key, label, color }) => (
                      <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#0a1220', border:'1px solid rgba(255,255,255,0.05)', borderRadius:9 }}>
                        <p style={{ fontSize:12, color:'#cbd5e1', fontWeight:500, margin:0 }}>{label}</p>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, background:`${color}15`, border:`1px solid ${color}30`, color }}>✓ Available</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Performance */}
          {(car.horsepower || car.acceleration || car.top_speed || car.boot_size || car.doors || car.seats) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:14 }}>Performance &amp; Details</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
                {[
                  { label:'Power', value: car.horsepower ? `${car.horsepower} bhp` : null },
                  { label:'Doors', value: car.doors ? `${car.doors} doors` : null },
                  { label:'Seats', value: car.seats ? `${car.seats} seats` : null },
                  { label:'0–100 km/h', value: car.acceleration ? `${car.acceleration}s` : null },
                  { label:'Top Speed', value: car.top_speed ? `${car.top_speed} km/h` : null },
                  { label:'Boot Space', value: car.boot_size ? `${car.boot_size}L` : null },
                ].filter(s => s.value).map(({ label, value }) => (
                  <div key={label} style={{ padding:'12px 14px', background:'#0a1220', borderRight:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.14em', color:'#334155', fontWeight:700, marginBottom:4 }}>{label}</p>
                    <p style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, margin:0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Running Costs */}
          {(() => {
            const cc = car.engine_cc || 0;
            const roadTaxMap = [[1000,20],[1200,55],[1400,70],[1600,90],[1800,200],[2000,280],[2500,380],[3000,880]];
            const roadTax = cc > 0 ? (roadTaxMap.find(([limit]) => cc <= limit)?.[1] ?? 1880) : null;
            const consumption = car.fuel_consumption || (cc <= 1600 ? 8 : cc <= 2000 ? 10 : 13);
            const totalFuelCost = Math.round(fuelDist * (consumption / 100) * 2.05);
            return (
              <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:16 }}>Running Costs</p>
                {roadTax && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'#0a1220', border:'1px solid rgba(255,255,255,0.05)', borderRadius:10, marginBottom:10 }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>Road Tax (est.)</span>
                    <span style={{ fontSize:14, color:'white', fontWeight:600 }}>RM {roadTax}/yr</span>
                  </div>
                )}
                {car.co2_emissions && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'#94a3b8' }}>CO₂ Emissions</span>
                      <span style={{ fontSize:13, color:'white', fontWeight:600 }}>{car.co2_emissions} g/km</span>
                    </div>
                    <div style={{ display:'flex', gap:2, height:8, borderRadius:5, overflow:'hidden' }}>
                      {[{limit:100,color:'#22c55e'},{limit:130,color:'#86efac'},{limit:150,color:'#fde047'},{limit:170,color:'#fb923c'},{limit:200,color:'#ef4444'},{limit:999,color:'#991b1b'}].map((band,i)=>{
                        const isActive = car.co2_emissions > [0,100,130,150,170,200][i] && car.co2_emissions <= band.limit;
                        return <div key={i} style={{ flex:1, background: isActive ? band.color : `${band.color}25`, borderRadius: i===0?'5px 0 0 5px':i===5?'0 5px 5px 0':0 }} />;
                      })}
                    </div>
                  </div>
                )}
                <div style={{ background:'#0a1220', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>Range Calculator</span>
                    <span style={{ fontSize:10, color:'#334155' }}>RON95 @ RM2.05/L</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:12 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color:'white', lineHeight:1 }}>RM {totalFuelCost}</span>
                    <span style={{ fontSize:12, color:'#475569' }}>for {fuelDist} km</span>
                  </div>
                  <input type="range" min={10} max={1000} step={10} value={fuelDist}
                    onChange={e => setFuelDist(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'#dc2626', cursor:'pointer' }}
                  />
                  <p style={{ fontSize:10, color:'#334155', marginTop:6 }}>~{consumption}L/100km estimated</p>
                </div>
              </div>
            );
          })()}

          {/* Location */}
          {(car.city || car.state) && (
            <div style={{ marginTop:32, paddingTop:28, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em', color:'#334155', fontWeight:700, marginBottom:14 }}>Location</p>
              <div style={{ background:'#0a1220', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div>
                  <p style={{ fontSize:14, color:'white', fontWeight:600, margin:'0 0 3px' }}>{[car.city, car.state].filter(Boolean).join(', ')}</p>
                  <p style={{ fontSize:11, color:'#475569', margin:0 }}>Malaysia</p>
                </div>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent([car.city, car.state, 'Malaysia'].filter(Boolean).join(', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'7px 12px', fontSize:11, color:'#94a3b8', textDecoration:'none', flexShrink:0 }}>
                  <Eye size={12} /> View Map
                </a>
              </div>
            </div>
          )}

        </div>

        {/* M6 — Booking form */}
        <div className="cdp-mobile-only" id="booking-form-mobile" style={{ padding:'0 18px', marginBottom:40 }}>
          <p style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.2em', color:'#dc2626', fontWeight:700, marginBottom:16 }}>Book a Viewing</p>
          <div style={{ background:'#0a1625', border:'1px solid rgba(220,38,38,0.1)', borderRadius:14, padding:'20px' }}>
            {booked ? (
              <div style={{ padding:'24px 0', textAlign:'center' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:20, color:'#4ade80' }}>✓</div>
                <p style={{ fontSize:'15px', color:'white', marginBottom:6, fontWeight:600 }}>Viewing Booked</p>
                <p style={{ fontSize:'13px', color:'#475569' }}>We'll reach out on WhatsApp shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleBook}>
                <input type="text" placeholder="Your name" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                  style={inputStyle(focusedField === 'name')} />
                <input type="tel" placeholder="Phone number" required value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                  style={inputStyle(focusedField === 'phone')} />
                <input type="date" required min={today} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  onFocus={() => setFocused('date')} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(focusedField === 'date'), colorScheme:'dark' }} />
                <select value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  onFocus={() => setFocused('time')} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(focusedField === 'time'), cursor:'pointer' }}>
                  {['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                    <option key={t} value={t} style={{ background:'#0d1117' }}>
                      {parseInt(t) < 12 ? `${parseInt(t)}:00 AM` : parseInt(t) === 12 ? '12:00 PM' : `${parseInt(t)-12}:00 PM`}
                    </option>
                  ))}
                </select>
                <textarea placeholder="Notes (optional)" rows={3} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  onFocus={() => setFocused('notes')} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(focusedField === 'notes'), resize:'vertical', minHeight:72 }} />
                <select value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  onFocus={() => setFocused('state')} onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(focusedField === 'state'), cursor:'pointer' }}>
                  <option value="" style={{ background:'#0d1117' }}>Your state (optional)</option>
                  {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => (
                    <option key={s} value={s} style={{ background:'#0d1117' }}>{s}</option>
                  ))}
                </select>
                <button type="submit" disabled={submitting}
                  style={{ width:'100%', background:'#dc2626', color:'white', border:'none', borderRadius:'9px', padding:'13px', fontWeight:700, fontSize:'14px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily:"'DM Sans',sans-serif", opacity: submitting ? 0.6 : 1, letterSpacing:'0.02em', transition:'opacity .2s', boxShadow:'0 4px 20px rgba(220,38,38,0.25)' }}>
                  {submitting ? 'Booking…' : 'Confirm Viewing'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* M7 — Salesman card */}
        {salesmanProfile && (() => {
          const waPhone = (salesmanProfile.whatsapp_number || '').replace(/\D/g, '');
          const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
          const firstName = (salesmanProfile.full_name || 'Agent').split(' ')[0];
          return (
            <div className="cdp-mobile-only" style={{ padding:'0 18px', marginBottom:32 }}>
              <div style={{ background:'#0b1422', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                  {salesmanProfile.avatar_url
                    ? <img src={salesmanProfile.avatar_url} alt={salesmanProfile.full_name} style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:52, height:52, borderRadius:'50%', background:'#1d4ed8', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff' }}>
                        {(salesmanProfile.full_name || 'S')[0].toUpperCase()}
                      </div>
                  }
                  <div>
                    <p style={{ fontSize:15, fontWeight:700, color:'white', margin:0 }}>{salesmanProfile.full_name || 'Agent'}</p>
                    {salesmanProfile.job_title && <p style={{ fontSize:12, color:'#475569', margin:'3px 0 0' }}>{salesmanProfile.job_title}</p>}
                    <p style={{ fontSize:11, color:'#1e293b', margin:'2px 0 0', letterSpacing:'0.05em' }}>Independent Agent · XDrive</p>
                  </div>
                </div>
                {waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', width:'100%', background:'#22c55e', color:'white', borderRadius:9, padding:'12px 0', fontWeight:700, fontSize:13, fontFamily:"'DM Sans',sans-serif", textAlign:'center', textDecoration:'none', boxSizing:'border-box', letterSpacing:'0.02em' }}>
                    Chat with {firstName}
                  </a>
                )}
                {salesmanProfile.slug && (
                  <Link to={`/s/${salesmanProfile.slug}`} style={{ display:'block', textAlign:'center', marginTop:10, fontSize:12, color:'#60a5fa', textDecoration:'none' }}>
                    View all listings →
                  </Link>
                )}
                {dealer?.subdomain && !isSubdomain() && (
                  <a href={`https://${dealer.subdomain}.xdrive.my`} target="_blank" rel="noopener noreferrer" style={{ display:'block', textAlign:'center', marginTop:6, fontSize:12, color:'#94a3b8', textDecoration:'none' }}>
                    Go to dealer's page →
                  </a>
                )}
              </div>
            </div>
          );
        })()}

        {/* M8 — Similar cars */}
        {similarCars.length > 0 && (
          <div className="cdp-mobile-only" style={{ padding:'0 18px', marginBottom:80 }}>
            <p style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.2em', color:'#1e293b', margin:'0 0 6px', fontWeight:700 }}>You might also like</p>
            <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'2.2rem', letterSpacing:'0.06em', color:'white', margin:'0 0 20px', borderLeft:'3px solid #dc2626', paddingLeft:'12px' }}>
              More {car.brand}
            </h2>
            <div style={{ display:'flex', overflowX:'auto', gap:14, scrollSnapType:'x mandatory', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', marginLeft:-18, marginRight:-18, paddingLeft:18, paddingRight:18 }}>
              {similarCars.map(s => (
                <div key={s.id} style={{ flexShrink:0, width:'72vw', scrollSnapAlign:'start' }}>
                  <CarCard car={s} ctaContext={ctaCtx} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 2: Body (desktop only) ── */}
        <div className="cdp-body-wrap cdp-desktop-only">
          {/* ── LEFT COLUMN ── */}
          <div className="cdp-body-left">
            {/* Title block */}
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.28em",
                color: "#dc2626",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {car.brand}
            </p>
            <h1
              style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: "clamp(3rem,5vw,4.4rem)",
                color: "white",
                lineHeight: 0.95,
                letterSpacing: "0.04em",
                marginBottom: 10,
              }}
            >
              {car.model}
              {car.variant ? " " + car.variant : ""}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#475569",
                letterSpacing: "0.05em",
                marginBottom: 20,
              }}
            >
              {[car.year, car.body_type, car.transmission]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            {(isRecon || isHot || hasDocuments) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 24,
                }}
              >
                {isRecon && (
                  <span
                    style={{
                      background: "rgba(168,85,247,0.1)",
                      border: "1px solid rgba(168,85,247,0.25)",
                      color: "#c084fc",
                      fontSize: "10px",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Recon
                  </span>
                )}
                {isHot && (
                  <span
                    style={{
                      background: "rgba(220,38,38,0.1)",
                      border: "1px solid rgba(220,38,38,0.28)",
                      color: "#f87171",
                      fontSize: "10px",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Hot Deal
                  </span>
                )}
                {hasDocuments && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.28)",
                      color: "#4ade80",
                      fontSize: "10px",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    <BadgeCheck size={11} /> Verified Docs
                  </span>
                )}
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
                ...(car.horsepower ? [{ label: "Power", value: `${car.horsepower} bhp` }] : []),
                ...(car.doors ? [{ label: "Doors", value: `${car.doors} doors` }] : []),
                ...(car.seats ? [{ label: "Seats", value: `${car.seats} seats` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="cdp-stat-cell">
                  <p
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      color: "#334155",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      color: "#e2e8f0",
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#334155",
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              About
            </p>
            <p
              style={{
                fontSize: 14,
                color: "#64748b",
                lineHeight: 2,
                marginBottom: 40,
              }}
            >
              {car.specs ||
                `${car.year} ${car.brand} ${car.model}, ${fmt(car.mileage)} km, ${car.transmission}, ${car.fuel_type}, ${car.colour}.`}
            </p>

            {/* Tabbed specs / features / options */}
            {(() => {
              const tabs = [
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
                          color: detailTab === t.key ? "white" : "#334155",
                          padding: "10px 24px 12px",
                          marginBottom: -1,
                          fontSize: "13px",
                          fontWeight: detailTab === t.key ? 600 : 400,
                          cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif",
                          transition: "all .2s",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

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
                              {
                                key: "Exterior Grade",
                                val: car.auction_grade || "—",
                              },
                              {
                                key: "Interior Grade",
                                val: car.interior_grade || "—",
                              },
                            ]
                          : []),
                      ].map(({ key, val }) => (
                        <div key={key} className="cdp-row">
                          <span style={{ fontSize: "13px", color: "#64748b" }}>
                            {key}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#f1f5f9",
                              textAlign: "right",
                            }}
                          >
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailTab === "specs" &&
                    isRecon &&
                    Array.isArray(car.damage_map) &&
                    car.damage_map.length > 0 && (
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 20,
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.16em",
                            color: "#334155",
                            fontWeight: 700,
                            marginBottom: 14,
                          }}
                        >
                          Condition Map
                        </p>
                        <div
                          style={{
                            background: "#0a1220",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 12,
                            padding: "16px 20px",
                          }}
                        >
                          <DamageMap value={car.damage_map} readOnly />
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
                            color: "#64748b",
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
                            color: "#64748b",
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

            {/* What's included */}
            {Array.isArray(car.included_services) &&
              car.included_services.length > 0 && (
                <div
                  style={{
                    marginTop: 40,
                    paddingTop: 32,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color: "#334155",
                      fontWeight: 700,
                      marginBottom: 16,
                    }}
                  >
                    What's Included
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
                          <CatIcon
                            size={13}
                            style={{ color: cfg.color, flexShrink: 0 }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: cfg.color,
                              fontWeight: 600,
                            }}
                          >
                            {svc.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {car.included_services_cost > 0 && (
                    <p
                      style={{ fontSize: 11, color: "#334155", marginTop: 12 }}
                    >
                      Estimated add-on value:{" "}
                      <span style={{ color: "#60a5fa", fontWeight: 700 }}>
                        RM {Number(car.included_services_cost).toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
              )}

            {/* VIDEO WALKTHROUGH */}
            {car.video_url && getEmbedUrl(car.video_url) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <PlayCircle size={13} style={{ color: '#dc2626' }} /> Watch Walkthrough
                </p>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <iframe src={getEmbedUrl(car.video_url)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} allowFullScreen title={`${car.year} ${car.brand} ${car.model} walkthrough`} />
                </div>
              </div>
            )}

            {/* ── CAR HISTORY ── */}
            <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Shield size={13} style={{ color: '#60a5fa' }} />
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700 }}>Car History</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'puspakom', icon: <ShieldCheck size={15} />, label: 'Puspakom Inspection', sub: 'Structural & mechanical check', okColor: '#4ade80', okBorder: 'rgba(34,197,94,0.3)' },
                  { key: 'service_history', icon: <FileText size={15} />, label: 'Service History', sub: 'Maintenance records', okColor: '#60a5fa', okBorder: 'rgba(96,165,250,0.3)' },
                  { key: 'loan_clearance', icon: <BadgeCheck size={15} />, label: 'Loan Clearance', sub: 'No outstanding finance', okColor: '#34d399', okBorder: 'rgba(52,211,153,0.3)' },
                  { key: 'ownership', icon: <Eye size={15} />, label: 'Ownership Docs', sub: 'VOC / transfer documents', okColor: '#fbbf24', okBorder: 'rgba(251,191,36,0.3)' },
                ].map(({ key, icon, label, sub, okColor, okBorder }) => {
                  const doc = car.car_documents?.find(d => d.type === key);
                  const rk = `d-${key}`;
                  const isOpen = openDocKey === rk;
                  const asImage = doc && isImageUrl(doc.url);
                  return (
                    <div key={key} style={{ background: '#0a1220', border: `1px solid ${isOpen && doc ? okBorder : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      <div onClick={() => doc && toggleDoc(rk)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: doc ? 'pointer' : 'default' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: doc ? okColor : '#334155' }}>{icon}</span>
                          <div>
                            <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, margin: 0 }}>{label}</p>
                            <p style={{ fontSize: 11, color: '#334155', margin: '2px 0 0' }}>{sub}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: doc ? `${okColor}15` : 'rgba(100,116,139,0.08)', border: `1px solid ${doc ? okBorder : 'rgba(100,116,139,0.15)'}`, color: doc ? okColor : '#475569', whiteSpace: 'nowrap' }}>
                            {doc ? '✓ Available' : 'Not Provided'}
                          </span>
                          {doc && <ChevronDown size={15} style={{ color: okColor, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />}
                        </div>
                      </div>
                      {isOpen && doc && (
                        <div style={{ borderTop: `1px solid ${okBorder}40`, padding: '14px 16px', background: `${okColor}08` }}>
                          {asImage ? (
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
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {car.car_documents?.filter(d => !['puspakom','service_history','loan_clearance','ownership'].includes(d.type)).map((doc, i) => {
                  const cfg = CDP_DOC_TYPES[doc.type] || CDP_DOC_TYPES.other;
                  const rk = `d-extra-${i}`;
                  const isOpen = openDocKey === rk;
                  const asImage = isImageUrl(doc.url);
                  return (
                    <div key={rk} style={{ background: '#0a1220', border: `1px solid ${isOpen ? `${cfg.color}50` : 'rgba(255,255,255,0.05)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      <div onClick={() => toggleDoc(rk)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <BadgeCheck size={15} style={{ color: cfg.color }} />
                          <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, margin: 0 }}>{cfg.label}</p>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a1220', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Star size={15} style={{ color: '#fbbf24' }} />
                    <div>
                      <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, margin: 0 }}>Previous Owners</p>
                      {(car.registration_date || car.local_reg_date) && <p style={{ fontSize: 11, color: '#334155', margin: '2px 0 0' }}>Registered {new Date(car.registration_date || car.local_reg_date).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}</p>}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                    {car.previous_owners != null ? `${car.previous_owners} owner${car.previous_owners !== 1 ? 's' : ''}` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a1220', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={15} style={{ color: car.warranty_months > 0 ? '#34d399' : '#334155' }} />
                    <div>
                      <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, margin: 0 }}>Warranty</p>
                      <p style={{ fontSize: 11, color: '#334155', margin: '2px 0 0' }}>Included with purchase</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: car.warranty_months > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(100,116,139,0.08)', border: `1px solid ${car.warranty_months > 0 ? 'rgba(52,211,153,0.3)' : 'rgba(100,116,139,0.15)'}`, color: car.warranty_months > 0 ? '#34d399' : '#475569' }}>
                    {car.warranty_months > 0 ? `${car.warranty_months} months` : 'No Warranty'}
                  </span>
                </div>
                {Array.isArray(car.dealer_perks) && car.dealer_perks.length > 0 && (() => {
                  const PERK_CFG = [
                    { key: 'part_exchange',    label: 'Part Exchange',      color: '#60a5fa' },
                    { key: 'whatsapp_chat',    label: 'WhatsApp Chat',      color: '#4ade80' },
                    { key: 'video_walkthrough',label: 'Video Walkthrough',  color: '#f87171' },
                    { key: 'warranty_incl',    label: 'Warranty Included',  color: '#34d399' },
                    { key: 'verified_docs',    label: 'Verified Docs',      color: '#4ade80' },
                    { key: 'book_viewing',     label: 'Book a Viewing',     color: '#60a5fa' },
                  ].filter(p => car.dealer_perks.includes(p.key));
                  if (!PERK_CFG.length) return null;
                  return (
                    <>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '2px 0' }} />
                      {PERK_CFG.map(({ key, label, color }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0a1220', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                          <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, margin: 0 }}>{label}</p>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, color }}>✓ Available</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── PERFORMANCE & DETAILS ── */}
            {(car.horsepower || car.acceleration || car.top_speed || car.boot_size || car.doors || car.seats || car.co2_emissions || car.insurance_group || car.safety_rating) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700, marginBottom: 20 }}>Performance &amp; Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
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
                    <div key={label} style={{ padding: '14px', background: '#0a1220', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#334155', fontWeight: 700, marginBottom: 5 }}>{label}</p>
                      <p style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500, margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RUNNING COSTS ── */}
            {(() => {
              const cc = car.engine_cc || 0;
              const roadTaxMap = [[1000,20],[1200,55],[1400,70],[1600,90],[1800,200],[2000,280],[2500,380],[3000,880]];
              const roadTax = cc > 0 ? (roadTaxMap.find(([limit]) => cc <= limit)?.[1] ?? 1880) : null;
              const co2 = car.co2_emissions;
              const insGrp = car.insurance_group ? Number(car.insurance_group) : null;
              const consumption = car.fuel_consumption || (cc <= 1600 ? 8 : cc <= 2000 ? 10 : 13);
              const petrolPrice = 2.05;
              const totalFuelCost = Math.round(fuelDist * (consumption / 100) * petrolPrice);
              return (
                <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700, marginBottom: 24 }}>Running Costs</p>
                  {roadTax && (
                    <div style={{ marginBottom: 24, padding: '16px 18px', background: '#0a1220', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Road Tax (estimated)</span>
                        <span style={{ fontSize: 15, color: 'white', fontWeight: 600 }}>RM {roadTax} / year</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>Based on {fmt(cc)}cc engine displacement</p>
                    </div>
                  )}
                  {co2 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>CO₂ Emissions</span>
                        <span style={{ fontSize: 15, color: 'white', fontWeight: 600 }}>{co2} g/km</span>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 5 }}>
                        <span>0</span><span>100</span><span>130</span><span>150</span><span>170</span><span>200+</span>
                      </div>
                    </div>
                  )}
                  {insGrp && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Insurance Group</span>
                        <span style={{ fontSize: 15, color: 'white', fontWeight: 600 }}>{insGrp} / 26</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (insGrp / 26) * 100)}%`, height: '100%', background: `hsl(${Math.round(120 - (insGrp / 26) * 120)}, 75%, 50%)`, borderRadius: 6 }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#334155', marginTop: 5 }}>
                        {insGrp <= 8 ? 'Low cost to insure' : insGrp <= 16 ? 'Moderate insurance cost' : 'Higher insurance cost'}
                      </p>
                    </div>
                  )}
                  <div style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>Range Calculator</span>
                      <span style={{ fontSize: 10, color: '#334155' }}>RON95 @ RM {petrolPrice}/L</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', color: 'white', lineHeight: 1 }}>RM {totalFuelCost}</span>
                      <span style={{ fontSize: 12, color: '#475569' }}>for {fuelDist} km</span>
                    </div>
                    <input type="range" min={10} max={1000} step={10} value={fuelDist}
                      onChange={e => setFuelDist(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
                      <span>10 km</span><span>500 km</span><span>1,000 km</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#334155', marginTop: 10 }}>
                      {car.fuel_consumption ? `${car.fuel_consumption}L/100km (manufacturer figure)` : `~${consumption}L/100km estimated from engine size`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── LOCATION ── */}
            {(car.city || car.state) && (
              <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700, marginBottom: 16 }}>Location</p>
                <div style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 16, color: 'white', fontWeight: 600, margin: '0 0 4px' }}>{[car.city, car.state].filter(Boolean).join(', ')}</p>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Malaysia · {dealerName}</p>
                  </div>
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent([car.city, car.state, 'Malaysia'].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#94a3b8', textDecoration: 'none', flexShrink: 0, letterSpacing: '0.03em' }}>
                    <Eye size={13} /> View on Map
                  </a>
                </div>
                <p style={{ fontSize: 11, color: '#334155', marginTop: 8 }}>Approximate area only — confirm address when enquiring.</p>
              </div>
            )}

            {/* BOOKING FORM */}
            <div ref={bookingRef} id="booking-form" style={{ marginTop: 56 }}>
              <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#334155', fontWeight: 700, marginBottom: 16 }}>Book a Viewing</p>
              <div style={{ maxWidth: 480, background: '#0a1625', border: '1px solid rgba(220,38,38,0.1)', borderRadius: 16, padding: 28 }}>
                {booked ? (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20, color: '#4ade80' }}>✓</div>
                    <p style={{ fontSize: '15px', color: 'white', marginBottom: 6, fontWeight: 600 }}>Viewing Booked</p>
                    <p style={{ fontSize: '13px', color: '#475569' }}>We'll reach out on WhatsApp shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleBook}>
                    <input type="text" placeholder="Your name" required value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                      style={inputStyle(focusedField === 'name')} />
                    <input type="tel" placeholder="Phone number" required value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                      style={inputStyle(focusedField === 'phone')} />
                    <input type="date" required min={today} value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      onFocus={() => setFocused('date')} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle(focusedField === 'date'), colorScheme: 'dark' }} />
                    <select value={form.time}
                      onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                      onFocus={() => setFocused('time')} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle(focusedField === 'time'), cursor: 'pointer' }}>
                      {['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                        <option key={t} value={t} style={{ background: '#0d1117' }}>
                          {parseInt(t) < 12 ? `${parseInt(t)}:00 AM` : parseInt(t) === 12 ? '12:00 PM' : `${parseInt(t)-12}:00 PM`}
                        </option>
                      ))}
                    </select>
                    <textarea placeholder="Notes (optional)" rows={3} value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      onFocus={() => setFocused('notes')} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle(focusedField === 'notes'), resize: 'vertical', minHeight: 72 }} />
                    <select value={form.state}
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                      onFocus={() => setFocused('state')} onBlur={() => setFocused(null)}
                      style={{ ...inputStyle(focusedField === 'state'), cursor: 'pointer' }}>
                      <option value="" style={{ background: '#0d1117' }}>Your state (optional)</option>
                      {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => (
                        <option key={s} value={s} style={{ background: '#0d1117' }}>{s}</option>
                      ))}
                    </select>
                    <button type="submit" disabled={submitting}
                      style={{ width: '100%', background: '#dc2626', color: 'white', border: 'none', borderRadius: '9px', padding: '13px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", opacity: submitting ? 0.6 : 1, letterSpacing: '0.02em', transition: 'opacity .2s', boxShadow: '0 4px 20px rgba(220,38,38,0.25)' }}>
                      {submitting ? 'Booking…' : 'Confirm Viewing'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* SIMILAR CARS */}
            {similarCars.length > 0 && (
              <div style={{ marginTop: 64 }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#1e293b', margin: '0 0 6px', fontWeight: 700 }}>You might also like</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                  <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', letterSpacing: '0.06em', color: 'white', margin: 0, flexShrink: 0, borderLeft: '3px solid #dc2626', paddingLeft: '14px' }}>
                    More {car.brand}
                  </h2>
                </div>
                <div className="cdp-similar-grid">
                  {similarCars.map(s => <CarCard key={s.id} car={s} ctaContext={ctaCtx} />)}
                </div>
                <div className="cdp-similar-scroll">
                  {similarCars.map(s => (
                    <div key={s.id} style={{ flexShrink: 0, width: '72vw', scrollSnapAlign: 'start' }}>
                      <CarCard car={s} ctaContext={ctaCtx} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>{/* end left column */}

          {/* ── RIGHT SIDEBAR ── */}
          <div className="cdp-sidebar" style={{ width: 360, flexShrink: 0, position: 'sticky', top: 76, maxHeight: 'calc(100vh - 92px)', overflowY: 'auto', scrollbarWidth: 'none', background: 'linear-gradient(160deg, #09111f 0%, #0a1220 100%)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px' }}>

            {/* DEALER TOPBAR */}
            {(() => {
              const isAgent = !!salesmanProfile;
              const displayName = isAgent ? (salesmanProfile.full_name || 'Agent') : dealerName;
              const avatarSrc = isAgent ? salesmanProfile.avatar_url : (dealer?.site_logo_url || dealer?.avatar_url);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt={displayName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%', background: isAgent ? '#1d4ed8' : '#111e2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {displayName[0]?.toUpperCase()}
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'white', fontWeight: 600, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                    <p style={{ fontSize: 11, color: isAgent ? '#60a5fa' : '#334155' }}>
                      {isAgent ? 'Independent Agent' : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'cdp-pulse 2s ease infinite' }} />
                          Verified Dealer
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 20, padding: '2px 8px', marginBottom: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'cdp-pulse 2s ease infinite' }} />
                      <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 600, letterSpacing: '0.08em' }}>ONLINE</span>
                    </div>
                    {listedDays !== null && <p style={{ fontSize: 10, color: '#1e293b' }}>{listedDays}d ago</p>}
                  </div>
                </div>
              );
            })()}

            {/* PRICE BLOCK */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#334155', fontWeight: 700, margin: 0 }}>Asking Price</p>
                {(dealer?.subdomain || dealer?.slug) && !isSubdomain() && (
                  <a
                    href={dealer.subdomain ? `https://${dealer.subdomain}.xdrive.my` : `https://xdrive.my/s/${dealer.slug}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none', letterSpacing: '0.03em' }}
                  >
                    {dealer.site_name || dealer.dealership} ↗
                  </a>
                )}
              </div>
              <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,3.5vw,3rem)', color: 'white', lineHeight: 1 }}>{fmtPrice(car.selling_price)}</p>
              {calcMonthly(car.selling_price) && (
                <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>~RM {fmt(calcMonthly(car.selling_price))}/mo</p>
              )}
              {isHot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: '#1e293b', textDecoration: 'line-through' }}>{fmtPrice(car.original_price)}</span>
                  <span style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: '#f87171', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.04em' }}>SAVE {fmtPrice(saving)}</span>
                </div>
              )}
            </div>
            <div style={{ height: 1, background: 'linear-gradient(to right, rgba(220,38,38,0.35), transparent)', margin: '14px 0 16px' }} />

            {/* TRUST BADGES */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {isRecon && <span style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc', fontSize: '10px', padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Recon</span>}
              {isHot && <span style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.28)', color: '#f87171', fontSize: '10px', padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>Hot Deal</span>}
              {hasDocuments && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80', fontSize: '10px', padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}><BadgeCheck size={11} /> Verified Docs</span>}
              {car.warranty_months > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80', fontSize: '10px', padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}><ShieldCheck size={11} /> {car.warranty_months}m Warranty</span>}
            </div>
            {car.deposit_amount > 0 && (
              <p style={{ fontSize: 11, color: '#475569', marginBottom: 8, textAlign: 'center' }}>RM {fmt(car.deposit_amount)} deposit to reserve</p>
            )}

            {/* CTA BUTTONS */}
            <button
              onClick={() => {
                trackEvent(supabase, 'booking_click', { car_id: car.id, car_name: `${car.brand} ${car.model} ${car.year}`, dealer_id: car.dealer_id, metadata: { source: 'car_detail' } });
                bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{ width: '100%', background: '#dc2626', color: 'white', border: 'none', borderTop: '2px solid #b91c1c', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.02em', boxShadow: '0 4px 24px rgba(220,38,38,0.25)', transition: 'transform .15s, box-shadow .2s' }}>
              Book a Viewing
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleWhatsApp}
                style={{ flex: 1, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', borderRadius: 10, padding: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, transition: 'all .2s' }}>
                WhatsApp
              </button>
              {contactPhone && (
                <button onClick={handleCall}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 10, padding: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13, transition: 'all .2s' }}>
                  <Phone size={13} /> Call
                </button>
              )}
            </div>

            <button onClick={() => setCalcOpen(true)}
              style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.06)', color: '#475569', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, letterSpacing: '0.05em', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 8, transition: 'all .2s' }}>
              <Calculator size={13} /> Financing Calculator
            </button>
            {dealer?.subdomain && !isSubdomain() && (
              <a href={`https://${dealer.subdomain}.xdrive.my`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: 10, padding: 10, fontSize: 12, letterSpacing: '0.05em', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textDecoration: 'none', boxSizing: 'border-box', transition: 'all .2s' }}>
                <ExternalLink size={13} /> Visit Dealer's Page
              </a>
            )}

            {/* SALESMAN CARD */}
            {salesmanProfile && (() => {
              const waPhone = (salesmanProfile.whatsapp_number || '').replace(/\D/g, '');
              const waHref = waPhone ? `https://wa.me/${waPhone.startsWith('6') ? waPhone : '6' + waPhone}` : null;
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
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>{salesmanProfile.full_name || 'Agent'}</p>
                      {salesmanProfile.job_title && <p style={{ fontSize: 12, color: '#475569', margin: '3px 0 0' }}>{salesmanProfile.job_title}</p>}
                      <p style={{ fontSize: 11, color: '#1e293b', margin: '2px 0 0', letterSpacing: '0.05em' }}>Independent Agent · XDrive</p>
                    </div>
                  </div>
                  {waHref && (
                    <a href={waHref} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', width: '100%', background: '#22c55e', color: 'white', borderRadius: 9, padding: '12px 0', fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans',sans-serif", textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', letterSpacing: '0.02em' }}>
                      Chat with {firstName}
                    </a>
                  )}
                  {salesmanProfile.slug && (
                    <Link to={`/s/${salesmanProfile.slug}`} style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 12, color: '#60a5fa', textDecoration: 'none' }}>
                      View all listings →
                    </Link>
                  )}
                  {dealer?.subdomain && !isSubdomain() && (
                    <a href={`https://${dealer.subdomain}.xdrive.my`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', marginTop: 6, fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}>
                      Go to dealer's page →
                    </a>
                  )}
                </div>
              );
            })()}
          </div>{/* end sidebar */}
        </div>{/* end body wrap */}

        {/* ── calculator modal ── */}
        {calcOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ width: '100%', maxWidth: 860, background: '#0b1422', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: '0 0 2px', letterSpacing: '0.02em' }}>Financing &amp; Cost Calculator</p>
                  <p style={{ color: '#475569', fontSize: 12, margin: 0 }}>{carTitle}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all .2s' }}>
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
                  flat
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
                style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>Reset</button>
            </div>
          </div>
        )}

      </div>

      {/* ── mobile sticky bar ── */}
      <div className="cdp-mobile-bar">
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'0 4px', flexShrink:0 }}>
          <HeartButton listingId={car?.id} size={20} />
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontFamily:"'DM Sans',sans-serif" }}>Save</span>
        </div>
        <button
          onClick={() => { if (!car?.id) return; isInCompare(car.id) ? removeFromCompare(car.id) : addToCompare(car.id); }}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, background:'none', border:'none', cursor:'pointer', padding:'0 4px', flexShrink:0 }}>
          <ArrowLeftRight size={20} color={car?.id && isInCompare(car.id) ? '#f87171' : 'rgba(255,255,255,0.35)'} />
          <span style={{ fontSize:9, color: car?.id && isInCompare(car.id) ? '#f87171' : 'rgba(255,255,255,0.35)', fontFamily:"'DM Sans',sans-serif" }}>
            {car?.id && isInCompare(car.id) ? 'Added' : 'Compare'}
          </span>
        </button>
        <button className="cdp-mobile-bar-wa" onClick={handleWhatsApp}>WhatsApp</button>
        <button className="cdp-mobile-bar-book" onClick={() => {
          trackEvent(supabase, 'booking_click', { car_id: car.id, car_name: `${car.brand} ${car.model} ${car.year}`, dealer_id: car.dealer_id, metadata: { source: 'car_detail' } });
          document.getElementById('booking-form-mobile')?.scrollIntoView({ behavior:'smooth', block:'start' });
        }}>Book a Viewing</button>
      </div>

      {/* ── enquiry modal ── */}
      {showEnquiryModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div style={{ background: '#0b1628', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '20px' }} className="p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold text-lg mb-1">Contact Dealer</h3>
            <p className="text-gray-500 text-sm mb-4">Enter your details to continue to WhatsApp</p>
            <input
              placeholder="Your name"
              value={enquiryForm.name}
              onChange={e => setEnquiryForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm mb-3 outline-none focus:border-red-500"
            />
            <input
              placeholder="Phone number (e.g. 0123456789)"
              value={enquiryForm.phone}
              onChange={e => setEnquiryForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm mb-3 outline-none focus:border-red-500"
            />
            <select
              value={enquiryForm.state}
              onChange={e => setEnquiryForm(p => ({ ...p, state: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm mb-4 outline-none focus:border-red-500"
              style={{ cursor: 'pointer' }}
            >
              <option value="" style={{ background: '#0d1117' }}>Your state (optional)</option>
              {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => (
                <option key={s} value={s} style={{ background: '#0d1117' }}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleEnquirySubmit}
              disabled={!enquiryForm.name || !enquiryForm.phone || enquirySubmitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm"
              style={{ borderTop: '2px solid #16a34a', letterSpacing: '0.02em' }}
            >
              {enquirySubmitting ? 'Opening WhatsApp...' : 'Continue to WhatsApp'}
            </button>
            <button onClick={() => setShowEnquiryModal(false)} className="w-full mt-2 text-gray-500 text-sm py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
                 
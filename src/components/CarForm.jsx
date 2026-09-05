import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { STATE_CITIES, cityOptionsFor, matchKnownLocation } from "../utils/locations";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Car,
  MapPin,
  DollarSign,
  FileText,
  Camera,
  Gauge,
  Clipboard,
  ClipboardCheck,
  ShieldCheck,
  Globe,
  Tag,
  Search,
  X as XIcon,
  BadgeCheck,
  Upload,
  GripVertical,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DamageMap from "./DamageMap";
import { getCategoryCfg } from "../utils/serviceCategories";
import { getEmbedUrl } from "../utils/videoEmbed";
import { useProfile, getDealerIdFromProfile } from "../hooks/useProfile";
import { lookupFullSpec } from "../utils/carSpecs";
import { HIGH_VALUE_THRESHOLD } from "../utils/financing";
import { CAR_DATA } from "../data/carData";
import { getListingGaps } from "../utils/listingCompleteness";
import { TRUST_DOCS, TRUST_DOC_KEYS, GERAN_REASONS, getTrustTier } from "../utils/trustDocs";
import { DOC_TYPES } from "../utils/docTypes";
import { decodeVin, isLikelyVin } from "../utils/vinDecode";
import { decodeChassis, isChassisCode, isMalaysianVin, generationYears, specVariantDiffers, specProbeYear } from "../utils/chassisDecode";
import { isPremiumSalesman } from "../utils/salesmanPlan";

// ─── Data ────────────────────────────────────────────────────────────────────
const initialListing = {
  brand: "",
  model: "",
  variant: "",
  year: "",
  bodyType: "",
  fuelType: "",
  transmission: "Auto",
  condition: "used",
  engineCc: "",
  horsepower: "",
  cylinders: "",
  doors: "",
  seats: "",
  fuelEconomyKpl: "",
  mileage: "",
  colour: "",
  registrationDate: "",
  plate_number: "",
  vin_number: "",
  state: "",
  city: "",
  basePrice: "",
  sellingPrice: "",
  commissionAmount: "",
  specs: "",
  options: "",
  features: "",
  images: [],
  // Recon / grading fields
  isRecon: false,
  auctionGrade: "",
  interiorGrade: "",
  importCountry: "",
  auctionHouse: "",
  localRegDate: "",
  chassisStatus: "",
  damageMap: [],
  // Condition report — the declaration is what makes an empty map mean
  // "no visible damage" instead of "never inspected".
  conditionDeclared: false,
  // Services
  included_services: [],
  baseReconCost: 0, // recon_cost excluding services (computed at pre-fill)
  // Video
  video_url: "",
  // Documents
  car_documents: [],
  // Only set when there's no registration_card document — the declared reason
  // the geran can't be supplied. Published to buyers, not a silent skip.
  geranReason: "",
  // Extra fields
  previous_owners: "",
  road_tax_expiry: "",
  loan_eligible: true,
  warranty_months: "",
  deposit_amount: "",
  payment_type: "cash",
  // Sambung bayar (loan takeover) — only used when payment_type === 'sambung_bayar'
  sambungMonthly: "",
  sambungMonthsLeft: "",
  sambungBalance: "",
  sambungDeposit: "",
  sambungBank: "",
};

// CAR_DATA moved to ../data/carData so lightweight consumers avoid this module.
export { CAR_DATA };

const ALL_BRANDS = Object.keys(CAR_DATA).sort();



const CONDITIONS = ["used", "recon", "new"];
const BODY_TYPES = ["Sedan", "SUV", "MPV", "Hatchback", "Coupe", "Pickup"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const CC_PRESETS = [660, 1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000, 3500];

const STEPS = [
  { id: 1, label: "Photos",   icon: Camera,         desc: "Upload images first" },
  { id: 2, label: "Car",      icon: Car,            desc: "Brand, model & condition" },
  { id: 3, label: "Technical",icon: Gauge,          desc: "Specs & history" },
  { id: 4, label: "Location", icon: MapPin,         desc: "State & city" },
  { id: 5, label: "Pricing",  icon: DollarSign,     desc: "Prices & add-ons" },
  { id: 6, label: "Details",  icon: FileText,       desc: "Features & documents" },
  { id: 7, label: "Review",   icon: ClipboardCheck, desc: "Confirm everything before publishing" },
];

function SortableSection({ id, section, complete, collapsed, onToggle, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const Icon = section.icon;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-2 rounded-xl border border-gray-200 bg-white"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none rounded-t-xl overflow-hidden"
        onClick={onToggle}
      >
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 touch-none flex-shrink-0"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Icon className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{section.label}</span>
            {complete && <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-500">{section.desc}</p>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
        }
      </div>
      {!collapsed && (
        <div className="px-4 pb-5 pt-1 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}


// The four named trust documents get their own upload slots, so the free-form
// picker only offers what's left. Keeps one document per named slot and stops
// a dealer filing the geran under "Other".
const OTHER_DOC_TYPES = DOC_TYPES.filter((d) => !TRUST_DOC_KEYS.includes(d.key));

// Splits a free-text "specs"/"features" field into list items on commas and
// newlines. A plain /[\n,]+/ split also cuts thousands-separator commas in
// half — "Mileage: 28,595 km" pasted into the specs box became two bullets,
// "28" and "595 km". Numbers are masked out before splitting and restored
// after, so "28,595" survives as one item.
function splitList(raw) {
  const str = String(raw || "");
  const numbers = [];
  const masked = str.replace(/\d{1,3}(?:,\d{3})+/g, (m) => {
    numbers.push(m);
    return `@@N${numbers.length - 1}@@`;
  });
  return masked
    .split(/[\n,]+/)
    .map((x) => x.replace(/@@N(\d+)@@/g, (_, i) => numbers[Number(i)]).trim())
    .filter(Boolean);
}

// ─── Copy formatter (also exported for DashboardPage use) ────────────────────
export function buildCopyText(l) {
  const condLabel =
    { used: "Used", recon: "Recon", new: "New" }[l.condition] ||
    l.condition ||
    "";
  const condEmoji = { used: "🚗", recon: "✨", new: "🆕" }[l.condition] || "🚗";

  const hasDiscount =
    l.original_price && l.selling_price && l.original_price > l.selling_price;
  const discountPct = hasDiscount
    ? Math.round(
        ((l.original_price - l.selling_price) / l.original_price) * 100,
      )
    : 0;
  const isHot = discountPct >= 3;

  // Auto hashtags — built only from the listing's own name + features, never
  // generic budget tags ("#keretamurah" = "cheap car", "#keretabekas" = "used
  // car") that undersell the listing regardless of its price point.
  const brand = (l.brand || "").toLowerCase().replace(/\s+/g, "");
  const model = (l.model || "").toLowerCase().replace(/\s+/g, "");
  const isHighValue = Number(l.selling_price) > HIGH_VALUE_THRESHOLD;
  const featureTags = splitList(l.features)
    .map((f) => `#${f.toLowerCase().replace(/[^a-z0-9]+/g, "")}`)
    .filter((f) => f.length > 1);
  const tags = [`#${brand}`, `#${model}`, ...featureTags].filter(Boolean).join(" ");

  const lines = [];
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(
    `${condEmoji} ${l.year || ""} ${l.brand || ""} ${l.model || ""}${l.variant ? " " + l.variant : ""} (${condLabel})`,
  );
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push("");

  // Core info
  if (l.year) lines.push(`📅 Year        : ${l.year}`);
  if (l.registration_date)
    lines.push(`📋 Reg Date    : ${l.registration_date}`);
  if (l.mileage)
    lines.push(`🔢 Mileage     : ${Number(l.mileage).toLocaleString()} km`);
  if (l.engine_cc)
    lines.push(`⚙️  Engine      : ${Number(l.engine_cc).toLocaleString()}cc`);
  if (l.transmission) lines.push(`🔧 Transmission: ${l.transmission}`);
  if (l.fuel_type) lines.push(`⛽ Fuel        : ${l.fuel_type}`);
  if (l.body_type) lines.push(`🚘 Body Type   : ${l.body_type}`);
  if (l.colour) lines.push(`🎨 Colour      : ${l.colour}`);
  if (l.state || l.city)
    lines.push(
      `📍 Location    : ${[l.city, l.state].filter(Boolean).join(", ")}`,
    );
  if (l.vin_number) lines.push(`🔑 VIN         : ${l.vin_number}`);
  lines.push("");

  // Pricing
  lines.push(`💰 PRICING`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  if (hasDiscount) {
    lines.push(`   Was  : RM ${Number(l.original_price).toLocaleString()}`);
    lines.push(
      `   Now  : RM ${Number(l.selling_price).toLocaleString()} ${isHot ? "🔥" : ""}`,
    );
    lines.push(
      `   Save : RM ${Number(l.original_price - l.selling_price).toLocaleString()} (${discountPct}% off)`,
    );
  } else {
    lines.push(`   Price: RM ${Number(l.selling_price).toLocaleString()}`);
  }
  lines.push("");

  // Features
  if (l.features && l.features.trim()) {
    lines.push(`✨ FEATURES`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    splitList(l.features).forEach((f) => lines.push(`   • ${f}`));
    lines.push("");
  }

  // Specs
  if (l.specs && l.specs.trim()) {
    lines.push(`🔩 SPECS`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    splitList(l.specs).forEach((s) => lines.push(`   • ${s}`));
    lines.push("");
  }

  // About / Options
  if (l.options && l.options.trim()) {
    lines.push(`📋 ABOUT THIS CAR`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`   ${l.options.trim()}`);
    lines.push("");
  }

  lines.push(`📞 DM or WhatsApp to enquire!`);
  lines.push(
    isHighValue
      ? `Viewing by appointment · Bank financing available`
      : `Loan available ✅ Trade-in welcome ✅`,
  );
  lines.push("");
  lines.push(tags);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  return lines.join("\n");
}

// The same listing, as a plain fact sheet for an AI to write from.
//
// buildCopyText above is the finished WhatsApp post — dividers, emoji, a CTA.
// Feeding that to a model wastes tokens on decoration and invites it to copy
// the layout instead of writing something new. This is the same SOURCE FIELDS,
// stripped to labelled facts.
//
// It exists because the AI caption writer was being handed four things (name,
// price, mileage, and a comma-joined transmission/colour/fuel/body string)
// while the human-written copy carried the variant, condition, recon grade,
// features, specs, the seller's own description and the location. The model
// was writing about a car it had barely been told about.
//
// Empty fields are omitted rather than sent as "unknown" — a blank invites the
// model to fill it in, which is exactly what must not happen with a car spec.
export function buildListingFacts(l) {
  const condLabel =
    { used: "Used", recon: "Recon", new: "New" }[l.condition] || l.condition || "";
  const out = [];
  const add = (k, v) => { if (v !== null && v !== undefined && String(v).trim() !== "") out.push(`${k}: ${v}`); };
  const list = (raw) => splitList(raw).join(", ");

  add("Car", [l.year, l.brand, l.model, l.variant].filter(Boolean).join(" "));
  add("Condition", condLabel);
  if (l.is_recon) {
    add("Recon import", l.import_country || "yes");
    add("Auction grade", l.auction_grade);
    add("Interior grade", l.interior_grade);
  }
  add("Price", l.selling_price ? `RM ${Number(l.selling_price).toLocaleString("en-MY")}` : null);
  if (l.original_price && l.selling_price && Number(l.original_price) > Number(l.selling_price)) {
    add("Was priced", `RM ${Number(l.original_price).toLocaleString("en-MY")}`);
    add("Discount", `RM ${Number(l.original_price - l.selling_price).toLocaleString("en-MY")}`);
  }
  add("Mileage", l.mileage ? `${Number(l.mileage).toLocaleString()} km` : null);
  add("Registered", l.registration_date);
  add("Engine", l.engine_cc ? `${Number(l.engine_cc).toLocaleString()}cc` : null);
  add("Horsepower", l.horsepower ? `${l.horsepower} hp` : null);
  add("Transmission", l.transmission);
  add("Fuel", l.fuel_type);
  add("Body type", l.body_type);
  add("Colour", l.colour);
  add("Seats", l.seats);
  add("Previous owners", l.previous_owners);
  add("Location", [l.city, l.state].filter(Boolean).join(", "));
  add("Warranty", l.warranty_months ? `${l.warranty_months} months` : null);
  add("Features", list(l.features));
  add("Specs", list(l.specs));
  add("Seller's description", String(l.options || "").trim() || null);
  if (Array.isArray(l.included_services) && l.included_services.length) {
    add("Included with purchase", l.included_services.map((s) => s?.name || s).filter(Boolean).join(", "));
  }
  return out.join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
// Common features buyers actually search for — rendered as tap-to-add chips in
// step 6 so dealers populate the SEO-critical features field without typing.
// Whatever they enter flows into the car-page prerender's alt text + schema.
const COMMON_FEATURES = [
  "Sunroof", "Panoramic roof", "Bucket seats", "Leather seats", "Ventilated seats",
  "Power seats", "360 camera", "Reverse camera", "Apple CarPlay", "Android Auto",
  "Push start", "Keyless entry", "HUD", "Blind spot monitor", "Adaptive cruise",
  "Digital cockpit", "Ambient lighting", "Carbon pack", "Sports exhaust",
  "Forged wheels", "Paddle shift", "Electric tailgate",
];

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${value === opt ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// Tap-to-pick row that opens a bottom sheet — replaces both native <select>
// (styling parity) and the free-text Combobox (kills the unwanted mobile
// keyboard) for any field backed by an enumerated list. Options may be plain
// strings or { value, label, color? } for cases needing a distinct value/label
// (e.g. DOC_TYPES) or a colour swatch. allowCustom keeps the old Combobox
// behavior of accepting a value not in the list (Brand/Model/City aren't
// exhaustive lists).
function PickerField({ label, value, onChange, options, placeholder = "Select…", disabled, allowCustom = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);
  const searchable = normalized.length > 12 || allowCustom;
  const filtered = query
    ? normalized.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized;
  const exactMatch = filtered.some((o) => o.label.toLowerCase() === query.toLowerCase());

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setQuery("");
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-none text-left transition-colors hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className={`truncate text-sm ${value ? "text-gray-900 font-medium" : "text-gray-400"}`}>
          {selected ? selected.label : value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open &&
        createPortal(
           <div className="fixed inset-0 z-[300] flex items-start justify-center pt-4 sm:pt-16">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
              <div className="relative w-full sm:max-w-md bg-white rounded-2xl max-h-[85vh] flex flex-col shadow-xl mx-3 sm:mx-0">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              {searchable && (
                <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search…"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              <div className="overflow-y-auto flex-1 py-1.5">
                {allowCustom && query && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => pick(query)}
                    className="w-full flex items-center gap-2 px-5 py-3 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors border-b border-gray-100"
                  >
                    Use "{query}"
                  </button>
                )}
                {filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left text-sm transition-colors ${value === o.value ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-900 hover:bg-gray-50"}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {o.color && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
                      )}
                      <span className="truncate">{o.label}</span>
                    </span>
                    {value === o.value && <Check className="w-4 h-4 flex-shrink-0" />}
                  </button>
                ))}
                {filtered.length === 0 && !(allowCustom && query) && (
                  <p className="px-5 py-6 text-center text-sm text-gray-400">No matches</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// Typing-assist textarea for long-form listing copy (the About section).
// Mimics how sellers hand-type Carlist-style descriptions:
//  - Enter continues a list line: "1. …" -> "2. ", and "-", "•" or an
//    emoji-prefixed line repeats its marker. Enter on an empty item exits
//    the list (marker is stripped), same as Google Keep.
//  - Double-space ends the sentence with ". " like phone keyboards. Done in
//    onChange (not keydown) because Android IMEs don't reliably emit key
//    events for space.
//  - Quick-insert chips drop common emoji markers at the cursor.
const QUICK_MARKS = ["✅", "•", "🔥", "⭐", "📌", "🛠️", "🚗", "💯"];
function SmartTextarea({ value, onValueChange, placeholder, rows = 6 }) {
  const ref = useRef(null);

  const applyEdit = (next, caret) => {
    onValueChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const handleChange = (e) => {
    const el = e.target;
    const next = el.value;
    const caret = el.selectionStart;
    // Just-typed double space after a word/number -> ". "
    if (
      next.length === value.length + 1 &&
      caret >= 3 &&
      next.slice(caret - 2, caret) === "  " &&
      /[\p{L}\p{N}]/u.test(next[caret - 3])
    ) {
      applyEdit(next.slice(0, caret - 2) + ". " + next.slice(caret), caret);
      return;
    }
    onValueChange(next);
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.target;
    const s = el.selectionStart;
    if (s !== el.selectionEnd) return;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const line = value.slice(lineStart, s);
    const num = line.match(/^(\d+)([.)])\s+/);
    const bul = num ? null : line.match(/^([-*•]|\p{Extended_Pictographic}\ufe0f?)\s+/u);
    const m = num || bul;
    if (!m) return;
    e.preventDefault();
    // Stop the Enter from also bubbling to the wizard's field-advance handler
    e.stopPropagation();
    const content = line.slice(m[0].length);
    if (!content.trim()) {
      applyEdit(value.slice(0, lineStart) + value.slice(s), lineStart);
    } else {
      const marker = num ? `${Number(num[1]) + 1}${num[2]} ` : `${bul[1]} `;
      const insert = `\n${marker}`;
      applyEdit(value.slice(0, s) + insert + value.slice(s), s + insert.length);
    }
  };

  const insertMark = (mark) => {
    const el = ref.current;
    const s = el && document.activeElement === el ? el.selectionStart : value.length;
    const end = el && document.activeElement === el ? el.selectionEnd : value.length;
    // Markers start a line — if the cursor is mid-line, break to a new one
    const atLineStart = s === 0 || value[s - 1] === "\n";
    const insert = `${atLineStart ? "" : "\n"}${mark} `;
    applyEdit(value.slice(0, s) + insert + value.slice(end), s + insert.length);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_MARKS.map((m) => (
          <button
            key={m}
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => insertMark(m)}
            className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-sm hover:border-blue-400 transition-colors"
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => insertMark("1.")}
          className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          1. list
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={textareaCls}
      />
      <p className="text-xs text-gray-400 mt-1.5">
        Enter continues a numbered or bullet line · double-space ends a sentence with "."
      </p>
    </div>
  );
}

// Review-step building blocks: a titled card with an Edit jump, and a
// label/value cell that renders nothing when the value is empty.
function ReviewSection({ title, onEdit, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// Progressive disclosure — keeps each step to its ~5 core inputs by default and
// tucks the optional/secondary fields behind a toggle. Only OPTIONAL fields go
// inside (no step validation depends on them being mounted), so collapsing never
// blocks the wizard. State lives here because renderSectionContent is a plain
// function call, not a component (Rules of Hooks).
function MoreDetails({ children, label = "More details (optional)", collapsible = false }) {
  // Most optional groups render inline so nothing useful hides behind a toggle.
  // Only the engine-spec group passes `collapsible` — buyers rarely need
  // bhp/cylinders/doors/seats, and a salesman's VIN decode fills them anyway,
  // so it stays tucked away to keep the form short.
  const [open, setOpen] = useState(false);
  if (!collapsible) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {label}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-none text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors";
const textareaCls =
  "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-none text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none";

function VideoPreview({ url }) {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl)
    return (
      <p className="text-xs text-yellow-600 mt-1">
        ⚠ Could not parse video URL. Paste a YouTube, TikTok, or Instagram link.
      </p>
    );
  return (
    <div className="aspect-video w-full max-w-sm rounded-lg overflow-hidden border border-gray-200 mt-2">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        title="Car video preview"
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cfDraftKey = (uid) => `carform_draft_${uid}`;
const cfSaveDraft = (uid, form, step) => {
  try {
    // form.images can hold raw File objects for photos still mid-upload.
    // File/Blob has no enumerable properties, so JSON.stringify silently
    // turns each into `{}` — restoring that draft later leaves nameless
    // placeholders in form.images that crash uploadImages() on publish
    // ("Cannot read properties of undefined (reading 'replace')"). Only
    // already-uploaded URLs survive a draft; unfinished files are dropped
    // and the user re-adds them.
    const safeImages = (form.images || []).filter((img) => typeof img === "string");
    localStorage.setItem(cfDraftKey(uid), JSON.stringify({ form: { ...form, images: safeImages }, step, savedAt: Date.now() }));
  } catch (_) {}
};
const cfLoadDraft = (uid) => { try { const r = localStorage.getItem(cfDraftKey(uid)); if (!r) return null; const d = JSON.parse(r); if (Date.now() - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(cfDraftKey(uid)); return null; } return d; } catch (_) { return null; } };
const cfClearDraft = (uid) => { try { localStorage.removeItem(cfDraftKey(uid)); } catch (_) {} };

// intakeDone: set by the dealer 2-phase flow (AddCarForm -> CarForm). AddCarForm's
// Identity/Pricing steps already captured brand/model/variant/year/mileage/colour/
// plate/VIN/CC/transmission/fuel/body/prices/commission/warranty/services, so those
// inputs are hidden here (values carry over via the `listing` prefill) and their
// step validations are relaxed. Standalone CarForm (salesman flows, plain edits)
// still shows everything.
export default function CarForm({ onCreate, listing, onUpdate, defaultValues, onBack, intakeDone }) {
  const { profile } = useProfile();
  const dealerId = getDealerIdFromProfile(profile);
  // VIN decode is a Premium-salesman convenience only. It's gated off for
  // Salesman Lite (the decode doesn't work reliably and Lite is the free tier).
  // Dealers go through AddCarForm's intake first, so they keep their decode there.
  const isSalesman = profile?.role === "salesman";
  const isPremiumPlan = isSalesman && isPremiumSalesman(profile);

  // In create mode, pre-fill state/city (and any other defaults) from the caller.
  // In edit mode, initialListing is unused — the pre-fill effect below populates from `listing`.
  const [form, setForm] = useState(() => listing ? initialListing : {
    ...initialListing,
    ...(defaultValues || {}),
    // Any location a caller seeds goes through the same matcher as the profile
    // prefill below — one rule for what this form will accept, not two.
    ...(defaultValues?.state || defaultValues?.city
      ? matchKnownLocation(defaultValues.state, defaultValues.city)
      : {}),
  });
  const [step, setStep] = useState(1);
  const [draftBanner, setDraftBanner] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [gapConfirm, setGapConfirm] = useState(null); // array of missing-field labels awaiting "post anyway" confirmation
  const [previews, setPreviews] = useState([]);
  const [copied, setCopied] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [photosFull, setPhotosFull] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [imgProgress, setImgProgress] = useState([]);
  const [dupWarning, setDupWarning] = useState({ plate: null, vin: null });
  // Cross-dealer clone signal: same VIN/plate live on another dealer's listing.
  const [conflictWarning, setConflictWarning] = useState({ plate: null, vin: null });
  const [capError, setCapError] = useState(false);
  // entry shape: { name: string, status: 'uploading'|'done'|'error' }
  const DEFAULT_ORDER = STEPS.map((s) => s.id);
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_ORDER);
  const [collapsed, setCollapsed] = useState({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const photosInputRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const formRef = useRef(null);

  // ── Duplicate plate/VIN detection ───────────────────────────────────────
  const checkDuplicate = async (field, value) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed || !dealerId) {
      setDupWarning(p => ({ ...p, [field]: null }));
      setConflictWarning(p => ({ ...p, [field]: null }));
      return;
    }
    const col = field === 'plate' ? 'plate_number' : 'vin_number';
    const query = supabase.from('car_listings').select('id, brand, model, year').eq('dealer_id', dealerId).ilike(col, trimmed);
    if (listing?.id) query.neq('id', listing.id);
    const { data } = await query.maybeSingle();
    setDupWarning(p => ({ ...p, [field]: data ? `Already exists: ${[data.brand, data.model, data.year].filter(Boolean).join(' ')}` : null }));

    // Cross-dealer clone check: same VIN/plate live on a DIFFERENT dealer.
    const { data: otherCount } = await supabase.rpc('count_other_dealer_vin_plate', {
      p_field: field,
      p_value: trimmed,
      p_dealer_id: dealerId,
      p_exclude_listing: listing?.id ?? null,
    });
    setConflictWarning(p => ({ ...p, [field]: (otherCount || 0) > 0 }));
  };

  // ── Draft save (new listings only, not edits) ────────────────────────────
  useEffect(() => {
    if (!profile?.id || listing) return;
    const draft = cfLoadDraft(profile.id);
    if (draft) setDraftBanner(true);
  }, [profile?.id, listing]);

  useEffect(() => {
    // Do not auto-save while the banner is visible — the user hasn't decided
    // yet, and saving now would overwrite the real draft with the empty form.
    if (!profile?.id || listing || draftBanner) return;
    const t = setTimeout(() => {
      cfSaveDraft(profile.id, form, step);
      setDraftSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
  }, [form, step, profile?.id, listing, draftBanner]);

  // Force-save immediately when the page is closed/refreshed so the debounce
  // window never causes a loss of the last few keystrokes.
  useEffect(() => {
    if (!profile?.id || listing) return;
    const handleUnload = () => {
      if (!draftBanner) cfSaveDraft(profile.id, form, step);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [profile?.id, listing, draftBanner, form, step]);

  // Load saved section order from profile
  useEffect(() => {
    if (!profile) return;
    const saved = profile.form_layout;
    if (Array.isArray(saved) && saved.length === STEPS.length) {
      setSectionOrder(saved);
    }
  }, [profile?.id]);

  // ── Documents state ──────────────────────────────────────────────────────
  const [docTypeInput, setDocTypeInput] = useState("insurance");
  const [docUploading, setDocUploading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  // slotType — the upload came from one of the named trust-document slots, so
  // the file REPLACES whatever sits in that slot rather than appending a second
  // copy. Without it the file appends using the free-form type picker.
  const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const MAX_DOC_BYTES = 10 * 1024 * 1024;

  const handleDocumentFile = async (e, slotType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG or WEBP files are allowed");
      e.target.value = "";
      return;
    }
    if (slotType) setUploadingSlot(slotType);
    else setDocUploading(true);
    try {
      // Compress photographed documents before the size check, so a 12MB phone
      // snap of a geran uploads instead of being rejected. Bigger and higher
      // quality than listing photos (1800/0.9 vs 1200/0.82) because these have
      // to stay READABLE — a compressed-to-mush geran is worthless. PDFs pass
      // through untouched: compressing one needs a real PDF library, and a
      // document-scan PDF is almost always well under the cap anyway.
      const upload = file.type === "application/pdf"
        ? file
        : await compressImage(file, 1800, 0.9);
      if (upload.size > MAX_DOC_BYTES) {
        toast.error(
          file.type === "application/pdf"
            ? "PDF is too large — max 10MB"
            : "Image is still over 10MB after compression — try a smaller one",
        );
        setUploadingSlot(null);
        setDocUploading(false);
        e.target.value = "";
        return;
      }
      // Owner-scoped + random, same as photo uploads (uploadOne, above) — the
      // storage RLS delete policy matches on foldername[1] = auth.uid(), and a
      // flat docs/ path with no owner folder can never satisfy it, so a
      // replaced/removed document was orphaned in storage forever.
      const rand = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      const folder = profile?.id ? `${profile.id}/` : "";
      const path = `${folder}docs/${Date.now()}-${rand}-${(upload.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("car-images")
        .upload(path, upload, { contentType: upload.type });
      if (error) throw error;
      const url = supabase.storage.from("car-images").getPublicUrl(path)
        .data.publicUrl;
      const type = slotType || docTypeInput;
      setForm((f) => {
        const docs = [...(f.car_documents || [])];
        const entry = { type, name: upload.name, url, path };
        const at = slotType ? docs.findIndex((d) => d.type === slotType) : -1;
        const prev = at >= 0 ? docs[at] : null;
        if (at >= 0) docs[at] = entry;
        else docs.push(entry);
        // The slot's old file is now replaced — its storage object would
        // otherwise sit orphaned forever, same problem removeDocument fixes.
        if (prev?.path) supabase.storage.from("car-images").remove([prev.path]).catch(() => {});
        // Attaching the geran clears any "can't provide it" reason — the
        // document is the stronger answer and the two must never both be set.
        return {
          ...f,
          car_documents: docs,
          ...(type === "registration_card" ? { geranReason: "" } : null),
        };
      });
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    }
    setUploadingSlot(null);
    setDocUploading(false);
    e.target.value = "";
  };

  const removeDocument = (i) => {
    const doc = (form.car_documents || [])[i];
    setForm((f) => ({
      ...f,
      car_documents: (f.car_documents || []).filter((_, j) => j !== i),
    }));
    // Old entries (uploaded before the owner-scoped path fix) have no `path`
    // to clean up — nothing to do for those beyond dropping the array entry.
    if (doc?.path) supabase.storage.from("car-images").remove([doc.path]).catch(() => {});
  };

  // ── Trust documents ──────────────────────────────────────────────────────
  const docInSlot = (key) =>
    (form.car_documents || []).find((d) => d.type === key) || null;
  const trustTier = getTrustTier(form.car_documents);

  // Anything not occupying a named slot: the other document types, plus any
  // SECOND copy of a named type (legacy listings can hold three service
  // invoices — they stay visible here so they can still be viewed or removed).
  const otherDocuments = (form.car_documents || [])
    .map((doc, idx) => ({ doc, idx }))
    .filter(({ doc, idx }) =>
      !TRUST_DOC_KEYS.includes(doc.type) ||
      (form.car_documents || []).findIndex((d) => d.type === doc.type) !== idx,
    );

  // The geran is the one document required to publish — either attached, or
  // declared unavailable with a reason the buyer gets to see. Edit mode is
  // exempt so quick fixes to pre-requirement listings aren't blocked.
  const geranSatisfied = !!docInSlot("registration_card") || !!form.geranReason;

  // ── Included services state ──────────────────────────────────────────────
  const [servicesOpen, setServicesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serviceCatalogue, setServiceCatalogue] = useState([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [commissionConfig, setCommissionConfig] = useState(null); // SET-4
  const [handlesRti, setHandlesRti] = useState(true); // profiles.handles_roadtax_insurance
  // Where the dealer is. Only used as the SECOND fallback for the location
  // prefill below — a salesman created by a dealer often has no city of their
  // own, but the cars they list sit in the dealer's yard.
  const [dealerLocation, setDealerLocation] = useState(null);
  const navigate = useNavigate();

  // SET-4: load dealer commission rule for the suggested-commission helper
  useEffect(() => {
    if (!dealerId) return;
    supabase.from("profiles").select("commission_config, handles_roadtax_insurance, state, city").eq("id", dealerId).maybeSingle()
      .then(({ data }) => {
        setCommissionConfig(data?.commission_config || null);
        setHandlesRti(data?.handles_roadtax_insurance !== false);
        setDealerLocation(data ? { state: data.state || "", city: data.city || "" } : null);
      });
  }, [dealerId]);

  // ── Location prefill ─────────────────────────────────────────────────────
  // Every seller states their state and city at onboarding, then had to pick
  // them again on every single listing. This fills them in from the profile
  // the form already loads, so the step is a confirmation rather than data
  // entry — and it stays fully editable, because a car is not always where its
  // seller is.
  //
  // It lives HERE, not in each caller: the dealer dashboard passed
  // `defaultValues` for this and Salesman Lite, Salesman Premium and the
  // manager panel did not, which is exactly the kind of per-caller drift that
  // leaves three of five surfaces without the feature.
  //
  // Rules, in order: never in edit mode; never over a value that is already
  // there (a restored draft, or `defaultValues` from the caller); own profile
  // first, then the dealer's. The functional updater reads the CURRENT form, so
  // it cannot race the draft-restore effect above.
  useEffect(() => {
    if (listing || !profile?.id) return;
    const { state: st, city: ct } = matchKnownLocation(
      profile.state || dealerLocation?.state,
      profile.city || dealerLocation?.city,
    );
    if (!st) return;
    setForm((f) => (f.state || f.city ? f : { ...f, state: st, city: ct }));
  }, [listing, profile?.id, profile?.state, profile?.city, dealerLocation]);

  useEffect(() => {
    previewUrlsRef.current = previews;
  }, [previews]);
  // Lock body scroll while the fullscreen photo manager is open.
  useEffect(() => {
    document.body.style.overflow = photosFull ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [photosFull]);
  // Lock body scroll while the completeness-gap confirmation is open.
  useEffect(() => {
    document.body.style.overflow = gapConfirm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [gapConfirm]);
  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((p) => {
        if (typeof p !== "string") URL.revokeObjectURL(p);
      });
    },
    [],
  );

  // Pre-fill form when in edit mode
  useEffect(() => {
    if (listing) {
      setForm({
        brand: listing.brand || "",
        model: listing.model || "",
        variant: listing.variant || "",
        year: String(listing.year || ""),
        bodyType: listing.body_type || "",
        fuelType: listing.fuel_type || "",
        transmission: listing.transmission || "Auto",
        // AddCarForm writes its stock condition ("Good"/"Excellent"…) into this
        // column; the marketplace domain is used/recon/new, so normalize anything
        // else from the recon flag (this is what gets written back on save).
        condition: ["used", "recon", "new"].includes(listing.condition)
          ? listing.condition
          : listing.is_recon ? "recon" : "used",
        engineCc: listing.engine_cc ? String(listing.engine_cc) : "",
        horsepower: listing.horsepower ? String(listing.horsepower) : "",
        cylinders: listing.cylinders ? String(listing.cylinders) : "",
        doors: listing.doors ? String(listing.doors) : "",
        seats: listing.seats ? String(listing.seats) : "",
        fuelEconomyKpl: listing.fuel_consumption ? String(listing.fuel_consumption) : "",
        mileage: listing.mileage ? String(listing.mileage) : "",
        colour: listing.colour || "",
        registrationDate: listing.registration_date || "",
        plate_number: listing.plate_number || "",
        vin_number: listing.vin_number || "",
        // Edit mode. `defaultValues` is how the dealer dashboard seeds a stock
        // unit's location when publishing one that has none; it goes through the
        // same matcher as the prefill so a state this form cannot render never
        // reaches the select from either direction.
        ...(listing.state
          ? { state: listing.state, city: listing.city || "" }
          : matchKnownLocation(defaultValues?.state, defaultValues?.city)),
        basePrice: listing.base_price ? String(listing.base_price) : "",
        sellingPrice: listing.selling_price
          ? String(listing.selling_price)
          : "",
        commissionAmount: listing.commission_amount
          ? String(listing.commission_amount)
          : "",
        specs: listing.specs || "",
        options: listing.options || "",
        features: listing.features || "",
        images: listing.images || [],
        isRecon: listing.is_recon || false,
        auctionGrade: listing.auction_grade || "",
        interiorGrade: listing.interior_grade || "",
        importCountry: listing.import_country || "",
        auctionHouse: listing.auction_house || "",
        localRegDate: listing.local_reg_date || "",
        chassisStatus: listing.chassis_status || "",
        damageMap: listing.damage_map || [],
        conditionDeclared: !!listing.condition_declared_at,
        included_services: listing.included_services || [],
        // base recon = total recon minus previously-stored services cost
        baseReconCost: Math.max(
          0,
          (listing.recon_cost || 0) - (listing.included_services_cost || 0),
        ),
        video_url: listing.video_url || "",
        car_documents: listing.car_documents || [],
        geranReason:
          listing.geran_status && listing.geran_status !== "held"
            ? listing.geran_status
            : "",
        previous_owners:
          listing.previous_owners != null
            ? String(listing.previous_owners)
            : "",
        road_tax_expiry: listing.road_tax_expiry || "",
        loan_eligible: listing.loan_eligible !== false,
        payment_type: listing.payment_type || "cash",
        warranty_months:
          listing.warranty_months != null
            ? String(listing.warranty_months)
            : "",
        deposit_amount:
          listing.deposit_amount != null ? String(listing.deposit_amount) : "",
        sambungMonthly:    listing.sambung_monthly     != null ? String(listing.sambung_monthly)     : "",
        sambungMonthsLeft: listing.sambung_months_left != null ? String(listing.sambung_months_left) : "",
        sambungBalance:    listing.sambung_balance     != null ? String(listing.sambung_balance)     : "",
        sambungDeposit:    listing.sambung_deposit     != null ? String(listing.sambung_deposit)     : "",
        sambungBank:       listing.sambung_bank        || "",
      });
      setPreviews(listing.images || []);
      setStep(1);
    }
  }, [listing]);

  // ── Auto-fill specs when brand + model + year are known ────────────────────
  const [autoFilled, setAutoFilled] = useState(false);
  useEffect(() => {
    setAutoFilled(false);
  }, [form.brand, form.model]);

  useEffect(() => {
    if (!form.brand || !form.model || !form.year || listing) return;
    const y = parseInt(form.year);
    if (!y || y < 1990) return;

    const cacheKey = `carspec_${form.brand}_${form.model}_${y}`.toLowerCase().replace(/\s+/g, "_");

    const applySpec = (spec) => {
      if (!spec) return;
      setForm((f) => ({
        ...f,
        ...(spec.engine_cc   ? { engineCc:    String(spec.engine_cc)  } : {}),
        ...(spec.transmission ? { transmission: spec.transmission      } : {}),
        ...(spec.fuel_type   ? { fuelType:    spec.fuel_type           } : {}),
        ...(spec.body_type   ? { bodyType:    spec.body_type           } : {}),
        ...(spec.horsepower       ? { horsepower:     String(spec.horsepower)       } : {}),
        ...(spec.cylinders        ? { cylinders:      String(spec.cylinders)        } : {}),
        ...(spec.doors            ? { doors:          String(spec.doors)            } : {}),
        ...(spec.seats            ? { seats:          String(spec.seats)            } : {}),
        ...(spec.fuel_consumption ? { fuelEconomyKpl: String(spec.fuel_consumption) } : {}),
      }));
      setAutoFilled(true);
    };

    // 1. Try the curated local table first, for ANY brand (no network cost).
    //    Covers Perodua/Proton + the common CBU sellers with Malaysian-spec data.
    const local = lookupFullSpec(form.brand, form.model, y);
    if (local) { applySpec(local); return; }

    // 2. Check localStorage cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { applySpec(JSON.parse(cached)); return; }
    } catch (_) {}

    // 3. Hit the serverless proxy
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/car-specs?make=${encodeURIComponent(form.brand)}&model=${encodeURIComponent(form.model)}&year=${y}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) return;
        const { spec } = await res.json();
        if (spec) {
          try { localStorage.setItem(cacheKey, JSON.stringify(spec)); } catch (_) {}
          applySpec(spec);
        }
      } catch (_) {}
    })();
  }, [form.brand, form.model, form.year]);

  // ── VIN / chassis decode (salesman flows) ─────────────────────────────────
  // This button's ONE job is IDENTITY: brand, model, and a year when the source
  // knows one. It deliberately does not fill specs — the effect above already
  // does that from brand + model + year (local table, then cache, then the
  // /api/car-specs proxy), and a second spec path here is exactly the kind of
  // drift that ends with two tables disagreeing.
  //
  // Three ways in, because a Malaysian forecourt holds three kinds of car and
  // only one of them has a VIN that NHTSA has ever seen:
  //   1. Japanese chassis code (FL5-1234567) -> local table, no network. A
  //      recon unit has no 17-char VIN at all, so gating this button on
  //      isLikelyVin() alone left it permanently disabled for the whole recon
  //      segment: no request, no message, nothing happened when it was tapped.
  //   2. Malaysian-built VIN (Perodua, Proton) -> don't call NHTSA. It is the
  //      US federal catalogue and has never held either marque.
  //   3. Anything else 17 characters -> NHTSA, unchanged.
  // Only ever fills blanks — never clobbers what the seller typed.
  const [decodingVin, setDecodingVin] = useState(false);
  const [vinDecodeMsg, setVinDecodeMsg] = useState(null); // { ok, text } | null
  const handleDecodeVin = async () => {
    setVinDecodeMsg(null);
    const raw = String(form.vin_number || "").trim().toUpperCase();
    const blank = (v) => !String(v ?? "").trim();
    const say = (ok, text) => setVinDecodeMsg({ ok, text });
    const fillsItself = "Set the brand, model and year below and the specs fill in on their own.";

    let ident = null;  // { brand, model, year } — identity only
    let extra = null;  // NHTSA spec extras, which are VIN-specific
    let lead = "";
    let specGap = false;      // decoded fine, but carSpecs has no row for this model
    let specVariant = null;   // decoded a variant whose specs differ from the base row

    const chassis = isLikelyVin(raw) ? null : decodeChassis(raw);
    if (chassis) {
      ident = { brand: chassis.brand, model: chassis.model, year: null };
      const yrs = generationYears(chassis);
      lead = `${chassis.code} is a ${chassis.model}${yrs ? `, ${yrs}` : ""}` +
        (chassis.alt ? ` (also sold as ${chassis.alt})` : "");
    } else if (isLikelyVin(raw)) {
      if (isMalaysianVin(raw)) {
        say(false, `That is a Malaysian-built VIN, and the decoder reads a US database that has never held one. ${fillsItself}`);
        return;
      }
      setDecodingVin(true);
      const r = await decodeVin(raw);
      setDecodingVin(false);
      if (!r) {
        say(false, `No match — the decoder reads a US database, so Japan-market and Malaysian cars miss. ${fillsItself}`);
        return;
      }
      ident = { brand: r.make, model: r.model, year: r.year };
      extra = r;
      lead = "VIN decoded";
    } else if (isChassisCode(raw)) {
      say(false, `We don't have "${raw}" in the chassis table yet. ${fillsItself}`);
      return;
    } else {
      say(false, "Enter a 17-character VIN, or the Japanese chassis code from the grant (e.g. FL5-1234567).");
      return;
    }

    // Match what we found against the form's own vocabulary, so the pickers
    // show a real selection rather than a near-miss string.
    const pick = (list, v) => list.find((o) => o.toLowerCase() === String(v || "").toLowerCase());
    const updates = {};
    if (blank(form.brand) && ident.brand) updates.brand = pick(ALL_BRANDS, ident.brand) || ident.brand;
    const brandNow = updates.brand || form.brand;
    if (blank(form.model) && ident.model) updates.model = pick(CAR_DATA[brandNow] || [], ident.model) || ident.model;
    if (blank(form.year) && ident.year) updates.year = String(ident.year);

    // NHTSA also returns per-VIN specs. Those beat a model average, so they are
    // the one thing this handler does fill — still blanks only.
    const filled = [];
    const put = (k, v, label) => {
      if (!v || !blank(form[k])) return;
      updates[k] = String(v);
      filled.push(label);
    };
    if (extra) {
      if (blank(form.engineCc) && extra.cc) updates.engineCc = String(extra.cc);
      if (blank(form.bodyType) && extra.body && BODY_TYPES.includes(extra.body)) updates.bodyType = extra.body;
      put("horsepower", extra.horsepower, `${extra.horsepower} bhp`);
      put("cylinders", extra.cylinders, `${extra.cylinders}-cyl`);
      put("doors", extra.doors, `${extra.doors} doors`);
      put("seats", extra.seats, `${extra.seats} seats`);
    } else if (chassis) {
      // The chassis path had no spec route at all, so a recon decode set a brand
      // and a model and stopped. Two things closed it off: the block above is
      // gated on `extra`, which only the NHTSA branch ever sets, and the spec
      // autofill effect bails on a blank year — which this path leaves blank on
      // purpose, because a chassis code names a GENERATION and cannot tell you a
      // build year.
      //
      // It does not need one. carSpecs rows are keyed on generation ranges
      // (yearFrom..yearTo), so the generation's own start year selects the right
      // row. Nothing is written to form.year — we are reading the generation's
      // specs, not claiming the car was built in chassis.from.
      // Both helpers live in chassisDecode.js so the test exercises the real
      // thing rather than a copy of it. See their comments for why a variant is
      // skipped and why the probe year is the middle of the generation.
      const variantDiffers = specVariantDiffers(chassis);
      const spec = variantDiffers
        ? null
        : lookupFullSpec(ident.brand, ident.model, specProbeYear(chassis));
      if (variantDiffers) specVariant = chassis.alt;
      if (spec) {
        if (blank(form.engineCc) && spec.engine_cc) updates.engineCc = String(spec.engine_cc);
        if (blank(form.bodyType) && spec.body_type && BODY_TYPES.includes(spec.body_type)) updates.bodyType = spec.body_type;
        if (blank(form.fuelType) && spec.fuel_type && FUEL_TYPES.includes(spec.fuel_type)) updates.fuelType = spec.fuel_type;
        put("horsepower", spec.horsepower, `${spec.horsepower} bhp`);
        put("cylinders", spec.cylinders, `${spec.cylinders}-cyl`);
        put("doors", spec.doors, `${spec.doors} doors`);
        put("seats", spec.seats, `${spec.seats} seats`);
        put("fuelEconomyKpl", spec.fuel_consumption, `${spec.fuel_consumption} km/L`);
      } else {
        specGap = true;
      }
    }
    if (Object.keys(updates).length) { setForm((f) => ({ ...f, ...updates })); setAutoFilled(true); }

    // A chassis code names a generation, never a build year. If the seller has
    // already typed a year that sits outside it, one of the two is wrong.
    const yr = parseInt(updates.year || form.year, 10);
    if (chassis && yr && chassis.from && (yr < chassis.from || (chassis.to && yr > chassis.to))) {
      say(false, `${lead}. Your year (${yr}) is outside that generation — check the year or the chassis code.`);
      return;
    }

    const named = [updates.brand, updates.model, updates.year].filter(Boolean).join(" ");
    const parts = [named && `set ${named}`, filled.length && `filled ${filled.join(", ")}`].filter(Boolean);
    // Don't promise specs we do not hold. "Add the year and they fill in" is
    // true only when there IS a row to find; for a model missing from the spec
    // table it sends the seller to add a year and watch nothing happen.
    const tail = specVariant
      ? ` That code is the ${specVariant}, and its engine and output differ from the standard model — fill the Technical section in by hand rather than trusting a model average.`
      : specGap
        ? " We don't hold the specs for this model yet — fill the Technical section in by hand."
        : (blank(form.year) && !updates.year ? " Add the year and the rest fills in on its own." : "");
    if (!parts.length) { say(true, `${lead}. Everything it could set was already filled in.${tail}`); return; }
    say(true, `${lead} — ${parts.join(", ")}.${tail}`);
  };

  // Fetch dealer products when picker is first opened
  useEffect(() => {
    if (!pickerOpen || catalogueLoaded || !dealerId) return;
    (async () => {
      const { data } = await supabase
        .from("dealer_products")
        .select("id, name, category, cost_price, selling_price")
        .eq("dealer_id", dealerId)
        .eq("is_active", true)
        .order("name");
      setServiceCatalogue(data || []);
      setCatalogueLoaded(true);
    })();
  }, [pickerOpen, dealerId]);

  const addService = (product) => {
    const entry = {
      product_id: product.id,
      name: product.name,
      category: product.category,
      cost: Number(product.cost_price) || 0,
      selling_price: Number(product.selling_price) || 0,
      icon: product.category,
    };
    setForm((f) => ({
      ...f,
      included_services: [...(f.included_services || []), entry],
    }));
    setPickerOpen(false);
    setServiceSearch("");
  };

  const removeService = (idx) => {
    setForm((f) => ({
      ...f,
      included_services: (f.included_services || []).filter(
        (_, i) => i !== idx,
      ),
    }));
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleChange = (e) => set(e.target.name, e.target.value);
  const modelOptions =
    form.brand && CAR_DATA[form.brand] ? CAR_DATA[form.brand] : [];
  // Decode accepts a full VIN OR a Japanese chassis code. Gating on the VIN
  // alone is what left the button permanently dead for recon stock.
  const canDecodeVin =
    isLikelyVin(form.vin_number) || isChassisCode(form.vin_number);
  // The seller's own city rides along when it is not one of ours, so the
  // prefill above has something the dropdown can actually show.
  const cityOptions = cityOptionsFor(form.state, form.city);

  // Auto-suggest auction grade based on mileage + age
  const suggestedGrade = useMemo(() => {
    const km = parseInt(form.mileage) || 0;
    const age =
      new Date().getFullYear() -
      (parseInt(form.year) || new Date().getFullYear());
    if (km < 30000 && age < 3) return "4.5";
    if (km < 70000 || age < 6) return "4";
    if (km < 100000 || age < 9) return "3.5";
    return "3";
  }, [form.mileage, form.year]);

  // ── Copy listing data handler ──
  const handleCopy = () => {
    const src = listing || {
      brand: form.brand,
      model: form.model,
      variant: form.variant,
      year: form.year,
      body_type: form.bodyType,
      fuel_type: form.fuelType,
      transmission: form.transmission,
      condition: form.condition,
      engine_cc: form.engineCc,
      mileage: form.mileage,
      colour: form.colour,
      registration_date: form.registrationDate,
      vin_number: form.vin_number,
      state: form.state,
      city: form.city,
      selling_price: form.sellingPrice,
      specs: form.specs,
      options: form.options,
      features: form.features,
    };
    navigator.clipboard.writeText(buildCopyText(src));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── image handlers ── */
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = 30 - form.images.length;
    if (slots <= 0) {
      toast.error("You've reached the 30-image limit for this listing.");
      e.target.value = "";
      return;
    }
    // Hard cap: only the first `slots` files are ever processed/uploaded, even
    // if the OS picker let the user select more (the file dialog can't be capped).
    const accepted = files.slice(0, slots);
    if (accepted.length < files.length)
      toast.message(
        `Added the first ${accepted.length} — 30 images is the max per listing.`,
      );
    set("images", [...form.images, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
    uploadImagesEager(accepted); // fire and forget
    e.target.value = "";
  };

  // `draftId` state isn't visible to a second overlapping call until the
  // insert resolves and re-renders — two file batches added in quick
  // succession both read draftId as null and both insert a draft row. The
  // ref is set synchronously, so the second call sees it immediately.
  const creatingDraftRef = useRef(false);
  const createDraftIfNeeded = async (firstUrl) => {
    if (draftId || creatingDraftRef.current) return;
    if (!dealerId) return;
    creatingDraftRef.current = true;
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .insert({ dealer_id: dealerId, status: "draft", images: [firstUrl] })
        .select("id")
        .single();
      if (!error && data) setDraftId(data.id);
    } catch {}
  };

  const compressImage = (file, maxWidth = 1200, quality = 0.82) =>
    new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) =>
            resolve(
              blob
                ? new File([blob], (file.name || "photo.jpg").replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
                : file,
            ),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });

  // Upload a single file with retries. Each file gets a unique path and uses
  // upsert:true, so if a client-side timeout fires AFTER the object already
  // landed server-side (the cause of "Failed" toasts on images that actually
  // uploaded), the retry overwrites the same path and succeeds instead of
  // erroring on a 409. Status only flips to "error" once all attempts fail.
  const uploadOne = async (file, absIdx) => {
    const compressed = await compressImage(file);
    const rand =
      (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    // Store under the uploader's uid folder so the storage RLS delete policy
    // (foldername[1] = auth.uid()) can match — flat root paths carried no owner
    // and were undeletable. profile.id is the logged-in user's auth uid.
    const folder = profile?.id ? `${profile.id}/` : "";
    const path = `${folder}${Date.now()}-${rand}-${(compressed.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.storage
        .from("car-images")
        .upload(path, compressed, {
          upsert: true,
          contentType: compressed.type || "image/jpeg",
        });
      if (!error) {
        const url = supabase.storage
          .from("car-images")
          .getPublicUrl(path).data.publicUrl;
        setForm((f) => {
          const imgs = [...f.images];
          const fileIdx = imgs.indexOf(file);
          if (fileIdx >= 0) imgs[fileIdx] = url;
          return { ...f, images: imgs };
        });
        setImgProgress((p) =>
          p.map((e, j) => (j === absIdx ? { ...e, status: "done" } : e)),
        );
        return url;
      }
      lastErr = error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    setImgProgress((p) =>
      p.map((e, j) => (j === absIdx ? { ...e, status: "error" } : e)),
    );
    throw lastErr;
  };

  const uploadImagesEager = async (files) => {
    const startIdx = imgProgress.length;
    setImgProgress((p) => [
      ...p,
      ...files.map((f) => ({ name: f.name, status: "uploading" })),
    ]);

    // Cap concurrency so a large batch (up to 30) doesn't exhaust the browser's
    // connection pool / storage gateway — the root cause of uploads that land
    // server-side but report "Failed" to the client. Files are pulled from a
    // shared cursor by a small pool of workers.
    const CONCURRENCY = 4;
    const results = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const myIdx = cursor++;
        try {
          results[myIdx] = {
            status: "fulfilled",
            value: await uploadOne(files[myIdx], startIdx + myIdx),
          };
        } catch (err) {
          results[myIdx] = { status: "rejected", reason: err };
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker),
    );

    const firstSuccess = results.find((r) => r && r.status === "fulfilled");
    if (firstSuccess) createDraftIfNeeded(firstSuccess.value);

    const failed = results.filter((r) => r && r.status === "rejected").length;
    if (failed > 0)
      toast.error(
        `${failed} image${failed === 1 ? "" : "s"} failed to upload — tap Add to retry ${failed === 1 ? "it" : "them"}.`,
      );
  };

  const moveToFirst = (i) => {
    if (i <= 0) return;
    setForm((f) => {
      const a = [...f.images];
      const [x] = a.splice(i, 1);
      a.unshift(x);
      return { ...f, images: a };
    });
    setPreviews((p) => {
      const a = [...p];
      const [x] = a.splice(i, 1);
      a.unshift(x);
      return a;
    });
  };

  const removeImage = (i) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));
    setPreviews((p) => {
      const a = [...p];
      const [r] = a.splice(i, 1);
      if (r) URL.revokeObjectURL(r);
      return a;
    });
  };

  const reorder = (from, to) => {
    if (
      from === null ||
      to === null ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= form.images.length ||
      to >= form.images.length
    )
      return;
    setForm((f) => {
      const a = [...f.images];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return { ...f, images: a };
    });
    setPreviews((p) => {
      const a = [...p];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return a;
    });
  };

  const moveByStep = (i, d) => {
    const n = i + d;
    if (n >= 0 && n < form.images.length) reorder(i, n);
  };
  const dragStart = (i, e) => {
    setDraggingIndex(i);
    setDropTargetIndex(i);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
  };
  const dragOver = (i, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetIndex !== i) setDropTargetIndex(i);
  };
  const drop = (i, e) => {
    e.preventDefault();
    const p = Number(e.dataTransfer.getData("text/plain"));
    reorder(Number.isInteger(p) ? p : draggingIndex, i);
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };
  const dragEnd = () => {
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };
  const clearAll = () => {
    previews.forEach(URL.revokeObjectURL);
    set("images", []);
    setPreviews([]);
    setDraggingIndex(null);
    setDropTargetIndex(null);
    if (photosInputRef.current) photosInputRef.current.value = "";
  };

  // Scroll the form back to the top whenever step changes. Auto-focusing the
  // first field is a desktop convenience (fast tab/type entry) — on touch
  // devices it force-opens the on-screen keyboard the instant a step loads,
  // which is actively harmful on Step 1 (Photos): the first focusable field
  // there ends up being the optional Walkthrough Video URL input even though
  // the actual task is tapping the photo upload button.
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const isTouchDevice = window.matchMedia?.("(pointer: coarse)").matches;
    if (isTouchDevice) return;
    const t = setTimeout(() => {
      const el = formRef.current?.querySelector(
        'input:not([type="file"]):not([type="hidden"]):not([disabled]), select:not([disabled])',
      );
      el?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [step]);

  // Enter key: advance to next field, or next step when all filled
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const tag = e.target.tagName.toLowerCase();
    if (tag === "textarea") return; // Enter adds newline in textareas
    if (tag === "button") return; // buttons handle their own Enter

    e.preventDefault();

    const container = formRef.current;
    if (!container) return;
    const focusable = [
      ...container.querySelectorAll(
        'input:not([type="file"]):not([type="hidden"]):not([disabled]), select:not([disabled])',
      ),
    ].filter((el) => el.offsetParent !== null);

    const idx = focusable.indexOf(e.target);
    if (idx >= 0 && idx < focusable.length - 1) {
      const next = focusable[idx + 1];
      next.focus();
      if (next.select && next.type !== "date" && next.type !== "color")
        next.select();
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // Last field — advance step (with reason if blocked) or submit
      if (step < STEPS.length) {
        goNext();
      } else {
        handleSubmit();
      }
    }
  };

  const canNext = () => {
    if (step === 1) return form.images.length > 0;
    if (step === 2) return form.brand && form.model && form.year && form.mileage && form.colour && form.condition;
    if (step === 3) return form.bodyType && form.fuelType;
    if (step === 4) return form.state && form.city;
    if (step === 5) return form.payment_type === "sambung_bayar"
      ? (Number(form.sambungMonthly) > 0 && Number(form.sambungDeposit) > 0)
      : (form.basePrice && form.sellingPrice);
    if (step === 6) return listing ? true : geranSatisfied;
    return true;
  };

  // Which required fields are still empty on a given step (for the toast). Any
  // step can be validated — not just the current one — so Publish can pre-flight
  // every step even when the user jumped straight to Review via the step tabs.
  const missingForStep = (s) => {
    if (s === 1) return form.images.length > 0 ? [] : ["at least 1 photo"];
    if (s === 2) return (intakeDone ? [
      [!form.condition, "Condition"],
    ] : [
      [!form.brand, "Brand"], [!form.model, "Model"], [!form.year, "Year"],
      [!form.mileage, "Mileage"], [!form.colour, "Colour"], [!form.condition, "Condition"],
    ]).filter(([m]) => m).map(([, l]) => l);
    if (s === 3) return intakeDone ? [] : [[!form.bodyType, "Body type"], [!form.fuelType, "Fuel type"]].filter(([m]) => m).map(([, l]) => l);
    if (s === 4) return [[!form.state, "State"], [!form.city, "City"]].filter(([m]) => m).map(([, l]) => l);
    if (s === 5) {
      if (intakeDone) return [];
      if (form.payment_type === "sambung_bayar")
        return [[!(Number(form.sambungMonthly) > 0), "Monthly (ansuran)"], [!(Number(form.sambungDeposit) > 0), "Deposit / duit nampak"]].filter(([m]) => m).map(([, l]) => l);
      return [[!form.basePrice, "Base price"], [!form.sellingPrice, "Selling price"]].filter(([m]) => m).map(([, l]) => l);
    }
    if (s === 6)
      return listing || geranSatisfied
        ? []
        : ["Geran / registration card (or the reason it's unavailable)"];
    return [];
  };
  const missingFields = () => missingForStep(step);

  // Pre-flight every required step. Returns { step, fields } for the FIRST step
  // still missing something, or null when the form is complete. Used by Publish
  // so a half-filled row never reaches the DB (which would throw a cryptic
  // not-null error the user can't act on).
  const firstIncompleteStep = () => {
    for (const s of [1, 2, 3, 4, 5, 6]) {
      const fields = missingForStep(s);
      if (fields.length) return { step: s, fields };
    }
    return null;
  };

  // Advance a step, or explain (via toast) exactly what's missing.
  const goNext = () => {
    const miss = missingFields();
    if (miss.length) { toast.error(`Please fill in: ${miss.join(", ")}`); return; }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const uploadImages = async () => {
    const urls = [];
    for (const file of form.images) {
      if (typeof file === "string") {
        urls.push(file);
        continue;
      }
      // Same uid-folder scoping as the eager path, so images uploaded at publish
      // are owner-scoped and deletable under the storage RLS delete policy.
      const folder = profile?.id ? `${profile.id}/` : "";
      const name = `${folder}${Date.now()}-${(file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("car-images")
        .upload(name, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) {
        // Tag it as an IMAGE failure. A storage RLS rejection also carries
        // code 42501, which the publish catch-block otherwise reports as
        // "your account isn't fully activated" — a misdiagnosis that sent a
        // whole debugging cycle after the seller's approval status while the
        // real fault was the upload.
        const e = new Error(
          `Photo "${file.name || "image"}" failed to upload: ${error.message || "unknown error"}`,
        );
        e.__imageUpload = true;
        throw e;
      }
      urls.push(
        supabase.storage.from("car-images").getPublicUrl(name).data.publicUrl,
      );
    }
    return urls;
  };

  const handleSubmit = async (skipGapCheck = false) => {
    // Pre-flight (new listings only): the step tabs let a user jump straight to
    // Review and hit Publish while an earlier required step is still blank
    // (brand/model are NOT NULL — that used to surface as a cryptic DB "error
    // pop up"). Catch it here: name the missing fields and bounce the user to
    // the offending step. Edit mode ("Save Changes") keeps the lighter checks so
    // quick edits of older listings aren't blocked on legacy-empty fields.
    const incomplete = listing ? null : firstIncompleteStep();
    if (incomplete) {
      const label = STEPS.find((x) => x.id === incomplete.step)?.label || `Step ${incomplete.step}`;
      setStep(incomplete.step);
      toast.error(`Required field${incomplete.fields.length > 1 ? "s" : ""} not filled: ${incomplete.fields.join(", ")}. Complete "${label}" before publishing.`);
      return;
    }
    if (!form.images.length) {
      toast.error("Please add at least 1 photo");
      return;
    }
    // Sambung bayar cars aren't sold at a full price — the buyer takes over the
    // loan — so base/selling price are optional there (default 0) and the sambung
    // monthly/deposit are what matter. Everything else stays required as before.
    const isSambung = form.payment_type === "sambung_bayar";
    const mileage = parseInt(form.mileage);
    const basePrice = form.basePrice ? parseFloat(form.basePrice) : 0;
    const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
    const year = parseInt(form.year);
    const engineCc = form.engineCc ? parseInt(form.engineCc) : null;

    if (isNaN(mileage) || mileage < 0) {
      toast.error("Invalid mileage");
      return;
    }
    if (isSambung) {
      if (!(Number(form.sambungMonthly) > 0)) { toast.error("Sambung Bayar: monthly (ansuran) is required"); return; }
      if (!(Number(form.sambungDeposit) > 0)) { toast.error("Sambung Bayar: deposit / duit nampak is required"); return; }
    } else {
      if (isNaN(basePrice) || basePrice < 0) {
        toast.error("Invalid base price");
        return;
      }
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        toast.error("Invalid selling price");
        return;
      }
    }
    if (isNaN(year) || year < 1900) {
      toast.error("Invalid year");
      return;
    }

    // Soft gate — buyer-facing gaps (missing transmission, VIN, etc.) don't
    // block the form the way a bad price/year does, but a listing this thin
    // won't sell well or read as trustworthy. Surface it once and let the
    // dealer choose to fix it or post anyway, rather than silently letting
    // an incomplete listing go live.
    if (!skipGapCheck && !isSambung) {
      const gaps = getListingGaps({
        images: form.images,
        selling_price: sellingPrice,
        mileage,
        transmission: form.transmission,
        fuel_type: form.fuelType,
        vin_number: form.vin_number,
        colour: form.colour,
        condition: form.condition,
        state: form.state,
      });
      if (gaps.length > 0) {
        setGapConfirm(gaps);
        return;
      }
    }

    setUploading(true);
    try {
      const imageUrls = await uploadImages();
      const servicesCost = (form.included_services || []).reduce(
        (sum, s) => sum + (s.cost || 0),
        0,
      );
      const payload = {
        brand: form.brand,
        model: form.model,
        variant: form.variant,
        state: form.state,
        city: form.city,
        mileage,
        colour: form.colour,
        condition: form.condition,
        registration_date: form.registrationDate,
        specs: form.specs,
        options: form.options,
        features: form.features,
        base_price: basePrice,
        selling_price: sellingPrice,
        // original_price is deliberately absent, not null. This payload is used
        // for updates too, and an absent key leaves the stored value alone —
        // sending null would wipe a genuine price drop recorded by
        // PriceEditModal every time someone edited the listing.
        engine_cc: engineCc,
        horsepower:       form.horsepower     ? parseInt(form.horsepower)         : null,
        cylinders:        form.cylinders      ? parseInt(form.cylinders)          : null,
        doors:            form.doors          ? parseInt(form.doors)              : null,
        seats:            form.seats          ? parseInt(form.seats)              : null,
        fuel_consumption: form.fuelEconomyKpl ? parseFloat(form.fuelEconomyKpl)  : null,
        images: imageUrls,
        year,
        transmission: form.transmission,
        body_type: form.bodyType,
        fuel_type: form.fuelType,
        plate_number: form.plate_number || null,
        vin_number: form.vin_number || null,
        // Recon / grading
        is_recon: form.isRecon,
        auction_grade: form.isRecon ? form.auctionGrade || null : null,
        interior_grade: form.isRecon ? form.interiorGrade || null : null,
        import_country: form.isRecon ? form.importCountry || null : null,
        auction_house: form.isRecon ? form.auctionHouse || null : null,
        local_reg_date: form.isRecon ? form.localRegDate || null : null,
        chassis_status: form.isRecon ? form.chassisStatus || null : null,
        damage_map: form.damageMap || [],
        // Keep the original declaration timestamp on edit so re-saving a listing
        // does not make an old walkaround look like it happened today.
        condition_declared_at: form.conditionDeclared
          ? listing?.condition_declared_at || new Date().toISOString()
          : null,
        commission_amount: form.commissionAmount ? parseFloat(form.commissionAmount) : null,
        included_services: form.included_services || [],
        included_services_cost: servicesCost,
        recon_cost: (form.baseReconCost || 0) + servicesCost,
        video_url: form.video_url || null,
        car_documents: form.car_documents || [],
        geran_status: (form.car_documents || []).some(
          (d) => d.type === "registration_card",
        )
          ? "held"
          : form.geranReason || null,
        previous_owners: form.previous_owners
          ? parseInt(form.previous_owners)
          : null,
        road_tax_expiry: form.road_tax_expiry || null,
        loan_eligible: form.loan_eligible !== false,
        warranty_months: form.warranty_months
          ? parseInt(form.warranty_months)
          : null,
        deposit_amount: form.deposit_amount
          ? parseFloat(form.deposit_amount)
          : null,
        payment_type: form.payment_type || "cash",
        // Sambung bayar figures — only persisted when this is a sambung listing,
        // cleared otherwise so switching payment type doesn't leave stale numbers.
        sambung_monthly:     form.payment_type === "sambung_bayar" && form.sambungMonthly     ? parseFloat(form.sambungMonthly)     : null,
        sambung_months_left: form.payment_type === "sambung_bayar" && form.sambungMonthsLeft  ? parseInt(form.sambungMonthsLeft)    : null,
        sambung_balance:     form.payment_type === "sambung_bayar" && form.sambungBalance     ? parseFloat(form.sambungBalance)     : null,
        sambung_deposit:     form.payment_type === "sambung_bayar" && form.sambungDeposit     ? parseFloat(form.sambungDeposit)     : null,
        sambung_bank:        form.payment_type === "sambung_bayar" && form.sambungBank        ? form.sambungBank.trim()             : null,
      };

      // All salesmen require approval — standalone → superadmin, under-dealer → manager
      const needsApproval = profile?.role === "salesman";

      if (listing) {
        // Edit mode — update by id
        // If resubmitting a rejected listing, return it to pending_approval
        const resubmitting = listing.status === "rejected" && needsApproval;
        const editPayload = resubmitting
          ? { ...payload, status: "pending_approval", rejection_reason: null }
          : payload;
        const { data, error } = await supabase
          .from("car_listings")
          .update(editPayload)
          .eq("id", listing.id)
          .select("*");
        if (error) throw error;
        if (!data?.length)
          throw new Error(
            "Update blocked — your dealer_id may not match your account. Run the fix SQL in Supabase (see README or ask your admin).",
          );
        const savedListing = data[0];
        onUpdate(savedListing);
        // Sync services to linked stock_unit
        if (savedListing?.id && dealerId) {
          await supabase
            .from("stock_units")
            .update({ included_services: form.included_services || [] })
            .eq("listing_id", savedListing.id)
            .eq("dealer_id", dealerId);
        }
      } else {
        // Create mode — insert new record
        if (!dealerId) {
          alert("Profile not loaded yet — please wait a moment and try again.");
          setUploading(false);
          return;
        }
        const publishStatus = needsApproval ? "pending_approval" : "available";
        let savedListing;
        if (draftId) {
          const { data, error } = await supabase
            .from("car_listings")
            .update({ ...payload, status: publishStatus })
            .eq("id", draftId)
            .select()
            .single();
          if (error) throw error;
          savedListing = data;
        } else {
          console.log(
            "[CarForm] insert dealer_id:",
            dealerId,
            "| role:",
            profile?.role,
          );
          const { data, error } = await supabase
            .from("car_listings")
            .insert([
              {
                dealer_id: dealerId,
                ...payload,
                status: publishStatus,
                // salesman_lite owns and sells their own listings
                ...(profile?.role === "salesman"
                  ? { assigned_to: profile.id }
                  : {}),
              },
            ])
            .select()
            .single();
          if (error) throw error;
          savedListing = data;
        }
        cfClearDraft(profile?.id);
        onCreate(savedListing);
        // Sync services to linked stock_unit (if one is auto-created)
        if (savedListing?.id) {
          await supabase
            .from("stock_units")
            .update({ included_services: form.included_services || [] })
            .eq("listing_id", savedListing.id)
            .eq("dealer_id", dealerId);
        }
        previews.forEach((p) => {
          if (typeof p !== "string") URL.revokeObjectURL(p);
        });
        setForm(initialListing);
        setPreviews([]);
        setDraggingIndex(null);
        setDropTargetIndex(null);
        setStep(1);
        setDraftId(null);
        setImgProgress([]);
      }
    } catch (err) {
      const msg = err?.message || "";
      // Checked FIRST: an image-upload failure must never be reported as an
      // account/permission problem (see uploadImages).
      if (err?.__imageUpload) {
        toast.error(`${msg}. Remove that photo and add it again, then publish.`);
      } else if (msg.includes('listing_cap_exceeded') || (err?.code === 'P0001' && msg.includes('listing cap'))) {
        setCapError(true);
      } else if (msg.includes('subscription_inactive')) {
        toast.error("Your trial or subscription has ended. Activate your plan to publish new listings.");
      } else if (err?.code === '42501' || msg.toLowerCase().includes('row-level security')) {
        toast.error("Publishing was blocked — your account isn't fully activated yet. Refresh and try again, or contact support.");
      } else if (err?.code === '23502') {
        // not-null violation slipped past pre-flight — name the column
        const col = msg.match(/column "?([a-z_]+)"?/i)?.[1];
        toast.error(col ? `Missing required field: ${col}. Please fill it in before publishing.` : "A required field is missing. Please review the form.");
      } else {
        toast.error("Could not publish: " + msg);
      }
    }
    setUploading(false);
  };

  async function handleSectionDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIdx = sectionOrder.indexOf(active.id);
    const newIdx = sectionOrder.indexOf(over.id);
    const newOrder = arrayMove(sectionOrder, oldIdx, newIdx);
    setSectionOrder(newOrder);
    if (profile?.id) {
      await supabase.from("profiles").update({ form_layout: newOrder }).eq("id", profile.id);
    }
  }

  function isSectionComplete(id) {
    switch (id) {
      case 1: return form.images.length > 0;
      // In intakeDone mode the identity/technical/pricing fields are hidden here
      // (already captured by AddCarForm — some, like colour, are optional there),
      // so only require what this form still shows.
      case 2: return intakeDone ? !!form.condition : !!(form.brand && form.model && form.year && form.mileage && form.colour && form.condition);
      case 3: return intakeDone ? true : !!(form.bodyType && form.fuelType);
      case 4: return !!(form.state && form.city);
      case 5: return intakeDone ? true : (form.payment_type === "sambung_bayar"
        ? (Number(form.sambungMonthly) > 0 && Number(form.sambungDeposit) > 0)
        : !!(form.basePrice && form.sellingPrice));
      case 6: return listing ? true : geranSatisfied;
      case 7: return true;
      default: return false;
    }
  }


  // Single photo thumbnail — reused by the inline strip and the fullscreen manager.
  function renderPhotoTile(src, i) {
    return (
      <div
        key={src + i}
        draggable
        onDragStart={(e) => dragStart(i, e)}
        onDragOver={(e) => dragOver(i, e)}
        onDrop={(e) => drop(i, e)}
        onDragEnd={dragEnd}
        className={`relative aspect-[4/3] sm:aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gray-100 border transition-all ${i === dropTargetIndex ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-200"} ${i === draggingIndex ? "opacity-70 scale-[0.98]" : ""}`}
      >
        <img src={src} alt={`preview ${i + 1}`} className="w-full h-full object-cover" />
        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] sm:text-[10px] font-semibold">
          #{i + 1}
        </span>
        {i === 0 ? (
          <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-blue-600 text-white text-[9px] sm:text-[10px] font-semibold">
            Primary
          </span>
        ) : (
          <button
            type="button"
            onClick={() => moveToFirst(i)}
            className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 hover:bg-black text-white text-[9px] sm:text-[10px] font-medium transition-colors"
          >
            Set #1
          </button>
        )}
        <button
          type="button"
          onClick={() => removeImage(i)}
          className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-black/70 hover:bg-red-600 text-white text-[10px] sm:text-xs font-bold transition-colors"
        >
          ×
        </button>
        <div className="absolute bottom-1 right-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveByStep(i, -1)}
            disabled={i === 0}
            className="w-5 h-5 rounded bg-black/70 text-white flex items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => moveByStep(i, 1)}
            disabled={i === previews.length - 1}
            className="w-5 h-5 rounded bg-black/70 text-white flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  function renderSectionContent(id) {
    switch (id) {
      case 1: return (
        <div className="space-y-5">
          <input
            ref={photosInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFiles}
            className="hidden"
          />
          {previews.length === 0 ? (
            <label
              onClick={() => photosInputRef.current?.click()}
              className="block border-2 border-dashed border-gray-300 hover:border-red-500 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
            >
              <Camera className="w-10 h-10 text-gray-400 group-hover:text-red-500 mx-auto mb-3 transition-colors" />
              <p className="text-gray-900 font-medium mb-1">Choose Photos</p>
              <p className="text-gray-500 text-sm">Up to 30 images — JPG, PNG, WEBP</p>
              <p className="text-blue-400 text-xs mt-2 font-medium">{form.images.length}/30 selected</p>
            </label>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => photosInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Add more · {form.images.length}/30
              </button>
            </div>
          )}
          {imgProgress.filter(p => p.status !== 'done').length > 0 && (
            <div className="space-y-1.5">
              {imgProgress.filter(p => p.status !== 'done').map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50
                     border border-gray-200 rounded-lg text-xs">
                  {p.status === 'uploading'
                    ? <div className="w-3 h-3 border border-gray-300 border-t-gray-600
                           rounded-full animate-spin flex-shrink-0" />
                    : <span className="text-red-400 flex-shrink-0">✕</span>}
                  <span className="text-gray-600 truncate">{p.name}</span>
                  <span className={p.status === 'error'
                    ? 'text-red-400 ml-auto flex-shrink-0'
                    : 'text-gray-500 ml-auto flex-shrink-0'}>
                    {p.status === 'error' ? 'Failed' : 'Uploading…'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {previews.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Image #1 is the main thumbnail · use arrows to reorder
                </p>
                <button
                  type="button"
                  onClick={() => setPhotosFull(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors flex-shrink-0"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Manage all
                </button>
              </div>
              {/* Compact single-row strip — scrolls horizontally, mobile-friendly */}
              <div className="flex gap-2 overflow-x-auto pb-1 px-0.5">
                {previews.map((src, i) => (
                  <div key={src + i} className="w-24 sm:w-28 flex-shrink-0">
                    {renderPhotoTile(src, i)}
                  </div>
                ))}
              </div>
            </>
          )}
          {photosFull && createPortal(
            <div
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col"
              onClick={() => setPhotosFull(false)}
            >
              <div
                className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 text-white min-w-0">
                  <span className="font-semibold text-sm flex-shrink-0">Manage Photos</span>
                  <span className="text-white/50 text-xs truncate">
                    {previews.length}/30 · drag or use arrows to reorder
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => photosInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" /> Add more
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotosFull(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-5xl mx-auto">
                  {previews.map((src, i) => renderPhotoTile(src, i))}
                </div>
              </div>
            </div>,
            document.body,
          )}
          {!intakeDone && (
                      <>
                                    <Field label="Plate Number" hint="Optional — vehicle registration plate">
            <input
              name="plate_number"
              value={form.plate_number}
              onChange={handleChange}
              onBlur={e => checkDuplicate('plate', e.target.value)}
              placeholder="e.g. WXY 1234"
              className={inputCls}
            />
            {dupWarning.plate && (
              <p className="text-xs text-amber-600 mt-1">Duplicate detected — {dupWarning.plate}</p>
            )}
            {conflictWarning.plate && (
              <p className="text-xs text-red-600 mt-1 font-semibold">This plate is already live on another dealer's listing. Confirm you hold the vehicle before publishing — duplicate/cloned listings are removed.</p>
            )}
          </Field>
          <Field label="VIN / chassis number" hint={isPremiumPlan ? "17-char VIN, or the Japanese chassis code — tap Decode to auto-fill specs" : "VIN, or the Japanese chassis code from the grant"}>
            <div className="flex gap-2">
              <input
                name="vin_number"
                value={form.vin_number}
                onChange={handleChange}
                onBlur={e => checkDuplicate('vin', e.target.value)}
                placeholder="e.g. JN1CA31D1XT000001 or FL5-1234567"
                className={`${inputCls} flex-1`}
                style={{ textTransform: "uppercase" }}
              />
              {isPremiumPlan && (
                <button
                  type="button"
                  onClick={handleDecodeVin}
                  disabled={decodingVin || !canDecodeVin}
                  className={`shrink-0 px-4 text-sm font-semibold text-white transition-colors ${canDecodeVin && !decodingVin ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"}`}
                >
                  {decodingVin ? "Decoding…" : "Decode"}
                </button>
              )}
            </div>
            {dupWarning.vin && (
              <p className="text-xs text-amber-600 mt-1">Duplicate detected — {dupWarning.vin}</p>
            )}
            {conflictWarning.vin && (
              <p className="text-xs text-red-600 mt-1 font-semibold">This VIN is already live on another dealer's listing. Confirm you hold the vehicle before publishing — duplicate/cloned listings are removed.</p>
            )}
            {vinDecodeMsg && (
              <p className={`text-xs mt-1 ${vinDecodeMsg.ok ? "text-emerald-600" : "text-amber-600"}`}>{vinDecodeMsg.text}</p>
            )}
          </Field>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    )}

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              {/* Walkthrough Video */}
          {/* Walkthrough Video */}
          <div className="space-y-1">
            <label className="text-sm text-gray-600">
              Walkthrough Video{" "}
              <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="url"
              placeholder="Paste YouTube, TikTok, or Instagram Reel URL"
              value={form.video_url || ""}
              onChange={(e) => set("video_url", e.target.value)}
              className={inputCls}
            />
            {form.video_url && <VideoPreview url={form.video_url} />}
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          {intakeDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <Check size={12} />
              {form.year} {form.brand} {form.model} — identity carried over from Core Details
            </div>
          )}
          {/* Core inputs — one per row */}
          {!intakeDone && (
          <>
          <Field label="Brand" required>
            <PickerField
              label="Select Brand"
              value={form.brand}
              onChange={(v) => setForm((f) => ({ ...f, brand: v, model: "" }))}
              options={ALL_BRANDS}
              placeholder="Select brand"
              allowCustom
            />
          </Field>
         <Field label="Model" required>
            <PickerField
              label="Select Model"
              value={form.model}
              onChange={(v) => set("model", v)}
              options={modelOptions}
              placeholder={form.brand ? "Select model" : "Pick brand first"}
              disabled={!form.brand}
              allowCustom
            />
          </Field>
          <Field label="Variant">
            <input
              name="variant"
              value={form.variant}
              onChange={handleChange}
              placeholder="e.g. 1.5 G"
              enterKeyHint="next"
              className={inputCls}
            />
          </Field>
          <Field label="Year" required>
            <input
              type="number"
              name="year"
              value={form.year}
              onChange={handleChange}
              placeholder="e.g. 2021"
              min="1900"
              max="2030"
              enterKeyHint="next"
              className={inputCls}
            />
          </Field>
          <Field label="Mileage (km)" required>
            <input
              type="number"
              name="mileage"
              value={form.mileage}
              onChange={handleChange}
              placeholder="e.g. 45000"
              min="0"
              enterKeyHint="next"
              className={inputCls}
            />
          </Field>
          <Field label="Colour" required>
            <input
              name="colour"
              value={form.colour}
              onChange={handleChange}
              placeholder="e.g. Pearl White"
              enterKeyHint="next"
              className={inputCls}
            />
          </Field>
          </>
          )}
          {autoFilled && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
              <Check size={12} />
              Specs auto-filled — review Technical section and adjust if needed
            </div>
          )}

          <MoreDetails>
             <Field label="Registration Date">
              <input
                type="date"
                name="registrationDate"
                value={form.registrationDate}
                onChange={handleChange}
                className={inputCls}
              />
            </Field>
            <Field label="Previous Owners">
              <input
                type="number"
                name="previous_owners"
                value={form.previous_owners}
                onChange={handleChange}
                placeholder="e.g. 2"
                min="0"
                max="10"
                className={inputCls}
              />
            </Field>
            <Field label="Road Tax Expiry">
              <input
                type="date"
                name="road_tax_expiry"
                value={form.road_tax_expiry}
                onChange={handleChange}
                className={inputCls}
              />
            </Field>
          </MoreDetails>

          {/* Pills — below everything */}
          <Field label="Condition" required>
            <PillSelect
              options={CONDITIONS}
              value={form.condition}
              onChange={(v) => set("condition", v)}
            />
          </Field>
          <Field label="Loan Eligible">
            <PillSelect
              options={["Yes", "No"]}
              value={form.loan_eligible ? "Yes" : "No"}
              onChange={(v) => set("loan_eligible", v === "Yes")}
            />
          </Field>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          {intakeDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <Check size={12} />
              {[form.bodyType, form.fuelType, form.transmission, form.engineCc && `${form.engineCc}cc`].filter(Boolean).join(" · ")} — carried over from Core Details
            </div>
          )}
          {/* Core input */}
          {!intakeDone && (
          <Field
            label="Engine Displacement (CC)"
            hint="Used for road tax & insurance calc"
          >
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  name="engineCc"
                  value={form.engineCc}
                  onChange={handleChange}
                  placeholder="e.g. 1500"
                  min="50"
                  max="10000"
                  className={`${inputCls} pr-12`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">
                  cc
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CC_PRESETS.map((cc) => (
                  <button
                    key={cc}
                    type="button"
                    onClick={() => set("engineCc", String(cc))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${String(form.engineCc) === String(cc) ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-100 border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600"}`}
                  >
                    {cc >= 1000 ? `${cc / 1000}`.replace(/\.0$/, "") + "k" : cc}
                    cc
                  </button>
                ))}
              </div>
            </div>
          </Field>
          )}

          {/* Condition report — every car, not just recon. Buyers cannot tell a
              clean car from a skipped walkaround unless the dealer says which it
              is, so the map is paired with an explicit declaration. */}
          <Field
            label="Condition Report"
            hint="Mark every dent, scratch, rust spot and replaced panel — buyers see this on the listing"
          >
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <DamageMap
                  value={form.damageMap}
                  onChange={(v) => set("damageMap", v)}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  set("conditionDeclared", !form.conditionDeclared)
                }
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${form.conditionDeclared ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200 hover:border-gray-300"}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${form.conditionDeclared ? "bg-emerald-600 border-emerald-600" : "border-gray-300 bg-white"}`}
                >
                  {form.conditionDeclared && (
                    <Check size={13} className="text-white" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    I walked around this car and marked every visible defect
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {form.damageMap.length > 0
                      ? `${form.damageMap.length} area${form.damageMap.length > 1 ? "s" : ""} marked — the listing will show them.`
                      : "Nothing marked — the listing will state you found no visible damage."}
                  </span>
                </span>
              </button>
            </div>
          </Field>

          {/* Recon toggle — mode switch, stays visible */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <div>
              <p className="text-gray-900 font-semibold text-sm">
                Recon / Grey Import Vehicle
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Enable if this car was imported from overseas
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("isRecon", !form.isRecon)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${form.isRecon ? "bg-blue-600" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isRecon ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          {form.isRecon && (
            <div className="space-y-4">
              <Field
                label="Auction Grade"
                hint={`Suggested: ${suggestedGrade}`}
              >
                <PickerField
                  label="Auction Grade"
                  value={form.auctionGrade}
                  onChange={(v) => set("auctionGrade", v)}
                  options={["S", "5", "4.5", "4", "3.5", "3", "R", "RA", "2", "1"].map((g) => ({
                    value: g,
                    label: g === suggestedGrade ? `${g}  ★ suggested` : g,
                  }))}
                  placeholder="Select grade"
                />
                {!form.auctionGrade && (
                  <button
                    type="button"
                    onClick={() => set("auctionGrade", suggestedGrade)}
                    className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Use suggested: {suggestedGrade}
                  </button>
                )}
              </Field>
              <Field label="Interior Grade">
                <PickerField
                  label="Interior Grade"
                  value={form.interiorGrade}
                  onChange={(v) => set("interiorGrade", v)}
                  options={["A", "B", "C", "D"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Import Country">
                <PickerField
                  label="Import Country"
                  value={form.importCountry}
                  onChange={(v) => set("importCountry", v)}
                  options={["Japan", "UK", "Australia", "Other"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Auction House" hint="e.g. USS, TAA, JAA">
                <input
                  name="auctionHouse"
                  value={form.auctionHouse}
                  onChange={handleChange}
                  placeholder="e.g. USS Tokyo"
                  className={inputCls}
                />
              </Field>
              <Field
                label="Local Reg Date"
                hint="When first registered in MY"
              >
                <input
                  type="date"
                  name="localRegDate"
                  value={form.localRegDate}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Field>
              <Field label="Chassis Status">
                <PickerField
                  label="Chassis Status"
                  value={form.chassisStatus}
                  onChange={(v) => set("chassisStatus", v)}
                  options={[
                    { value: "clean", label: "Clean" },
                    { value: "repaired", label: "Repaired" },
                    { value: "written_off", label: "Written Off" },
                  ]}
                  placeholder="Select"
                />
              </Field>
            </div>
          )}

          {/* Advanced specs — enthusiast-facing, collapsed by default. A
              salesman's VIN decode fills bhp/cylinders/doors/seats for them. */}
          <MoreDetails collapsible label="Advanced specs (optional)">
            <Field label="Power (bhp)">
              <div className="relative">
                <input
                  type="number"
                  name="horsepower"
                  value={form.horsepower}
                  onChange={handleChange}
                  placeholder="e.g. 130"
                  min="0"
                  className={`${inputCls} pr-14`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">bhp</span>
              </div>
            </Field>
            <Field label="Cylinders">
              <input
                type="number"
                name="cylinders"
                value={form.cylinders}
                onChange={handleChange}
                placeholder="e.g. 4"
                min="1"
                max="16"
                className={inputCls}
              />
            </Field>
            <Field label="Fuel Economy">
              <div className="relative">
                <input
                  type="number"
                  name="fuelEconomyKpl"
                  value={form.fuelEconomyKpl}
                  onChange={handleChange}
                  placeholder="e.g. 15"
                  min="1"
                  step="0.1"
                  className={`${inputCls} pr-14`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium pointer-events-none">km/L</span>
              </div>
            </Field>
            <Field label="Doors">
              <input
                type="number"
                name="doors"
                value={form.doors}
                onChange={handleChange}
                placeholder="e.g. 4"
                min="2"
                max="6"
                className={inputCls}
              />
            </Field>
            <Field label="Seats">
              <input
                type="number"
                name="seats"
                value={form.seats}
                onChange={handleChange}
                placeholder="e.g. 5"
                min="1"
                max="9"
                className={inputCls}
              />
            </Field>
          </MoreDetails>

          {/* Pills — below everything */}
          {!intakeDone && (
          <>
          <Field label="Body Type" required>
            <PillSelect
              options={BODY_TYPES}
              value={form.bodyType}
              onChange={(v) => set("bodyType", v)}
            />
          </Field>
          <Field label="Fuel Type" required>
            <PillSelect
              options={FUEL_TYPES}
              value={form.fuelType}
              onChange={(v) => set("fuelType", v)}
            />
          </Field>
          <Field label="Transmission">
            <PillSelect
              options={["Auto", "Manual"]}
              value={form.transmission}
              onChange={(v) => set("transmission", v)}
            />
          </Field>
          </>
          )}
        </div>
      );
      case 4: return (
        <div className="space-y-5">
          <Field label="State" required>
            <PickerField
              label="Select State"
              value={form.state}
              onChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}
              options={Object.keys(STATE_CITIES)}
              placeholder="Select state"
            />
          </Field>
          <Field label="City" required>
            <PickerField
              label="Select City"
              value={form.city}
              onChange={(v) => set("city", v)}
              options={cityOptions}
              placeholder={form.state ? "Select city" : "Select state first"}
              disabled={!form.state}
              allowCustom
            />
          </Field>
        </div>
      );
      case 5: return (
        <div className="space-y-5">
          {intakeDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <Check size={12} />
              Asking RM {Number(form.sellingPrice || 0).toLocaleString()} — pricing carried over from Core Details
            </div>
          )}
          <Field label="Payment Type" required>
            <PillSelect
              options={["Cash", "Loan", "Sambung Bayar"]}
              value={
                form.payment_type === "sambung_bayar"
                  ? "Sambung Bayar"
                  : form.payment_type
                    ? form.payment_type.charAt(0).toUpperCase() + form.payment_type.slice(1)
                    : "Cash"
              }
              onChange={(v) =>
                set("payment_type", v === "Sambung Bayar" ? "sambung_bayar" : v.toLowerCase())
              }
            />
          </Field>

          {/* Sambung bayar (loan takeover) — buyers decide on monthly + upfront cash +
              months left, not a full price, so capture those directly. */}
          {form.payment_type === "sambung_bayar" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
              <p className="text-xs font-semibold text-amber-700">Sambung Bayar details — what buyers see first</p>
              <div className="space-y-4">
                <Field label="Monthly (Ansuran)" required hint="Buyer's monthly payment">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">RM</span>
                    <input type="number" name="sambungMonthly" value={form.sambungMonthly} onChange={handleChange} placeholder="0" min="0" inputMode="numeric" className={`${inputCls} pl-12`} />
                  </div>
                </Field>
                <Field label="Deposit / Duit Nampak" required hint="Upfront cash to take over">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">RM</span>
                    <input type="number" name="sambungDeposit" value={form.sambungDeposit} onChange={handleChange} placeholder="0" min="0" inputMode="numeric" className={`${inputCls} pl-12`} />
                  </div>
                </Field>
                <Field label="Months Left (Baki Tempoh)" hint="Remaining tenure">
                  <input type="number" name="sambungMonthsLeft" value={form.sambungMonthsLeft} onChange={handleChange} placeholder="e.g. 36" min="0" max="120" inputMode="numeric" className={inputCls} />
                </Field>
                <Field label="Balance (Baki Pinjaman)" hint="Outstanding loan — optional">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">RM</span>
                    <input type="number" name="sambungBalance" value={form.sambungBalance} onChange={handleChange} placeholder="0" min="0" inputMode="numeric" className={`${inputCls} pl-12`} />
                  </div>
                </Field>
              </div>
              <Field label="Bank" hint="Which bank holds the loan">
                <input name="sambungBank" value={form.sambungBank} onChange={handleChange} placeholder="e.g. Maybank, Public Bank" className={inputCls} />
              </Field>
            </div>
          )}

          {!intakeDone && (
          <>
          <Field
            label="Base Price (RM)"
            required
            hint="Your cost / purchase price"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                name="basePrice"
                value={form.basePrice}
                onChange={handleChange}
                placeholder="0"
                min="0"
                enterKeyHint="next"
                inputMode="numeric"
                className={`${inputCls} pl-12`}
              />
            </div>
          </Field>
          <Field
            label="Selling Price (RM)"
            required
            hint="What you're selling it for"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                name="sellingPrice"
                value={form.sellingPrice}
                onChange={handleChange}
                placeholder="0"
                min="0"
                enterKeyHint="next"
                inputMode="numeric"
                className={`${inputCls} pl-12`}
              />
            </div>
          </Field>
          {/* The manual "Original Price" input was removed here. A seller typing
              their own crossed-out "was" price is an anchor they invent, not a
              price the car was ever listed at — a misleading price indication
              under the Trade Descriptions Act 2011, and it made the Hot Deals
              feed meaningless. original_price is still recorded, but only by
              PriceEditModal (DashboardPage.jsx:2654) when a dealer actually
              drops a live listing's price, so a crossed-out price on a card is
              now always a real one. */}
          {form.basePrice && form.sellingPrice && (
            <div
              className={`px-4 py-3 rounded-xl text-sm font-medium border ${parseFloat(form.sellingPrice) >= parseFloat(form.basePrice) ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}
            >
              {parseFloat(form.sellingPrice) >= parseFloat(form.basePrice)
                ? `Profit margin: +RM ${(parseFloat(form.sellingPrice) - parseFloat(form.basePrice)).toLocaleString()} above your cost`
                : `⚠ Selling price is RM ${(parseFloat(form.basePrice) - parseFloat(form.sellingPrice)).toLocaleString()} below your cost (base price) — you'd sell this at a loss`}
            </div>
          )}
          <Field
            label="Salesman Commission (RM)"
            hint="Flat payout to salesman who closes this deal"
          >
            {(() => {
              const base = parseFloat(form.basePrice);
              const sell = parseFloat(form.sellingPrice);
              const margin = !isNaN(base) && !isNaN(sell) && sell > base ? sell - base : null;
              // SET-4: derive from the dealer's commission rule (default 10% of margin)
              const cfg = commissionConfig || { type: 'percent_gross', value: 10 };
              let suggested = null;
              let suggestNote = '';
              if (cfg.type === 'flat' && cfg.value > 0) {
                suggested = Math.round(cfg.value);
                suggestNote = `flat rate`;
              } else if (cfg.type === 'percent_sale' && !isNaN(sell) && cfg.value > 0) {
                suggested = Math.round(sell * cfg.value / 100 / 50) * 50;
                suggestNote = `${cfg.value}% of sale price`;
              } else if (margin && cfg.value > 0) {
                suggested = Math.round(margin * cfg.value / 100 / 50) * 50;
                suggestNote = `${cfg.value}% of margin`;
              }
              return (
                <>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                      RM
                    </span>
                    <input
                      type="number"
                      name="commissionAmount"
                      value={form.commissionAmount}
                      onChange={handleChange}
                      placeholder="0"
                      min="0"
                      enterKeyHint="next"
                      inputMode="numeric"
                      className={`${inputCls} pl-12`}
                    />
                  </div>
                  {suggested && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      Suggested: RM {suggested.toLocaleString()} ({suggestNote})
                      {!form.commissionAmount && (
                        <button
                          type="button"
                          onClick={() => set("commissionAmount", String(suggested))}
                          className="ml-2 text-red-400 underline underline-offset-2"
                        >
                          Apply
                        </button>
                      )}
                    </p>
                  )}
                </>
              );
            })()}
          </Field>
          <Field
            label="Warranty (months)"
            hint="Warranty offered with this car — shown to buyers"
          >
            <input
              type="number"
              name="warranty_months"
              value={form.warranty_months}
              onChange={handleChange}
              placeholder="e.g. 6"
              min="0"
              max="120"
              enterKeyHint="next"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          </>
          )}
          <MoreDetails>
            <Field
              label="Deposit to Reserve (RM)"
              hint="Amount needed to hold this unit"
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                  RM
                </span>
                <input
                  type="number"
                  name="deposit_amount"
                  value={form.deposit_amount}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className={`${inputCls} pl-12`}
                />
              </div>
            </Field>
          </MoreDetails>

          {/* ── Included Services & Add-ons ── */}
          {!intakeDone && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header toggle */}
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-900">
                  Included Services &amp; Add-ons
                </span>
                {form.included_services.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-semibold">
                    {form.included_services.length}
                  </span>
                )}
              </div>
              {servicesOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {servicesOpen && (
              <div className="px-4 pb-4 pt-3 space-y-3 bg-white">
                {/* Attached list */}
                {form.included_services.length > 0 && (
                  <div className="space-y-2">
                    {form.included_services.map((svc, idx) => {
                      const cfg = getCategoryCfg(svc.category);
                      const CatIcon = cfg.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200"
                        >
                          <CatIcon
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: cfg.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {svc.name}
                            </p>
                            <p className="text-xs text-gray-500">{cfg.label}</p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                            RM {Number(svc.selling_price || 0).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeService(idx)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {/* Cost summary */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/15">
                      <span className="text-xs text-gray-400 font-medium">
                        Total value included
                      </span>
                      <span className="text-sm font-semibold text-blue-400">
                        RM{" "}
                        {form.included_services
                          .reduce((s, x) => s + Number(x.selling_price || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Add Service toggle */}
                {!pickerOpen ? (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 text-sm transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                    Add a service from catalogue
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {/* Search bar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
                      <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search catalogue…"
                        className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpen(false);
                          setServiceSearch("");
                        }}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Catalogue list */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                      {serviceCatalogue.length === 0 && (
                        <p className="text-center text-gray-600 text-sm py-6">
                          {catalogueLoaded
                            ? "No products in catalogue yet"
                            : "Loading…"}
                        </p>
                      )}
                      {serviceCatalogue
                        .filter(
                          (p) =>
                            !serviceSearch ||
                            p.name
                              .toLowerCase()
                              .includes(serviceSearch.toLowerCase()) ||
                            p.category
                              .toLowerCase()
                              .includes(serviceSearch.toLowerCase()),
                        )
                        .filter((p) => p.is_active !== false)
                        // Dealers that outsource road tax & insurance don't bundle
                        // them as included services — hide those categories.
                        .filter((p) => handlesRti || (p.category !== "road_tax" && p.category !== "insurance"))
                        .map((p) => {
                          const cfg = getCategoryCfg(p.category);
                          const CatIcon = cfg.icon;
                          const alreadyAdded = form.included_services.some(
                            (s) => (s.product_id || s.id) === p.id,
                          );
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addService(p)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}
                            >
                              <CatIcon
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: cfg.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {p.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {cfg.label}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                RM{" "}
                                {Number(p.selling_price || 0).toLocaleString()}
                              </span>
                              {alreadyAdded && (
                                <span className="text-xs text-gray-500">
                                  Added
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      );
      case 6: {
        const selFeatures = parseTags(form.features);
        const isSel = (f) => selFeatures.some((t) => t.toLowerCase() === f.toLowerCase());
        const toggleFeature = (f) => {
          const tags = parseTags(form.features);
          const i = tags.findIndex((t) => t.toLowerCase() === f.toLowerCase());
          if (i >= 0) tags.splice(i, 1);
          else tags.push(f);
          set("features", tags.join(", "));
        };
        return (
          <div className="space-y-5">
            <Field
              label="About this car"
              hint={'Condition, history, why it stands out — shown as the "About this car" section on the listing.'}
            >
              <SmartTextarea
                value={form.specs}
                onValueChange={(v) => set("specs", v)}
                placeholder={"e.g.\nFull service record\nOne owner, accident-free\nInterior 9/10, tyres 80%"}
                rows={7}
              />
            </Field>
            <Field
              label="Features & options"
              hint="What buyers search for on Google — tap to add, or type your own. The more you list, the more searches this car shows up in."
            >
              {/* Chips: max 4 rows tall, flowing into columns that scroll/drag
                  horizontally so the free-text box below stays reachable (mobile-first). */}
              <div className="overflow-x-auto pb-2 mb-2.5" style={{ WebkitOverflowScrolling: "touch" }}>
                <div
                  className="grid grid-flow-col justify-items-start gap-2"
                  style={{ gridTemplateRows: "repeat(4, auto)", gridAutoColumns: "max-content" }}
                >
                  {COMMON_FEATURES.map((f) => {
                    const on = isSel(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFeature(f)}
                        className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          on
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {on && <Check className="w-3.5 h-3.5" />}
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
              <textarea
                name="features"
                value={form.features}
                onChange={handleChange}
                placeholder="Anything else — e.g. bucket seats, carbon pack, tinted windows. Separate with commas."
                className={textareaCls}
                rows={2}
              />
            </Field>

            {/* ── Car Documents ─────────────────────────────────────────────
                Named slots for the four documents a buyer can open and check
                for themselves, plus a free-form list for everything else. The
                geran is required to publish: attach it, or pick the reason you
                can't — and that reason is shown to buyers on the listing. */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-900">Car Documents</span>
                  <span
                    className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      trustTier.level === 3
                        ? "bg-emerald-100 text-emerald-700"
                        : trustTier.level === 0
                          ? "bg-gray-200 text-gray-600"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {trustTier.label}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5" aria-hidden="true">
                  {TRUST_DOCS.map((t) => (
                    <div
                      key={t.key}
                      className={`h-1 flex-1 rounded-full ${docInSlot(t.key) ? "bg-emerald-500" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {trustTier.nextMissing
                    ? `${trustTier.count} of ${trustTier.total} attached — add ${trustTier.nextMissing.short.toLowerCase()} next.`
                    : "All four attached. Buyers can open every one of them on the listing."}
                </p>
              </div>

              <div className="bg-white divide-y divide-gray-100">
                {TRUST_DOCS.map((t) => {
                  const idx = (form.car_documents || []).findIndex((d) => d.type === t.key);
                  const doc = idx >= 0 ? form.car_documents[idx] : null;
                  const isGeran = t.key === "registration_card";
                  const declared = isGeran && !doc && !!form.geranReason;
                  return (
                    <div key={t.key} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            doc
                              ? "bg-emerald-100 text-emerald-600"
                              : declared
                                ? "bg-amber-100 text-amber-600"
                                : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {doc ? (
                            <Check className="w-3 h-3" strokeWidth={3} />
                          ) : declared ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {t.label}
                            {t.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          {doc ? (
                            <div className="flex items-center gap-3 mt-1 min-w-0">
                              <span className="text-xs text-gray-600 truncate min-w-0">{doc.name}</span>
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
                              >
                                View
                              </a>
                              <button
                                type="button"
                                onClick={() => removeDocument(idx)}
                                className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 mt-0.5">{t.hint}</p>
                          )}
                        </div>
                        <label
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
                            uploadingSlot === t.key
                              ? "bg-gray-200 text-gray-400 cursor-wait"
                              : doc
                                ? "border border-gray-200 text-gray-700 hover:border-gray-300 cursor-pointer"
                                : "bg-gray-900 hover:bg-gray-800 text-white cursor-pointer"
                          }`}
                        >
                          {uploadingSlot === t.key ? (
                            <>
                              <div className="w-3 h-3 border-2 border-gray-400/40 border-t-gray-500 rounded-full animate-spin" />
                              Uploading
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" /> {doc ? "Replace" : "Upload"}
                            </>
                          )}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => handleDocumentFile(e, t.key)}
                            disabled={!!uploadingSlot}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {isGeran && !doc && (
                        <div className="mt-3 sm:ml-8 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                          <p className="text-xs font-medium text-gray-700">
                            Can&apos;t attach it? Pick the reason — buyers see this on the listing.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {GERAN_REASONS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() =>
                                  set("geranReason", form.geranReason === r.value ? "" : r.value)
                                }
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors ${
                                  form.geranReason === r.value
                                    ? "border-amber-400 bg-amber-50 text-amber-800"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Everything else — insurance, warranty, AP permits, plus any
                  extra copies of the four named documents above. */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-700">Other documents</p>
                {otherDocuments.length > 0 && (
                  <div className="space-y-2">
                    {otherDocuments.map(({ doc, idx }) => {
                      const dt =
                        DOC_TYPES.find((d) => d.key === doc.type) ||
                        DOC_TYPES[DOC_TYPES.length - 1];
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-xl"
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500">{dt.label}</p>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            onClick={() => removeDocument(idx)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <PickerField
                      label="Document Type"
                      value={docTypeInput}
                      onChange={(v) => setDocTypeInput(v)}
                      options={OTHER_DOC_TYPES.map((d) => ({
                        value: d.key,
                        label: d.label,
                        color: d.color,
                      }))}
                      placeholder="Select type"
                    />
                  </div>
                  <label
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${
                      docUploading
                        ? "bg-gray-200 text-gray-400 cursor-wait"
                        : "border border-gray-300 bg-white text-gray-800 hover:border-gray-400 cursor-pointer"
                    }`}
                  >
                    {docUploading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-gray-400/40 border-t-gray-500 rounded-full animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleDocumentFile}
                      disabled={docUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  PDF, JPG or PNG. Buyers can open every document you attach. Our team
                  reviews them before the Verified badge appears on the listing.
                </p>
              </div>
            </div>
          </div>
        );
      }
      case 7: {
        const rm = (v) => (v !== "" && v != null && !isNaN(Number(v)) && Number(v) > 0 ? `RM ${Number(v).toLocaleString()}` : null);
        const svcTotal = form.included_services.reduce((s, x) => s + Number(x.selling_price || 0), 0);
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Last check — confirm everything below, then hit {listing ? "Save Changes" : "Publish Listing"}. Tap Edit to fix a section.
            </p>
            <ReviewSection title={`Photos · ${previews.length}`} onEdit={() => setStep(1)}>
              {previews.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {previews.slice(0, 8).map((src, i) => (
                    <img key={src + i} src={src} alt={`photo ${i + 1}`} className="w-16 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                  ))}
                  {previews.length > 8 && (
                    <div className="w-16 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                      +{previews.length - 8}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-500">No photos yet — at least 1 required</p>
              )}
              {(form.video_url || form.car_documents.length > 0) && (
                <p className="text-xs text-gray-500 mt-2">
                  {[
                    form.video_url && "Walkthrough video attached",
                    form.car_documents.length > 0 && `${form.car_documents.length} document${form.car_documents.length > 1 ? "s" : ""}`,
                  ].filter(Boolean).join(" · ")}
                </p>
              )}
            </ReviewSection>
            <ReviewSection title="Car" onEdit={() => setStep(2)}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <ReviewItem label="Vehicle" value={[form.year, form.brand, form.model, form.variant].filter(Boolean).join(" ")} />
                <ReviewItem label="Condition" value={{ used: "Used", recon: "Recon", new: "New" }[form.condition] || form.condition} />
                <ReviewItem label="Mileage" value={form.mileage ? `${Number(form.mileage).toLocaleString()} km` : null} />
                <ReviewItem label="Colour" value={form.colour} />
                <ReviewItem label="Plate" value={form.plate_number} />
                <ReviewItem label="VIN" value={form.vin_number} />
                <ReviewItem label="Registered" value={form.registrationDate} />
                <ReviewItem label="Previous owners" value={form.previous_owners} />
                <ReviewItem label="Road tax expiry" value={form.road_tax_expiry} />
                <ReviewItem label="Loan eligible" value={form.loan_eligible ? "Yes" : "No"} />
              </div>
            </ReviewSection>
            <ReviewSection title="Technical" onEdit={() => setStep(3)}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <ReviewItem label="Body type" value={form.bodyType} />
                <ReviewItem label="Fuel" value={form.fuelType} />
                <ReviewItem label="Transmission" value={form.transmission} />
                <ReviewItem label="Engine" value={form.engineCc ? `${form.engineCc}cc` : null} />
                <ReviewItem label="Power" value={form.horsepower ? `${form.horsepower} bhp` : null} />
                <ReviewItem label="Doors / Seats" value={[form.doors, form.seats].filter(Boolean).join(" / ") || null} />
                {form.isRecon && (
                  <ReviewItem label="Recon" value={[form.auctionGrade && `Grade ${form.auctionGrade}`, form.importCountry].filter(Boolean).join(" · ") || "Yes"} />
                )}
              </div>
            </ReviewSection>
            <ReviewSection title="Location" onEdit={() => setStep(4)}>
              {form.state || form.city ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <ReviewItem label="State" value={form.state} />
                  <ReviewItem label="City" value={form.city} />
                </div>
              ) : (
                <p className="text-sm text-red-500">Not set — state & city are required</p>
              )}
            </ReviewSection>
            <ReviewSection title="Pricing" onEdit={() => setStep(5)}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <ReviewItem label="Payment" value={form.payment_type === "sambung_bayar" ? "Sambung Bayar" : (form.payment_type || "cash").charAt(0).toUpperCase() + (form.payment_type || "cash").slice(1)} />
                {form.payment_type === "sambung_bayar" ? (
                  <>
                    <ReviewItem label="Monthly (ansuran)" value={rm(form.sambungMonthly)} />
                    <ReviewItem label="Deposit / duit nampak" value={rm(form.sambungDeposit)} />
                    <ReviewItem label="Months left" value={form.sambungMonthsLeft ? `${form.sambungMonthsLeft} months` : null} />
                    <ReviewItem label="Balance" value={rm(form.sambungBalance)} />
                    <ReviewItem label="Bank" value={form.sambungBank} />
                  </>
                ) : (
                  <>
                    <ReviewItem label="Selling price" value={rm(form.sellingPrice)} />
                    <ReviewItem label="Base / cost" value={rm(form.basePrice)} />
                    <ReviewItem label="Commission" value={rm(form.commissionAmount)} />
                    <ReviewItem label="Deposit to reserve" value={rm(form.deposit_amount)} />
                    <ReviewItem label="Warranty" value={form.warranty_months && Number(form.warranty_months) > 0 ? `${form.warranty_months} months` : null} />
                  </>
                )}
                <ReviewItem label="Included services" value={form.included_services.length ? `${form.included_services.length} · RM ${svcTotal.toLocaleString()}` : null} />
              </div>
            </ReviewSection>
            {(form.specs || form.options || form.features) && (
              <ReviewSection title="Description" onEdit={() => setStep(6)}>
                <div className="space-y-2.5">
                  <ReviewItem label="About" value={form.specs} />
                  <ReviewItem label="Options" value={form.options} />
                  <ReviewItem label="Features" value={form.features} />
                </div>
              </ReviewSection>
            )}
          </div>
        );
      }
      default: return null;
    }
  }

  return (
    <div
      ref={formRef}
      onKeyDown={handleKeyDown}
      className="w-full"
      style={{
        fontFamily: "system-ui, sans-serif",
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Draft resume banner */}
      {draftBanner && !listing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", borderRadius: 9, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", fontFamily: "system-ui,sans-serif" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#93c5fd", flex: 1 }}>You have a saved draft from a previous session.</p>
          <button onClick={() => {
            const d = cfLoadDraft(profile?.id);
            if (d) {
              // Drafts saved before the location prefill existed have no state
              // or city — resuming one should not undo the prefill.
              const loc = matchKnownLocation(
                profile?.state || dealerLocation?.state,
                profile?.city || dealerLocation?.city,
              );
              setForm(d.form?.state || d.form?.city ? d.form : { ...d.form, ...loc });
              setStep(d.step || 1);
              // Re-hydrate image previews from saved URLs so the photo step isn't empty
              if (Array.isArray(d.form?.images) && d.form.images.length > 0) {
                setPreviews(d.form.images);
              }
            }
            setDraftBanner(false);
          }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#2563eb", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Resume</button>
          <button onClick={() => { cfClearDraft(profile?.id); setDraftBanner(false); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Discard</button>
        </div>
      )}
      {/* Draft auto-save indicator */}
      {!draftBanner && !listing && draftSavedAt && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontFamily: "system-ui,sans-serif" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#6b7280" }}>Draft saved</span>
        </div>
      )}

      {/* Step progress indicator — compact circle strip, optional Back button left */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 20 }}>
        {onBack && (
          <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginBottom: 11 }}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", overflowX: "auto", minWidth: 0 }}>
          {STEPS.map((s, i) => {
            const complete = isSectionComplete(s.id);
            const isCurrent = step === s.id;
            const isLast = i === STEPS.length - 1;
            return (
              <React.Fragment key={s.id}>
                <button type="button" onClick={() => setStep(s.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: isCurrent ? "#dc2626" : complete ? "#dc2626" : "#fff",
                    border: `2px solid ${isCurrent || complete ? "#dc2626" : "#d1d5db"}`,
                    boxShadow: isCurrent ? "0 0 0 3px rgba(220,38,38,0.15)" : "none",
                  }}>
                    {complete && !isCurrent ? <Check className="w-3 h-3" style={{ color: "#fff" }} /> : <span style={{ fontSize: 9, fontWeight: 800, color: isCurrent ? "#fff" : "#9ca3af" }}>{s.id}</span>}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, whiteSpace: "nowrap", color: isCurrent ? "#dc2626" : complete ? "#374151" : "#9ca3af" }}>{s.label}</span>
                </button>
                {!isLast && <div style={{ flex: 1, height: 2, background: complete ? "#dc2626" : "#e5e7eb", margin: "0 3px 11px", minWidth: 6 }} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current step only */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-6 py-5">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
          {(() => {
            const sec = STEPS.find((s) => s.id === step);
            const Icon = sec?.icon;
            return (
              <>
                {Icon && <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0"><Icon className="w-4.5 h-4.5 text-red-600" /></div>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Step {step} of {STEPS.length} · {sec?.label}</p>
                  <p className="text-xs text-gray-500">{sec?.desc}</p>
                </div>
                {listing && (
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {/* Copy summary lives on Details (while writing the About copy) and Review */}
                    {step >= STEPS.length - 1 && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${copied ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"}`}
                      >
                        {copied ? <><ClipboardCheck className="w-3.5 h-3.5" />Copied</> : <><Clipboard className="w-3.5 h-3.5" />Copy</>}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={uploading}
                      title="Save changes (any step)"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {uploading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Check className="w-3.5 h-3.5" />Save</>}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {renderSectionContent(step)}
      </div>

      {/* Listing cap warning */}
      {capError && step === STEPS.length && (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
          <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Listing cap reached</p>
          <p style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>
            Your current plan allows a limited number of active listings. Remove a listing or upgrade your plan to add more.
          </p>
          <a href="mailto:support@xdrive.my?subject=Upgrade Plan" style={{ display: 'inline-block', marginTop: 10, padding: '7px 14px', background: '#dc2626', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Upgrade Plan
          </a>
        </div>
      )}

      {/* Wizard navigation */}
      <div className="mt-5 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all hover:border-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />Back
          </button>
        )}

        {step < STEPS.length ? (
          <button
            type="button"
            onClick={goNext}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all"
          >
            Continue<ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={uploading || capError || !(form.images.length > 0 && form.brand && form.model && form.year && form.state && form.city && (form.payment_type === "sambung_bayar" ? (Number(form.sambungMonthly) > 0 && Number(form.sambungDeposit) > 0) : (form.basePrice && form.sellingPrice)))}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading…</>
            ) : (
              <><Check className="w-4 h-4" />{listing ? "Save Changes" : "Publish Listing"}</>
            )}
          </button>
        )}
      </div>

      {gapConfirm && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setGapConfirm(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Make sure your listing is well informed to post</p>
                <p className="text-xs text-gray-500 mt-1">Buyers won't see this listing's {gapConfirm.join(", ")}. Complete listings sell faster and build more trust.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setGapConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Go Back &amp; Fix
              </button>
              <button
                type="button"
                onClick={() => { setGapConfirm(null); handleSubmit(true); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Post Anyway
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );

}

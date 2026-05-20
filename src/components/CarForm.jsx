import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DamageMap from "./DamageMap";
import { getCategoryCfg } from "../utils/serviceCategories";
import { getEmbedUrl } from "../utils/videoEmbed";
import { useProfile, getDealerIdFromProfile } from "../hooks/useProfile";

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
  mileage: "",
  colour: "",
  registrationDate: "",
  plate_number: "",
  vin_number: "",
  state: "",
  city: "",
  basePrice: "",
  sellingPrice: "",
  originalPrice: "",
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
  // Services
  included_services: [],
  baseReconCost: 0, // recon_cost excluding services (computed at pre-fill)
  // Video
  video_url: "",
  // Documents
  car_documents: [],
  // Extra fields
  previous_owners: "",
  road_tax_expiry: "",
  loan_eligible: true,
  warranty_months: "",
  deposit_amount: "",
  payment_type: "cash",
};

export const CAR_DATA = {
  Perodua: [
    "Myvi",
    "Axia",
    "Bezza",
    "Ativa",
    "Alza",
    "Kancil",
    "Kelisa",
    "Kenari",
    "Viva",
    "Nautica",
  ],
  Proton: [
    "Saga",
    "Persona",
    "Iriz",
    "X50",
    "X70",
    "X90",
    "Exora",
    "Preve",
    "Suprima S",
    "Wira",
    "Waja",
    "Gen-2",
    "Satria Neo",
    "Arena",
    "Juara",
  ],
  Honda: [
    "City",
    "Civic",
    "Accord",
    "Jazz",
    "HR-V",
    "CR-V",
    "BR-V",
    "Odyssey",
    "Freed",
    "Stream",
    "Mobilio",
    "WR-V",
    "ZR-V",
    "Pilot",
    "Fit",
    "Insight",
    "Legend",
    "CR-Z",
    "S2000",
    "NSX",
    "Stepwgn",
  ],
  Toyota: [
    "Vios",
    "Yaris",
    "Corolla",
    "Camry",
    "Prius",
    "C-HR",
    "RAV4",
    "Fortuner",
    "Hilux",
    "Innova",
    "Rush",
    "Veloz",
    "Avanza",
    "Sienta",
    "Alphard",
    "Vellfire",
    "Land Cruiser",
    "Prado",
    "Harrier",
    "Estima",
    "86",
    "GR86",
    "Supra",
  ],
  Nissan: [
    "Almera",
    "Serena",
    "X-Trail",
    "Navara",
    "Patrol",
    "Murano",
    "Qashqai",
    "Juke",
    "Note",
    "March",
    "Sylphy",
    "Teana",
    "Leaf",
    "GT-R",
    "370Z",
    "350Z",
    "Kicks",
    "Terra",
  ],
  Mazda: [
    "Mazda 2",
    "Mazda 3",
    "Mazda 6",
    "CX-3",
    "CX-30",
    "CX-5",
    "CX-8",
    "CX-9",
    "CX-60",
    "MX-5",
    "RX-7",
    "RX-8",
    "BT-50",
  ],
  Mitsubishi: [
    "Attrage",
    "Lancer",
    "Galant",
    "Eclipse Cross",
    "ASX",
    "Outlander",
    "Pajero",
    "Triton",
    "Xpander",
    "Mirage",
    "Evo",
  ],
  Suzuki: [
    "Swift",
    "Ciaz",
    "Baleno",
    "Vitara",
    "SX4",
    "Jimny",
    "Ertiga",
    "XL7",
    "Celerio",
    "Alto",
  ],
  Subaru: [
    "Impreza",
    "Legacy",
    "Outback",
    "Forester",
    "XV",
    "Crosstrek",
    "WRX",
    "STI",
    "BRZ",
    "Levorg",
  ],
  Hyundai: [
    "Elantra",
    "Sonata",
    "Tucson",
    "Santa Fe",
    "Kona",
    "Venue",
    "Palisade",
    "Creta",
    "i10",
    "i20",
    "i30",
    "Ioniq 5",
    "Ioniq 6",
    "Veloster",
    "Staria",
  ],
  Kia: [
    "Picanto",
    "Rio",
    "Cerato",
    "K5",
    "Stinger",
    "Sportage",
    "Sorento",
    "Telluride",
    "Seltos",
    "Niro",
    "EV6",
    "Carnival",
    "Soul",
  ],
  BMW: [
    "1 Series",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "7 Series",
    "8 Series",
    "X1",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "iX",
    "i4",
    "i5",
    "Z4",
    "M2",
    "M3",
    "M4",
    "M5",
  ],
  Mercedes: [
    "A-Class",
    "C-Class",
    "E-Class",
    "S-Class",
    "CLA",
    "CLS",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GLS",
    "G-Class",
    "AMG GT",
    "SL",
    "V-Class",
  ],
  Volkswagen: [
    "Polo",
    "Golf",
    "Jetta",
    "Passat",
    "Arteon",
    "Tiguan",
    "Touareg",
    "T-Cross",
    "T-Roc",
    "ID.4",
    "Amarok",
  ],
  Audi: [
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "Q3",
    "Q5",
    "Q7",
    "Q8",
    "TT",
    "R8",
    "e-tron GT",
    "RS3",
    "RS4",
    "RS5",
    "RS6",
    "S3",
    "S4",
  ],
  Porsche: [
    "911",
    "Cayenne",
    "Macan",
    "Panamera",
    "Taycan",
    "Boxster",
    "Cayman",
  ],
  "Land Rover": [
    "Defender",
    "Discovery",
    "Discovery Sport",
    "Range Rover",
    "Range Rover Sport",
    "Range Rover Velar",
    "Range Rover Evoque",
  ],
  Lexus: ["IS", "ES", "GS", "LS", "UX", "NX", "RX", "GX", "LX", "RC", "LC"],
  Volvo: ["S60", "S90", "V60", "XC40", "XC60", "XC90", "C40", "EX30", "EX90"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  Ford: [
    "Mustang",
    "Explorer",
    "Ranger",
    "Everest",
    "F-150",
    "Bronco",
    "Focus",
    "Fiesta",
    "Puma",
  ],
  MG: ["MG3", "MG5", "MG6", "ZS", "HS"],
  BYD: ["Atto 3", "Dolphin", "Seal", "Han", "Tang", "Destroyer 05"],
  Ferrari: ["Roma", "Portofino", "SF90", "F8", "812", "Purosangue"],
  Lamborghini: ["Huracan", "Urus", "Revuelto"],
  Jaguar: ["XE", "XF", "XJ", "E-Pace", "F-Pace", "I-Pace", "F-Type"],
  Bentley: ["Continental GT", "Flying Spur", "Bentayga", "Mulsanne"],
  "Rolls Royce": ["Phantom", "Ghost", "Wraith", "Dawn", "Cullinan", "Spectre"],
  MINI: ["Cooper", "Clubman", "Countryman", "Convertible"],
  Chery: ["Omoda 5", "Tiggo 4", "Tiggo 7", "Tiggo 8"],
  Haval: ["H6", "Jolion", "H2", "H9"],
  Geely: ["Coolray", "Azkarra", "Okavango"],
};

const ALL_BRANDS = Object.keys(CAR_DATA).sort();

const STATE_CITIES = {
  "Kuala Lumpur": [
    "Kuala Lumpur City Centre",
    "Chow Kit",
    "Bangsar",
    "Mont Kiara",
    "Kepong",
    "Setapak",
    "Wangsa Maju",
    "Titiwangsa",
    "Brickfields",
    "Cheras",
    "Bukit Jalil",
    "Sri Petaling",
  ],
  Selangor: [
    "Shah Alam",
    "Petaling Jaya",
    "Subang Jaya",
    "Klang",
    "Ampang",
    "Puchong",
    "Sepang",
    "Rawang",
    "Kajang",
    "Cyberjaya",
    "Putrajaya",
    "Damansara",
    "Sungai Buloh",
  ],
  Penang: [
    "George Town",
    "Butterworth",
    "Bukit Mertajam",
    "Bayan Lepas",
    "Batu Ferringhi",
    "Gelugor",
    "Seberang Jaya",
    "Perai",
    "Sungai Jawi",
    "Nibong Tebal",
    "Kepala Batas",
    "Balik Pulau",
  ],
  Johor: [
    "Johor Bahru",
    "Iskandar Puteri",
    "Skudai",
    "Kulai",
    "Batu Pahat",
    "Muar",
    "Kluang",
    "Pasir Gudang",
    "Senai",
  ],
  Perak: [
    "Ipoh",
    "Taiping",
    "Teluk Intan",
    "Sitiawan",
    "Lumut",
    "Kampar",
    "Tanjung Malim",
    "Kuala Kangsar",
  ],
  Melaka: ["Melaka City", "Ayer Keroh", "Bukit Katil", "Alor Gajah", "Jasin"],
  "Negeri Sembilan": [
    "Seremban",
    "Port Dickson",
    "Nilai",
    "Rembau",
    "Tampin",
    "Senawang",
  ],
  Kedah: ["Alor Setar", "Sungai Petani", "Kulim", "Langkawi", "Baling"],
  Kelantan: ["Kota Bharu", "Pasir Mas", "Tanah Merah", "Machang", "Gua Musang"],
  Terengganu: ["Kuala Terengganu", "Kemaman", "Dungun", "Kerteh", "Marang"],
  Pahang: [
    "Kuantan",
    "Temerloh",
    "Bentong",
    "Raub",
    "Cameron Highlands",
    "Genting Highlands",
  ],
  Sabah: [
    "Kota Kinabalu",
    "Sandakan",
    "Tawau",
    "Lahad Datu",
    "Keningau",
    "Semporna",
    "Kota Belud",
  ],
  Sarawak: ["Kuching", "Miri", "Sibu", "Bintulu", "Limbang", "Kota Samarahan"],
};

const CONDITIONS = ["used", "recon", "new"];
const BODY_TYPES = ["Sedan", "SUV", "MPV", "Hatchback", "Coupe", "Pickup"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const CC_PRESETS = [660, 1000, 1300, 1500, 1600, 1800, 2000, 2500, 3000, 3500];

const STEPS = [
  { id: 1, label: "Photos",    icon: Camera,      desc: "Upload images first" },
  { id: 2, label: "Identity",  icon: Car,         desc: "Brand & model" },
  { id: 3, label: "Condition", icon: Check,       desc: "Mileage & colour" },
  { id: 4, label: "Specs",     icon: Gauge,       desc: "Type & engine" },
  { id: 5, label: "History",   icon: ShieldCheck, desc: "Recon & import" },
  { id: 6, label: "Location",  icon: MapPin,      desc: "State & city" },
  { id: 7, label: "Pricing",   icon: DollarSign,  desc: "Prices & discount" },
  { id: 8, label: "Details",   icon: FileText,    desc: "Specs, features & docs" },
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
      className="mb-2 rounded-xl border border-gray-800 bg-gray-900"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none rounded-t-xl overflow-hidden"
        onClick={onToggle}
      >
        <button
          type="button"
          className="text-gray-600 hover:text-gray-400 touch-none flex-shrink-0"
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
            <span className="text-sm font-semibold text-white">{section.label}</span>
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
        <div className="px-4 pb-5 pt-1 border-t border-gray-800/70">
          {children}
        </div>
      )}
    </div>
  );
}

const DOC_TYPES = [
  { key: "puspakom", label: "Puspakom Inspection", color: "#22c55e" },
  { key: "service_history", label: "Service History", color: "#60a5fa" },
  { key: "insurance", label: "Insurance Certificate", color: "#a78bfa" },
  { key: "ownership", label: "Ownership / VOC", color: "#fbbf24" },
  { key: "warranty", label: "Warranty Certificate", color: "#34d399" },
  { key: "import_ap", label: "Import / AP Permit", color: "#fb923c" },
  { key: "loan_clearance", label: "Loan Clearance Letter", color: "#94a3b8" },
  { key: "other", label: "Other Document", color: "#6b7280" },
];

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

  // Auto hashtags
  const brand = (l.brand || "").toLowerCase().replace(/\s+/g, "");
  const model = (l.model || "").toLowerCase().replace(/\s+/g, "");
  const state = (l.state || "").toLowerCase().replace(/\s+/g, "");
  const cond = (l.condition || "").toLowerCase();
  const tags = [
    "#keretamurah",
    "#keretamalaysia",
    `#${brand}`,
    `#${model}`,
    state ? `#kereta${state}` : "",
    `#${cond}`,
    "#keretabekas",
    "#jualbeli",
  ]
    .filter(Boolean)
    .join(" ");

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
    const featureList = l.features
      .split(/[\n,]+/)
      .map((f) => f.trim())
      .filter(Boolean);
    featureList.forEach((f) => lines.push(`   • ${f}`));
    lines.push("");
  }

  // Specs
  if (l.specs && l.specs.trim()) {
    lines.push(`🔩 SPECS`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    const specList = l.specs
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    specList.forEach((s) => lines.push(`   • ${s}`));
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
  lines.push(`Loan available ✅ Trade-in welcome ✅`);
  lines.push("");
  lines.push(tags);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  return lines.join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Combobox({ value, onChange, options, placeholder, disabled }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = query
    ? options
        .filter((o) => o.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20)
    : options.slice(0, 20);
  useEffect(() => {
    setQuery(value || "");
  }, [value]);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        enterKeyHint="next"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open && filtered.length > 0) {
            e.preventDefault();
            onChange(filtered[0]);
            setQuery(filtered[0]);
            setOpen(false);
            // bubble up so parent handleKeyDown advances to the next field
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      />
      {open && !disabled && (
        <ul className="absolute z-[200] w-full bg-gray-800 border border-gray-700 rounded-xl mt-1 max-h-48 overflow-y-auto shadow-2xl">
          {filtered.map((o) => (
            <li
              key={o}
              onMouseDown={() => {
                onChange(o);
                setQuery(o);
                setOpen(false);
              }}
              className="px-4 py-2.5 text-white hover:bg-blue-600/20 hover:text-blue-400 cursor-pointer text-sm transition-colors"
            >
              {o}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-2.5 text-gray-500 text-sm italic">
              No match — input saved as-is
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function PillSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${value === opt ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-white"}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors";
const selectCls =
  "w-full px-4 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-2xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-colors appearance-none cursor-pointer";
const textareaCls =
  "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none";

function VideoPreview({ url }) {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl)
    return (
      <p className="text-xs text-yellow-400 mt-1">
        ⚠ Could not parse video URL. Paste a YouTube, TikTok, or Instagram link.
      </p>
    );
  return (
    <div className="aspect-video w-full max-w-sm rounded-lg overflow-hidden border border-white/10 mt-2">
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
const cfSaveDraft = (uid, form, step) => { try { localStorage.setItem(cfDraftKey(uid), JSON.stringify({ form, step, savedAt: Date.now() })); } catch (_) {} };
const cfLoadDraft = (uid) => { try { const r = localStorage.getItem(cfDraftKey(uid)); if (!r) return null; const d = JSON.parse(r); if (Date.now() - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(cfDraftKey(uid)); return null; } return d; } catch (_) { return null; } };
const cfClearDraft = (uid) => { try { localStorage.removeItem(cfDraftKey(uid)); } catch (_) {} };

export default function CarForm({ onCreate, listing, onUpdate }) {
  const { profile } = useProfile();
  const dealerId = getDealerIdFromProfile(profile);

  const [form, setForm] = useState(initialListing);
  const [step, setStep] = useState(1);
  const [draftBanner, setDraftBanner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [copied, setCopied] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [imgProgress, setImgProgress] = useState([]);
  // entry shape: { name: string, status: 'uploading'|'done'|'error' }
  const DEFAULT_ORDER = STEPS.map((s) => s.id);
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_ORDER);
  const [collapsed, setCollapsed] = useState({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const photosInputRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const formRef = useRef(null);

  // ── Draft save (new listings only, not edits) ────────────────────────────
  useEffect(() => {
    if (!profile?.id || listing) return;
    const draft = cfLoadDraft(profile.id);
    if (draft) setDraftBanner(true);
  }, [profile?.id, listing]);

  useEffect(() => {
    if (!profile?.id || listing) return;
    const t = setTimeout(() => cfSaveDraft(profile.id, form, step), 800);
    return () => clearTimeout(t);
  }, [form, step, profile?.id, listing]);

  // Load saved section order from profile
  useEffect(() => {
    if (!profile) return;
    const saved = profile.form_layout;
    if (Array.isArray(saved) && saved.length === STEPS.length) {
      setSectionOrder(saved);
    }
  }, [profile?.id]);

  // ── Documents state ──────────────────────────────────────────────────────
  const [docTypeInput, setDocTypeInput] = useState("puspakom");
  const [docUploading, setDocUploading] = useState(false);

  const handleDocumentFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    try {
      const path = `docs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("car-images")
        .upload(path, file);
      if (error) throw error;
      const url = supabase.storage.from("car-images").getPublicUrl(path)
        .data.publicUrl;
      setForm((f) => ({
        ...f,
        car_documents: [
          ...(f.car_documents || []),
          { type: docTypeInput, name: file.name, url },
        ],
      }));
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setDocUploading(false);
    e.target.value = "";
  };

  const removeDocument = (i) => {
    setForm((f) => ({
      ...f,
      car_documents: (f.car_documents || []).filter((_, j) => j !== i),
    }));
  };

  // ── Included services state ──────────────────────────────────────────────
  const [servicesOpen, setServicesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serviceCatalogue, setServiceCatalogue] = useState([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    previewUrlsRef.current = previews;
  }, [previews]);
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
        condition: listing.condition || "used",
        engineCc: listing.engine_cc ? String(listing.engine_cc) : "",
        mileage: listing.mileage ? String(listing.mileage) : "",
        colour: listing.colour || "",
        registrationDate: listing.registration_date || "",
        plate_number: listing.plate_number || "",
        vin_number: listing.vin_number || "",
        state: listing.state || "",
        city: listing.city || "",
        basePrice: listing.base_price ? String(listing.base_price) : "",
        sellingPrice: listing.selling_price
          ? String(listing.selling_price)
          : "",
        originalPrice: listing.original_price
          ? String(listing.original_price)
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
        included_services: listing.included_services || [],
        // base recon = total recon minus previously-stored services cost
        baseReconCost: Math.max(
          0,
          (listing.recon_cost || 0) - (listing.included_services_cost || 0),
        ),
        video_url: listing.video_url || "",
        car_documents: listing.car_documents || [],
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
      });
      setPreviews(listing.images || []);
      setStep(1);
    }
  }, [listing]);

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
      cost: product.cost_price || 0,
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
  const cityOptions =
    form.state && STATE_CITIES[form.state] ? STATE_CITIES[form.state] : [];

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

  // Discount preview calculations
  const originalPriceVal = form.originalPrice
    ? parseFloat(form.originalPrice)
    : null;
  const sellingPriceVal = form.sellingPrice
    ? parseFloat(form.sellingPrice)
    : null;
  const hasDiscount =
    originalPriceVal && sellingPriceVal && originalPriceVal > sellingPriceVal;
  const discountAmt = hasDiscount ? originalPriceVal - sellingPriceVal : null;
  const discountPct = hasDiscount
    ? ((discountAmt / originalPriceVal) * 100).toFixed(1)
    : null;
  const isHotDeal = hasDiscount && parseFloat(discountPct) >= 3;

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
      original_price: form.originalPrice,
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
      alert("Maximum 30 images");
      e.target.value = "";
      return;
    }
    const accepted = files.slice(0, slots);
    if (accepted.length < files.length)
      alert(
        `Only ${slots} more image${slots === 1 ? "" : "s"} allowed (max 30).`,
      );
    set("images", [...form.images, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
    uploadImagesEager(accepted); // fire and forget
    e.target.value = "";
  };

  const createDraftIfNeeded = async (firstUrl) => {
    if (draftId) return;
    if (!dealerId) return;
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .insert({ dealer_id: dealerId, status: "draft", images: [firstUrl] })
        .select("id")
        .single();
      if (!error && data) setDraftId(data.id);
    } catch {}
  };

  const uploadImagesEager = async (files) => {
    const startIdx = imgProgress.length;
    setImgProgress((p) => [
      ...p,
      ...files.map((f) => ({ name: f.name, status: "uploading" })),
    ]);

    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("car-images")
          .upload(path, file);
        if (error) {
          setImgProgress((p) =>
            p.map((e, j) =>
              j === startIdx + i ? { ...e, status: "error" } : e,
            ),
          );
          throw error;
        }
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
          p.map((e, j) =>
            j === startIdx + i ? { ...e, status: "done" } : e,
          ),
        );
        return url;
      }),
    );

    const firstSuccess = results.find((r) => r.status === "fulfilled");
    if (firstSuccess) createDraftIfNeeded(firstSuccess.value);
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

  // Auto-focus first input whenever step changes
  useEffect(() => {
    const t = setTimeout(() => {
      const el = formRef.current?.querySelector(
        'input:not([type="file"]):not([type="hidden"]):not([disabled]), select:not([disabled])',
      );
      el?.focus();
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
      // Last field — advance step or submit
      if (canNext() && step < STEPS.length) {
        setStep((s) => s + 1);
      } else if (canNext() && step === STEPS.length) {
        handleSubmit();
      }
    }
  };

  const canNext = () => {
    if (step === 1) return form.images.length > 0;
    if (step === 2) return form.brand && form.model && form.year;
    if (step === 3) return form.mileage && form.colour && form.condition;
    if (step === 4) return form.bodyType && form.fuelType;
    if (step === 5) return true;
    if (step === 6) return form.state && form.city;
    if (step === 7) return form.basePrice && form.sellingPrice;
    return true;
  };

  const uploadImages = async () => {
    const urls = [];
    for (const file of form.images) {
      if (typeof file === "string") {
        urls.push(file);
        continue;
      }
      const name = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("car-images")
        .upload(name, file);
      if (error) throw error;
      urls.push(
        supabase.storage.from("car-images").getPublicUrl(name).data.publicUrl,
      );
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!form.images.length) {
      alert("Please select at least 1 image");
      return;
    }
    const mileage = parseInt(form.mileage);
    const basePrice = parseFloat(form.basePrice);
    const sellingPrice = parseFloat(form.sellingPrice);
    const originalPrice = form.originalPrice
      ? parseFloat(form.originalPrice)
      : null;
    const year = parseInt(form.year);
    const engineCc = form.engineCc ? parseInt(form.engineCc) : null;

    if (isNaN(mileage) || mileage < 0) {
      alert("Invalid mileage");
      return;
    }
    if (isNaN(basePrice) || basePrice < 0) {
      alert("Invalid base price");
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      alert("Invalid selling price");
      return;
    }
    if (isNaN(year) || year < 1900) {
      alert("Invalid year");
      return;
    }
    if (originalPrice !== null && originalPrice <= sellingPrice) {
      alert("Original price must be higher than selling price");
      return;
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
        original_price: originalPrice,
        engine_cc: engineCc,
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
        included_services: form.included_services || [],
        included_services_cost: servicesCost,
        recon_cost: (form.baseReconCost || 0) + servicesCost,
        video_url: form.video_url || null,
        car_documents: form.car_documents || [],
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
      };

      // Salesman-lite (standalone, no dealer) requires superadmin approval
      const needsApproval = profile?.role === "salesman" && !profile?.dealer_id;

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
      alert("Error: " + err.message);
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
      case 2: return !!(form.brand && form.model && form.year);
      case 3: return !!(form.mileage && form.colour && form.condition);
      case 4: return !!(form.bodyType && form.fuelType);
      case 5: return true;
      case 6: return !!(form.state && form.city);
      case 7: return !!(form.basePrice && form.sellingPrice);
      case 8: return true;
      default: return false;
    }
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
              className="block border-2 border-dashed border-gray-700 hover:border-red-500 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
            >
              <Camera className="w-10 h-10 text-gray-600 group-hover:text-red-500 mx-auto mb-3 transition-colors" />
              <p className="text-white font-medium mb-1">Choose Photos</p>
              <p className="text-gray-500 text-sm">Up to 30 images — JPG, PNG, WEBP</p>
              <p className="text-blue-400 text-xs mt-2 font-medium">{form.images.length}/30 selected</p>
            </label>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => photosInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Add more · {form.images.length}/30
              </button>
            </div>
          )}
          {imgProgress.filter(p => p.status !== 'done').length > 0 && (
            <div className="space-y-1.5">
              {imgProgress.filter(p => p.status !== 'done').map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800
                     border border-gray-700 rounded-lg text-xs">
                  {p.status === 'uploading'
                    ? <div className="w-3 h-3 border border-white/30 border-t-white
                           rounded-full animate-spin flex-shrink-0" />
                    : <span className="text-red-400 flex-shrink-0">✕</span>}
                  <span className="text-gray-400 truncate">{p.name}</span>
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
              <p className="text-xs text-gray-500">
                Drag to reorder on desktop · use arrows on mobile · Image #1 is
                the main thumbnail
              </p>
              <div className="max-h-[40vh] sm:max-h-[52vh] overflow-y-auto rounded-xl border border-gray-800 p-1.5 sm:p-2">
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2">
                  {previews.map((src, i) => (
                    <div
                      key={src + i}
                      draggable
                      onDragStart={(e) => dragStart(i, e)}
                      onDragOver={(e) => dragOver(i, e)}
                      onDrop={(e) => drop(i, e)}
                      onDragEnd={dragEnd}
                      className={`relative aspect-[4/3] sm:aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gray-800 border transition-all ${i === dropTargetIndex ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-700"} ${i === draggingIndex ? "opacity-70 scale-[0.98]" : ""}`}
                    >
                      <img
                        src={src}
                        alt={`preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] sm:text-[10px] font-semibold">
                        #{i + 1}
                      </span>
                      <span className="hidden sm:block absolute top-1 right-7 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium select-none">
                        Drag
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
                      <div className="absolute bottom-1 right-1 flex items-center gap-1 sm:hidden">
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
                  ))}
                </div>
              </div>
            </>
          )}
          {/* Walkthrough Video */}
          <div className="space-y-1">
            <label className="text-sm text-gray-400">
              Walkthrough Video{" "}
              <span className="text-gray-600">(optional)</span>
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

          {/* Car Documents */}
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-900">
              <BadgeCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">
                Car Documents
              </span>
              {form.car_documents.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                  {form.car_documents.length}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-600">
                Puspakom, service history, insurance…
              </span>
            </div>
            <div className="px-4 pb-4 pt-3 space-y-3 bg-gray-900/50">
              {form.car_documents.length > 0 && (
                <div className="space-y-2">
                  {form.car_documents.map((doc, i) => {
                    const dt =
                      DOC_TYPES.find((d) => d.key === doc.type) ||
                      DOC_TYPES[DOC_TYPES.length - 1];
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded-xl"
                      >
                        <BadgeCheck
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: dt.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {doc.name}
                          </p>
                          <p className="text-xs" style={{ color: dt.color }}>
                            {dt.label}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 mr-1 flex-shrink-0"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => removeDocument(i)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={docTypeInput}
                  onChange={(e) => setDocTypeInput(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {DOC_TYPES.map((d) => (
                    <option
                      key={d.key}
                      value={d.key}
                      style={{ background: "#111827" }}
                    >
                      {d.label}
                    </option>
                  ))}
                </select>
                <label
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors flex-shrink-0 ${docUploading ? "bg-gray-700 text-gray-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                >
                  {docUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
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
              <p className="text-xs text-gray-600">
                PDF, JPG or PNG — shown to buyers on the listing page and earns
                a Verified badge on listing cards.
              </p>
            </div>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand" required>
              <Combobox
                value={form.brand}
                onChange={(v) =>
                  setForm((f) => ({ ...f, brand: v, model: "" }))
                }
                options={ALL_BRANDS}
                placeholder="e.g. Toyota"
              />
            </Field>
            <Field label="Model" required>
              <Combobox
                value={form.model}
                onChange={(v) => set("model", v)}
                options={modelOptions}
                placeholder={form.brand ? "e.g. Vios" : "Pick brand first"}
                disabled={!form.brand}
              />
            </Field>
          </div>
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
        </div>
      );
      case 3: return (
        <div className="space-y-5">
          <Field label="Condition" required>
            <PillSelect
              options={CONDITIONS}
              value={form.condition}
              onChange={(v) => set("condition", v)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <Field label="Registration Date">
            <input
              type="date"
              name="registrationDate"
              value={form.registrationDate}
              onChange={handleChange}
              className={inputCls}
            />
          </Field>
          <Field
            label="Plate Number"
            hint="Optional — vehicle registration plate"
          >
            <input
              name="plate_number"
              value={form.plate_number}
              onChange={handleChange}
              placeholder="e.g. WXY 1234"
              className={inputCls}
            />
          </Field>
          <Field label="VIN Number" hint="Vehicle Identification Number">
            <input
              name="vin_number"
              value={form.vin_number}
              onChange={handleChange}
              placeholder="e.g. JN1CA31D1XT000001"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <Field label="Loan Eligible">
            <PillSelect
              options={["Yes", "No"]}
              value={form.loan_eligible ? "Yes" : "No"}
              onChange={(v) => set("loan_eligible", v === "Yes")}
            />
          </Field>
        </div>
      );
      case 4: return (
        <div className="space-y-6">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${String(form.engineCc) === String(cc) ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-white"}`}
                  >
                    {cc >= 1000 ? `${cc / 1000}`.replace(/\.0$/, "") + "k" : cc}
                    cc
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>
      );
      case 5: return (
        <div className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-2xl">
            <div>
              <p className="text-white font-semibold text-sm">
                Recon / Grey Import Vehicle
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Enable if this car was imported from overseas
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("isRecon", !form.isRecon)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${form.isRecon ? "bg-blue-600" : "bg-gray-600"}`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isRecon ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          {form.isRecon && (
            <div className="space-y-5">
              {/* Grade row */}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Auction Grade"
                  hint={`Suggested: ${suggestedGrade}`}
                >
                  <div className="relative">
                    <select
                      name="auctionGrade"
                      value={form.auctionGrade}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— Select grade —</option>
                      {[
                        "S",
                        "5",
                        "4.5",
                        "4",
                        "3.5",
                        "3",
                        "R",
                        "RA",
                        "2",
                        "1",
                      ].map((g) => (
                        <option key={g} value={g}>
                          {g}
                          {g === suggestedGrade ? " ★ suggested" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                  {!form.auctionGrade && (
                    <button
                      type="button"
                      onClick={() => set("auctionGrade", suggestedGrade)}
                      className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Use suggested: {suggestedGrade}
                    </button>
                  )}
                </Field>
                <Field label="Interior Grade">
                  <div className="relative">
                    <select
                      name="interiorGrade"
                      value={form.interiorGrade}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      {["A", "B", "C", "D"].map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </Field>
              </div>

              {/* Import country + auction house */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Import Country">
                  <div className="relative">
                    <select
                      name="importCountry"
                      value={form.importCountry}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      {["Japan", "UK", "Australia", "Other"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
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
              </div>

              {/* Local reg date + chassis status */}
              <div className="grid grid-cols-2 gap-4">
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
                  <div className="relative">
                    <select
                      name="chassisStatus"
                      value={form.chassisStatus}
                      onChange={handleChange}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      <option value="clean">Clean</option>
                      <option value="repaired">Repaired</option>
                      <option value="written_off">Written Off</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </Field>
              </div>

              {/* Damage map */}
              <Field label="Damage Map" hint="Click car to mark damage areas">
                <div className="p-4 bg-gray-800/60 border border-gray-700 rounded-2xl">
                  <DamageMap
                    value={form.damageMap}
                    onChange={(v) => set("damageMap", v)}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>
      );
      case 6: return (
        <div className="space-y-5">
          <Field label="State" required>
            <div className="relative">
              <select
                name="state"
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, state: e.target.value, city: "" }))
                }
                className={selectCls}
              >
                <option value="">-- Select state --</option>
                {Object.keys(STATE_CITIES).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </Field>
          <Field label="City" required>
            <Combobox
              value={form.city}
              onChange={(v) => set("city", v)}
              options={cityOptions}
              placeholder={
                form.state ? "Type or search city..." : "Select state first"
              }
              disabled={!form.state}
            />
          </Field>
        </div>
      );
      case 7: return (
        <div className="space-y-5">
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
          <Field
            label="Original Price (RM)"
            hint="Optional — set if this is a discounted price"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                name="originalPrice"
                value={form.originalPrice}
                onChange={handleChange}
                placeholder="Leave blank if no discount"
                min="0"
                className={`${inputCls} pl-12`}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              This becomes the crossed-out "was" price on the listing card. Must
              be higher than selling price.
            </p>
            {hasDiscount && (
              <div
                className={`flex items-center gap-3 mt-3 px-4 py-3 rounded-xl border ${isHotDeal ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"}`}
              >
                <span className="text-2xl leading-none">
                  {isHotDeal ? "🔥" : "↓"}
                </span>
                <div>
                  <p
                    className={`text-sm font-semibold ${isHotDeal ? "text-red-400" : "text-green-400"}`}
                  >
                    RM {discountAmt.toLocaleString()} off ({discountPct}%)
                    {isHotDeal && " — qualifies as Hot Deal!"}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {isHotDeal
                      ? "This listing will appear in the Hot Deals section on the homepage"
                      : `Needs ≥3% discount for Hot Deals. Currently ${discountPct}%`}
                  </p>
                </div>
              </div>
            )}
          </Field>
          {form.basePrice && form.sellingPrice && (
            <div
              className={`px-4 py-3 rounded-xl text-sm font-medium border ${parseFloat(form.sellingPrice) >= parseFloat(form.basePrice) ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}
            >
              {parseFloat(form.sellingPrice) >= parseFloat(form.basePrice)
                ? `Margin: +RM ${(parseFloat(form.sellingPrice) - parseFloat(form.basePrice)).toLocaleString()}`
                : `⚠ Selling below base price by RM ${(parseFloat(form.basePrice) - parseFloat(form.sellingPrice)).toLocaleString()}`}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
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
            <Field label="Warranty Offered (months)" hint="0 = no warranty">
              <input
                type="number"
                name="warranty_months"
                value={form.warranty_months}
                onChange={handleChange}
                placeholder="e.g. 3"
                min="0"
                className={inputCls}
              />
            </Field>
          </div>

          {/* ── Included Services & Add-ons ── */}
          <div className="rounded-2xl border border-gray-800 overflow-hidden">
            {/* Header toggle */}
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800/80 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">
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
              <div className="px-4 pb-4 pt-3 space-y-3 bg-gray-900/50">
                {/* Attached list */}
                {form.included_services.length > 0 && (
                  <div className="space-y-2">
                    {form.included_services.map((svc, idx) => {
                      const cfg = getCategoryCfg(svc.category);
                      const CatIcon = cfg.icon;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700"
                        >
                          <CatIcon
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: cfg.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {svc.name}
                            </p>
                            <p className="text-xs text-gray-500">{cfg.label}</p>
                          </div>
                          <span className="text-sm font-semibold text-white whitespace-nowrap">
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
                        Total included services cost
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-700 hover:border-blue-500/40 text-gray-500 hover:text-blue-400 text-sm transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                    Add a service from catalogue
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                    {/* Search bar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
                      <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search catalogue…"
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpen(false);
                          setServiceSearch("");
                        }}
                        className="text-gray-500 hover:text-white"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Catalogue list */}
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-700/50">
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
                        .map((p) => {
                          const cfg = getCategoryCfg(p.category);
                          const CatIcon = cfg.icon;
                          const alreadyAdded = form.included_services.some(
                            (s) => s.id === p.id,
                          );
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addService(p)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-700/50"}`}
                            >
                              <CatIcon
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: cfg.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {p.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {cfg.label}
                                </p>
                              </div>
                              <span className="text-sm font-semibold text-white whitespace-nowrap">
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
        </div>
      );
      case 8: return (
        <div className="space-y-5">
          <Field label="Specs">
            <textarea
              name="specs"
              value={form.specs}
              onChange={handleChange}
              placeholder="e.g. 1.5L DOHC, 107hp, 140Nm..."
              className={textareaCls}
              rows={3}
            />
          </Field>
          <Field label="Options">
            <textarea
              name="options"
              value={form.options}
              onChange={handleChange}
              placeholder="e.g. Sunroof, leather seats, Apple CarPlay..."
              className={textareaCls}
              rows={3}
            />
          </Field>
          <Field label="Features">
            <textarea
              name="features"
              value={form.features}
              onChange={handleChange}
              placeholder="e.g. Reverse camera, push start, keyless entry..."
              className={textareaCls}
              rows={3}
            />
          </Field>
        </div>
      );
      default: return null;
    }
  }

  return (
    <div
      ref={formRef}
      onKeyDown={handleKeyDown}
      className="w-full"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Draft resume banner */}
      {draftBanner && !listing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 14px", borderRadius: 9, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", fontFamily: "'DM Sans',sans-serif" }}>
          <span style={{ fontSize: 13 }}>📝</span>
          <p style={{ margin: 0, fontSize: 12, color: "#93c5fd", flex: 1 }}>You have an unsaved draft.</p>
          <button onClick={() => { const d = cfLoadDraft(profile?.id); if (d) { setForm(d.form); } setDraftBanner(false); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#2563eb", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Resume</button>
          <button onClick={() => { cfClearDraft(profile?.id); setDraftBanner(false); }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Discard</button>
        </div>
      )}

      {/* Sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((id) => {
            const section = STEPS.find((s) => s.id === id);
            return (
              <SortableSection
                key={id}
                id={id}
                section={section}
                complete={isSectionComplete(id)}
                collapsed={!!collapsed[id]}
                onToggle={() =>
                  setCollapsed((p) => ({ ...p, [id]: !p[id] }))
                }
              >
                {renderSectionContent(id)}
              </SortableSection>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Submit */}
      <div className="mt-6">
        {listing && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${copied ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-white hover:border-white/20"}`}
            >
              {copied ? <><ClipboardCheck className="w-3.5 h-3.5" />Copied!</> : <><Clipboard className="w-3.5 h-3.5" />Copy Data</>}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading || !(form.images.length > 0 && form.brand && form.model && form.year && form.state && form.city && form.basePrice && form.sellingPrice)}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading…</>
          ) : (
            <><Check className="w-4 h-4" />{listing ? "Save Changes" : "Publish Listing"}</>
          )}
        </button>
      </div>
    </div>
  );

}

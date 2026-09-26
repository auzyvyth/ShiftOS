import React from "react";
import { toast } from "sonner";
import {
  Car, ChevronLeft, ChevronRight, Copy, Droplets, FileText, Gauge, Hash,
  MapPin, Palette, PlayCircle, Settings, X, ZoomIn,
} from "lucide-react";
import { DOC_TYPES } from "../utils/docTypes";
import { DEFAULT_EIR } from "../utils/financing";
import { getCategoryCfg } from "../utils/serviceCategories";
import { calcMonthly } from "../utils/financing";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../theme/tokens";

// Shared by SalesmanLite and SalesmanPremium (both used to carry their own
// near-identical ~900-line copy of this popup — see CLAUDE.md "one
// implementation, shared"). Each caller supplies its own `actions` (Copy
// Link / WA Caption / AI Caption / Broadcast etc.) since those differ by
// plan; everything else — gallery, fields, tabs — is identical.

// A plain comma/newline split also cuts a thousands-separator number in half
// — "28,595 km" typed into the features box became two tags, "28" and "595
// km". Numbers are masked out before splitting and restored after.
const parseTags = (str) => {
  if (!str) return [];
  const numbers = [];
  const masked = String(str).replace(/\d{1,3}(?:,\d{3})+/g, (m) => {
    numbers.push(m);
    return `@@N${numbers.length - 1}@@`;
  });
  return masked
    .split(/[\n,]+/)
    .map((s) => s.replace(/@@N(\d+)@@/g, (_, i) => numbers[Number(i)]).trim())
    .filter(Boolean);
};

const copyText = (text, label) => {
  if (!text) return;
  navigator.clipboard.writeText(String(text)).then(() => toast.success(`${label} copied`));
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : null);

const Row = ({ k, v, valueColor }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
    <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{k}</span>
    <span style={{ fontSize: T.size.base, color: valueColor || C.textSec, textAlign: "right" }}>{v ?? "—"}</span>
  </div>
);

const Grid = ({ rows }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20 }}>
    {rows.map(({ k, v, valueColor }) => <Row key={k} k={k} v={v} valueColor={valueColor} />)}
  </div>
);

const TABS = ["specs", "mechanical", "paperwork", "features", "options"];

export default function CarDetailPopup({
  selectedCar, carStatsMap,
  carDetailImgIdx, carDetailTab, carDetailLbOpen, isMobile,
  setCarDetailImgIdx, setCarDetailTab, setCarDetailLbOpen, setSelectedCar,
  actions = [],
}) {
  const car = selectedCar;
  if (!car) return null;

  const images = Array.isArray(car.images) && car.images.length > 0 ? car.images : [];
  const sp = car.selling_price || 0;
  const op = car.original_price || null;
  const saving = op && op > sp ? op - sp : 0;
  const monthly = calcMonthly(sp);
  const stats = carStatsMap[car.id] ?? {};
  const views = stats.views || 0;
  const enqs = stats.enquiries || 0;
  const cvr = views > 0 ? ((enqs / views) * 100).toFixed(1) : null;
  const features = parseTags(car.features);
  const docs = Array.isArray(car.car_documents) ? car.car_documents : [];

  const rtExpiry = car.road_tax_expiry ? new Date(car.road_tax_expiry) : null;
  const rtDays = rtExpiry ? Math.ceil((rtExpiry - Date.now()) / 86400000) : null;
  const rtColor = rtDays == null ? C.textSec : rtDays < 0 ? C.dangerText : rtDays <= 30 ? C.warnText : C.textSec;
  const rtLabel = rtExpiry ? `${fmtDate(rtExpiry)}${rtDays < 0 ? " (expired)" : rtDays <= 30 ? ` (${rtDays}d left)` : ""}` : null;

  const close = () => {
    setSelectedCar(null);
    setCarDetailImgIdx(0);
    setCarDetailTab("specs");
    setCarDetailLbOpen(false);
  };

  const navBtn = (side, onClick) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ position: "absolute", [side]: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: R.sm, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {side === "left" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  );

  const identityChip = (label, value, onCopy) => (
    <button
      key={label}
      onClick={onCopy}
      style={{ display: "flex", alignItems: "center", gap: 6, background: C.fill, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: "6px 10px", cursor: "pointer" }}
    >
      <Hash size={11} color={C.textMuted} />
      <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: T.size.base, color: C.text, fontFamily: "monospace" }}>{value}</span>
      <Copy size={10} color={C.textMuted} />
    </button>
  );

  return (
    <>
      <div
        onClick={close}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", overflowY: "auto" }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "relative", margin: isMobile ? 0 : "24px auto", maxWidth: isMobile ? "100vw" : 1000, width: isMobile ? "100vw" : "calc(100vw - 48px)", height: isMobile ? "100dvh" : undefined, maxHeight: isMobile ? "100dvh" : "calc(100vh - 48px)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? 0 : R.lg, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}
        >
          <button
            onClick={close}
            style={{ position: "absolute", top: 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>

          <div style={{ display: "flex", flex: 1, minHeight: 0, overflowY: "auto", flexDirection: isMobile ? "column" : "row" }}>
            {/* LEFT — gallery + details */}
            <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? "none" : `1px solid ${C.border}`, overflowY: isMobile ? "visible" : "auto" }}>
              {images.length > 0 ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 60, display: "flex", flexDirection: "column", gap: 5, maxHeight: isMobile ? 180 : 300, overflowY: "auto" }}>
                    {images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setCarDetailImgIdx(i)}
                        style={{ width: 60, height: 44, borderRadius: 4, cursor: "pointer", flexShrink: 0, background: C.bg, border: i === carDetailImgIdx ? `1px solid ${C.accent}` : `1px solid ${C.border}`, overflow: "hidden", opacity: i === carDetailImgIdx ? 1 : 0.45 }}
                      >
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, position: "relative", background: C.bg, borderRadius: R.sm, overflow: "hidden", height: isMobile ? 180 : 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src={images[carDetailImgIdx]}
                      alt=""
                      onClick={() => setCarDetailLbOpen(true)}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in", display: "block" }}
                    />
                    {images.length > 1 && (
                      <>
                        {navBtn("left", () => setCarDetailImgIdx((i) => (i - 1 + images.length) % images.length))}
                        {navBtn("right", () => setCarDetailImgIdx((i) => (i + 1) % images.length))}
                      </>
                    )}
                    <button
                      onClick={() => setCarDetailLbOpen(true)}
                      style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: R.sm, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <ZoomIn size={13} />
                    </button>
                    {images.length > 1 && (
                      <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: T.size.sm, color: C.textMuted, background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 7px" }}>
                        {carDetailImgIdx + 1} / {images.length}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ height: isMobile ? 160 : 260, background: C.fillSubtle, borderRadius: R.sm, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car size={40} color={C.textDim} />
                </div>
              )}

              {/* Header */}
              <div style={{ marginTop: 18 }}>
                <p style={{ fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label, margin: 0 }}>{car.brand}</p>
                <p style={{ fontSize: T.size.xl, fontWeight: T.weight.normal, color: C.text, margin: "4px 0 0", lineHeight: 1.2 }}>
                  {car.model}{car.variant ? ` ${car.variant}` : ""}
                </p>
                <p style={{ fontSize: T.size.sm, color: C.textMuted, margin: "6px 0 0" }}>
                  {[car.year, car.body_type, car.transmission, car.fuel_type].filter(Boolean).join(" · ")}
                </p>
                {(car.city || car.state) && (
                  <p style={{ fontSize: T.size.sm, color: C.textMuted, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} /> {[car.city, car.state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>

              {/* Description — the seller's own free-text "About" copy, previously write-only */}
              {car.specs && (
                <p style={{ fontSize: T.size.base, color: C.textSec, margin: "10px 0 0", lineHeight: 1.5 }}>{car.specs}</p>
              )}

              {/* Identity — VIN / plate, tap to copy. The reason this popup got rebuilt. */}
              {(car.vin_number || car.plate_number) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {car.vin_number && identityChip("VIN", car.vin_number, () => copyText(car.vin_number, "VIN"))}
                  {car.plate_number && identityChip("Plate", car.plate_number, () => copyText(car.plate_number, "Plate number"))}
                </div>
              )}

              {/* Price */}
              <div style={{ marginTop: 14 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: T.size.hero, color: C.text, margin: 0, lineHeight: 1 }}>
                  {sp ? `RM ${sp.toLocaleString("en-MY")}` : "—"}
                </p>
                {saving > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: T.size.sm, color: C.textDim, textDecoration: "line-through" }}>RM {op.toLocaleString("en-MY")}</span>
                    <span style={{ fontSize: T.size.xs, color: C.infoTextHi, background: withAlpha(C.info, 0.12), border: `1px solid ${withAlpha(C.info, 0.25)}`, borderRadius: 4, padding: "1px 6px" }}>
                      SAVE RM {saving.toLocaleString("en-MY")}
                    </span>
                  </div>
                )}
                {monthly > 0 && (
                  <p style={{ fontSize: T.size.sm, color: C.textMuted, marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr · {DEFAULT_EIR}% EIR</p>
                )}
              </div>

              {/* Quick stats strip */}
              <div style={{ display: "flex", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, margin: "16px 0", padding: "12px 0", overflowX: "auto" }}>
                {[
                  { Icon: Gauge, label: "Mileage", value: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "—" },
                  { Icon: Settings, label: "Engine", value: car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : "—" },
                  { Icon: ChevronRight, label: "Transmission", value: car.transmission || "—" },
                  { Icon: Droplets, label: "Fuel", value: car.fuel_type || "—" },
                  { Icon: Palette, label: "Colour", value: car.colour || "—" },
                ].map(({ Icon, label, value }, i, arr) => (
                  <div key={label} style={{ flex: "1 0 70px", textAlign: "center", padding: "0 10px", borderRight: i < arr.length - 1 ? `1px solid ${C.line}` : "none" }}>
                    <Icon size={13} color={C.textMuted} style={{ marginBottom: 4 }} />
                    <p style={{ fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: T.size.base, color: C.text, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16, overflowX: "auto" }}>
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCarDetailTab(tab)}
                    style={{ padding: "8px 14px", fontSize: T.size.sm, whiteSpace: "nowrap", color: carDetailTab === tab ? C.text : C.textMuted, background: "none", border: "none", borderBottom: carDetailTab === tab ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {carDetailTab === "specs" && (
                <Grid rows={[
                  { k: "Year", v: car.year || "—" },
                  { k: "Condition", v: car.condition || "—" },
                  { k: "Body Type", v: car.body_type || "—" },
                  { k: "Colour", v: car.colour || "—" },
                  { k: "Mileage", v: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "—" },
                  { k: "Transmission", v: car.transmission || "—" },
                  { k: "Fuel Type", v: car.fuel_type || "—" },
                  { k: "Location", v: [car.city, car.state].filter(Boolean).join(", ") || "—" },
                ]} />
              )}

              {carDetailTab === "mechanical" && (
                <Grid rows={[
                  { k: "Horsepower", v: car.horsepower ? `${car.horsepower} hp` : "—" },
                  { k: "Cylinders", v: car.cylinders ? `${car.cylinders} cyl` : "—" },
                  { k: "Doors", v: car.doors || "—" },
                  { k: "Seats", v: car.seats || "—" },
                  { k: "Fuel Consumption", v: car.fuel_consumption ? `${car.fuel_consumption} L/100km` : "—" },
                ]} />
              )}

              {carDetailTab === "paperwork" && (
                <div>
                  <Grid rows={[
                    { k: "VIN", v: car.vin_number || "—" },
                    { k: "Plate Number", v: car.plate_number || "—" },
                    { k: "Registration Date", v: fmtDate(car.registration_date) || "—" },
                    { k: "Previous Owners", v: car.previous_owners ?? "—" },
                    { k: "Chassis Status", v: car.chassis_status ? car.chassis_status.replace(/_/g, " ") : "—" },
                    { k: "Road Tax Expiry", v: rtLabel || "—", valueColor: rtColor },
                    { k: "Warranty", v: car.warranty_months > 0 ? `${car.warranty_months} months` : "—" },
                    { k: "Payment Type", v: car.payment_type ? car.payment_type.replace(/_/g, " ") : "—" },
                    { k: "Loan Eligible", v: car.loan_eligible == null ? "—" : car.loan_eligible ? "Yes" : "No" },
                    { k: "Deposit Amount", v: car.deposit_amount > 0 ? `RM ${Number(car.deposit_amount).toLocaleString("en-MY")}` : "—" },
                  ]} />

                  <p style={{ fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold, margin: "18px 0 4px" }}>Recon / Import</p>
                  <Grid rows={[
                    { k: "Unit Type", v: car.is_recon === true ? "Recon (Imported)" : car.is_recon === false ? "Local Unit" : "—" },
                    { k: "Auction Grade", v: car.auction_grade || "—" },
                    { k: "Interior Grade", v: car.interior_grade || "—" },
                    { k: "Import Country", v: car.import_country || "—" },
                    { k: "Auction House", v: car.auction_house || "—" },
                    { k: "Local Reg. Date", v: fmtDate(car.local_reg_date) || "—" },
                  ]} />

                  <p style={{ fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold, margin: "18px 0 8px" }}>Documents</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {docs.length === 0 ? (
                      <p style={{ fontSize: T.size.base, color: C.textMuted, margin: 0 }}>No documents on file.</p>
                    ) : (
                      docs.map((d, i) => {
                        const cfg = DOC_TYPES.find((t) => t.key === d.type) || DOC_TYPES[DOC_TYPES.length - 1];
                        return (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: T.size.sm, color: cfg.color, background: withAlpha(cfg.color, 0.1), border: `1px solid ${withAlpha(cfg.color, 0.25)}`, borderRadius: R.sm, padding: "4px 10px" }}>
                            <FileText size={11} /> {cfg.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                  {car.video_url && (
                    <a href={car.video_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: T.size.base, color: C.infoText, textDecoration: "none" }}>
                      <PlayCircle size={14} /> Watch video
                    </a>
                  )}
                </div>
              )}

              {carDetailTab === "features" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {features.length === 0 ? (
                    <p style={{ fontSize: T.size.base, color: C.textMuted }}>No features listed.</p>
                  ) : (
                    features.map((f, i) => (
                      <span key={i} style={{ fontSize: T.size.sm, color: C.textSec, background: C.fill, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 10px" }}>{f}</span>
                    ))
                  )}
                </div>
              )}

              {carDetailTab === "options" && (
                <div>
                  {!car.options || !car.options.trim() ? (
                    <p style={{ fontSize: T.size.base, color: C.textMuted }}>No options listed.</p>
                  ) : (
                    <p style={{ fontSize: T.size.base, color: C.textSec, lineHeight: 1.5, margin: 0 }}>{car.options}</p>
                  )}
                </div>
              )}

              {/* What's Included — dealer add-on services bundled into the sale */}
              {Array.isArray(car.included_services) && car.included_services.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                  <p style={{ fontSize: T.size.xs, textTransform: "uppercase", letterSpacing: T.track.label, color: C.textMuted, fontWeight: T.weight.semibold, marginBottom: 10 }}>What's Included</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {car.included_services.map((svc, i) => {
                      const cfg = getCategoryCfg(svc.category);
                      const CatIcon = cfg.icon;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: withAlpha(cfg.color, 0.07), border: `1px solid ${withAlpha(cfg.color, 0.2)}`, borderRadius: R.sm, padding: "6px 12px" }}>
                          <CatIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span style={{ fontSize: T.size.sm, color: cfg.color, fontWeight: T.weight.semibold }}>{svc.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  {car.included_services_cost > 0 && (
                    <p style={{ fontSize: T.size.sm, color: C.textMuted, marginTop: 10 }}>
                      Est. add-on value: <span style={{ color: C.infoText, fontWeight: T.weight.bold }}>RM {Number(car.included_services_cost).toLocaleString("en-MY")}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — actions + CVR */}
            {/* `0 1 200px`, not `0 0 200px`: a column that cannot shrink
                overflows the dialog rather than fitting inside it the moment
                the dialog is narrower than left-pane + 200, which is how a
                button ends up clipped by the dialog's own overflow. minWidth 0
                is the other half of that rule — without it a flex child still
                refuses to go below its content width. */}
            <div style={{ flex: isMobile ? "none" : "0 1 200px", minWidth: 0, width: isMobile ? "100%" : undefined, padding: isMobile ? "12px 16px 32px" : 20, display: "flex", flexDirection: "column", gap: 8, borderTop: isMobile ? `1px solid ${C.border}` : "none" }}>
              <p style={{ fontSize: T.size.xs, color: C.textMuted, letterSpacing: T.track.label, textTransform: "uppercase", margin: "0 0 4px" }}>Actions</p>
              {actions.map(({ key, label, color, bg, border, onClick }) => (
                <button
                  key={key}
                  onClick={onClick}
                  style={{ width: "100%", minWidth: 0, background: bg, border: `1px solid ${border}`, borderRadius: R.sm, padding: "10px 12px", fontSize: T.size.sm, fontWeight: T.weight.medium, color, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 2, fontFamily: "system-ui, sans-serif" }}
                >
                  {label}
                </button>
              ))}

              {/* Performance */}
              <div style={{ marginTop: 8, background: C.fillSubtle, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: 12 }}>
                <p style={{ fontSize: T.size.xs, color: C.textMuted, letterSpacing: T.track.label, textTransform: "uppercase", margin: "0 0 8px" }}>Performance</p>
                {[
                  { label: "Views", val: views, color: C.infoText },
                  { label: "Enquiries", val: enqs, color: C.warnText },
                  { label: "CVR", val: cvr !== null ? `${cvr}%` : "—", color: C.successText },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{label}</span>
                    <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Status */}
              <div style={{ background: C.fillSubtle, border: `1px solid ${C.border}`, borderRadius: R.sm, padding: 12 }}>
                <p style={{ fontSize: T.size.xs, color: C.textMuted, letterSpacing: T.track.label, textTransform: "uppercase", margin: "0 0 6px" }}>Status</p>
                <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, textTransform: "capitalize", color: car.status === "available" ? C.successText : car.status === "sold" ? C.textMuted : C.warnText }}>
                  {car.status || "available"}
                </span>
                {car.created_at && (
                  <p style={{ fontSize: T.size.sm, color: C.textMuted, margin: "8px 0 0" }}>Listed {fmtDate(car.created_at)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {carDetailLbOpen && images.length > 0 && (
        <div
          onClick={() => setCarDetailLbOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button
            onClick={() => setCarDetailLbOpen(false)}
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
          >
            <X size={18} />
          </button>
          {images.length > 1 && (
            <span style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", fontSize: T.size.sm, color: C.textMuted, background: "rgba(0,0,0,0.5)", borderRadius: 20, padding: "4px 12px" }}>
              {carDetailImgIdx + 1} / {images.length}
            </span>
          )}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCarDetailImgIdx((i) => (i - 1 + images.length) % images.length); }}
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <img
            src={images[carDetailImgIdx]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "calc(100vw - 120px)", maxHeight: "90vh", objectFit: "contain", borderRadius: 4, display: "block" }}
          />
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCarDetailImgIdx((i) => (i + 1) % images.length); }}
              style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: R.sm, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

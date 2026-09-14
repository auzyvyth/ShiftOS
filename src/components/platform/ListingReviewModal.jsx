import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { docTypeCfg } from "../../utils/docTypes";
import { TRUST_DOCS, geranStatusLabel } from "../../utils/trustDocs";
import DamageMap from "../DamageMap";

// Full-evidence review sheet for one pending listing.
//
// The Review queue row is a SUMMARY — it can tell you a car is waiting and
// flag what looks wrong, but it cannot show you the geran. Approving from the
// row meant approving paperwork nobody had opened, so the decision buttons
// live here now, next to the evidence, and the row's only action is "Review".
// Bulk approve stays on the toolbar for the confident sweep.
//
// Overlay rules (CLAUDE.md): portalled to document.body, body scroll locked
// while open, and NO nested overlay — a document opens in a new tab rather
// than a lightbox stacked on this sheet.

const fmtMoney = (n) => (n || n === 0 ? `RM ${Number(n).toLocaleString("en-MY")}` : null);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : null;

export const relTime = (d) => {
  if (!d) return null;
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// One definition of what looks wrong with a listing, read by the queue row and
// by this sheet. Two copies would drift and the sheet is where the decision is
// made, so a flag missing here is a flag that never reaches the decision.
export function listingFlags(listing) {
  const salesman = listing.profiles || {};
  const imgs = listing.images || [];
  const docs = Array.isArray(listing.car_documents) ? listing.car_documents : [];
  const accountAgeHrs = salesman.created_at ? (Date.now() - new Date(salesman.created_at)) / 3600000 : null;
  const origPrice = listing.original_price || listing.previous_price || null;
  const discountPct =
    origPrice && origPrice > listing.selling_price
      ? Math.round(((origPrice - listing.selling_price) / origPrice) * 100)
      : 0;
  const hasGeran = docs.some((d) => d?.type === "registration_card");
  return [
    imgs.length === 0 && { label: "No images", sev: "high" },
    !hasGeran && !listing.geran_status && { label: "No geran on file", sev: "high" },
    accountAgeHrs !== null && accountAgeHrs < 24 && { label: "New account (<24h)", sev: "high" },
    listing._duplicatePlate && { label: "Duplicate plate", sev: "high" },
    (listing._sharedPhoneAccounts || 0) > 1 && { label: `Phone on ${listing._sharedPhoneAccounts} accounts`, sev: "high" },
    (salesman.listing_count_cache || 0) >= 28 && { label: "Near listing cap", sev: "med" },
    !salesman.ic_verified_at && { label: "No IC submitted", sev: "med" },
    discountPct > 20 && { label: `Big discount (${discountPct}%)`, sev: "med" },
    (listing._rejectionCount || 0) > 0 && {
      label: `${listing._rejectionCount} prior rejection${listing._rejectionCount > 1 ? "s" : ""}`,
      sev: "med",
    },
  ].filter(Boolean);
}

const Flag = ({ f }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 700,
      padding: "3px 8px",
      borderRadius: 5,
      background: f.sev === "high" ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.1)",
      border: f.sev === "high" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(251,191,36,0.25)",
      color: f.sev === "high" ? "#f87171" : "#fbbf24",
    }}
  >
    {f.label}
  </span>
);

const Section = ({ title, children, right }) => (
  <div style={{ marginTop: 20 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {title}
      </p>
      {right}
    </div>
    {children}
  </div>
);

const Row = ({ k, v, mono, color }) =>
  v === null || v === undefined || v === "" ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 11.5, color: "#6b7280", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12, color: color || "#cbd5e1", textAlign: "right", wordBreak: "break-word", fontFamily: mono ? "monospace" : "inherit" }}>
        {v}
      </span>
    </div>
  );

const isPdf = (d) => /\.pdf($|\?)/i.test(d?.url || "") || d?.name?.toLowerCase().endsWith(".pdf");

export default function ListingReviewModal({
  listing,
  busy,
  onClose,
  onApprove,       // (listing, { alsoVerifySeller }) => Promise
  onReject,        // (listing, reason) => Promise
  onToggleDocsVerified, // (listing) => Promise
  onSaveNote,      // (listing, note) => Promise<boolean>
}) {
  const [pane, setPane] = useState("photos"); // photos | docs
  const [photoIdx, setPhotoIdx] = useState(0);
  const [docIdx, setDocIdx] = useState(0);
  const [alsoVerifySeller, setAlsoVerifySeller] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(listing?.admin_notes || "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const images = useMemo(() => (Array.isArray(listing?.images) ? listing.images.filter(Boolean) : []), [listing]);
  const docs = useMemo(
    () => (Array.isArray(listing?.car_documents) ? listing.car_documents.filter((d) => d?.url) : []),
    [listing],
  );

  // Open on whichever pane actually has evidence — a listing with no photos
  // should not open on an empty photo viewer.
  useEffect(() => {
    setPane(images.length === 0 && docs.length > 0 ? "docs" : "photos");
    setPhotoIdx(0);
    setDocIdx(0);
    setRejecting(false);
    setReason("");
    setAlsoVerifySeller(false);
    setNote(listing?.admin_notes || "");
    setNoteSaved(false);
  }, [listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overlay rule 2 — lock the page behind the sheet, restore on close.
  useEffect(() => {
    if (!listing) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [listing]);

  const step = useCallback(
    (dir) => {
      if (pane === "photos") setPhotoIdx((i) => (images.length ? (i + dir + images.length) % images.length : 0));
      else setDocIdx((i) => (docs.length ? (i + dir + docs.length) % docs.length : 0));
    },
    [pane, images.length, docs.length],
  );

  useEffect(() => {
    if (!listing) return undefined;
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "");
      if (e.key === "Escape" && !typing) onClose();
      if (typing) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listing, onClose, step]);

  if (!listing) return null;

  const salesman = listing.profiles || {};
  const carName = [listing.year, listing.brand, listing.model, listing.variant].filter(Boolean).join(" ") || "Untitled listing";
  const flags = listingFlags(listing);
  const origPrice = listing.original_price || listing.previous_price || null;
  const accountAgeHrs = salesman.created_at ? (Date.now() - new Date(salesman.created_at)) / 3600000 : null;
  // "Already approved" is approval_status -- is_verified is the ID badge, a
  // different decision (decide_user_approval only grants it when the seller
  // actually submitted documents).
  const sellerApproved = salesman.approval_status === "approved";
  const missingTrustDocs = TRUST_DOCS.filter((t) => !docs.some((d) => d.type === t.key));
  const damageMarks = Array.isArray(listing.damage_map) ? listing.damage_map : [];
  const showCondition = damageMarks.length > 0 || !!listing.condition_declared_at;

  const current = pane === "photos" ? images[photoIdx] : docs[docIdx];
  const currentUrl = pane === "photos" ? current : current?.url;
  const count = pane === "photos" ? images.length : docs.length;
  const idx = pane === "photos" ? photoIdx : docIdx;

  const navBtn = (side) => (
    <button
      onClick={() => step(side === "left" ? -1 : 1)}
      aria-label={side === "left" ? "Previous" : "Next"}
      style={{
        position: "absolute", [side]: 8, top: "50%", transform: "translateY(-50%)",
        width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", cursor: "pointer",
        fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );

  const actionsDisabled = !!busy;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end",
      }}
    >
      <style>{`
        .plr-body { display: flex; align-items: flex-start; gap: 22px; }
        .plr-evidence { flex: 1.1; min-width: 0; position: sticky; top: 0; align-self: flex-start; }
        .plr-facts { flex: 1; min-width: 0; }
        .plr-viewer { height: 380px; }
        .plr-decide { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .plr-strip::-webkit-scrollbar { height: 3px; }
        @media (max-width: 860px) {
          .plr-body { flex-direction: column; gap: 4px; }
          .plr-evidence { width: 100%; flex: none; position: static; }
          .plr-facts { width: 100%; flex: none; }
          .plr-viewer { height: 260px; }
          .plr-decide > button { flex: 1 1 auto; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1040px, 100%)", height: "100%", background: "#0b0f16",
          borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9", wordBreak: "break-word" }}>{carName}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                {fmtMoney(listing.selling_price) || "No price"}
                {origPrice ? (
                  <span style={{ color: "#4b5563", fontWeight: 500, textDecoration: "line-through", marginLeft: 8 }}>
                    {fmtMoney(origPrice)}
                  </span>
                ) : null}
                <span style={{ color: "#6b7280", fontWeight: 500, marginLeft: 8, fontSize: 11.5 }}>
                  submitted {relTime(listing.created_at)}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
            >
              &times;
            </button>
          </div>
          {flags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {flags.map((f, i) => <Flag key={i} f={f} />)}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 26px" }}>
          <div className="plr-body">
            {/* ── Evidence: photos + documents, actually openable ── */}
            <div className="plr-evidence">
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { id: "photos", label: `Photos ${images.length}` },
                  { id: "docs", label: `Documents ${docs.length}` },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPane(p.id)}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                      fontFamily: "inherit",
                      background: pane === p.id ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
                      border: pane === p.id ? "1px solid rgba(220,38,38,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      color: pane === p.id ? "#f87171" : "#9ca3af",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div
                className="plr-viewer"
                style={{
                  position: "relative", background: "#06090f", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {count === 0 ? (
                  <p style={{ fontSize: 12.5, color: "#4b5563", padding: 20, textAlign: "center" }}>
                    {pane === "photos" ? "This listing has no photos." : "This listing has no documents attached."}
                  </p>
                ) : pane === "docs" && isPdf(current) ? (
                  <iframe title={current?.name || "document"} src={currentUrl} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
                ) : (
                  <img
                    src={currentUrl}
                    alt={pane === "photos" ? `Photo ${idx + 1}` : current?.name || "document"}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                )}
                {count > 1 && navBtn("left")}
                {count > 1 && navBtn("right")}
                {count > 0 && (
                  <span style={{ position: "absolute", left: 10, bottom: 10, fontSize: 10.5, color: "#9ca3af", background: "rgba(0,0,0,0.6)", borderRadius: 5, padding: "3px 7px" }}>
                    {idx + 1} / {count}
                  </span>
                )}
                {count > 0 && (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ position: "absolute", right: 10, bottom: 10, fontSize: 10.5, color: "#93c5fd", background: "rgba(0,0,0,0.6)", borderRadius: 5, padding: "3px 7px", textDecoration: "none" }}
                  >
                    Open full size
                  </a>
                )}
              </div>

              {/* Thumbnail strip */}
              {count > 0 && (
                <div className="plr-strip" style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {(pane === "photos" ? images : docs).map((it, i) => {
                    const src = pane === "photos" ? it : it.url;
                    const active = i === idx;
                    const pdf = pane === "docs" && isPdf(it);
                    return (
                      <button
                        key={i}
                        onClick={() => (pane === "photos" ? setPhotoIdx(i) : setDocIdx(i))}
                        title={pane === "docs" ? `${docTypeCfg(it.type).label} — ${it.name || ""}` : `Photo ${i + 1}`}
                        style={{
                          width: 54, height: 44, flexShrink: 0, borderRadius: 6, padding: 0, cursor: "pointer",
                          overflow: "hidden", background: "#06090f",
                          border: active ? "1px solid rgba(220,38,38,0.65)" : "1px solid rgba(255,255,255,0.08)",
                          opacity: active ? 1 : 0.65,
                        }}
                      >
                        {pdf ? (
                          <span style={{ fontSize: 9, color: "#9ca3af", display: "block", lineHeight: "44px" }}>PDF</span>
                        ) : (
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

            </div>

            {/* ── Facts: everything the seller declared ── */}
            <div className="plr-facts">
              {/* Document checklist — what is attached and, more usefully, what is not */}
              <Section title="Paperwork checklist">
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {docs.map((d, i) => {
                    const cfg = docTypeCfg(d.type);
                    return (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: cfg.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, color: "#e5e7eb", fontWeight: 600 }}>{cfg.label}</p>
                          <p style={{ margin: 0, fontSize: 10.5, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d.name || d.url}
                          </p>
                        </div>
                        <button
                          onClick={() => { setPane("docs"); setDocIdx(i); }}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                  {missingTrustDocs.map((t) => (
                    <div
                      key={t.key}
                      style={{ display: "flex", alignItems: "center", gap: 9, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px" }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: "#374151", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{t.label}</p>
                        <p style={{ margin: 0, fontSize: 10.5, color: "#4b5563" }}>
                          Not attached{t.key === "registration_card" && listing.geran_status ? ` — ${geranStatusLabel(listing.geran_status) || listing.geran_status}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                  {docs.length === 0 && missingTrustDocs.length === 0 && (
                    <p style={{ fontSize: 12, color: "#4b5563", margin: 0 }}>Nothing on file.</p>
                  )}
                </div>
              </Section>

              <Section title="Car">
                <Row k="Mileage" v={listing.mileage ? `${Number(listing.mileage).toLocaleString()} km` : null} />
                <Row k="Colour" v={listing.colour} />
                <Row k="Condition" v={listing.condition} />
                <Row k="Transmission" v={listing.transmission} />
                <Row k="Fuel" v={listing.fuel_type} />
                <Row k="Body" v={listing.body_type} />
                <Row k="Engine" v={listing.engine_cc ? `${listing.engine_cc} cc` : null} />
                <Row k="Power" v={listing.horsepower ? `${listing.horsepower} hp` : null} />
                <Row k="Seats / doors" v={[listing.seats, listing.doors].filter(Boolean).join(" / ") || null} />
                <Row k="Location" v={[listing.city, listing.state].filter(Boolean).join(", ") || null} />
              </Section>

              <Section title="Identity">
                <Row k="Plate" v={listing.plate_number} mono color={listing._duplicatePlate ? "#f87171" : undefined} />
                <Row k="VIN / chassis" v={listing.vin_number || listing.vin} mono />
                <Row k="Engine no." v={listing.engine_number} mono />
                <Row k="Registered" v={listing.registration_date || fmtDate(listing.local_reg_date)} />
                <Row k="Previous owners" v={listing.previous_owners} />
                <Row k="Listing id" v={listing.id} mono />
              </Section>

              <Section title="Paperwork">
                <Row k="Geran" v={geranStatusLabel(listing.geran_status) || (docs.some((d) => d.type === "registration_card") ? "Attached" : "Not stated")} />
                <Row k="Road tax expiry" v={fmtDate(listing.road_tax_expiry)} />
                <Row k="Warranty" v={listing.warranty_months ? `${listing.warranty_months} months` : null} />
                <Row k="Chassis status" v={listing.chassis_status} />
                <Row k="Documents verified" v={listing.docs_verified ? `Yes — ${fmtDate(listing.docs_verified_at) || "verified"}` : "No"} color={listing.docs_verified ? "#4ade80" : "#9ca3af"} />
              </Section>

              <Section title="Price">
                <Row k="Asking" v={fmtMoney(listing.selling_price)} />
                <Row k="Was" v={fmtMoney(origPrice)} />
                <Row k="Payment type" v={listing.payment_type} />
                <Row k="Loan eligible" v={listing.loan_eligible === null || listing.loan_eligible === undefined ? null : listing.loan_eligible ? "Yes" : "No"} />
                <Row k="Deposit" v={fmtMoney(listing.deposit_amount)} />
              </Section>

              {listing.is_recon && (
                <Section title="Recon">
                  <Row k="Import country" v={listing.import_country} />
                  <Row k="Auction house" v={listing.auction_house} />
                  <Row k="Auction grade" v={listing.auction_grade} />
                  <Row k="Interior grade" v={listing.interior_grade} />
                </Section>
              )}

              {listing.description && (
                <Section title="Description">
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{listing.description}</p>
                </Section>
              )}

              {listing.video_url && (
                <Section title="Video">
                  <a href={listing.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#93c5fd", wordBreak: "break-all" }}>
                    {listing.video_url}
                  </a>
                </Section>
              )}

              {showCondition && (
                <Section title="Declared condition" right={<span style={{ fontSize: 10.5, color: "#4b5563" }}>{damageMarks.length} area{damageMarks.length === 1 ? "" : "s"} marked</span>}>
                  <div style={{ maxWidth: 220 }}>
                    <DamageMap value={damageMarks} readOnly />
                  </div>
                </Section>
              )}

              <Section title="Seller">
                <Row k="Name" v={salesman.full_name || salesman.dealership} />
                <Row k="Handle" v={salesman.slug ? `@${salesman.slug}` : null} />
                <Row k="Email" v={salesman.email} />
                <Row k="Phone" v={salesman.phone || salesman.whatsapp_number} color={listing._sharedPhoneAccounts > 1 ? "#f87171" : undefined} />
                <Row k="Phone shared with" v={listing._sharedPhoneAccounts > 1 ? `${listing._sharedPhoneAccounts} accounts` : null} color="#f87171" />
                <Row k="IC check" v={salesman.ic_verified_at ? `Submitted ${fmtDate(salesman.ic_verified_at)}` : "Not submitted"} color={salesman.ic_verified_at ? "#4ade80" : "#fbbf24"} />
                <Row
                  k="Account approval"
                  v={salesman.approval_status || "pending"}
                  color={sellerApproved ? "#4ade80" : salesman.approval_status === "rejected" ? "#f87171" : "#fbbf24"}
                />
                <Row k="ID badge" v={salesman.is_verified ? "Verified" : "Not verified"} color={salesman.is_verified ? "#4ade80" : "#9ca3af"} />
                <Row k="Plan" v={salesman.plan} />
                <Row k="Account age" v={accountAgeHrs === null ? null : accountAgeHrs < 24 ? `${Math.round(accountAgeHrs)}h` : `${Math.round(accountAgeHrs / 24)}d`} />
                <Row k="Live listings" v={listing._liveListingCount || 0} />
                <Row k="Listings total" v={salesman.listing_count_cache ?? 0} />
                <Row k="Prior rejections" v={listing._rejectionCount || 0} color={(listing._rejectionCount || 0) > 0 ? "#fbbf24" : undefined} />
              </Section>

              <Section
                title="Internal note"
                right={noteSaved ? <span style={{ fontSize: 10.5, color: "#4ade80" }}>Saved</span> : null}
              >
                <textarea
                  value={note}
                  onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
                  placeholder="Only superadmins see this"
                  rows={2}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "8px 10px", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
                <button
                  disabled={noteSaving || note === (listing.admin_notes || "")}
                  onClick={async () => {
                    setNoteSaving(true);
                    const ok = await onSaveNote(listing, note);
                    setNoteSaving(false);
                    setNoteSaved(!!ok);
                  }}
                  style={{
                    marginTop: 8, fontSize: 11.5, fontWeight: 600, padding: "6px 14px", borderRadius: 7,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    color: note === (listing.admin_notes || "") ? "#374151" : "#9ca3af",
                    cursor: note === (listing.admin_notes || "") ? "default" : "pointer", fontFamily: "inherit",
                  }}
                >
                  {noteSaving ? "Saving…" : "Save note"}
                </button>
              </Section>
            </div>
          </div>
        </div>

        {/* ── Decision bar — the whole point of the sheet ── */}
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)", background: "#0b0f16", padding: "12px 20px 16px" }}>
          {rejecting ? (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>Reason for rejection — the salesman sees this</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Geran does not match the plate on the listing"
                rows={2}
                autoFocus
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setRejecting(false); setReason(""); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12.5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
                <button
                  disabled={!reason.trim() || actionsDisabled}
                  onClick={() => onReject(listing, reason.trim())}
                  style={{
                    flex: 2, padding: "9px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                    background: reason.trim() ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                    border: reason.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: reason.trim() ? "#f87171" : "#374151",
                    cursor: reason.trim() && !actionsDisabled ? "pointer" : "not-allowed",
                    opacity: actionsDisabled ? 0.6 : 1,
                  }}
                >
                  {actionsDisabled ? "Rejecting…" : "Confirm reject"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, cursor: "pointer", color: listing.docs_verified ? "#4ade80" : "#9ca3af", fontWeight: 600 }}>
                  <input type="checkbox" checked={!!listing.docs_verified} onChange={() => onToggleDocsVerified(listing)} style={{ accentColor: "#22c55e", cursor: "pointer" }} />
                  {listing.docs_verified ? "Documents verified" : "Mark documents verified"}
                </label>
                <label
                  title={sellerApproved ? undefined : "Grants the seller marketplace access and clears their pending signup review"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, cursor: sellerApproved ? "default" : "pointer", color: sellerApproved ? "#4b5563" : "#9ca3af", fontWeight: 600 }}
                >
                  <input
                    type="checkbox"
                    disabled={sellerApproved}
                    checked={alsoVerifySeller || sellerApproved}
                    onChange={(e) => setAlsoVerifySeller(e.target.checked)}
                    style={{ accentColor: "#60a5fa", cursor: "inherit" }}
                  />
                  {sellerApproved ? "Seller account already approved" : "Also approve this seller account"}
                </label>
              </div>
              <div className="plr-decide">
                <button
                  disabled={actionsDisabled}
                  onClick={() => onApprove(listing, { alsoVerifySeller })}
                  style={{
                    fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 8, fontFamily: "inherit",
                    background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80",
                    cursor: actionsDisabled ? "not-allowed" : "pointer", opacity: actionsDisabled ? 0.6 : 1,
                  }}
                >
                  {actionsDisabled ? "Working…" : alsoVerifySeller ? "Approve listing + seller" : "Approve listing"}
                </button>
                <button
                  disabled={actionsDisabled}
                  onClick={() => { setRejecting(true); setReason(""); }}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, fontFamily: "inherit",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#f87171",
                    cursor: actionsDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={onClose}
                  style={{ marginLeft: "auto", fontSize: 12.5, padding: "10px 16px", borderRadius: 8, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Decide later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

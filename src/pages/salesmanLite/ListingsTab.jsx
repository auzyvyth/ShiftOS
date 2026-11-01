import React from "react";
import { useTranslation } from "react-i18next";
import {
  Calculator, Car, Check, ChevronDown, ClipboardPen, Download, FileText,
  Film, Link as LinkIcon, Lock, Pencil, Plus, Trash2,
} from "lucide-react";
import { premiumDark as P } from "../../theme/tokens";
import "./keys.css";
import { ROOT_DOMAIN } from "../../config/site";
import CarNextStep from "../../components/coach/CarNextStep";
import { PRIVATE_CAR_LIMIT, privateCount } from "../../utils/privateCars";

// Listings tab (Salesman Lite). Redesigned 2026-11-01 in `premiumDark`, the
// same look as Premium's Listings (src/pages/salesmanPremium/ListingsTab.jsx):
// depth by tone, no card borders, red only as a fill, mint the only green.
//
// DRAWING ONLY. Handlers, the add form and every rule stay in SalesmanLite.jsx
// `renderListings`. Every control the old tab had is here: add / cancel, the
// page link + Copy, status tabs, sort, the empty state's two buttons, per car
// Edit & Resubmit, the locked car's Premium button, open on photo / title,
// the status menu, the next-step button, Link / Caption / Edit / View, and ···
// (Brief, Loan poster, TikTok post locked, Download photos, Delete).
// What went (each fact once): the per-card "Live on XDrive · N views" strip
// (the Available tab says live, the views line says the count), the "hot /
// stale" counts (the next-step line replaced those tags), and "My margin: —"
// when there is nothing to show.
export default function ListingsTab({
  isMobile, profile, myListings, carStatsMap, isLockedCar,
  filterStatus, setFilterStatus, sortBy, setSortBy,
  showAddForm, onToggleAdd, onAddListing, addForm, onBackToDashboard,
  onCopyPageLink,
  statusMenuCarId, setStatusMenuCarId, actionMenuCarId, setActionMenuCarId,
  confirmDeleteId, setConfirmDeleteId, deletingId,
  onOpenDetail, onEdit, updateListingStatus, coachFor, onCoach,
  listingCopied, handleListingCopy, onBrief, onPoster, onPremium, lockedCap,
  downloadListingImages, handleDeleteListing,
}) {
  const { t, i18n } = useTranslation();

  const normStatus = (s) => (!s || s === "active" ? "available" : s);
  const enriched = myListings.map((car) => {
    const st = carStatsMap[car.id] ?? {};
    return { car, views: st.views || 0, enqs: st.enquiries || 0 };
  });
  const filtered = enriched.filter((e) => (isLockedCar(e.car) ? "available" : normStatus(e.car.status)) === filterStatus);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price_desc") return (b.car.selling_price || 0) - (a.car.selling_price || 0);
    if (sortBy === "price_asc") return (a.car.selling_price || 0) - (b.car.selling_price || 0);
    if (sortBy === "oldest") return new Date(a.car.created_at) - new Date(b.car.created_at);
    return new Date(b.car.created_at) - new Date(a.car.created_at);
  });
  // Only cards whose title collides with a sibling get colour / plate under it.
  const nameCounts = {};
  sorted.forEach(({ car }) => {
    const n = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  });

  const statusLabel = (st) => (st === "private" ? t("privateCars.label")
    : st === "pending_approval" ? t("salesmanLite.listings.status.pendingApproval")
    : t(`salesmanLite.listings.status.${st}`, { defaultValue: st }));
  const STATUS_TABS = [
    { key: "pending_approval", label: t("salesmanLite.listings.status.pending"), count: myListings.filter((c) => c.status === "pending_approval").length },
    { key: "rejected", label: t("salesmanLite.listings.status.rejected"), count: myListings.filter((c) => c.status === "rejected").length },
    { key: "available", label: t("salesmanLite.listings.status.available"), count: myListings.filter((c) => (c.status || "available") === "available" || isLockedCar(c)).length },
    { key: "reserved", label: t("salesmanLite.listings.status.reserved"), count: myListings.filter((c) => c.status === "reserved").length },
    { key: "sold", label: t("salesmanLite.listings.status.sold"), count: myListings.filter((c) => c.status === "sold").length },
    // Private only gets a tab while it holds a car (or is the one picked).
    ...(privateCount(myListings) > 0 || filterStatus === "private"
      ? [{ key: "private", label: t("privateCars.tab"), count: privateCount(myListings) }] : []),
  ];

  // ── Shared styles ─────────────────────────────────────────────────────────
  const pill = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px",
    borderRadius: P.radius.pill, border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: "nowrap", flexShrink: 0,
    background: active ? P.text : P.raised, color: active ? P.card : P.textSec,
  });
  const sortBtn = (active) => ({
    height: 28, padding: "0 10px", borderRadius: P.radius.pill, border: "none", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, fontWeight: active ? 600 : 400,
    background: active ? P.hover : "transparent", color: active ? P.text : P.textMuted,
  });
  const cardBtn = { flex: 1, minWidth: 0, height: 36, borderRadius: P.radius.row, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: P.raised, color: P.text };
  const redBtn = { marginTop: 12, width: "100%", height: 40, fontSize: 13, fontWeight: 600, borderRadius: P.radius.pill, border: "none", color: P.onAccent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" };
  const menuBox = { position: "absolute", right: 0, zIndex: 60, background: P.hover, border: `1px solid ${P.line}`, borderRadius: P.radius.row, overflow: "hidden", minWidth: 190, boxShadow: "0 12px 32px rgba(0,0,0,0.55)" };
  const menuItem = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", color: P.text, fontSize: 13, textAlign: "left", fontFamily: "inherit" };
  const menuRule = <div style={{ height: 1, background: P.line }} />;
  const dotOf = (st) => (st === "available" ? P.up : st === "reserved" ? P.textSec : P.textMuted);
  const eyebrow = (color) => ({ margin: "0 0 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color });
  const liveCount = myListings.filter((c) => c.status === "available").length;

  return (
    <div style={{ color: P.text }}>
      {/* Header: the one red button. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {t("salesmanLite.listings.title")} <span style={{ color: P.textMuted, fontWeight: 500 }}>{myListings.length}</span>
        </p>
        <button onClick={onToggleAdd} className={showAddForm ? undefined : "lk-red"}
          style={{ height: 40, padding: "0 16px", borderRadius: P.radius.pill, background: showAddForm ? P.raised : undefined, border: "none", color: showAddForm ? P.text : P.onAccent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {!showAddForm && <Plus size={14} />} {showAddForm ? t("salesmanLite.listings.cancel") : t("salesmanLite.listings.addListing")}
        </button>
      </div>

      {/* Page link: one quiet row (it used to be a green strip with the domain typed in). */}
      {!showAddForm && profile?.slug && liveCount > 0 && (
        <button onClick={onCopyPageLink}
          style={{ width: "100%", boxSizing: "border-box", height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", marginBottom: 14, borderRadius: P.radius.pill, background: P.card, border: "none", color: P.textSec, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <LinkIcon size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ROOT_DOMAIN}/s/{profile.slug}</span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: P.text }}>{t("salesmanLite.listings.copyLink")}</span>
        </button>
      )}

      {addForm}

      {myListings.length > 0 && !showAddForm && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", minWidth: 0, maxWidth: "100%" }}>
            {STATUS_TABS.map(({ key, label, count }) => {
              const active = filterStatus === key;
              return (
                <button key={key} onClick={() => setFilterStatus(key)} style={pill(active)}>
                  {label}
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: active ? P.card : P.textMuted, opacity: active ? 0.7 : 1 }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
            <span style={{ fontSize: 12, color: P.textMuted, marginRight: 4 }}>{t("salesmanLite.listings.sort")}</span>
            <button style={sortBtn(sortBy === "newest")} onClick={() => setSortBy("newest")}>{t("salesmanLite.listings.sortNewest")}</button>
            <button style={sortBtn(sortBy === "price_desc")} onClick={() => setSortBy("price_desc")}>{t("salesmanLite.listings.sortPriceDesc")}</button>
            <button style={sortBtn(sortBy === "price_asc")} onClick={() => setSortBy("price_asc")}>{t("salesmanLite.listings.sortPriceAsc")}</button>
          </div>
        </div>
      )}

      {myListings.length === 0 && !showAddForm ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "52px 24px", background: P.card, borderRadius: P.radius.card, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: P.raised, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Car size={24} color={P.textMuted} />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>No listings yet</p>
          <p style={{ margin: 0, fontSize: 13, color: P.textSec, maxWidth: 260, lineHeight: 1.55 }}>Add your first car using the button above.</p>
          <button className="lk-red" onClick={onAddListing} style={{ ...redBtn, width: "auto", padding: "0 22px", height: 42, fontSize: 14 }}>+ Add Listing</button>
          <button onClick={onBackToDashboard} style={{ marginTop: 2, height: 36, padding: "0 16px", borderRadius: P.radius.pill, background: "none", border: "none", color: P.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ← Back to Dashboard
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 16px", background: P.card, borderRadius: P.radius.card, color: P.textSec, fontSize: 13 }}>
          No {filterStatus} listings.
        </div>
      ) : (
        <div onClick={() => { setStatusMenuCarId(null); setActionMenuCarId(null); }}
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
          {sorted.map(({ car, views, enqs }) => {
            const isSold = car.status === "sold";
            const isReserved = car.status === "reserved";
            const isPending = car.status === "pending_approval";
            const isRejected = car.status === "rejected";
            const isPrivate = car.status === "private";
            const isLocked = isLockedCar(car);
            const img = car.images?.[0];
            const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
            const price = car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "—";
            const disambiguator = nameCounts[name] > 1
              ? [car.colour, car.plate_number ? `Plate …${car.plate_number.slice(-4)}` : null].filter(Boolean).join(" · ")
              : null;
            const open = () => onOpenDetail(car);
            // Margin = selling minus base price (a sole seller). Shown only when both exist.
            const base = Number(car.base_price);
            const sell = Number(car.selling_price);
            const margin = base > 0 && sell > 0 ? sell - base : null;
            const copied = listingCopied[car.id];
            // State on the photo as a pill, instead of its own strip.
            const statusPill = isSold
              ? `${statusLabel("sold")}${car.sold_at ? ` · ${new Date(car.sold_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}` : ""}`
              : isReserved ? statusLabel("reserved")
              : isPending ? `${statusLabel("pending_approval")} · not visible to buyers yet`
              : isPrivate ? `${statusLabel("private")} · ${t("privateCars.onlyYou")}`
              : null;
            const photoFilter = isLocked ? "grayscale(1) brightness(0.3)" : isSold ? "grayscale(0.75) brightness(0.6)" : "none";
            return (
              <div key={car.id}
                style={{ position: "relative", zIndex: statusMenuCarId === car.id || actionMenuCarId === car.id ? 5 : undefined, background: P.card, borderRadius: P.radius.card, opacity: isSold ? 0.62 : 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
                {/* Only the top is clipped (rounded corners); clipping the card cut the status menu off. */}
                <div style={{ borderRadius: `${P.radius.card}px ${P.radius.card}px 0 0`, overflow: "hidden" }}>
                  {isRejected && (
                    <div style={{ padding: "14px 16px", background: P.hero }}>
                      <p style={eyebrow(P.accentText)}>Not approved</p>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                        {car.rejection_reason || "No reason was given. Check the details and photos, then resubmit."}
                      </p>
                      <button className="lk-red" onClick={() => onEdit(car)} style={redBtn}><Pencil size={13} /> Edit & Resubmit</button>
                    </div>
                  )}
                  {/* Locked after Premium lapsed: the photo is blacked out below. */}
                  {isLocked && (
                    <div style={{ padding: "14px 16px", background: P.raised }}>
                      <p style={{ ...eyebrow(P.textSec), display: "flex", alignItems: "center", gap: 6 }}><Lock size={12} /> {t("premiumLapse.lockedTitle")}</p>
                      <p style={{ margin: 0, fontSize: 13, color: P.textSec, lineHeight: 1.45 }}>{t("premiumLapse.lockedBody", { cap: lockedCap })}</p>
                      <button className="lk-red" onClick={onPremium} style={redBtn}>{t("premiumLapse.lockedCta")}</button>
                    </div>
                  )}
                  <div onClick={open} style={{ position: "relative", cursor: "pointer" }}>
                    {img
                      ? <img src={img} alt={name} style={{ display: "block", width: "100%", height: 160, objectFit: "cover", filter: photoFilter }} />
                      : <div style={{ width: "100%", height: 160, background: P.raised, display: "flex", alignItems: "center", justifyContent: "center", filter: photoFilter }}><Car size={32} color={P.textMuted} /></div>}
                    {statusPill && (
                      <span style={{ position: "absolute", top: 10, left: 10, maxWidth: "calc(100% - 20px)", padding: "4px 10px", borderRadius: P.radius.pill, background: "rgba(8,9,12,0.82)", color: P.text, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {statusPill}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Title + status menu */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <p onClick={open} style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, flex: 1, minWidth: 0, cursor: "pointer", color: isSold ? P.textSec : P.text }}>
                      {name}
                      {disambiguator && <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: P.textMuted, marginTop: 2 }}>{disambiguator}</span>}
                    </p>
                    {/* Pending / rejected: the state is said above, a disabled pill would contradict it. */}
                    {!isPending && !isRejected && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {(() => {
                          const cur = normStatus(car.status || "available");
                          const menuOpen = statusMenuCarId === car.id;
                          return (
                            <button onClick={(e) => { e.stopPropagation(); setStatusMenuCarId(menuOpen ? null : car.id); }} title="Change listing status"
                              style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 8px 0 11px", borderRadius: P.radius.pill, background: menuOpen ? P.hover : P.raised, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotOf(cur), flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: P.text }}>{isLocked ? t("premiumLapse.lockedTitle") : statusLabel(cur)}</span>
                              <ChevronDown size={13} color={P.textSec} style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                            </button>
                          );
                        })()}
                        {statusMenuCarId === car.id && (
                          <div onClick={(e) => e.stopPropagation()} style={{ ...menuBox, minWidth: 170, top: "calc(100% + 6px)" }}>
                            <p style={{ margin: 0, padding: "10px 14px 6px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.textMuted }}>Set this listing to</p>
                            {[
                              { key: "available", label: "Available", hint: "Live for buyers" },
                              { key: "reserved", label: "Reserved", hint: "Deposit / on hold" },
                              { key: "sold", label: "Sold", hint: "Deal closed" },
                              ...(isPrivate || privateCount(myListings) < PRIVATE_CAR_LIMIT
                                ? [{ key: "private", label: t("privateCars.label"), hint: t("privateCars.hint", { n: PRIVATE_CAR_LIMIT }) }] : []),
                            ].map(({ key, label, hint }) => {
                              const active = normStatus(car.status || "available") === key;
                              return (
                                <button key={key} onClick={() => updateListingStatus(car, key)} style={{ ...menuItem, background: active ? P.raised : "none" }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotOf(key), flexShrink: 0 }} />
                                  <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{label}</span>
                                    <span style={{ fontSize: 11.5, color: P.textMuted }}>{hint}</span>
                                  </span>
                                  {active && <Check size={14} color={P.up} style={{ flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price + margin on one line */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: isSold ? P.textSec : P.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{price}</span>
                    {margin != null && (
                      <span style={{ fontSize: 12, color: P.textMuted }}>
                        My margin: <span style={{ fontWeight: 600, color: margin >= 0 ? P.up : P.accentText, fontVariantNumeric: "tabular-nums" }}>RM {margin.toLocaleString()}</span>
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "0 0 10px", minHeight: 17, fontSize: 12, color: P.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[
                      car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
                      car.engine_cc ? `${Number(car.engine_cc).toLocaleString()}cc` : null,
                      car.transmission,
                      car.colour,
                    ].filter(Boolean).join(" · ")}
                  </p>

                  {/* Traffic as facts, then the ONE next step (COACH-1). */}
                  {!isSold && !isRejected && !isPending && !isLocked && (
                    <p style={{ margin: "0 0 10px", fontSize: 12.5, color: P.textSec, fontVariantNumeric: "tabular-nums" }}>
                      <strong style={{ color: P.text, fontWeight: 600 }}>{views}</strong> views · <strong style={{ color: P.text, fontWeight: 600 }}>{enqs}</strong> enquiries
                    </p>
                  )}
                  {!isLocked && (
                    <CarNextStep
                      step={coachFor(car)} car={car} lang={i18n.language}
                      colors={{ text: P.text, sub: P.textSec, accent: P.accent, onAccent: P.onAccent, soft: P.raised, line: P.line }}
                      onAction={onCoach}
                    />
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
                    {isSold || isRejected ? (
                      // Rejected: Edit & Resubmit is in the notice at the top.
                      <button onClick={open} style={{ ...cardBtn, color: P.textSec }}>View</button>
                    ) : isPending ? (
                      <>
                        <button onClick={open} style={{ ...cardBtn, color: P.textSec }}>View</button>
                        <button onClick={() => onEdit(car)} style={cardBtn}><Pencil size={12} /> Edit</button>
                      </>
                    ) : (
                      <>
                        {/* A private car has no public page to link to. data-share-car = the COACH-1 share tour's ring. */}
                        {!isPrivate && (
                          <button data-share-car={car.id} onClick={() => handleListingCopy(car, "link")} title="Copy link" style={{ ...cardBtn, color: copied === "link" ? P.up : P.text }}>
                            <LinkIcon size={12} /> {copied === "link" ? "Copied" : "Link"}
                          </button>
                        )}
                        <button onClick={() => handleListingCopy(car, "wa")} title="Copy caption" style={{ ...cardBtn, color: copied === "wa" ? P.up : P.text }}>
                          <ClipboardPen size={12} /> {copied === "wa" ? "Copied" : "Caption"}
                        </button>
                        <button onClick={() => onEdit(car)} style={cardBtn}><Pencil size={12} /> Edit</button>
                      </>
                    )}

                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); setActionMenuCarId(actionMenuCarId === car.id ? null : car.id); setConfirmDeleteId(null); }}
                        title="More actions" aria-label="More actions"
                        style={{ width: 36, height: 36, borderRadius: P.radius.row, background: P.raised, border: "none", color: P.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, letterSpacing: 1 }}>
                        ···
                      </button>
                      {actionMenuCarId === car.id && (
                        <div onClick={(e) => e.stopPropagation()} style={{ ...menuBox, bottom: "calc(100% + 6px)" }}>
                          {!isSold && (
                            <>
                              <button onClick={() => { onBrief(car); setActionMenuCarId(null); }} style={menuItem}><FileText size={13} /> Brief</button>
                              {/* Loan poster: free on Lite for 4 cars a month (claim_loan_poster). */}
                              <button onClick={() => { onPoster(car); setActionMenuCarId(null); }} style={menuItem}><Calculator size={13} /> Loan poster</button>
                              {/* Studio is Premium: shown locked, the tap goes to the one upgrade screen. */}
                              <button className="lk-prem-in" onClick={() => { setActionMenuCarId(null); onPremium(); }} style={{ ...menuItem, color: P.text }}>
                                <Film size={13} />
                                <span style={{ flex: 1 }}>TikTok post</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: P.textMuted, background: P.raised, borderRadius: P.radius.pill, padding: "2px 7px" }}>
                                  <Lock size={9} strokeWidth={2.5} /> Premium
                                </span>
                              </button>
                              {menuRule}
                            </>
                          )}
                          {Array.isArray(car.images) && car.images.length > 0 && (
                            <>
                              <button onClick={() => { downloadListingImages(car); setActionMenuCarId(null); }} style={menuItem}><Download size={13} /> Download photos</button>
                              {menuRule}
                            </>
                          )}
                          {confirmDeleteId === car.id ? (
                            <div style={{ padding: "8px 10px", display: "flex", gap: 6 }}>
                              <button onClick={() => handleDeleteListing(car.id)} disabled={deletingId === car.id}
                                style={{ flex: 1, height: 32, fontSize: 12.5, borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, cursor: deletingId === car.id ? "wait" : "pointer", opacity: deletingId === car.id ? 0.6 : 1, fontWeight: 600, fontFamily: "inherit" }}>
                                {deletingId === car.id ? "Deleting..." : "Delete"}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, height: 32, fontSize: 12.5, borderRadius: P.radius.pill, background: P.raised, border: "none", color: P.textSec, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(car.id)} style={{ ...menuItem, color: P.accentText }}><Trash2 size={13} /> Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

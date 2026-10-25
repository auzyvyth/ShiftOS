import React from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import {
 Calculator, Car, Check, ChevronDown, Clock, Download, Flame, Link as LinkIcon,
 Film, Megaphone, Pencil, Plus, Sparkles, Trash2,
} from "lucide-react";
// Both forms load when they open, not with the Listings tab.
const CarFormFast = React.lazy(() => import("../../components/CarFormFast"));
const CarForm = React.lazy(() => import("../../components/CarForm"));
import VerifyBadgePrompt from "../../components/kyc/VerifyBadgePrompt";
import { premiumDark as P } from "../../theme/tokens";
import { ListingFormModal, tp } from "./shared";

// Lazy-load JSZip from CDN once, only when a salesman actually downloads photos.
let _jszipPromise = null;
function loadJSZip() {
 if (window.JSZip) return Promise.resolve(window.JSZip);
 if (_jszipPromise) return _jszipPromise;
 _jszipPromise = new Promise((res, rej) => {
 const s = document.createElement("script");
 s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
 s.onload = () => res(window.JSZip);
 s.onerror = rej;
 document.body.appendChild(s);
 });
 return _jszipPromise;
}

const downloadListingImages = async (car) => {
 const imgs = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
 if (imgs.length === 0) { toast.error(tp("lst.noImages")); return; }
 const base = [car.year, car.brand, car.model].filter(Boolean).join("-").replace(/\s+/g, "-") || "car";
 if (imgs.length === 1) {
 try {
 const resp = await fetch(imgs[0]);
 const blob = await resp.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 const ext = ((blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")).split("+")[0];
 a.href = url; a.download = `${base}.${ext}`;
 document.body.appendChild(a); a.click(); a.remove();
 URL.revokeObjectURL(url);
 toast.success(tp("lst.savedPhoto"));
 } catch { toast.error(tp("lst.downloadFail")); }
 return;
 }
 const tId = toast.loading(tp("lst.zipping", { n: imgs.length }));
 try {
 const JSZip = await loadJSZip();
 const zip = new JSZip();
 let ok = 0;
 await Promise.all(imgs.map(async (src, i) => {
 try {
 const resp = await fetch(src);
 const blob = await resp.blob();
 const ext = ((blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")).split("+")[0];
 zip.file(`${base}-${i + 1}.${ext}`, blob);
 ok++;
 } catch { /* skip a failed image */ }
 }));
 if (ok === 0) { toast.error(tp("lst.downloadFail"), { id: tId }); return; }
 const out = await zip.generateAsync({ type: "blob" });
 const url = URL.createObjectURL(out);
 const a = document.createElement("a");
 a.href = url; a.download = `${base}-photos.zip`;
 document.body.appendChild(a); a.click(); a.remove();
 URL.revokeObjectURL(url);
 toast.success(tp("lst.savedZip", { count: ok }), { id: tId });
 } catch {
 toast.error(tp("lst.zipFail"), { id: tId });
 }
};

// Listings tab — split out of SalesmanPremium.jsx (was `renderListings`) so it
// lazy-loads instead of shipping in the initial bundle. The car-detail popup
// this tab opens now lives in src/components/CarDetailPopup.jsx, shared with
// SalesmanLite.
// Rebuilt 2026-10-25 (SIMPLE-2) in the `premiumDark` palette, one fact once:
// the "Live on XDrive" strip on every card (the Available tab already says it,
// and it repeated the view count), the page-link bar (Dashboard > Your page
// has it), the average-quality banner and the separate photo nudge (the card's
// one "improve" line names the first fix, photos first) all went. Link moved
// into ···; Caption + Edit stay on the card.
export default function ListingsTab({
 onOpenNewCars,
 myListings, carStatsMap, filterStatus, sortBy, listingCopied, showAddForm, showFastForm,
 statusMenuCarId, actionMenuCarId, confirmDeleteId, profile, isMobile,
 setMyListings, setFilterStatus, setSortBy, setShowAddForm, setShowFastForm,
 setStatusMenuCarId, setActionMenuCarId, setConfirmDeleteId, setEditListing,
 setSelectedCar, setCarDetailImgIdx, setCarDetailTab,
 listingScore, updateListingStatus, handleDeleteListing, deletingId, handleListingCopy, openBroadcast,
 generateAiCaptions, onVerifyId, openStudio, openLoanPoster,
}) {
 const { t, i18n } = useTranslation();
 const dateLocale = i18n.language?.startsWith("ms") ? "ms-MY" : "en-MY";
 const statusLabel = (st) => t(`salesmanPremium.lst.status.${st}`, { defaultValue: st });
 const enriched = myListings.map((car) => {
 const stats = carStatsMap[car.id] ?? {};
 const views = stats.views || 0;
 const enqs = stats.enquiries || 0;
 const cvr = views > 0 ? (enqs / views) * 100 : null;
 const isHot = cvr !== null && cvr > 6 && views > 3;
 const isStale = views > 10 && (cvr === null || cvr === 0);
 return { car, views, enqs, isHot, isStale };
 });

 const normStatus = (s) => {
 if (!s || s === "active") return "available";
 return s;
 };
 const filtered = enriched.filter((e) => normStatus(e.car.status) === filterStatus);

 const sorted = [...filtered].sort((a, b) => {
 if (sortBy === "price_desc") return (b.car.selling_price || 0) - (a.car.selling_price || 0);
 if (sortBy === "price_asc") return (a.car.selling_price || 0) - (b.car.selling_price || 0);
 if (sortBy === "oldest") return new Date(a.car.created_at) - new Date(b.car.created_at);
 return new Date(b.car.created_at) - new Date(a.car.created_at); // newest (default)
 });

 // Two cars can share the exact same year/brand/model/variant — only
 // surface a disambiguator (colour / plate) on cards whose title actually
 // collides with a sibling.
 const nameCounts = {};
 sorted.forEach(({ car }) => {
 const n = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
 nameCounts[n] = (nameCounts[n] || 0) + 1;
 });

 // Pending + Not approved only get a tab while they hold a car (or are the
 // one picked): most sellers never have either, and five tabs read as work.
 const STATUS_TABS = [
 { key: "pending_approval", label: t("salesmanPremium.lst.tabPending"), count: myListings.filter((c) => c.status === "pending_approval").length, optional: true },
 { key: "rejected", label: statusLabel("rejected"), count: myListings.filter((c) => c.status === "rejected").length, optional: true },
 { key: "available", label: statusLabel("available"), count: myListings.filter((c) => (c.status || "available") === "available").length },
 { key: "reserved", label: statusLabel("reserved"), count: myListings.filter((c) => c.status === "reserved").length },
 { key: "sold", label: statusLabel("sold"), count: myListings.filter((c) => c.status === "sold").length },
 ].filter((s) => !s.optional || s.count > 0 || s.key === filterStatus);

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
 const menuBox = { position: "absolute", right: 0, zIndex: 60, background: P.hover, border: `1px solid ${P.line}`, borderRadius: P.radius.row, overflow: "hidden", minWidth: 170, boxShadow: "0 12px 32px rgba(0,0,0,0.55)" };
 const menuItem = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", background: "none", border: "none", cursor: "pointer", color: P.text, fontSize: 13, textAlign: "left", fontFamily: "inherit" };
 const menuRule = <div style={{ height: 1, background: P.line }} />;
 const dotOf = (st) => (st === "available" ? P.up : st === "reserved" ? P.textSec : P.textMuted);

 return (
 <div>
 {/* The badge is unearnable if nobody finds the upload step, and Settings is
     the screen a rep never opens. */}
 <VerifyBadgePrompt profile={profile} onStart={onVerifyId} theme="premium" />

 {/* Header: Quick add is the one red button; the full form sits beside it. */}
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
 <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: P.text, letterSpacing: "-0.01em" }}>
 {t("salesmanPremium.lst.title", { n: myListings.length })}
 </p>
 <div style={{ display: "flex", gap: 8 }}>
 <button
 data-tour-id="lst-fast"
 onClick={() => { setShowFastForm(true); setShowAddForm(false); }}
 style={{ height: 40, padding: "0 16px", borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
 >
 {t("salesmanPremium.lst.fast")}
 </button>
 <button
 data-tour-id="lst-full"
 onClick={() => { setShowAddForm(true); setShowFastForm(false); }}
 style={{ height: 40, padding: "0 16px", borderRadius: P.radius.pill, background: P.raised, border: "none", color: P.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
 >
 <Plus size={14} /> {t("salesmanPremium.lst.fullForm")}
 </button>
 </div>
 </div>

 <ListingFormModal
 open={showFastForm}
 onClose={() => setShowFastForm(false)}
 title={t("salesmanPremium.lst.fastTitle")}
 subtitle={t("salesmanPremium.lst.fastSub")}
 isMobile={isMobile}
 >
 <React.Suspense fallback={<p style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>{t("salesmanPremium.common.loading")}</p>}>
 <CarFormFast
 sellerProfile={profile}
 onOpenNewCars={onOpenNewCars}
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowFastForm(false);
 toast.success(t("salesmanPremium.lst.listedFast"));
 }}
 />
 </React.Suspense>
 </ListingFormModal>

 <ListingFormModal
 open={showAddForm}
 onClose={() => setShowAddForm(false)}
 title={t("salesmanPremium.lst.newTitle")}
 subtitle={t("salesmanPremium.lst.newSub")}
 isMobile={isMobile}
 >
 <React.Suspense fallback={<p style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>{t("salesmanPremium.common.loading")}</p>}>
 <CarForm
 dark
 sellerProfile={profile}
 onOpenNewCars={onOpenNewCars}
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowAddForm(false);
 toast.success(t("salesmanPremium.lst.published"));
 }}
 />
 </React.Suspense>
 </ListingFormModal>

 {myListings.length > 0 && (
 <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
 {/* Status pills */}
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
 {/* Sort */}
 <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
 <span style={{ fontSize: 12, color: P.textMuted, marginRight: 4 }}>{t("salesmanPremium.lst.sort")}</span>
 <button style={sortBtn(sortBy === "newest")} onClick={() => setSortBy("newest")}>{t("salesmanPremium.lst.newest")}</button>
 <button style={sortBtn(sortBy === "price_desc")} onClick={() => setSortBy("price_desc")}>{t("salesmanPremium.lst.price")} ↓</button>
 <button style={sortBtn(sortBy === "price_asc")} onClick={() => setSortBy("price_asc")}>{t("salesmanPremium.lst.price")} ↑</button>
 </div>
 </div>
 )}

 {myListings.length === 0 ? (
 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "52px 24px", background: P.card, borderRadius: P.radius.card, textAlign: "center" }}>
 <div style={{ width: 52, height: 52, borderRadius: "50%", background: P.raised, display: "flex", alignItems: "center", justifyContent: "center" }}>
 <Car size={24} color={P.textMuted} />
 </div>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.text }}>{t("salesmanPremium.lst.emptyTitle")}</p>
 <p style={{ margin: 0, fontSize: 13, color: P.textSec, maxWidth: 280, lineHeight: 1.55 }}>{t("salesmanPremium.lst.emptyBody")}</p>
 </div>
 ) : sorted.length === 0 ? (
 <div style={{ textAlign: "center", padding: "36px 16px", background: P.card, borderRadius: P.radius.card, color: P.textSec, fontSize: 13 }}>
 {t("salesmanPremium.lst.noneInStatus", { status: statusLabel(filterStatus).toLowerCase() })}
 </div>
 ) : (
 <div
 onClick={() => { setStatusMenuCarId(null); setActionMenuCarId(null); }}
 style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}
 >
 {sorted.map(({ car, views, enqs: enquiries, isHot, isStale }) => {
 const isSold = car.status === "sold";
 const isReserved = car.status === "reserved";
 const isPending = car.status === "pending_approval";
 const isRejected = car.status === "rejected";
 const isLive = !isSold && !isReserved && !isPending && !isRejected;
 const img = car.images?.[0];
 const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
 const price = car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "—";
 const disambiguator = nameCounts[name] > 1
 ? [car.colour, car.plate_number ? t("salesmanPremium.lst.plate", { last: car.plate_number.slice(-4) }) : null].filter(Boolean).join(" · ")
 : null;
 // Included services sold with the car (car_listings.included_services:
 // [{ name, category, cost, selling_price }]). Shown as an INLINE marker in
 // the meta row below, never as its own row — the house rule here is that a
 // card with add-ons must not be taller, nor push its own text lower, than a
 // card without them.
 const addOns = Array.isArray(car.included_services) ? car.included_services.filter(Boolean) : [];
 const openDetail = () => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); };
 // My margin — a sole seller, so selling price minus base price. Hidden
 // when either is missing: a "—" on every card was noise.
 const base = Number(car.base_price);
 const sell = Number(car.selling_price);
 const margin = base > 0 && sell > 0 ? sell - base : null;
 const score = !isSold && !isRejected ? listingScore(car) : null;
 const copied = listingCopied[car.id];
 const statusPill = isSold
 ? `${statusLabel("sold")}${car.sold_at ? ` · ${new Date(car.sold_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}` : ""}`
 : isReserved ? statusLabel("reserved")
 : isPending ? `${statusLabel("pending_approval")} · ${t("salesmanPremium.lst.notVisible")}`
 : null;
 return (
 <div
 key={car.id}
 style={{ background: P.card, borderRadius: P.radius.card, overflow: "hidden", opacity: isSold ? 0.62 : 1, display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}
 >
 {/* Rejected — the reason is the first thing on the card: it is the
     only thing the seller needs to act on. */}
 {isRejected && (
 <div style={{ padding: "14px 16px", background: P.hero }}>
 <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.accentText }}>{t("salesmanPremium.lst.notApproved")}</p>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.text, lineHeight: 1.4 }}>
 {car.rejection_reason || t("salesmanPremium.lst.noReason")}
 </p>
 <button onClick={() => setEditListing(car)} style={{ marginTop: 12, width: "100%", height: 38, fontSize: 13, fontWeight: 600, borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
 <Pencil size={13} /> {t("salesmanPremium.lst.editResubmit")}
 </button>
 </div>
 )}

 {/* Photo, with the state on it as a pill instead of its own strip */}
 <div onClick={openDetail} style={{ position: "relative", cursor: "pointer" }}>
 {img ? (
 <img src={img} alt={name} style={{ display: "block", width: "100%", height: 160, objectFit: "cover", filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none" }} />
 ) : (
 <div style={{ width: "100%", height: 160, background: P.raised, display: "flex", alignItems: "center", justifyContent: "center" }}>
 <Car size={32} color={P.textMuted} />
 </div>
 )}
 {statusPill && (
 <span style={{ position: "absolute", top: 10, left: 10, maxWidth: "calc(100% - 20px)", padding: "4px 10px", borderRadius: P.radius.pill, background: "rgba(8,9,12,0.82)", color: P.text, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
 {statusPill}
 </span>
 )}
 </div>

 <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
 {/* Title + status dropdown */}
 <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
 <p onClick={openDetail} style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.text, lineHeight: 1.35, flex: 1, minWidth: 0, cursor: "pointer" }}>
 {name}
 {disambiguator && (
 <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: P.textMuted, marginTop: 2 }}>{disambiguator}</span>
 )}
 </p>
 {/* Locked (pending / rejected): the state is already said on the
     card, and a disabled pill would just contradict it. */}
 {!isPending && !isRejected && (
 <div style={{ position: "relative", flexShrink: 0 }}>
 {(() => {
 const cur = normStatus(car.status || "available");
 const open = statusMenuCarId === car.id;
 return (
 <button
 onClick={(e) => { e.stopPropagation(); setStatusMenuCarId(open ? null : car.id); }}
 title={t("salesmanPremium.lst.changeStatus")}
 style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 8px 0 11px", borderRadius: P.radius.pill, background: open ? P.hover : P.raised, border: "none", cursor: "pointer", fontFamily: "inherit" }}
 >
 <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotOf(cur), flexShrink: 0 }} />
 <span style={{ fontSize: 12, fontWeight: 600, color: P.text }}>{statusLabel(car.status || "available")}</span>
 <ChevronDown size={13} color={P.textSec} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
 </button>
 );
 })()}
 {statusMenuCarId === car.id && (
 <div onClick={(e) => e.stopPropagation()} style={{ ...menuBox, top: "calc(100% + 6px)" }}>
 <p style={{ margin: 0, padding: "10px 14px 6px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.textMuted }}>{t("salesmanPremium.lst.setTo")}</p>
 {[
 { key: "available", hint: t("salesmanPremium.lst.hintAvailable") },
 { key: "reserved", hint: t("salesmanPremium.lst.hintReserved") },
 { key: "sold", hint: t("salesmanPremium.lst.hintSold") },
 ].map(({ key, hint }) => {
 const active = normStatus(car.status || "available") === key;
 return (
 <button key={key} onClick={() => updateListingStatus(car, key)} style={{ ...menuItem, background: active ? P.raised : "none" }}>
 <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotOf(key), flexShrink: 0 }} />
 <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
 <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: P.text }}>{statusLabel(key)}</span>
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
 {t("salesmanPremium.lst.myMargin")} <span style={{ fontWeight: 600, color: margin >= 0 ? P.up : P.accentText, fontVariantNumeric: "tabular-nums" }}>RM {margin.toLocaleString()}</span>
 </span>
 )}
 </div>

 {/* Meta + add-on marker. minHeight is load-bearing: a listing with no
     mileage/engine/transmission/colour would otherwise collapse this line to
     zero and everything below it would sit higher than on its neighbours. */}
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, minHeight: 17 }}>
 <p style={{ margin: 0, fontSize: 12, color: P.textMuted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[
 car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
 car.engine_cc ? `${Number(car.engine_cc).toLocaleString()}cc` : null,
 car.transmission,
 car.colour,
 ].filter(Boolean).join(" · ")}
 </p>
 {addOns.length > 0 && (
 <span
 title={t("salesmanPremium.lst.included", { list: addOns.map(a => a?.name).filter(Boolean).join(", ") })}
 style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: P.radius.pill, background: P.raised, color: P.textSec, fontSize: 11.5, fontWeight: 600 }}
 >
 <Sparkles size={10} style={{ flexShrink: 0 }} />{addOns.length}
 </span>
 )}
 </div>

 {/* Traffic: one line. Hidden for sold, and for cars buyers can't see. */}
 {!isSold && !isRejected && !isPending && (
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: P.textSec }}>
 <span style={{ fontVariantNumeric: "tabular-nums" }}>
 <strong style={{ color: P.text, fontWeight: 600 }}>{views}</strong> {t("salesmanPremium.lst.viewsLower")} · <strong style={{ color: P.text, fontWeight: 600 }}>{enquiries}</strong> {t("salesmanPremium.lst.enquiriesLower")}
 </span>
 {isHot && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, color: P.accentText, fontWeight: 600 }}><Flame size={12} /> {t("salesmanPremium.lst.hot")}</span>}
 {isStale && !isHot && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, color: P.textMuted }}><Clock size={12} /> {t("salesmanPremium.lst.stale")}</span>}
 </div>
 )}

 {/* Improve: one line, the first fix (photos rank first), one tap. */}
 {score && score.pct < 90 && (
 <button
 onClick={() => setEditListing(car)}
 title={score.missing.length ? t("salesmanPremium.lst.improve", { list: score.missing.join(", ") }) : ""}
 style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 12, padding: "9px 12px", borderRadius: P.radius.row, background: P.raised, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
 >
 <span style={{ flex: 1, minWidth: 0 }}>
 <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: P.textSec, marginBottom: 5 }}>
 <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{score.missing[0] || t("salesmanPremium.lst.quality")}</span>
 <span style={{ fontWeight: 600, color: P.text, fontVariantNumeric: "tabular-nums", marginLeft: 8 }}>{score.pct}%</span>
 </span>
 <span style={{ display: "block", height: 3, borderRadius: P.radius.pill, background: P.hover, overflow: "hidden" }}>
 <span style={{ display: "block", height: "100%", width: `${score.pct}%`, background: P.accent, borderRadius: P.radius.pill }} />
 </span>
 </span>
 <span style={{ fontSize: 12, fontWeight: 600, color: P.text, flexShrink: 0 }}>{t("salesmanPremium.lst.fix")}</span>
 </button>
 )}

 {/* Actions: Caption + Edit, everything else behind ··· */}
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
 {isSold || isRejected ? (
 <button onClick={openDetail} style={{ ...cardBtn, color: P.textSec }}>{t("salesmanPremium.lst.view")}</button>
 ) : isPending ? (
 <>
 <button onClick={openDetail} style={{ ...cardBtn, color: P.textSec }}>{t("salesmanPremium.lst.view")}</button>
 <button onClick={() => setEditListing(car)} style={cardBtn}><Pencil size={12} /> {t("salesmanPremium.carActions.edit")}</button>
 </>
 ) : (
 <>
 <button onClick={() => handleListingCopy(car, "wa")} title={t("salesmanPremium.lst.copyCaptionTitle")} style={{ ...cardBtn, color: copied === "wa" ? P.up : P.text }}>
 {copied === "wa" ? t("salesmanPremium.lst.copied") : t("salesmanPremium.lst.caption")}
 </button>
 <button onClick={() => setEditListing(car)} style={cardBtn}><Pencil size={12} /> {t("salesmanPremium.carActions.edit")}</button>
 </>
 )}

 {/* ··· overflow — Link, Broadcast, AI Caption, posters, photos, Delete */}
 <div style={{ position: "relative", flexShrink: 0 }}>
 <button
 data-tour-id="lst-more"
 onClick={(e) => { e.stopPropagation(); setActionMenuCarId(actionMenuCarId === car.id ? null : car.id); setConfirmDeleteId(null); }}
 title={t("salesmanPremium.lst.moreActions")} aria-label={t("salesmanPremium.lst.moreActions")}
 style={{ width: 36, height: 36, borderRadius: P.radius.row, background: P.raised, border: "none", color: P.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, letterSpacing: 1 }}
 >
 ···
 </button>
 {actionMenuCarId === car.id && (
 <div onClick={(e) => e.stopPropagation()} style={{ ...menuBox, bottom: "calc(100% + 6px)" }}>
 {isLive && (
 <button onClick={() => { handleListingCopy(car, "link"); setActionMenuCarId(null); }} title={t("salesmanPremium.lst.copyLinkTitle")} style={menuItem}>
 <LinkIcon size={13} /> {t("salesmanPremium.carActions.copyLink")}
 </button>
 )}
 {!isSold && (
 <>
 <button onClick={() => { openBroadcast(car); setActionMenuCarId(null); }} style={menuItem}>
 <Megaphone size={13} /> {t("salesmanPremium.carActions.broadcast")}
 </button>
 <button onClick={() => { generateAiCaptions(car); setActionMenuCarId(null); }} style={menuItem}>
 <Sparkles size={13} /> {t("salesmanPremium.carActions.aiCaption")}
 </button>
 {openLoanPoster && (
 <button data-tour-id="lst-poster" onClick={() => { openLoanPoster(car); setActionMenuCarId(null); }} style={menuItem}>
 <Calculator size={13} /> {t("salesmanPremium.lst.loanPoster")}
 </button>
 )}
 {/* Studio: TikTok poster from this car. Post-list only, and it
     never writes back to the listing, so the listing photos stay clean. */}
 <button onClick={() => { openStudio(car); setActionMenuCarId(null); }} style={menuItem}>
 <Film size={13} /> {t("salesmanPremium.lst.tiktokPost")}
 </button>
 {menuRule}
 </>
 )}
 {Array.isArray(car.images) && car.images.length > 0 && (
 <>
 <button onClick={() => { downloadListingImages(car); setActionMenuCarId(null); }} style={menuItem}>
 <Download size={13} /> {t("salesmanPremium.lst.downloadPhotos")}
 </button>
 {menuRule}
 </>
 )}
 {confirmDeleteId === car.id ? (
 <div style={{ padding: "8px 10px", display: "flex", gap: 6 }}>
 <button onClick={() => handleDeleteListing(car.id)} disabled={deletingId === car.id} style={{ flex: 1, height: 32, fontSize: 12.5, borderRadius: P.radius.pill, background: P.accent, border: "none", color: P.onAccent, cursor: deletingId === car.id ? "wait" : "pointer", opacity: deletingId === car.id ? 0.6 : 1, fontWeight: 600, fontFamily: "inherit" }}>{deletingId === car.id ? t("salesmanPremium.common.deleting") : t("salesmanPremium.common.delete")}</button>
 <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, height: 32, fontSize: 12.5, borderRadius: P.radius.pill, background: P.raised, border: "none", color: P.textSec, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanPremium.common.cancel")}</button>
 </div>
 ) : (
 <button onClick={() => setConfirmDeleteId(car.id)} style={{ ...menuItem, color: P.accentText }}>
 <Trash2 size={13} /> {t("salesmanPremium.common.delete")}
 </button>
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

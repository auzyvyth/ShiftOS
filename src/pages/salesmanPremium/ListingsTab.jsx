import React from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import {
 BarChart2, Camera, Car, Check, ChevronDown, Clock, Copy, Download, Flame, Link as LinkIcon,
 Megaphone, Pencil, Plus, Sparkles, Store, Trash2, X,
} from "lucide-react";
import CarFormFast from "../../components/CarFormFast";
import CarForm from "../../components/CarForm";
import VerifyBadgePrompt from "../../components/kyc/VerifyBadgePrompt";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import { priceStyle, SOFT, ListingFormModal } from "./shared";

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
 if (imgs.length === 0) { toast.error("No images on this listing"); return; }
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
 toast.success("Saved photo");
 } catch { toast.error("Couldn't download image"); }
 return;
 }
 const tId = toast.loading(`Zipping ${imgs.length} photos…`);
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
 if (ok === 0) { toast.error("Couldn't download images", { id: tId }); return; }
 const out = await zip.generateAsync({ type: "blob" });
 const url = URL.createObjectURL(out);
 const a = document.createElement("a");
 a.href = url; a.download = `${base}-photos.zip`;
 document.body.appendChild(a); a.click(); a.remove();
 URL.revokeObjectURL(url);
 toast.success(`Saved ${ok} photo${ok > 1 ? "s" : ""} as zip`, { id: tId });
 } catch {
 toast.error("Couldn't build zip", { id: tId });
 }
};

// Listings tab — split out of SalesmanPremium.jsx (was `renderListings`) so it
// lazy-loads instead of shipping in the initial bundle. The car-detail popup
// this tab opens now lives in src/components/CarDetailPopup.jsx, shared with
// SalesmanLite.
export default function ListingsTab({
 myListings, carStatsMap, filterStatus, sortBy, listingCopied, showAddForm, showFastForm,
 statusMenuCarId, actionMenuCarId, confirmDeleteId, cvrHover, profile, isMobile,
 setMyListings, setFilterStatus, setSortBy, setShowAddForm, setShowFastForm,
 setStatusMenuCarId, setActionMenuCarId, setConfirmDeleteId, setCvrHover, setEditListing,
 setSelectedCar, setCarDetailImgIdx, setCarDetailTab,
 listingScore, updateListingStatus, handleDeleteListing, handleListingCopy, openBroadcast,
 generateAiCaptions, onVerifyId,
}) {
 const enriched = myListings.map((car) => {
 const stats = carStatsMap[car.id]?? {};
 const views = stats.views || 0;
 const enqs = stats.enquiries || 0;
 const cvr = views > 0? (enqs / views) * 100 : null;
 const isHot = cvr!== null && cvr > 6 && views > 3;
 const isStale = views > 10 && (cvr === null || cvr === 0);
 return { car, views, enqs, cvr, isHot, isStale };
 });

 const hotCount = enriched.filter((e) => e.isHot).length;
 const staleCount = enriched.filter((e) => e.isStale).length;

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

 const SEL_STYLE = (active) => ({
 fontSize: T.size.sm,
 padding: "5px 11px",
 borderRadius: R.sm,
 cursor: "pointer",
 background: active ? withAlpha(C.accent, 0.12) : C.line,
 border: active ? `1px solid ${withAlpha(C.accent, 0.3)}` : `1px solid ${C.border}`,
 color: active ? C.dangerText : C.textMuted,
 fontWeight: active ? T.weight.semibold : T.weight.normal,
 });

 return (
 <div>
 {/* The badge is unearnable if nobody finds the upload step, and Settings is
     the screen a rep never opens. */}
 <VerifyBadgePrompt profile={profile} onStart={onVerifyId} />

 {/* Header row with Add button */}
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 12,
 }}
 >
 <p
 style={{
 margin: 0,
 fontSize: 16,
 fontWeight: 600,
 color: "#f1f5f9",
 }}
 >My Listings ({myListings.length})
 </p>
 <div style={{ display: "flex", gap: 7 }}>
 <button
 onClick={() => { setShowFastForm(true); setShowAddForm(false); }}
 style={{ display: "flex", alignItems: "center", gap: 5, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, padding: "7px 12px", cursor: "pointer" }}
 >
 Fast
 </button>
 <button
 onClick={() => { setShowAddForm(true); setShowFastForm(false); }}
 style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}
 >
 <Plus size={13} /> Full Form
 </button>
 </div>
 </div>

 <ListingFormModal
 open={showFastForm}
 onClose={() => setShowFastForm(false)}
 title="Fast List"
 subtitle="2 steps, live in 30 seconds"
 isMobile={isMobile}
 >
 <CarFormFast
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowFastForm(false);
 toast.success("Listed! Add more details anytime.");
 }}
 />
 </ListingFormModal>

 <ListingFormModal
 open={showAddForm}
 onClose={() => setShowAddForm(false)}
 title="New Listing"
 subtitle="Full form — every spec, photo and price field"
 isMobile={isMobile}
 >
 <CarForm
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowAddForm(false);
 toast.success("Listing published!");
 }}
 />
 </ListingFormModal>

 {/* Store exposure bar */}
 {profile?.slug && myListings.filter(c => c.status === "available").length > 0 && (
 <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", padding: "7px 12px", borderRadius: R.md, background: withAlpha(C.success, 0.04), border: `1px solid ${withAlpha(C.success, 0.13)}` }}>
 <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.success, flexShrink: 0 }} />
 <span style={{ fontSize: T.size.xs, color: C.textMuted, flex: 1 }}>
 Your listings are <strong style={{ color: C.success }}>live on XDrive</strong> — buyers can find you at xdrive.my/s/{profile.slug}
 </span>
 <button
 onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success("Link copied!"); }}
 style={{ ...SOFT(C.success), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, whiteSpace: "nowrap", fontFamily: "inherit" }}
 >
 Copy Link
 </button>
 </div>
 )}

 {/* Listing quality banner */}
 {myListings.filter(c => c.status === "available").length > 0 && (() => {
 const scores = myListings.filter(c => c.status === "available").map(c => listingScore(c).pct);
 const avg = Math.round(scores.reduce((s, p) => s + p, 0) / scores.length);
 if (avg >= 80) return null;
 return (
 <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "9px 14px", borderRadius: R.md, background: withAlpha(C.warn, 0.04), border: `1px solid ${withAlpha(C.warn, 0.15)}` }}>
 <BarChart2 size={13} style={{ flexShrink: 0, color: C.warnText }} />
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec, flex: 1 }}>Your listings average <strong style={{ color: C.warnText }}>{avg}% quality</strong>. Complete listings get 3× more views.</p>
 </div>
 );
 })()}

 {myListings.length > 0 && (
 <>
 {/* Status tabs */}
 <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
 <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
 {[
 { key: "pending_approval", label: "Pending", count: myListings.filter((c) => c.status === "pending_approval").length },
 { key: "rejected", label: "Rejected", count: myListings.filter((c) => c.status === "rejected").length },
 { key: "available", label: "Available", count: myListings.filter((c) => (c.status || "available") === "available").length },
 { key: "reserved", label: "Reserved", count: myListings.filter((c) => c.status === "reserved").length },
 { key: "sold", label: "Sold", count: myListings.filter((c) => c.status === "sold").length },
 ].map(({ key, label, count }) => (
 <button
 key={key}
 onClick={() => setFilterStatus(key)}
 style={{
 background: "none", border: "none", cursor: "pointer",
 padding: "10px 13px", fontSize: T.size.base,
 fontWeight: filterStatus === key ? T.weight.semibold : T.weight.normal,
 fontFamily: "inherit",
 color: filterStatus === key ? C.text : C.textDim,
 borderBottom: filterStatus === key ? `2px solid ${C.accent}` : "2px solid transparent",
 marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
 transition: "color 0.15s", whiteSpace: "nowrap", flexShrink: 0,
 }}
 >
 {label}
 <span style={{
 fontSize: T.size.sm, fontWeight: T.weight.bold, padding: "1px 6px", borderRadius: 4, lineHeight: 1.6,
 background: filterStatus === key ? withAlpha(C.accent, 0.12) : C.fill,
 color: filterStatus === key ? C.dangerText : C.textDim,
 }}>
 {count}
 </span>
 </button>
 ))}
 </div>
 </div>

 {/* Sort row */}
 <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0 14px" }}>
 <span style={{ fontSize: T.size.sm, color: C.textDim, marginRight: 2 }}>Sort:</span>
 <button style={SEL_STYLE(sortBy === "newest")} onClick={() => setSortBy("newest")}>Newest</button>
 <button style={SEL_STYLE(sortBy === "price_desc")} onClick={() => setSortBy("price_desc")}>Price ↓</button>
 <button style={SEL_STYLE(sortBy === "price_asc")} onClick={() => setSortBy("price_asc")}>Price ↑</button>
 {hotCount > 0 && (
 <span style={{ fontSize: T.size.sm, color: C.danger, fontWeight: T.weight.semibold, marginLeft: "auto" }}>{hotCount} hot</span>
 )}
 {staleCount > 0 && (
 <span style={{ fontSize: T.size.sm, color: C.textMuted, fontWeight: T.weight.medium }}>{staleCount} stale</span>
 )}
 </div>
 </>
 )}

 {myListings.length === 0? (
 <div
 style={{
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 justifyContent: "center",
 gap: 12,
 padding: "52px 24px",
 background: "#0d1117",
 border: "1px dashed rgba(255,255,255,0.1)",
 borderRadius: 14,
 }}
 >
 <div
 style={{
 width: 52,
 height: 52,
 borderRadius: "50%",
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.08)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <Car size={24} color="#374151" />
 </div>
 <p
 style={{
 margin: 0,
 fontSize: 15,
 fontWeight: 600,
 color: "#4b5563",
 }}
 >No listings yet
 </p>
 <p
 style={{
 margin: 0,
 fontSize: 12,
 color: "#374151",
 textAlign: "center",
 maxWidth: 260,
 lineHeight: 1.6,
 }}
 >Add your first car using the button above.
 </p>
 </div>
 ) : sorted.length === 0? (
 <div
 style={{
 textAlign: "center",
 padding: "32px 0",
 color: "#374151",
 fontSize: 13,
 }}
 >No {filterStatus} listings.
 </div>
 ) : (
 <div
 onClick={() => { setStatusMenuCarId(null); setActionMenuCarId(null); }}
 style={{
 display: "grid",
 gridTemplateColumns: isMobile
? "1fr"
 : "repeat(auto-fill,minmax(260px,1fr))",
 gap: 14,
 }}
 >
 {sorted.map(({ car, views, enqs: enquiries, cvr, isHot, isStale }) => {
 const isSold = car.status === "sold";
 const isReserved = car.status === "reserved";
 const isPending = car.status === "pending_approval";
 const isRejected = car.status === "rejected";
 const cvrFill = cvr !== null ? Math.min(cvr * 10, 100) : 0;
 const img = car.images?.[0];
 const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
 const price = car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "—";
 const disambiguator = nameCounts[name] > 1
 ? [car.colour, car.plate_number ? `Plate …${car.plate_number.slice(-4)}` : null].filter(Boolean).join(" · ")
 : null;
 const cvrLabel = cvr !== null ? cvr.toFixed(1) : "0";
 const isHovering = cvrHover === car.id;
 // Included services sold with the car (car_listings.included_services:
 // [{ name, category, cost, selling_price }]). Shown as an INLINE marker in
 // the meta row below, never as its own row — the house rule here is that a
 // card with add-ons must not be taller, nor push its own text lower, than a
 // card without them.
 const addOns = Array.isArray(car.included_services) ? car.included_services.filter(Boolean) : [];
 const openDetail = () => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); };
 return (
 <div
 key={car.id}
 style={{
 background: C.surface,
 border: isSold ? `1px solid ${C.fillStrong}`
 : isReserved ? `1px solid ${withAlpha(C.warn, 0.22)}`
 : isPending ? `1px solid ${withAlpha(C.warn, 0.18)}`
 : isRejected ? `1px solid ${withAlpha(C.danger, 0.22)}`
 : `1px solid ${C.border}`,
 borderRadius: R.lg, overflow: "hidden", opacity: isSold ? 0.62 : 1,
 transition: "opacity 0.2s", display: "flex", flexDirection: "column", height: "100%",
 }}
 >
 {/* Image */}
 {img ? (
 <img
 src={img} alt={name} onClick={openDetail}
 style={{ width: "100%", height: 150, objectFit: "cover", cursor: "pointer", filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none" }}
 />
 ) : (
 <div
 onClick={openDetail}
 style={{ width: "100%", height: 150, background: C.fill, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none" }}
 >
 <Car size={32} color={C.textDim} />
 </div>
 )}

 {/* Status indicator — compact single-line strip */}
 {(isSold || isReserved || isPending || isRejected) && (
 <div style={{
 display: "flex", alignItems: "center", gap: 6, padding: "5px 14px",
 borderBottom: `1px solid ${isRejected ? withAlpha(C.danger, 0.18) : isSold ? withAlpha(C.textMuted, 0.15) : withAlpha(C.warn, 0.15)}`,
 background: `${isRejected ? withAlpha(C.danger, 0.05) : isSold ? withAlpha(C.textMuted, 0.07) : withAlpha(C.warn, 0.05)}`,
 }}>
 <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: isRejected ? C.dangerText : isSold ? C.textMuted : C.warnText }} />
 <span style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, color: isRejected ? C.dangerText : isSold ? C.textSec : C.warnText }}>
 {isSold ? "Sold" : isReserved ? "Reserved" : isPending ? "Pending approval" : "Rejected"}
 </span>
 {isSold && car.sold_at && (
 <span style={{ fontSize: T.size.xs, color: C.textDim }}>
 · {new Date(car.sold_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
 </span>
 )}
 {isPending && <span style={{ fontSize: T.size.xs, color: C.textMuted }}>· not visible to buyers yet</span>}
 {isRejected && car.rejection_reason && (
 <span style={{ fontSize: T.size.xs, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {car.rejection_reason}</span>
 )}
 </div>
 )}

 {/* Live on XDrive bar — only for available listings */}
 {!isSold &&!isReserved &&!isPending &&!isRejected && (
 <div style={{ background: withAlpha(C.success, 0.05), borderBottom: `1px solid ${withAlpha(C.success, 0.13)}`, padding: "5px 14px", display: "flex", alignItems: "center", gap: 6 }}>
 <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.success, flexShrink: 0 }} />
 <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.success, letterSpacing: "0.1em", textTransform: "uppercase" }}>Live on XDrive</span>
 <span style={{ marginLeft: "auto", fontSize: T.size.xs, color: C.textDim }}>{views > 0 ? `${views} view${views !== 1 ? "s" : ""}` : "accepting buyers"}</span>
 </div>
 )}

 <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
 {/* Title + status dropdown */}
 <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
 <p
 onClick={openDetail}
 style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: isSold ? C.textMuted : C.text, lineHeight: 1.3, flex: 1, marginRight: 8, cursor: "pointer" }}
 >
 {name}
 {disambiguator && (
 <span style={{ display: "block", fontSize: T.size.xs, fontWeight: T.weight.normal, color: C.textMuted, marginTop: 2 }}>{disambiguator}</span>
 )}
 </p>
 <div style={{ position: "relative", flexShrink: 0 }}>
 {(() => {
 const curStatus = normStatus(car.status || "available");
 const dotColor = curStatus === "reserved" ? C.warnText : curStatus === "sold" ? C.textSec : C.successText;
 const locked = isPending || isRejected;
 const open = statusMenuCarId === car.id;
 return (
 <button
 onClick={(e) => { e.stopPropagation(); if (locked) return; setStatusMenuCarId(open ? null : car.id); }}
 title={locked ? undefined : "Change listing status"}
 style={{
 display: "flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 9px", borderRadius: R.sm,
 background: open ? C.fillStrong : C.line, border: `1px solid ${open ? C.borderStrong : C.border}`,
 cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1,
 }}
 >
 <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
 <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.text, textTransform: "capitalize" }}>{car.status || "available"}</span>
 {!locked && <ChevronDown size={13} color={C.textSec} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
 </button>
 );
 })()}
 {!isPending &&!isRejected && statusMenuCarId === car.id && (
 <div
 onClick={(e) => e.stopPropagation()}
 style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, overflow: "hidden", minWidth: 146, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
 >
 <p style={{ margin: 0, padding: "8px 12px 6px", fontSize: T.size.xs, fontWeight: T.weight.bold, letterSpacing: T.track.label, textTransform: "uppercase", color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Set this listing to</p>
 {[
 { key: "available", label: "Available", color: C.successText, hint: "Live for buyers" },
 { key: "reserved", label: "Reserved", color: C.warnText, hint: "Deposit / on hold" },
 { key: "sold", label: "Sold", color: C.textSec, hint: "Deal closed" },
 ].map(({ key, label, color, hint }) => {
 const active = normStatus(car.status || "available") === key;
 return (
 <button
 key={key}
 onClick={() => updateListingStatus(car, key)}
 style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", background: active ? C.fillStrong : "none", border: "none", cursor: "pointer", textAlign: "left" }}
 >
 <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
 <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
 <span style={{ fontSize: T.size.base, color: active ? C.text : C.textSec, fontWeight: active ? T.weight.bold : T.weight.medium }}>{label}</span>
 <span style={{ fontSize: T.size.xs, color: C.textMuted }}>{hint}</span>
 </span>
 {active && <Check size={13} color={C.successText} style={{ flexShrink: 0 }} />}
 </button>
 );
 })}
 </div>
 )}
 </div>
 </div>

 {/* Price */}
 <p style={{ margin: "0 0 6px", lineHeight: 1, ...(isSold ? { fontSize: T.size.base, fontWeight: T.weight.bold, color: C.textDim } : priceStyle(car.selling_price)) }}>
 {price}
 </p>

 {/* My margin — you're a sole seller, no salesman under you to pay a
     commission to, so this is just selling price minus base price.
     Computed, not typed in. */}
 {(() => {
 const base = Number(car.base_price);
 const sell = Number(car.selling_price);
 const hasBoth = !isNaN(base) && base > 0 && !isNaN(sell) && sell > 0;
 const margin = hasBoth? sell - base : null;
 return (
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
 <span style={{ fontSize: T.size.xs, color: C.textDim, whiteSpace: "nowrap" }}>My margin:</span>
 <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: margin == null? C.textMuted : margin >= 0? C.successText : C.dangerText }}>
 {margin == null? "—" : `RM ${margin.toLocaleString()}`}
 </span>
 </div>
 );
 })()}

 {/* Meta + add-on marker. minHeight is load-bearing: a listing with no
     mileage/engine/transmission/colour would otherwise collapse this line to
     zero and everything below it would sit higher than on its neighbours. */}
 <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px", minHeight: 17 }}>
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textDim, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[
 car.mileage? `${Number(car.mileage).toLocaleString()} km` : null,
 car.engine_cc? `${Number(car.engine_cc).toLocaleString()}cc` : null,
 car.transmission,
 car.colour,
 ].filter(Boolean).join(" · ")}
 </p>
 {addOns.length > 0 && (
 <span
 title={`Included: ${addOns.map(a => a?.name).filter(Boolean).join(", ")}`}
 style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: R.pill, background: withAlpha(C.info, 0.1), border: `1px solid ${withAlpha(C.info, 0.22)}`, color: C.infoText, fontSize: T.size.xs, fontWeight: T.weight.semibold, lineHeight: 1.4 }}
 >
 <Sparkles size={9} style={{ flexShrink: 0 }} />{addOns.length}
 </span>
 )}
 </div>

 {/* Listing completeness bar */}
 {!isSold && (() => {
 const { pct, missing } = listingScore(car);
 if (pct >= 90) return null;
 const barColor = pct >= 70? C.warnText : C.dangerText;
 return (
 <div style={{ marginBottom: 8 }} title={missing.length? `Improve: ${missing.join(", ")}` : ""}>
 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
 <span style={{ fontSize: T.size.xs, color: C.textDim }}>Listing quality</span>
 <span style={{ fontSize: T.size.xs, color: barColor, fontWeight: T.weight.semibold }}>{pct}%</span>
 </div>
 <div style={{ height: 3, borderRadius: R.pill, background: C.fillStrong, overflow: "hidden" }}>
 <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: R.pill }} />
 </div>
 {missing.length > 0 && <p style={{ margin: "3px 0 0", fontSize: T.size.xs, color: C.textDim }}>+ {missing[0]}</p>}
 </div>
 );
 })()}

 {/* CVR bar — hidden for sold */}
 {!isSold && (
 <div style={{ marginBottom: 10, position: "relative" }} onMouseEnter={() => setCvrHover(car.id)} onMouseLeave={() => setCvrHover(null)}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
 <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>
 <span style={{ color: C.text, fontWeight: T.weight.bold }}>{views}</span> views · <span style={{ color: C.text, fontWeight: T.weight.bold }}>{enquiries}</span> enquiries
 </span>
 {isHot && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: T.size.sm, color: C.danger, fontWeight: T.weight.semibold }}><Flame size={12} /> Hot</span>}
 {isStale &&!isHot && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: T.size.sm, color: C.textSec }}><Clock size={12} /> Stale</span>}
 </div>
 <div style={{ height: 4, borderRadius: R.pill, background: C.fillStrong, overflow: "visible" }}>
 <div style={{ height: "100%", width: `${cvrFill}%`, background: isHot? C.danger : C.textDim, borderRadius: R.pill, transition: "width 0.3s" }} />
 </div>
 {isHovering && (
 <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.sm, padding: "5px 10px", fontSize: T.size.sm, color: C.text, whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
 {views} views · {enquiries} enquiries ·{" "}
 <span style={{ color: isHot? C.danger : C.infoText, fontWeight: T.weight.semibold }}>{cvrLabel}% CVR</span>
 </div>
 )}
 </div>
 )}

 {/* Photo nudge — fewer than 3 photos hurts views */}
 {!isSold && (!car.images || car.images.length < 3) && (
 <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, padding: "5px 8px", borderRadius: R.sm, background: withAlpha(C.warn, 0.05), border: `1px solid ${withAlpha(C.warn, 0.14)}` }}>
 <Camera size={11} style={{ flexShrink: 0, color: C.warn }} />
 <span style={{ fontSize: T.size.xs, color: C.warn, flex: 1 }}>
 Add {Math.max(0, 3 - (car.images?.length || 0))} more photo{Math.max(0, 3 - (car.images?.length || 0))!== 1? "s" : ""} — listings with 3+ photos get 3× more views
 </span>
 <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.warnText), fontSize: T.size.xs, padding: "2px 7px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.bold, whiteSpace: "nowrap", fontFamily: "inherit" }}>Fix</button>
 </div>
 )}

 {/* Action bar */}
 <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: "auto" }}>
 {isSold ? (
 <button onClick={openDetail} style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>View</button>
 ) : isPending ? (
 <>
 <button onClick={openDetail} style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>View</button>
 <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.info), color: C.infoText, flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
 <Pencil size={10} /> Edit
 </button>
 </>
 ) : isRejected ? (
 <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.accent), color: C.dangerText, flex: 1, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
 <Pencil size={10} /> Edit & Resubmit
 </button>
 ) : (
 <>
 <button
 onClick={() => handleListingCopy(car, "link")}
 title="Copy link"
 style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "link"? withAlpha(C.success, 0.12) : C.fill, border: `1px solid ${C.border}`, color: listingCopied[car.id] === "link"? C.successText : C.textSec }}
 >
 <LinkIcon size={11} />
 {listingCopied[car.id] === "link"? "Copied" : "Link"}
 </button>
 <button
 onClick={() => handleListingCopy(car, "wa")}
 title="Copy caption"
 style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "wa"? withAlpha(C.success, 0.12) : withAlpha(C.success, 0.06), border: `1px solid ${withAlpha(C.success, 0.15)}`, color: listingCopied[car.id] === "wa"? C.successText : C.success }}
 >
 {listingCopied[car.id] === "wa"? "Copied" : "Caption"}
 </button>
 <button
 onClick={() => setEditListing(car)}
 style={{ ...SOFT(C.info), color: C.infoText, flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
 >
 <Pencil size={10} /> Edit
 </button>
 </>
 )}

 {/* ··· overflow — Broadcast / AI Caption (Premium-only) + Delete */}
 <div style={{ position: "relative", flexShrink: 0 }}>
 <button
 onClick={(e) => { e.stopPropagation(); setActionMenuCarId(actionMenuCarId === car.id? null : car.id); setConfirmDeleteId(null); }}
 title="More actions" aria-label="More actions"
 style={{ width: 30, height: 30, borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.size.base, letterSpacing: 1 }}
 >
 ···
 </button>
 {actionMenuCarId === car.id && (
 <div
 onClick={(e) => e.stopPropagation()}
 style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 60, background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, overflow: "hidden", minWidth: 150, boxShadow: "0 8px 28px rgba(0,0,0,0.6)" }}
 >
 {!isSold && (
 <>
 <button onClick={() => { openBroadcast(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.textSec, fontSize: T.size.base, textAlign: "left" }}>
 <Megaphone size={12} /> Broadcast
 </button>
 <button onClick={() => { generateAiCaptions(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.textSec, fontSize: T.size.base, textAlign: "left" }}>
 <Sparkles size={12} /> AI Caption
 </button>
 <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
 </>
 )}
 {Array.isArray(car.images) && car.images.length > 0 && (
 <>
 <button onClick={() => { downloadListingImages(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.textSec, fontSize: T.size.base, textAlign: "left" }}>
 <Download size={12} /> Download photos
 </button>
 <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
 </>
 )}
 {confirmDeleteId === car.id ? (
 <div style={{ padding: "8px 14px", display: "flex", gap: 6 }}>
 <button onClick={() => handleDeleteListing(car.id)} style={{ flex: 1, fontSize: T.size.sm, padding: "5px 0", borderRadius: R.sm, background: withAlpha(C.danger, 0.2), border: `1px solid ${withAlpha(C.danger, 0.4)}`, color: C.dangerText, cursor: "pointer", fontWeight: T.weight.bold }}>Delete</button>
 <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, fontSize: T.size.sm, padding: "5px 0", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>Cancel</button>
 </div>
 ) : (
 <button onClick={() => setConfirmDeleteId(car.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: T.size.base, textAlign: "left" }}>
 <Trash2 size={12} /> Delete
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

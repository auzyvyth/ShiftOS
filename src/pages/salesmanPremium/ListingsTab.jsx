import React from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import {
 BarChart2, Camera, Car, Check, ChevronDown, Clock, Copy, Flame, Link as LinkIcon,
 Megaphone, Pencil, Plus, Sparkles, Store, Trash2,
 Bell, ChevronLeft, ChevronRight, Droplets, Gauge, MapPin, MessageSquare, Palette,
 Settings, X, ZoomIn,
} from "lucide-react";
import CarFormFast from "../../components/CarFormFast";
import CarForm from "../../components/CarForm";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import { priceStyle, SOFT } from "./shared";

// Listings tab (+ its car-detail popup) — split out of SalesmanPremium.jsx
// (was `renderListings` / `renderCarDetailPopup`) so it lazy-loads instead of
// shipping in the initial bundle. Bodies moved verbatim; only the wrappers
// (closures -> real components taking named props) and these imports are new.
export default function ListingsTab({
 myListings, carStatsMap, filterStatus, sortBy, listingCopied, showAddForm, showFastForm,
 statusMenuCarId, actionMenuCarId, confirmDeleteId, cvrHover, profile, isMobile,
 setMyListings, setFilterStatus, setSortBy, setShowAddForm, setShowFastForm,
 setStatusMenuCarId, setActionMenuCarId, setConfirmDeleteId, setCvrHover, setEditListing,
 setSelectedCar, setCarDetailImgIdx, setCarDetailTab,
 listingScore, updateListingStatus, handleDeleteListing, handleListingCopy, openBroadcast,
 generateAiCaptions, refreshCommissionData,
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
 onClick={() => { setShowFastForm(v =>!v); setShowAddForm(false); }}
 style={{ display: "flex", alignItems: "center", gap: 5, background: showFastForm? "rgba(220,38,38,0.15)" : "#dc2626", border: showFastForm? "1px solid rgba(220,38,38,0.4)" : "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, padding: "7px 12px", cursor: "pointer" }}
 >
 {showFastForm? "Cancel" : "Fast"}
 </button>
 <button
 onClick={() => { setShowAddForm(v =>!v); setShowFastForm(false); }}
 style={{ display: "flex", alignItems: "center", gap: 5, background: showAddForm? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}
 >
 <Plus size={13} /> {showAddForm? "Cancel" : "Full Form"}
 </button>
 </div>
 </div>

 {showFastForm && (
 <div style={{ marginBottom: 24, background: "#0d1117", border: "1px solid rgba(220,38,38,0.15)", borderRadius: 12, padding: 16 }}>
 <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>Fast List — 2 steps, live in 30 seconds</p>
 <CarFormFast
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowFastForm(false);
 toast.success("Listed! Add more details anytime.");
 }}
 />
 </div>
 )}

 {showAddForm && (
 <div
 style={{
 marginBottom: 24,
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: 16,
 }}
 >
 <CarForm
 onCreate={(car) => {
 setMyListings((p) => [car, ...p]);
 setShowAddForm(false);
 toast.success("Listing published!");
 }}
 />
 </div>
 )}

 {/* Store exposure bar */}
 {!showAddForm &&!showFastForm && profile?.slug && myListings.filter(c => c.status === "available").length > 0 && (
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
 {!showAddForm &&!showFastForm && myListings.filter(c => c.status === "available").length > 0 && (() => {
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

 {myListings.length > 0 &&!showAddForm &&!(showFastForm) && (
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

 {myListings.length === 0 &&!showAddForm? (
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
 display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
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
 <div style={{ background: withAlpha(C.success, 0.05), borderBottom: `1px solid ${withAlpha(C.success, 0.13)}`, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
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

 {/* My commission input */}
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
 <span style={{ fontSize: T.size.xs, color: C.textDim, whiteSpace: "nowrap" }}>My commission:</span>
 <div style={{ display: "flex", alignItems: "stretch", gap: 0, flex: 1 }}>
 <span style={{ display: "flex", alignItems: "center", fontSize: T.size.sm, color: C.textMuted, padding: "0 8px", background: C.fill, border: `1px solid ${C.border}`, borderRight: "none", borderRadius: `${R.sm}px 0 0 ${R.sm}px` }}>RM</span>
 <input
 key={`comm-${car.id}-${car.commission_amount?? "x"}`}
 type="number" min="0" step="100" placeholder="0"
 defaultValue={car.commission_amount!= null? car.commission_amount : ""}
 onBlur={async e => {
 const val = e.target.value === ""? null : Number(e.target.value);
 if (val === (car.commission_amount?? null)) return;
 await supabase.from("car_listings").update({ commission_amount: val }).eq("id", car.id);
 setMyListings(prev => prev.map(c => c.id === car.id? { ...c, commission_amount: val } : c));
 refreshCommissionData();
 }}
 style={{ flex: 1, minWidth: 0, width: 0, background: C.fill, border: `1px solid ${C.border}`, borderLeft: "none", borderRadius: `0 ${R.sm}px ${R.sm}px 0`, padding: "5px 8px", color: car.commission_amount? C.infoText : C.textMuted, fontSize: T.size.base, fontWeight: car.commission_amount? T.weight.bold : T.weight.normal, fontFamily: "inherit", outline: "none", lineHeight: 1.2, boxSizing: "border-box" }}
 />
 </div>
 </div>

 {/* Meta */}
 <p style={{ margin: "0 0 8px", fontSize: T.size.sm, color: C.textDim }}>
 {[
 car.mileage? `${Number(car.mileage).toLocaleString()} km` : null,
 car.engine_cc? `${Number(car.engine_cc).toLocaleString()}cc` : null,
 car.transmission,
 car.colour,
 ].filter(Boolean).join(" · ")}
 </p>

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

// Car detail popup, shown over the Listings tab when `selectedCar` is set.
// Lazy-loaded from the same chunk as ListingsTab (see the shell's import).
export function CarDetailPopup({
 selectedCar, carStatsMap, listingCopied, carDetailImgIdx, carDetailTab, carDetailLbOpen,
 isMobile,
 setCarDetailImgIdx, setCarDetailTab, setCarDetailLbOpen, setSelectedCar,
 handleListingCopy, openBroadcast, generateAiCaptions,
}) {
 const car = selectedCar;
 if (!car) return null;
 const parseTags = (str) => {
 if (!str) return [];
 return str
 .split(/[\n,]+/)
 .map((s) => s.trim())
 .filter(Boolean);
 };
 const images =
 Array.isArray(car.images) && car.images.length > 0? car.images : [];
 const sp = car.selling_price || 0;
 const op = car.original_price || null;
 const saving = op && op > sp? op - sp : 0;
 const monthly =
 sp > 0? Math.round((sp * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12)) : null;
 const stats = carStatsMap[car.id]?? {};
 const views = stats.views || 0;
 const enqs = stats.enquiries || 0;
 const cvr = views > 0? ((enqs / views) * 100).toFixed(1) : null;
 const features = parseTags(car.features);
 const options = parseTags(car.options);

 const close = () => {
 setSelectedCar(null);
 setCarDetailImgIdx(0);
 setCarDetailTab("specs");
 setCarDetailLbOpen(false);
 };

 const navBtn = (side, onClick) => (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onClick();
 }}
 style={{
 position: "absolute",
 [side]: 8,
 top: "50%",
 transform: "translateY(-50%)",
 width: 30,
 height: 30,
 borderRadius: 6,
 background: "rgba(0,0,0,0.55)",
 backdropFilter: "blur(8px)",
 border: "1px solid rgba(255,255,255,0.12)",
 color: "#9ca3af",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 {side === "left"? (
 <ChevronLeft size={14} />
 ) : (
 <ChevronRight size={14} />
 )}
 </button>
 );

 const actionBtn = (label, color, bg, border, onClick) => (
 <button
 onClick={onClick}
 style={{
 width: "100%",
 background: bg,
 border: `1px solid ${border}`,
 borderRadius: 6,
 padding: "10px 12px",
 fontSize: 12,
 fontWeight: 500,
 color,
 cursor: "pointer",
 textAlign: "left",
 display: "flex",
 alignItems: "center",
 gap: 8,
 fontFamily: "system-ui, sans-serif",
 }}
 >
 {label}
 </button>
 );

 return (
 <>
 <div
 onClick={close}
 style={{
 position: "fixed",
 inset: 0,
 zIndex: 200,
 background: "rgba(0,0,0,0.82)",
 backdropFilter: "blur(10px)",
 WebkitBackdropFilter: "blur(10px)",
 overflowY: "auto",
 }}
 >
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 position: "relative",
 margin: isMobile? 0 : "24px auto",
 maxWidth: isMobile? "100vw" : 1000,
 width: isMobile? "100vw" : "calc(100vw - 48px)",
 height: isMobile? "100dvh" : undefined,
 maxHeight: isMobile? "100dvh" : "calc(100vh - 48px)",
 background: "rgba(11,11,15,0.99)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: isMobile? 0 : 8,
 overflow: "hidden",
 display: "flex",
 flexDirection: "column",
 fontFamily: "system-ui, sans-serif",
 }}
 >
 <button
 onClick={close}
 style={{
 position: "absolute",
 top: 14,
 right: 14,
 zIndex: 10,
 width: 36,
 height: 36,
 borderRadius: 6,
 background: "rgba(255,255,255,0.07)",
 border: "1px solid rgba(255,255,255,0.08)",
 color: "#9ca3af",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <X size={16} />
 </button>

 <div
 style={{
 display: "flex",
 flex: 1,
 minHeight: 0,
 overflowY: "auto",
 flexDirection: isMobile? "column" : "row",
 }}
 >
 {/* LEFT — gallery + details */}
 <div
 style={{
 flex: 1,
 minWidth: 0,
 padding: isMobile? 16 : 24,
 borderRight: isMobile
? "none"
 : "1px solid rgba(255,255,255,0.08)",
 overflowY: isMobile? "visible" : "auto",
 }}
 >
 {images.length > 0? (
 <div style={{ display: "flex", gap: 8 }}>
 <div
 style={{
 width: 60,
 display: "flex",
 flexDirection: "column",
 gap: 5,
 maxHeight: isMobile? 180 : 300,
 overflowY: "auto",
 }}
 >
 {images.map((img, i) => (
 <div
 key={i}
 onClick={() => setCarDetailImgIdx(i)}
 style={{
 width: 60,
 height: 44,
 borderRadius: 4,
 cursor: "pointer",
 flexShrink: 0,
 background: "#0d0d0d",
 border:
 i === carDetailImgIdx
? "1px solid rgba(59,130,246,0.6)"
 : "1px solid rgba(255,255,255,0.08)",
 overflow: "hidden",
 opacity: i === carDetailImgIdx? 1 : 0.45,
 }}
 >
 <img
 src={img}
 alt=""
 style={{
 width: "100%",
 height: "100%",
 objectFit: "contain",
 display: "block",
 }}
 />
 </div>
 ))}
 </div>
 <div
 style={{
 flex: 1,
 position: "relative",
 background: "#0d0d0d",
 borderRadius: 6,
 overflow: "hidden",
 height: isMobile? 180 : 300,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <img
 src={images[carDetailImgIdx]}
 alt=""
 onClick={() => setCarDetailLbOpen(true)}
 style={{
 maxWidth: "100%",
 maxHeight: "100%",
 objectFit: "contain",
 cursor: "zoom-in",
 display: "block",
 }}
 />
 {images.length > 1 && (
 <>
 {navBtn("left", () =>
 setCarDetailImgIdx(
 (i) => (i - 1 + images.length) % images.length,
 ),
 )}
 {navBtn("right", () =>
 setCarDetailImgIdx((i) => (i + 1) % images.length),
 )}
 </>
 )}
 <button
 onClick={() => setCarDetailLbOpen(true)}
 style={{
 position: "absolute",
 bottom: 8,
 right: 8,
 width: 28,
 height: 28,
 borderRadius: 6,
 background: "rgba(0,0,0,0.55)",
 backdropFilter: "blur(8px)",
 border: "1px solid rgba(255,255,255,0.12)",
 color: "#9ca3af",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <ZoomIn size={13} />
 </button>
 {images.length > 1 && (
 <span
 style={{
 position: "absolute",
 bottom: 8,
 left: 8,
 fontSize: 10,
 color: "#9ca3af",
 background: "rgba(0,0,0,0.55)",
 borderRadius: 4,
 padding: "2px 7px",
 }}
 >
 {carDetailImgIdx + 1} / {images.length}
 </span>
 )}
 </div>
 </div>
 ) : (
 <div
 style={{
 height: isMobile? 160 : 260,
 background: "rgba(255,255,255,0.03)",
 borderRadius: 6,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <Car size={40} color="#374151" />
 </div>
 )}

 {/* Car header */}
 <div style={{ marginTop: 18 }}>
 <p
 style={{
 fontSize: 11,
 color: "#6b7280",
 textTransform: "uppercase",
 letterSpacing: "0.15em",
 margin: 0,
 }}
 >
 {car.brand}
 </p>
 <p
 style={{
 fontSize: 22,
 fontWeight: 300,
 color: "#f3f4f6",
 margin: "4px 0 0",
 lineHeight: 1.2,
 }}
 >
 {car.model}
 {car.variant? ` ${car.variant}` : ""}
 </p>
 <p
 style={{
 fontSize: 12,
 color: "#6b7280",
 margin: "6px 0 0",
 }}
 >
 {[car.year, car.body_type, car.transmission, car.fuel_type]
 .filter(Boolean)
 .join(" · ")}
 </p>
 {(car.city || car.state) && (
 <p
 style={{
 fontSize: 12,
 color: "#6b7280",
 margin: "4px 0 0",
 display: "flex",
 alignItems: "center",
 gap: 4,
 }}
 >
 <MapPin size={11} />{" "}
 {[car.city, car.state].filter(Boolean).join(", ")}
 </p>
 )}
 </div>

 {/* Price */}
 <div style={{ marginTop: 12 }}>
 <p
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 32,
 color: "#f3f4f6",
 margin: 0,
 lineHeight: 1,
 }}
 >
 {sp? `RM ${sp.toLocaleString("en-MY")}` : "—"}
 </p>
 {saving > 0 && (
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: 8,
 marginTop: 4,
 }}
 >
 <span
 style={{
 fontSize: 12,
 color: "#374151",
 textDecoration: "line-through",
 }}
 >RM {op.toLocaleString("en-MY")}
 </span>
 <span
 style={{
 fontSize: 10,
 color: "#93c5fd",
 background: "rgba(59,130,246,0.12)",
 border: "1px solid rgba(59,130,246,0.25)",
 borderRadius: 4,
 padding: "1px 6px",
 }}
 >SAVE RM {saving.toLocaleString("en-MY")}
 </span>
 </div>
 )}
 {monthly > 0 && (
 <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr ·
 3.5% p.a.
 </p>
 )}
 </div>

 {/* Specs strip */}
 <div
 style={{
 display: "flex",
 borderTop: "1px solid rgba(255,255,255,0.05)",
 borderBottom: "1px solid rgba(255,255,255,0.05)",
 margin: "16px 0",
 padding: "12px 0",
 gap: 0,
 overflowX: "auto",
 }}
 >
 {[
 {
 Icon: Gauge,
 label: "Mileage",
 value: car.mileage
? `${Number(car.mileage).toLocaleString()} km`
 : "—",
 },
 {
 Icon: Settings,
 label: "Engine",
 value: car.engine_cc
? `${Number(car.engine_cc).toLocaleString()} cc`
 : "—",
 },
 {
 Icon: ChevronRight,
 label: "Transmission",
 value: car.transmission || "—",
 },
 {
 Icon: Droplets,
 label: "Fuel",
 value: car.fuel_type || "—",
 },
 {
 Icon: Palette,
 label: "Colour",
 value: car.colour || "—",
 },
 ].map(({ Icon, label, value }, i, arr) => (
 <div
 key={label}
 style={{
 flex: "1 0 70px",
 textAlign: "center",
 padding: "0 10px",
 borderRight:
 i < arr.length - 1
? "1px solid rgba(255,255,255,0.05)"
 : "none",
 }}
 >
 <Icon
 size={13}
 color="#6b7280"
 style={{ marginBottom: 4 }}
 />
 <p
 style={{
 fontSize: 9,
 textTransform: "uppercase",
 letterSpacing: "0.12em",
 color: "#6b7280",
 marginBottom: 3,
 }}
 >
 {label}
 </p>
 <p style={{ fontSize: 12, color: "#f3f4f6", margin: 0 }}>
 {value}
 </p>
 </div>
 ))}
 </div>

 {/* Tabs */}
 <div
 style={{
 display: "flex",
 borderBottom: "1px solid rgba(255,255,255,0.08)",
 marginBottom: 16,
 }}
 >
 {["specs", "features", "options"].map((tab) => (
 <button
 key={tab}
 onClick={() => setCarDetailTab(tab)}
 style={{
 padding: "8px 16px",
 fontSize: 12,
 color: carDetailTab === tab? "#f3f4f6" : "#6b7280",
 borderBottom:
 carDetailTab === tab
? "2px solid #ef4444"
 : "2px solid transparent",
 background: "none",
 border: "none",
 borderBottom:
 carDetailTab === tab
? "2px solid #ef4444"
 : "2px solid transparent",
 cursor: "pointer",
 fontFamily: "system-ui, sans-serif",
 }}
 >
 {tab.charAt(0).toUpperCase() + tab.slice(1)}
 </button>
 ))}
 </div>

 {carDetailTab === "specs" && (
 <div>
 {[
 { k: "Year", v: car.year || "—" },
 { k: "Condition", v: car.condition || "—" },
 { k: "Body Type", v: car.body_type || "—" },
 { k: "Colour", v: car.colour || "—" },
 {
 k: "Mileage",
 v: car.mileage
? `${Number(car.mileage).toLocaleString()} km`
 : "—",
 },
 { k: "Transmission", v: car.transmission || "—" },
 { k: "Fuel Type", v: car.fuel_type || "—" },
 {
 k: "Location",
 v:
 [car.city, car.state].filter(Boolean).join(", ") ||
 "—",
 },
 ].map(({ k, v }) => (
 <div
 key={k}
 style={{
 display: "flex",
 justifyContent: "space-between",
 padding: "10px 0",
 borderBottom: "1px solid rgba(255,255,255,0.04)",
 }}
 >
 <span style={{ fontSize: 12, color: "#6b7280" }}>
 {k}
 </span>
 <span style={{ fontSize: 13, color: "#9ca3af" }}>
 {v}
 </span>
 </div>
 ))}
 </div>
 )}

 {carDetailTab === "features" && (
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
 {features.length === 0? (
 <p style={{ fontSize: 13, color: "#6b7280" }}>No features listed.
 </p>
 ) : (
 features.map((f, i) => (
 <span
 key={i}
 style={{
 fontSize: 12,
 color: "#9ca3af",
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 4,
 padding: "4px 10px",
 }}
 >
 {f}
 </span>
 ))
 )}
 </div>
 )}

 {carDetailTab === "options" && (
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
 {options.length === 0? (
 <p style={{ fontSize: 13, color: "#6b7280" }}>No options listed.
 </p>
 ) : (
 options.map((o, i) => (
 <span
 key={i}
 style={{
 fontSize: 12,
 color: "#9ca3af",
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 4,
 padding: "4px 10px",
 }}
 >
 {o}
 </span>
 ))
 )}
 </div>
 )}
 </div>

 {/* RIGHT — actions + CVR */}
 <div
 style={{
 flex: isMobile? "none" : "0 0 200px",
 width: isMobile? "100%" : undefined,
 padding: isMobile? "12px 16px 32px" : 20,
 display: "flex",
 flexDirection: "column",
 gap: 8,
 borderTop: isMobile
? "1px solid rgba(255,255,255,0.08)"
 : "none",
 }}
 >
 <p
 style={{
 fontSize: 10,
 color: "#6b7280",
 letterSpacing: "0.15em",
 textTransform: "uppercase",
 margin: "0 0 4px",
 }}
 >Actions
 </p>
 {actionBtn(
 <>
 <Copy size={13} style={{ flexShrink: 0 }} />Copy Link
 </>,
 listingCopied[car.id] === "link"? "#4ade80" : "#9ca3af",
 listingCopied[car.id] === "link"
? "rgba(34,197,94,0.08)"
 : "rgba(255,255,255,0.04)",
 listingCopied[car.id] === "link"
? "rgba(34,197,94,0.3)"
 : "rgba(255,255,255,0.08)",
 () => handleListingCopy(car, "link"),
 )}
 {actionBtn(
 <>
 <MessageSquare size={13} style={{ flexShrink: 0 }} />WA
 Caption
 </>,
 "#4ade80",
 "rgba(37,211,102,0.06)",
 "rgba(37,211,102,0.2)",
 () => handleListingCopy(car, "wa"),
 )}
 {actionBtn(
 <>
 <Sparkles size={13} style={{ flexShrink: 0 }} />AI Caption
 </>,
 "#c084fc",
 "rgba(168,85,247,0.08)",
 "rgba(168,85,247,0.25)",
 () => {
 generateAiCaptions(car);
 close();
 },
 )}
 {actionBtn(
 <>
 <Bell size={13} style={{ flexShrink: 0 }} />Broadcast
 </>,
 "#fb923c",
 "rgba(249,115,22,0.08)",
 "rgba(249,115,22,0.25)",
 () => {
 openBroadcast(car);
 close();
 },
 )}

 {/* Performance */}
 <div
 style={{
 marginTop: 8,
 background: "rgba(255,255,255,0.03)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 6,
 padding: 12,
 }}
 >
 <p
 style={{
 fontSize: 10,
 color: "#6b7280",
 letterSpacing: "0.1em",
 textTransform: "uppercase",
 margin: "0 0 8px",
 }}
 >Performance
 </p>
 {[
 { label: "Views", val: views, color: "#60a5fa" },
 { label: "Enquiries", val: enqs, color: "#fbbf24" },
 {
 label: "CVR",
 val: cvr!== null? `${cvr}%` : "—",
 color: "#4ade80",
 },
 ].map(({ label, val, color }) => (
 <div
 key={label}
 style={{
 display: "flex",
 justifyContent: "space-between",
 marginBottom: 6,
 }}
 >
 <span style={{ fontSize: 11, color: "#6b7280" }}>
 {label}
 </span>
 <span style={{ fontSize: 12, fontWeight: 600, color }}>
 {val}
 </span>
 </div>
 ))}
 </div>

 {/* Status */}
 <div
 style={{
 background: "rgba(255,255,255,0.03)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 6,
 padding: 12,
 }}
 >
 <p
 style={{
 fontSize: 10,
 color: "#6b7280",
 letterSpacing: "0.1em",
 textTransform: "uppercase",
 margin: "0 0 6px",
 }}
 >Status
 </p>
 <span
 style={{
 fontSize: 12,
 fontWeight: 600,
 textTransform: "capitalize",
 color:
 car.status === "available"
? "#4ade80"
 : car.status === "sold"
? "#9ca3af"
 : "#fbbf24",
 }}
 >
 {car.status || "available"}
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Lightbox */}
 {carDetailLbOpen && images.length > 0 && (
 <div
 onClick={() => setCarDetailLbOpen(false)}
 style={{
 position: "fixed",
 inset: 0,
 zIndex: 300,
 background: "rgba(0,0,0,0.96)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <button
 onClick={() => setCarDetailLbOpen(false)}
 style={{
 position: "absolute",
 top: 16,
 right: 16,
 width: 40,
 height: 40,
 borderRadius: 8,
 background: "rgba(255,255,255,0.08)",
 border: "1px solid rgba(255,255,255,0.15)",
 color: "#e5e5e5",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 zIndex: 10,
 }}
 >
 <X size={18} />
 </button>
 {images.length > 1 && (
 <span
 style={{
 position: "absolute",
 top: 20,
 left: "50%",
 transform: "translateX(-50%)",
 fontSize: 12,
 color: "#9ca3af",
 background: "rgba(0,0,0,0.5)",
 borderRadius: 20,
 padding: "4px 12px",
 }}
 >
 {carDetailImgIdx + 1} / {images.length}
 </span>
 )}
 {images.length > 1 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setCarDetailImgIdx(
 (i) => (i - 1 + images.length) % images.length,
 );
 }}
 style={{
 position: "absolute",
 left: 16,
 top: "50%",
 transform: "translateY(-50%)",
 width: 44,
 height: 44,
 borderRadius: 8,
 background: "rgba(255,255,255,0.08)",
 border: "1px solid rgba(255,255,255,0.15)",
 color: "#e5e5e5",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <ChevronLeft size={22} />
 </button>
 )}
 <img
 src={images[carDetailImgIdx]}
 alt=""
 onClick={(e) => e.stopPropagation()}
 style={{
 maxWidth: "calc(100vw - 120px)",
 maxHeight: "90vh",
 objectFit: "contain",
 borderRadius: 4,
 display: "block",
 }}
 />
 {images.length > 1 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setCarDetailImgIdx((i) => (i + 1) % images.length);
 }}
 style={{
 position: "absolute",
 right: 16,
 top: "50%",
 transform: "translateY(-50%)",
 width: 44,
 height: 44,
 borderRadius: 8,
 background: "rgba(255,255,255,0.08)",
 border: "1px solid rgba(255,255,255,0.15)",
 color: "#e5e5e5",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 }}
 >
 <ChevronRight size={22} />
 </button>
 )}
 </div>
 )}
 </>
 );
}

# TikTok Studio — Fix Backlog

## 1. Image contain — car must fit inside every aspect ratio frame
**Status:** DONE  
- [x] renderBackground(): contain logic in place (dw/dh centered)
- [x] Hard canvas clip added at top of renderBackground (ctx.beginPath/rect/clip) so blurred
      background can never bleed outside the frame boundary

## 2. Corner radius — px not %
**Status:** DONE  
- [x] LayerDiv CSS: `borderRadius` changed from `${v}%` → `${v}px`
- [x] Konva Rect: `cornerRadius` changed from `(v/100)*min(lw,lh)` → `v * scale`
- [x] Both sliders: max 50→100, fmt label `%` → `px`
- [x] Badge element (CanvasElement HTML): `borderRadius: 999` → `(el.borderRadius ?? 999) * scale`
- [x] Badge element (canvas export): roundRect radius `bh/2` → `el.borderRadius ?? bh/2`

## 3. Properties parity — pre-applied texts get same controls as user-added shapes
**Status:** DONE  
- [x] ElPropsPanel: font family selector added (falls back to template default)
- [x] ElPropsPanel: background fill + clear button for text elements
- [x] ElPropsPanel: corner radius slider (0–999px) for badge elements
- [x] CanvasElement HTML: uses el.fontFamily when set (badge + text)
- [x] CanvasElement HTML (text): shows bgColor background with padding + borderRadius
- [x] renderToCanvas badge export: uses el.fontFamily, el.borderRadius
- [x] renderToCanvas text export: uses el.fontFamily, draws bgColor rect behind text

---

# SalesmanLite — Production Hardening Backlog

## 4. [CRITICAL] Realtime: 5 postgres_changes listeners per session
**Status:** DONE  
- [x] Collapsed dual whatsapp_enquiries channels into shared `handleEnquiryInsert` with dedup
- [x] Reduced from 5 to 4 listeners (leads, notifications, enquiries, appointments)

## 5. [CRITICAL] Appointments fetch silently discards errors
**Status:** DONE  
- [x] Destructure `error`, show `toast.error("Could not load bookings")` and return early

## 6. [CRITICAL] Merge is not atomic — 3 unguarded sequential writes
**Status:** DONE  
- [x] Removed 3 client-side writes; only `use_dealer_invite` RPC runs
- [x] Success + redirect gated on RPC returning no error

## 7. [HIGH] Analytics fetch: no server-side date filter
**Status:** DONE  
- [x] Added `.gte("created_at", cutoff30)` before query; removed JS filter

## 8. [HIGH] AI caption: Regenerate bypasses loading guard + no rate limit
**Status:** DONE  
- [x] 10/day cap via sessionStorage; Regenerate now respects `aiCaptionLoading` guard

## 9. [HIGH] saveFollowUp: DB error silently swallowed, UI says success
**Status:** DONE  
- [x] Return early + `toast.error` on failure; local state only updated after confirmed write

## 10. [HIGH] listingStats useMemo: O(n×m) filter per listing
**Status:** DONE  
- [x] Pre-grouped events into `Map<carId, events[]>` and `Map<listingId, count>` for O(1) lookup

## 11. [HIGH] Merge shows success even when profile update failed
**Status:** DONE  
- [x] Gated on RPC success only (covered by item 6)

## 12. [HIGH] Avatar upload: no file size validation
**Status:** DONE  
- [x] Reject > 5MB before upload; check `file.type.startsWith("image/")`

## 13. [HIGH] precacheImages: uncontrolled parallel cache writes
**Status:** DONE  
- [x] Batched 4 at a time; limited to first 2 images per listing

## 14. [HIGH] Broadcast cannot be cancelled mid-sequence
**Status:** TODO  
- [ ] Add cancel flag ref (`broadcastCancelled`) checked inside the setTimeout chain
- [ ] Show "Cancel" button while broadcast is running

## 15. [HIGH] WA modal opens WhatsApp before DB write completes
**Status:** TODO  
- [ ] Await DB write before calling `window.open()`
- [ ] If DB write fails, show error toast and do not open WA

## 16. [HIGH] Appointment cancel: no confirmation
**Status:** TODO  
- [ ] Replace inline `onClick` with two-tap pattern (first tap → "Tap again to confirm")

## 17. [HIGH] select("*") on profiles
**Status:** DONE  
- [x] Replaced with explicit column list

## 18. [HIGH] Dealer_id realtime channel inserts leads with no duplicate check
**Status:** DONE  
- [x] Shared `handleEnquiryInsert` checks for existing lead by phone before inserting

## 19. [MEDIUM] listingStats.sort() mutates memoised array inside JSX render
**Status:** TODO  
- [ ] Move sort into the useMemo that produces listingStats

## 20. [MEDIUM] getHeatScore called O(n log n) times during sort + once per card
**Status:** TODO  
- [ ] Pre-compute heat scores into a Map before sort and renderLeadCard

## 21. [MEDIUM] dismissTour DB error not caught
**Status:** TODO  
- [ ] Add error check; if fails, do not hide tour UI (retry on next load)

## 22. [MEDIUM] Dead code cleanup
**Status:** DONE  
- [x] Removed unused `ArrowUpDown` import
- [x] Simplified `cta: null` in onboarding step 1

## 23. [MEDIUM] Mobile: 7 listing action buttons in 2-col grid, last misaligned
**Status:** TODO  
- [ ] Change to flex-wrap row; all buttons same width; no orphaned last item

## 24. [MEDIUM] Notification panel tap-trap on mobile (320px wide, 55px backdrop)
**Status:** TODO  
- [ ] On mobile, render panel as full-width bottom sheet with clear close handle

## 25. [MEDIUM] Car detail modal clips on iOS Safari (100dvh)
**Status:** TODO  
- [ ] Replace `100dvh` with `100svh` or `calc(100vh - env(safe-area-inset-bottom))`

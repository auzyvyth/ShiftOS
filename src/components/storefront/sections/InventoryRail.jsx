// Cars, version B "Rail" (STOREFRONT-2 stage 3): the same heading, search and chips as the
// grid, then the cars in one row the buyer swipes (arrows on a computer). Suits a dealer with
// a few cars, and keeps the page short so the sections below it get seen.
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShowroomCardSkeleton } from "@/components/ShowroomCard";
import { CarsHeading, CarsToolbar, CarCard, ViewAllButton } from "./carsParts";
import { wrap, secA } from "./shared";

export default function InventoryRail({ browseOn, featured, loading, carsBase, ctaCtx, compare }) {
  const rail = useRef(null);
  const step = (dir) => {
    const el = rail.current;
    if (!el) return;
    const card = el.firstElementChild;
    const by = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * by, behavior: "smooth" });
  };
  const arrow = (dir, label) => (
    <button type="button" className="irl-arrow" aria-label={label} onClick={() => step(dir)}>
      {dir < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );

  return (
    <section className="sec-pad" style={secA}>
      <style>{`
        .irl { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(260px, 300px); gap: 20px; overflow-x: auto;
          scroll-snap-type: x mandatory; scroll-padding: 0 20px; padding: 4px 20px 16px; margin: 0 -20px 20px;
          scrollbar-width: thin; scrollbar-color: var(--sf-border, rgba(255,255,255,0.18)) transparent; overscroll-behavior-x: contain; }
        .irl > * { scroll-snap-align: start; min-width: 0; }
        .irl-arrows { display: none; gap: 8px; justify-content: flex-end; margin: -8px 0 12px; }
        .irl-arrow { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
          background: var(--sf-card, #111113); border: 1px solid var(--sf-border, rgba(255,255,255,0.1)); color: var(--sf-muted, #C0C0C6); transition: border-color 0.2s ease; }
        .irl-arrow:hover { border-color: var(--sf-border, rgba(255,255,255,0.24)); }
        @media (hover: hover) and (pointer: fine) { .irl-arrows { display: flex; } }
        @media (max-width: 640px) { .irl { grid-auto-columns: 72%; gap: 12px; } }
      `}</style>
      <div style={wrap}>
        <CarsHeading carsBase={carsBase} />
        <CarsToolbar carsBase={carsBase} browseOn={browseOn} />
        {featured.length > 2 && <div className="irl-arrows">{arrow(-1, "Previous cars")}{arrow(1, "Next cars")}</div>}
        <div className="irl" ref={rail}>
          {loading
            ? [...Array(3)].map((_, i) => <ShowroomCardSkeleton key={i} dark />)
            : featured.map((c, i) => <CarCard key={c.id} car={c} index={i} ctaCtx={ctaCtx} compare={compare} />)}
        </div>
        <ViewAllButton carsBase={carsBase} />
      </div>
    </section>
  );
}

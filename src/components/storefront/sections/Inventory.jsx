import { ShowroomCardSkeleton } from "@/components/ShowroomCard";
import { CarsHeading, CarsToolbar, CarCard, ViewAllButton } from "./carsParts";
import { wrap, secA } from "./shared";

// Cars, version A "Grid": search, body-type chips and the newest six cars in the one card grid.
export default function Inventory({ browseOn, featured, loading, carsBase, ctaCtx, compare }) {
  return (
    <section className="sec-pad" style={secA}>
      <div style={wrap}>
        <CarsHeading carsBase={carsBase} />
        <CarsToolbar carsBase={carsBase} browseOn={browseOn} />
        <div className="sc-grid" style={{ marginBottom: "36px" }}>
          {loading
            ? [...Array(3)].map((_, i) => <ShowroomCardSkeleton key={i} dark />)
            : featured.map((c, i) => <CarCard key={c.id} car={c} index={i} ctaCtx={ctaCtx} compare={compare} />)}
        </div>
        <ViewAllButton carsBase={carsBase} />
      </div>
    </section>
  );
}

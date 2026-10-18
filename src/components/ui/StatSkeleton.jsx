// A placeholder for a number that has not arrived yet. Shown INSTEAD of a 0:
// a seller reads "0 views" as a fact, so a stat that is still loading must
// not look like a real zero. Seller panels are dark, so the default tone is a
// faint white; pass `tone` for a light surface.
const KEYFRAMES = `@keyframes xd-stat-pulse { 0%, 100% { opacity: 0.55 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .xd-stat-skel { animation: none !important } }`;

export default function StatSkeleton({ width = 44, height = 26, tone = "rgba(255,255,255,0.09)", style }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <span
        className="xd-stat-skel"
        aria-hidden="true"
        style={{
          display: "inline-block", width, height, borderRadius: 6, background: tone,
          animation: "xd-stat-pulse 1.4s ease-in-out infinite", verticalAlign: "middle", ...style,
        }}
      />
    </>
  );
}

import { Award, CheckCircle, UserCheck, Car } from "lucide-react";
import { FadeIn, CountUp } from "./ui";
import { wrap, secLight } from "./shared";
import { statList } from "./statsParts";

const ICONS = { years: Award, sold: CheckCircle, customers: UserCheck, stock: Car };

// "By the Numbers": only numbers that are above zero; hidden when there are none
// (statsParts.js, the same rule for versions B and C).
export default function Stats({ tenant, soldCount, stock }) {
  const statItems = statList({ tenant, soldCount, stock }).map((s) => ({ ...s, icon: ICONS[s.key] }));
  if (statItems.length === 0) return null;
  return (
    <section style={{ ...secLight, position: "relative", overflow: "hidden" }} className="sec-pad">
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "700px",
          height: "500px",
          background:
            "radial-gradient(ellipse,rgba(var(--sf-accent-rgb, 220,38,38),0.05) 0%,transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ ...wrap, position: "relative", zIndex: 1 }}>
        <FadeIn>
          <p
            className="sec-eyebrow"
            style={{ justifyContent: "center", marginBottom: "40px" }}
          >
            By the Numbers
          </p>
        </FadeIn>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${statItems.length}, 1fr)`,
            gap: "1px",
            background: "var(--sf-border, rgba(255,255,255,0.06))",
            border: "1px solid var(--sf-border, rgba(255,255,255,0.06))",
            borderRadius: "6px",
            overflow: "hidden",
          }}
          className="stats-band-grid"
        >
          {statItems.map((s, i) => (
            // Keyed by label, not position: the sold count arrives after the others, and a
            // position key kept the old number in the moved card ("Cars Sold" showed the
            // happy-customers figure; found 2026-11-20).
            <FadeIn key={s.label} delay={i * 0.08}>
              <div
                style={{
                  background: "var(--sf-bg, #0C0C0E)",
                  padding: "36px 20px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(var(--sf-accent-rgb, 220,38,38),0.08)",
                    border: "1px solid rgba(var(--sf-accent-rgb, 220,38,38),0.2)",
                  }}
                >
                  <s.icon size={19} style={{ color: "var(--sf-accent-text, #DC2626)" }} />
                </div>
                <CountUp
                  end={s.value}
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: "var(--sf-text, #F0F0F0)",
                    fontSize: "clamp(1.9rem,5vw,3rem)",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                />
                <span
                  style={{
                    width: "24px",
                    height: "2px",
                    background: "var(--sf-accent, #DC2626)",
                    borderRadius: "2px",
                  }}
                />
                <p
                  style={{
                    color: "var(--sf-muted, #8A8A94)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    margin: 0,
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

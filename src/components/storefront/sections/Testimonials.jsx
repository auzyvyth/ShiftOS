import { Star, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FadeIn } from "./ui";
import { wrap, secA, glassCard } from "./shared";

// Testimonials the dealer typed in Settings; hidden when there are none, never a made-up set.
// (docs/STOREFRONT_PLAN.md: to be replaced by real reviews only.)
export default function Testimonials({ tenant }) {
  const { t } = useTranslation();
  const testimonials = (Array.isArray(tenant?.storefront_testimonials) ? tenant.storefront_testimonials : []).map((item) => ({
    name: item.name,
    loc: item.location,
    text: item.text,
    r: 5,
  }));
  return (
    <>
      {testimonials.length > 0 && (
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow green">Real Buyers</p>
              <h2 className="sec-title">{t("home.testimonials.title")}</h2>
            </div>
          </FadeIn>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
              gap: "16px",
            }}
          >
            {testimonials.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div
                  style={{
                    ...glassCard,
                    padding: "28px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "2px",
                      marginBottom: "16px",
                    }}
                  >
                    {[...Array(item.r)].map((_, j) => (
                      <Star
                        key={j}
                        size={11}
                        style={{ fill: "#C4A265", color: "#C4A265" }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      color: "#9090A0",
                      fontSize: "13px",
                      lineHeight: "1.8",
                      marginBottom: "20px",
                      fontStyle: "italic",
                      flex: 1,
                    }}
                  >
                    "{item.text}"
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      paddingTop: "16px",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(196,162,101,0.08)",
                        border: "1px solid rgba(196,162,101,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#C4A265",
                          fontWeight: "700",
                          fontSize: "13px",
                        }}
                      >
                        {item.name[0]}
                      </span>
                    </div>
                    <div>
                      <p
                        style={{
                          color: "#F0F0F0",
                          fontWeight: "600",
                          fontSize: "13px",
                          margin: "0 0 2px 0",
                        }}
                      >
                        {item.name}
                      </p>
                      <p
                        style={{
                          color: "#3A3A42",
                          fontSize: "11px",
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <MapPin size={9} /> {item.loc}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
      )}
    </>
  );
}

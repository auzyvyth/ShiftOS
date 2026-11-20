import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FadeIn } from "./ui";
import { wrap, secB, primaryBtn } from "./shared";

// Link to the loan calculator.
export default function CalculatorCta() {
  const { t } = useTranslation();
  return (
    <>
      <section className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div
              style={{
                borderRadius: "6px",
                overflow: "hidden",
                position: "relative",
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  padding: "40px",
                  flex: "1",
                  minWidth: "240px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "3px",
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                  }}
                >
                  <Calculator size={18} style={{ color: "#DC2626" }} />
                </div>
                <h2
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: "#F0F0F0",
                    fontSize: "clamp(1.2rem,4vw,1.8rem)",
                    fontWeight: "700",
                    letterSpacing: "-0.025em",
                    margin: "0 0 10px 0",
                    lineHeight: 1.15,
                  }}
                >
                  {t("home.budget.title")}
                </h2>
                <p
                  style={{
                    color: "#52525A",
                    fontSize: "13px",
                    lineHeight: "1.7",
                    margin: "0 0 24px 0",
                  }}
                >
                  {t("home.budget.subtitle")}
                </p>
                <Link
                  to="/calculator"
                  className="primary-btn"
                  style={primaryBtn}
                >
                  <Calculator size={14} />
                  {t("home.budget.calcBtn")}
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  );
}

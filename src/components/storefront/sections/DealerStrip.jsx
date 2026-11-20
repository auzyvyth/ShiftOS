import { Link } from "react-router-dom";
import { MapPin, ArrowRight, MessageCircle } from "lucide-react";
import { buildWaUrl } from "../../../hooks/useCTAContext";
import { wrap, primaryBtn, waBtn } from "./shared";

// Stock, sold count, town and the two quick buttons, right under the hero.
export default function DealerStrip({ tenant, siteName, carsBase, ctaCtx, stock, soldDisplay }) {
  return (
    <>
      <section style={{ background: "#0C0C0E", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ ...wrap, padding: "18px 20px" }}>
          <div className="dealer-strip">
            <div className="dealer-strip-stats">
              <div className="dealer-strip-nums">
                {tenant?.stat_years > 0 && (
                  <div className="dealer-strip-stat">
                    <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                      {tenant.stat_years}+
                    </p>
                    <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                      Years in Business
                    </p>
                  </div>
                )}
                <div className="dealer-strip-stat">
                  <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                    {stock != null ? String(stock) : "—"}
                  </p>
                  <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                    Cars in Stock
                  </p>
                </div>
                <div className="dealer-strip-stat">
                  <p style={{ color: "#F0F0F0", fontSize: 20, fontWeight: 700, lineHeight: 1, margin: "0 0 4px" }}>
                    {soldDisplay}
                  </p>
                  <p style={{ color: "#52525A", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", margin: 0, fontWeight: 600 }}>
                    Cars Sold
                  </p>
                </div>
              </div>
              {(tenant?.city || tenant?.state) && (
                <div className="dealer-strip-loc">
                  <MapPin size={14} style={{ color: "#C4A265", flexShrink: 0 }} />
                  <span style={{ color: "#C0C0C6", fontSize: 13, fontWeight: 600 }}>
                    {[tenant?.city, tenant?.state].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
            <div className="dealer-strip-actions">
              <Link to={carsBase} className="primary-btn" style={{ ...primaryBtn, padding: "11px 22px" }}>
                Browse Our Cars <ArrowRight size={14} />
              </Link>
              <a
                href={
                  buildWaUrl(
                    ctaCtx.type !== "loading"
                      ? ctaCtx
                      : { type: "listing", profile: null, ref: null },
                    tenant?.whatsapp_number,
                    `Hi ${siteName}, I'd like to enquire about a car`,
                  ) || "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="wa-btn-hp"
                style={{ ...waBtn, padding: "11px 22px" }}
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

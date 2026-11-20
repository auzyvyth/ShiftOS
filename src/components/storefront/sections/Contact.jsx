import { Link } from "react-router-dom";
import { MessageCircle, ArrowRight, MapPin, Phone, Mail, Clock, Facebook, Instagram, Music2, Repeat, Calculator } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import { buildWaUrl } from "../../../hooks/useCTAContext";
import { storefrontCta } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secA, primaryBtn } from "./shared";

// "Get in Touch": WhatsApp, browse, trade-in, loan check, then the contact cards and socials.
export default function Contact({ tenant, siteName, carsBase, ctaCtx, onTradeIn, onLoanCheck }) {
  const ctaData = storefrontCta(tenant?.storefront_cta);
  const ctaTitle = ctaData.title;
  const ctaSubtitle = ctaData.subtitle;
  const ctaPrimaryLabel = ctaData.primary_label;
  const ctaSecondaryLabel = ctaData.secondary_label;
  const waHref =
    buildWaUrl(
      ctaCtx.type !== "loading"
        ? ctaCtx
        : { type: "listing", profile: null, ref: null },
      tenant?.whatsapp_number,
      ctaCtx.type === "salesman"
        ? `Hi, I need help finding a car — via ${ctaCtx.ref}`
        : `Hi ${siteName}, I need help finding a car`,
    ) || "#";
  const logEnquiry = () => {
    supabase
      .from("whatsapp_enquiries")
      .insert({
        dealer_id: tenant?.id || null,
        listing_id: null,
        buyer_name: null,
        buyer_phone: null,
        buyer_message: `General enquiry from homepage CTA`,
        source: "homepage_cta",
        status: "new",
      })
      .then(() => {});
  };
  const contactItems = [
    tenant?.phone && {
      icon: Phone,
      label: "Call us",
      value: tenant.phone,
      href: `tel:${String(tenant.phone).replace(/[^\d+]/g, "")}`,
    },
    tenant?.email && {
      icon: Mail,
      label: "Email us",
      value: tenant.email,
      href: `mailto:${tenant.email}`,
    },
    (() => {
      const addr = [tenant?.location, tenant?.city, tenant?.state]
        .filter(Boolean)
        .join(", ");
      return (
        addr && {
          icon: MapPin,
          label: "Visit us",
          value: addr,
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
          external: true,
        }
      );
    })(),
    tenant?.business_hours && {
      icon: Clock,
      label: "Opening hours",
      value: tenant.business_hours,
      href: null,
    },
  ].filter(Boolean);
  const socials = [
    tenant?.social_facebook && { icon: Facebook, href: tenant.social_facebook },
    tenant?.social_instagram && { icon: Instagram, href: tenant.social_instagram },
    tenant?.social_tiktok && { icon: Music2, href: tenant.social_tiktok },
  ].filter(Boolean);
  const cardStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "24px 18px",
    background: "var(--sf-card, #111113)",
    border: "1px solid var(--sf-border, rgba(255,255,255,0.07))",
    borderRadius: "8px",
    textDecoration: "none",
  };
  return (
    <section
      id="contact"
      className="sec-pad"
      style={{ ...secA, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle,rgba(var(--sf-accent-rgb, 196,162,101),0.025) 0%,transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          ...wrap,
          maxWidth: "760px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <FadeIn>
          <p
            className="sec-eyebrow"
            style={{ justifyContent: "center", marginBottom: "16px" }}
          >
            Get in Touch
          </p>
          <h2
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: "var(--sf-text, #F0F0F0)",
              fontSize: "clamp(2rem,7vw,3.6rem)",
              fontWeight: "800",
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              margin: "0 0 16px 0",
            }}
          >
            {ctaTitle}
          </h2>
          <p
            style={{
              color: "var(--sf-muted, #52525A)",
              fontSize: "clamp(13px,3.5vw,15px)",
              lineHeight: "1.8",
              margin: "0 auto 36px",
              maxWidth: "520px",
            }}
          >
            {ctaSubtitle}
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-btn"
              style={{
                ...primaryBtn,
                background: "#25D366",
                borderColor: "#25D366",
              }}
              onClick={logEnquiry}
            >
              <MessageCircle size={14} />
              {ctaSecondaryLabel}
            </a>
            <Link
              to={carsBase}
              className="ghost-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "transparent",
                border: "1px solid var(--sf-border, rgba(255,255,255,0.12))",
                color: "var(--sf-muted, #C0C0C6)",
                fontWeight: "600",
                fontSize: "14px",
                padding: "13px 28px",
                borderRadius: "4px",
                textDecoration: "none",
                transition: "all 0.2s ease",
                letterSpacing: "0.02em",
              }}
            >
              {ctaPrimaryLabel} <ArrowRight size={14} />
            </Link>
            {tenant?.subdomain && (
              <button
                type="button"
                onClick={onTradeIn}
                className="ghost-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "transparent",
                  border: "1px solid var(--sf-border, rgba(255,255,255,0.12))",
                  color: "var(--sf-muted, #C0C0C6)",
                  fontWeight: "600",
                  fontSize: "14px",
                  padding: "13px 28px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                <Repeat size={14} /> Trade in my car
              </button>
            )}
            {tenant?.subdomain && (
              <button
                type="button"
                onClick={onLoanCheck}
                className="ghost-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "transparent",
                  border: "1px solid var(--sf-border, rgba(255,255,255,0.12))",
                  color: "var(--sf-muted, #C0C0C6)",
                  fontWeight: "600",
                  fontSize: "14px",
                  padding: "13px 28px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                <Calculator size={14} /> Check my loan
              </button>
            )}
          </div>

          {contactItems.length > 0 && (
            <div className="contact-grid">
              {contactItems.map((c, i) => {
                const Inner = (
                  <>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "3px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(var(--sf-accent-rgb, 196,162,101),0.08)",
                        border: "1px solid rgba(var(--sf-accent-rgb, 196,162,101),0.18)",
                      }}
                    >
                      <c.icon size={16} style={{ color: "var(--sf-accent-text, #C4A265)" }} />
                    </div>
                    <p
                      style={{
                        color: "var(--sf-muted, #3A3A42)",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        margin: 0,
                        fontWeight: 600,
                      }}
                    >
                      {c.label}
                    </p>
                    <p
                      style={{
                        color: "var(--sf-text, #F0F0F0)",
                        fontSize: "13px",
                        fontWeight: 600,
                        margin: 0,
                        wordBreak: "break-word",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {c.value}
                    </p>
                  </>
                );
                return c.href ? (
                  <a
                    key={i}
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noopener noreferrer" : undefined}
                    className="card-hover"
                    style={cardStyle}
                  >
                    {Inner}
                  </a>
                ) : (
                  <div key={i} style={cardStyle}>
                    {Inner}
                  </div>
                );
              })}
            </div>
          )}

          {socials.length > 0 && (
            <div className="contact-socials">
              {socials.map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-hover"
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--sf-card, #111113)",
                    border: "1px solid var(--sf-border, rgba(255,255,255,0.08))",
                  }}
                  aria-label="Social link"
                >
                  <s.icon size={16} style={{ color: "var(--sf-muted, #C0C0C6)" }} />
                </a>
              ))}
            </div>
          )}
        </FadeIn>
      </div>
    </section>
  );
}

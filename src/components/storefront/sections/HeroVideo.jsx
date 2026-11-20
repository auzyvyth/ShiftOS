import { getEmbedUrl } from "../../../utils/videoEmbed";

// The dealer's own video (Settings > Storefront), only when switched on and the link embeds.
export default function HeroVideo({ tenant }) {
  return (
    <>
      {tenant?.hero_video_enabled &&
        tenant?.hero_video_url &&
        getEmbedUrl(tenant.hero_video_url) && (
          <section
            className="sec-pad"
            style={{ background: "var(--sf-bg, #080C14)", paddingTop: 40, paddingBottom: 40 }}
          >
            <div
              style={{
                maxWidth: 900,
                margin: "0 auto",
                padding: "0 16px",
                textAlign: "center",
              }}
            >
              {tenant.hero_video_title && (
                <h2
                  style={{
                    fontSize: "clamp(20px,4vw,28px)",
                    fontWeight: 700,
                    color: "var(--sf-text, #f3f4f6)",
                    marginBottom: 20,
                    fontFamily: "system-ui,sans-serif",
                  }}
                >
                  {tenant.hero_video_title}
                </h2>
              )}
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%",
                  height: 0,
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid var(--sf-border, rgba(255,255,255,0.1))",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <iframe
                  src={getEmbedUrl(tenant.hero_video_url)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                  allowFullScreen
                  title="Dealer video"
                />
              </div>
            </div>
          </section>
        )}
    </>
  );
}

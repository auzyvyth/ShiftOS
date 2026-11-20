import { FadeIn } from "./ui";
import { wrap, secB } from "./shared";

// The dealer's own About text; hidden when they wrote none.
export default function About({ tenant, siteName }) {
  return (
    <>
      {tenant?.about_text && (
        <section className="sec-pad" style={secB}>
          <div style={wrap}>
            <FadeIn>
              <div style={{ marginBottom: "24px", textAlign: "center" }}>
                <p className="sec-eyebrow">About {siteName}</p>
                <h2 className="sec-title">Get to know us</h2>
              </div>
              <p
                style={{
                  color: "#9CA3AF",
                  fontSize: "15px",
                  lineHeight: "1.9",
                  maxWidth: "760px",
                  margin: "0 auto",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                }}
              >
                {tenant.about_text}
              </p>
            </FadeIn>
          </div>
        </section>
      )}
    </>
  );
}

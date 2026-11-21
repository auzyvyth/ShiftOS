// Buyer reviews, version C "Framed" (STOREFRONT-2 stage 4): a centred heading and the reviews
// in one card with a top line in the dealer's colour. The list is the same ReviewsSection as
// version A and the car pages: real buyer reviews only.
// Hidden the same way as A.
import ReviewsSection from "../../reviews/ReviewsSection";
import { FadeIn } from "./ui";
import { wrap, secB, DARK_REVIEW_TH, accentOf } from "./shared";

export default function ReviewsFramed({ tenant, siteName }) {
  if (!tenant?.id) return null;
  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .rvf { max-width: 760px; margin: 0 auto; }
        .rvf-head { text-align: center; margin-bottom: 28px; }
        .rvf-head .sfv-eyebrow { justify-content: center; }
        .rvf-card { background: var(--sf-card, #111113); border-radius: 16px; border-top: 2px solid var(--sf-accent); padding: 4px 28px 28px; }
        .rvf-card > div { margin-top: 0 !important; border-top: none !important; } /* the list's own top line: the card has one */
        @media (max-width: 480px) { .rvf-card { padding: 0 16px 20px; } }
      `}</style>
      <div style={wrap}>
        <div className="rvf">
          <FadeIn>
            <div className="rvf-head">
              <p className="sfv-eyebrow">Buyer reviews</p>
              <h2 className="sec-title">What buyers say</h2>
            </div>
          </FadeIn>
          <div className="rvf-card">
            <ReviewsSection dealerId={tenant.id} sellerName={siteName} isXdrive={false} th={DARK_REVIEW_TH} />
          </div>
        </div>
      </div>
    </section>
  );
}

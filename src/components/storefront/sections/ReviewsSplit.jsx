// Buyer reviews, version B "Side by side" (STOREFRONT-2 stage 4): the heading on the left, the
// reviews (with their own average and "write a review") on the right. The list is the same
// ReviewsSection as version A and the car pages: real buyer reviews (reviews table), never
// typed ones. Hidden the same way as A.
import ReviewsSection from "../../reviews/ReviewsSection";
import { FadeIn } from "./ui";
import { wrap, secB, DARK_REVIEW_TH, accentOf } from "./shared";

export default function ReviewsSplit({ tenant, siteName }) {
  if (!tenant?.id) return null;
  return (
    <section className="sec-pad" style={{ ...secB, "--sf-accent": accentOf(tenant) }}>
      <style>{`
        .rvs { display: grid; gap: 8px; }
        @media (min-width: 900px) { .rvs { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; align-items: start; } }
        .rvs-list > div { margin-top: 0 !important; } /* line up with the heading */
      `}</style>
      <div style={wrap}>
        <div className="rvs">
          <FadeIn>
            <p className="sfv-eyebrow">Buyer reviews</p>
            <h2 className="sec-title">What buyers say about {siteName}</h2>
          </FadeIn>
          <div className="rvs-list" style={{ minWidth: 0 }}>
            <ReviewsSection dealerId={tenant.id} sellerName={siteName} isXdrive={false} th={DARK_REVIEW_TH} />
          </div>
        </div>
      </div>
    </section>
  );
}

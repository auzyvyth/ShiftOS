import ReviewsSection from "../../reviews/ReviewsSection";
import { wrap, secB, DARK_REVIEW_TH } from "./shared";

// Real buyer reviews for this dealer (reviews table), never typed ones.
export default function Reviews({ tenant, siteName }) {
  return (
    <>
      {tenant?.id && (
        <section className="sec-pad" style={secB}>
          <div style={{ ...wrap, maxWidth: 760 }}>
            <ReviewsSection
              dealerId={tenant.id}
              sellerName={siteName}
              isXdrive={false}
              th={DARK_REVIEW_TH}
            />
          </div>
        </section>
      )}
    </>
  );
}

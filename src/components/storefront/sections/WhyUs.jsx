import { TrendingDown, UserCheck, ShieldCheck, DollarSign } from "lucide-react";
import { storefrontWhy } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secA } from "./shared";

const whyIcons = [TrendingDown, UserCheck, ShieldCheck, DollarSign];

// "Why us": only what the dealer wrote (src/utils/storefrontCopy.js); hidden when blank.
export default function WhyUs({ tenant, siteName }) {
  const whyData = storefrontWhy(tenant?.storefront_why, tenant?.site_name || tenant?.dealership);
  const benefits = (whyData?.items || []).map((item, i) => ({ icon: whyIcons[i], title: item.title, desc: item.desc }));
  const whyTitle = whyData?.title;
  return (
    <>
      {benefits.length > 0 && (
      <section className="sec-pad" style={secA}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Why {siteName}</p>
              <h2 className="sec-title">{whyTitle}</h2>
            </div>
          </FadeIn>
          <div className="why-grid2">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <FadeIn key={i} delay={i * 0.06}>
                  <div className="why-card card-hover">
                    <div className="why-ico">
                      {Icon && <Icon size={20} strokeWidth={2} />}
                    </div>
                    <h3 className="why-t">{b.title}</h3>
                    <p className="why-d">{b.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>
      )}
    </>
  );
}

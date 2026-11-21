import { MessageCircle, Search, Shield, CheckCircle } from "lucide-react";
import { storefrontHow } from "../../../utils/storefrontCopy";
import { FadeIn } from "./ui";
import { wrap, secB } from "./shared";

const howIcons = [MessageCircle, Search, Shield, CheckCircle];
const howNums = ["01", "02", "03", "04"];

// "How it works": only the steps the dealer wrote; hidden when blank (the header and
// footer links use the same rule, hasHowItWorks).
export default function HowItWorks({ tenant }) {
  const howData = storefrontHow(tenant?.storefront_how);
  const steps = (howData?.steps || []).map((step, i) => ({ n: howNums[i], icon: howIcons[i], t: step.title, d: step.desc }));
  const howTitle = howData?.title;
  return (
    <>
      {steps.length > 0 && (
      <section id="how-it-works" className="sec-pad" style={secB}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom: "48px" }}>
              <p className="sec-eyebrow">Simple Process</p>
              <h2 className="sec-title">{howTitle}</h2>
            </div>
          </FadeIn>
          <div className="how-list">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const right = i % 2 === 1;
              return (
                <FadeIn
                  key={i}
                  className="how-step"
                  from={right ? "right" : "left"}
                  delay={i * 0.05}
                >
                  <div className="how-card">
                    <div className="how-ico">
                      {Icon && <Icon size={24} strokeWidth={2} />}
                    </div>
                    <div>
                      <p className="how-k">Step {s.n}</p>
                      <h3 className="how-t">{s.t}</h3>
                      <p className="how-d">{s.d}</p>
                    </div>
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

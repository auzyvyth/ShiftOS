// Every section of a dealer's own site, in the order the page shows them today.
// STOREFRONT-2 (docs/STOREFRONT_PLAN.md): stage 1 split them out of HomePage.jsx with no
// visible change; stage 2 turns this list into the dealer's saved layout. Each section
// gets the same props (HomePage.jsx `ctx`) and returns null when it has nothing to show.
import HeroCarousel from "@/components/HeroCarousel";
import DealerStrip from "./DealerStrip";
import HeroVideo from "./HeroVideo";
import HotDeals from "./HotDeals";
import Inventory from "./Inventory";
import About from "./About";
import Reviews from "./Reviews";
import WhyUs from "./WhyUs";
import Stats from "./Stats";
import HowItWorks from "./HowItWorks";
import Testimonials from "./Testimonials";
import CalculatorCta from "./CalculatorCta";
import Contact from "./Contact";

const Hero = ({ siteName }) => <HeroCarousel compact siteName={siteName} />;

export const STOREFRONT_SECTIONS = [
  { id: "hero", Component: Hero },
  { id: "strip", Component: DealerStrip },
  { id: "video", Component: HeroVideo },
  { id: "hot_deals", Component: HotDeals },
  { id: "cars", Component: Inventory },
  { id: "about", Component: About },
  { id: "reviews", Component: Reviews },
  { id: "why", Component: WhyUs },
  { id: "stats", Component: Stats },
  { id: "how", Component: HowItWorks },
  { id: "testimonials", Component: Testimonials },
  { id: "calculator", Component: CalculatorCta },
  { id: "contact", Component: Contact },
];

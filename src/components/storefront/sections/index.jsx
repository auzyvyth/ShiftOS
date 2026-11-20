// Every section of a dealer's own site and the versions of it the page can draw.
// STOREFRONT-2 (docs/STOREFRONT_PLAN.md). Which sections show, in what order and which
// version is the dealer's saved layout (src/utils/storefrontLayout.js); HomePage.jsx draws
// it. Every section gets the same props (HomePage `ctx`) and returns null when it has
// nothing to show.
//
// Loading: what usually sits on the first screen, and the two sections the header links
// jump to (#how-it-works, #contact), load with the page. The rest load only when the page
// draws them, one small file each, so a version a dealer did not pick is never downloaded.
// A new version = one more key under its section here (max 3: VARIANTS), nothing else.
import { lazy } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import DealerStrip from "./DealerStrip";
import HeroVideo from "./HeroVideo";
import HotDeals from "./HotDeals";
import Inventory from "./Inventory";
import HowItWorks from "./HowItWorks";
import Contact from "./Contact";

const About = lazy(() => import("./About"));
const Reviews = lazy(() => import("./Reviews"));
const WhyUs = lazy(() => import("./WhyUs"));
const Stats = lazy(() => import("./Stats"));
const Testimonials = lazy(() => import("./Testimonials"));
const CalculatorCta = lazy(() => import("./CalculatorCta"));
// Versions B and C: only the one a dealer picked is ever downloaded.
const HeroSplit = lazy(() => import("./HeroSplit"));
const HeroMosaic = lazy(() => import("./HeroMosaic"));
const InventoryRail = lazy(() => import("./InventoryRail"));
const InventorySpotlight = lazy(() => import("./InventorySpotlight"));
const AboutSplit = lazy(() => import("./AboutSplit"));
const AboutLead = lazy(() => import("./AboutLead"));
const WhyUsSplit = lazy(() => import("./WhyUsSplit"));
const WhyUsNumbered = lazy(() => import("./WhyUsNumbered"));
const StatsBig = lazy(() => import("./StatsBig"));
const StatsBand = lazy(() => import("./StatsBand"));
// How it works B/C carry id="how-it-works" too. Lazy like the rest: the chunk is fetched as
// the page draws (not on scroll), so a header-link tap finds it; only a cold load of
// /#how-it-works can arrive a moment before it.
const HowTimeline = lazy(() => import("./HowTimeline"));
const HowRow = lazy(() => import("./HowRow"));
const ReviewsSplit = lazy(() => import("./ReviewsSplit"));
const ReviewsFramed = lazy(() => import("./ReviewsFramed"));

const Hero = ({ siteName }) => <HeroCarousel compact siteName={siteName} />;

export const SECTION_VERSIONS = {
  hero: { a: Hero, b: HeroSplit, c: HeroMosaic },
  strip: { a: DealerStrip },
  video: { a: HeroVideo },
  hot_deals: { a: HotDeals },
  cars: { a: Inventory, b: InventoryRail, c: InventorySpotlight },
  about: { a: About, b: AboutSplit, c: AboutLead },
  reviews: { a: Reviews, b: ReviewsSplit, c: ReviewsFramed },
  why: { a: WhyUs, b: WhyUsSplit, c: WhyUsNumbered },
  stats: { a: Stats, b: StatsBig, c: StatsBand },
  how: { a: HowItWorks, b: HowTimeline, c: HowRow },
  testimonials: { a: Testimonials },
  calculator: { a: CalculatorCta },
  contact: { a: Contact },
};

// What cleanLayout may keep, as plain data (the editor reads it without this file).
export { AVAILABLE_VERSIONS } from "./versions";

// What shows for the split second a lazily loaded top banner takes to arrive: the same dark
// ground at banner height, so nothing below it jumps up and back down.
export const SECTION_FALLBACK = {
  hero: <div aria-hidden style={{ minHeight: "min(70vh, 640px)", background: "#0C0C0E" }} />,
};

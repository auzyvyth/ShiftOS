// Shared facts for the top-banner and car-section versions that show real cars
// (STOREFRONT-2 stage 3). Only facts from the car row: name, price, the card's own
// monthly estimate (calcMonthly, the same number ShowroomCard prints). Never a claim.
import { cdnImg } from "../../../utils/img";
import { calcMonthly } from "../../../utils/financing";
import { cardTitle } from "../../../utils/cardTitle";

export const carHref = (car) => `/cars/${car.slug || car.id}`;
export const carPhoto = (car, w = 960) => {
  const url = Array.isArray(car?.images) ? car.images.find(Boolean) : null;
  return url ? cdnImg(url, w, 72) : null;
};
export const carName = (car) => {
  const { name, variant } = cardTitle(car);
  return variant ? `${name} ${variant}` : name;
};
export const rm = (n) => `RM ${Math.round(Number(n) || 0).toLocaleString("en-MY")}`;
export const carPrice = (car) => (Number(car?.selling_price) > 0 ? rm(car.selling_price) : "Ask for price");
export const carMonthly = (car) => {
  const m = calcMonthly(Number(car?.selling_price) || 0);
  return m ? `est. ${rm(m)}/mo` : "";
};
// The cars a banner may show: priced, with a photo, newest first (the page's own order).
export const showcaseCars = (cars, max) => (cars || []).filter((c) => carPhoto(c) && Number(c.selling_price) > 0).slice(0, max);

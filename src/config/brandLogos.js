// Brand logo files in /public/brands, the ONE map (the marketplace's New-car picker and brand row,
// and the dealer site's brand strip read it). A brand is listed here only once its CURRENT logo
// is in that folder; every other brand renders as a wordmark. (The old proton.svg was the
// ProtonMail logo; proton.png + byd.png + perodua.png came from the owner, 2026-10-22.)
// The other files in /public/brands are not listed on purpose: nobody has checked them.
export const LOGOS = {
  Proton: '/brands/proton.png', Perodua: '/brands/perodua.png', Toyota: '/brands/toyota.svg',
  BYD: '/brands/byd.png', Honda: '/brands/honda.svg', Jaecoo: '/brands/jaecoo.png',
};

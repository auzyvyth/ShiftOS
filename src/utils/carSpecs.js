// Lightweight local-market spec lookup for common Malaysian models.
// No JPJ API access — this is a pragmatic auto-fill so dealers don't have to
// type engine CC / body type for the cars they sell most. Covers the
// high-volume Perodua/Proton/Honda/Toyota/Nissan range; everything else
// falls back to manual entry. Keyed by lowercased "make model".
//
// cc = typical engine displacement, body = body type.
const SPECS = {
  // Perodua
  "perodua myvi":     { cc: 1496, body: "Hatchback" },
  "perodua axia":     { cc: 998,  body: "Hatchback" },
  "perodua bezza":    { cc: 1331, body: "Sedan" },
  "perodua alza":     { cc: 1496, body: "MPV" },
  "perodua aruz":     { cc: 1496, body: "SUV" },
  "perodua ativa":    { cc: 998,  body: "SUV" },
  "perodua kancil":   { cc: 847,  body: "Hatchback" },
  "perodua kenari":   { cc: 989,  body: "Hatchback" },
  "perodua viva":     { cc: 998,  body: "Hatchback" },
  // Proton
  "proton saga":      { cc: 1332, body: "Sedan" },
  "proton persona":   { cc: 1597, body: "Sedan" },
  "proton iriz":      { cc: 1597, body: "Hatchback" },
  "proton x50":       { cc: 1477, body: "SUV" },
  "proton x70":       { cc: 1798, body: "SUV" },
  "proton x90":       { cc: 1477, body: "SUV" },
  "proton exora":     { cc: 1561, body: "MPV" },
  "proton preve":     { cc: 1561, body: "Sedan" },
  "proton waja":      { cc: 1597, body: "Sedan" },
  "proton wira":      { cc: 1468, body: "Sedan" },
  // Honda
  "honda city":       { cc: 1498, body: "Sedan" },
  "honda civic":      { cc: 1498, body: "Sedan" },
  "honda accord":     { cc: 1498, body: "Sedan" },
  "honda jazz":       { cc: 1497, body: "Hatchback" },
  "honda hr-v":       { cc: 1498, body: "SUV" },
  "honda hrv":        { cc: 1498, body: "SUV" },
  "honda cr-v":       { cc: 1498, body: "SUV" },
  "honda crv":        { cc: 1498, body: "SUV" },
  "honda br-v":       { cc: 1497, body: "SUV" },
  "honda brv":        { cc: 1497, body: "SUV" },
  "honda wr-v":       { cc: 1498, body: "SUV" },
  "honda odyssey":    { cc: 2356, body: "MPV" },
  // Toyota
  "toyota vios":      { cc: 1496, body: "Sedan" },
  "toyota yaris":     { cc: 1496, body: "Hatchback" },
  "toyota corolla":   { cc: 1798, body: "Sedan" },
  "toyota altis":     { cc: 1798, body: "Sedan" },
  "toyota camry":     { cc: 2487, body: "Sedan" },
  "toyota hilux":     { cc: 2393, body: "Pickup" },
  "toyota fortuner":  { cc: 2393, body: "SUV" },
  "toyota rush":      { cc: 1496, body: "SUV" },
  "toyota innova":    { cc: 1998, body: "MPV" },
  "toyota avanza":    { cc: 1496, body: "MPV" },
  "toyota veloz":     { cc: 1496, body: "MPV" },
  "toyota alphard":   { cc: 2493, body: "MPV" },
  "toyota vellfire":  { cc: 2493, body: "MPV" },
  "toyota harrier":   { cc: 1986, body: "SUV" },
  // Nissan
  "nissan almera":    { cc: 999,  body: "Sedan" },
  "nissan x-trail":   { cc: 1997, body: "SUV" },
  "nissan xtrail":    { cc: 1997, body: "SUV" },
  "nissan serena":    { cc: 1997, body: "MPV" },
  "nissan navara":    { cc: 2488, body: "Pickup" },
  // Mazda
  "mazda 2":          { cc: 1496, body: "Sedan" },
  "mazda 3":          { cc: 1998, body: "Sedan" },
  "mazda cx-3":       { cc: 1998, body: "SUV" },
  "mazda cx-5":       { cc: 1998, body: "SUV" },
  "mazda cx-30":      { cc: 1998, body: "SUV" },
  "mazda cx-8":       { cc: 2488, body: "SUV" },
  // Mitsubishi
  "mitsubishi triton":  { cc: 2442, body: "Pickup" },
  "mitsubishi asx":     { cc: 1998, body: "SUV" },
  "mitsubishi outlander": { cc: 2360, body: "SUV" },
  "mitsubishi xpander": { cc: 1499, body: "MPV" },
};

// Returns { cc, body } if a confident match is found, else null.
export function lookupCarSpec(make, model) {
  if (!make || !model) return null;
  const key = `${make} ${model}`.toLowerCase().trim().replace(/\s+/g, " ");
  return SPECS[key] || null;
}

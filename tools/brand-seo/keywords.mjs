// node tools/brand-seo/keywords.mjs > docs/BRAND_SEO_KEYWORDS.md
import { SAMPLE_ROWS } from "./sample-rows.mjs";
import { NEW_CAR_BRANDS } from "../../src/utils/newCars.js";
import { hubModels, hubPath, brandKeywords } from "../../src/utils/brandHub.js";

const out = [`# Brand page keywords (2026-11-25)

Source: Google Malaysia results for each brand's price list, models, hybrid / EV / instalment and Malay
("harga kereta <brand>") searches. Who ranks: ZigWheels, Paultan, Carlist, SoyaCincau, PCauto, Motorist,
Bateriku, and the brands' own sites. The patterns that kept appearing:

- \`<brand> price malaysia 2026\`, \`<brand> price list\`, \`<brand> models\`, \`new <brand>\`, \`<brand> cars price\`
- \`<brand> <body>\` pages (SUV, sedan, MPV, 5 / 7 seater), \`<brand> hybrid\`, \`<brand> EV\`, \`<brand> under RMxxk\`
- \`<model> price\`, \`<model> variants\`, \`<model> specs\`, \`<model> review\`, \`<model> vs <rival>\`
- Malay: \`harga kereta <brand> 2026\`, \`senarai harga <brand>\`, \`ansuran bulanan <model>\`
- News intent (price cut, launch, rebate, Merdeka promo): NOT answered by these pages on purpose, promos expire and
  the database holds none.

Each keyword below is answered by something real on the brand page or its model / loan pages
(\`/new-cars/<brand>\`, \`/new-cars/<brand>/<model>\`, \`/kalkulator-loan/<brand>\`). Built by \`brandKeywords()\` in
\`src/utils/brandHub.js\` from the price list; re-run \`node tools/brand-seo/keywords.mjs\` when models change.
Search volumes are not in this file: no keyword tool was available, so nothing here is ranked by volume.
`];
for (const brand of NEW_CAR_BRANDS) {
  const models = hubModels(brand, SAMPLE_ROWS);
  const kw = brandKeywords(brand, models, 2026);
  out.push(`\n## ${brand} (${models.length} models, ${kw.length} keywords) - ${hubPath(brand)}\n`);
  out.push(kw.map((k) => `- ${k}`).join("\n"));
}
console.log(out.join("\n"));

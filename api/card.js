/* eslint-env node */
// ONE function for every picture Drevo draws on the server (2026-11-22). They were three
// functions (agent-card, dealer-card, post-photo); each new one pushed the project over
// Vercel's function limit and production stopped deploying (the release of #615 never went
// live). Keep new pictures HERE (a new file in api/_cards/ + a line below), never a new
// file in api/. The old addresses still work: vercel.json rewrites them to ?kind=.
//   /api/agent-card?slug=   -> kind=agent   (link preview of a seller's page)
//   /api/dealer-card?sub=   -> kind=dealer  (link preview of a dealer storefront)
//   /api/post-photo?car=&i= -> kind=post    (watermarked photo for Drevo's own social posts)
// Each is imported only when asked for, so a request loads one set of fonts and images.
const KINDS = {
  agent: () => import('./_cards/agent.js'),
  dealer: () => import('./_cards/dealer.js'),
  post: () => import('./_cards/post.js'),
};

export default async function handler(req, res) {
  const load = KINDS[String(req.query?.kind || '')];
  if (!load) {
    res.status(404).send('not found');
    return;
  }
  const mod = await load();
  return mod.default(req, res);
}

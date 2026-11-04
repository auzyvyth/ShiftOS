// "Find me" board copy, shared by src/pages/FindMePage.jsx and the crawler
// render in api/og.js so the two cannot drift.
export const FIND_ME_COPY = {
  title: 'Find me a car | Drevo',
  description: 'Post the used car you want on Drevo. Dealers and agents who have it message you, and your name stays hidden until you reply.',
  eyebrow: 'Find me a car',
  h1: 'Tell sellers what you want',
  intro: (max) => `Post the car you are looking for. Dealers and agents who have it message you here, up to ${max} per post. Your name stays hidden until you reply.`,
};

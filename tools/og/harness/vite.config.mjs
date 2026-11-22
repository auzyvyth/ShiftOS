import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../..');
const nm = path.join(repo, 'node_modules');
export default defineConfig({
  root: here, plugins: [react()],
  resolve: { alias: [
    { find: /^.*\/supabaseClient(\.js)?$/, replacement: path.join(here, 'stub.js') },
    ...['react','react-dom','lucide-react','react-i18next','i18next','i18next-browser-languagedetector','sonner','react-router-dom','recharts','@tanstack/react-query'].map((m) => ({ find: new RegExp(`^${m}(/.*)?$`), replacement: path.join(nm, m) + '$1' })),
  ] },
  // Car photos for the demo cards: the ad photos (marketing/ads/drevo-remotion/public/photos).
  publicDir: path.join(repo, 'marketing/ads/drevo-remotion/public'),
  server: { port: 5299, strictPort: true, fs: { allow: [repo] } },
  css: { postcss: repo },
});

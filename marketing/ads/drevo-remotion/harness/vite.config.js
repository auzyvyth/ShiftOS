import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../../..');
const nm = path.resolve(here, '../node_modules');
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^.*\/supabaseClient(\.js)?$/, replacement: path.join(here, 'stubSupabase.js') },
      ...['react', 'react-dom', 'lucide-react', 'react-i18next', 'i18next', 'i18next-browser-languagedetector', 'sonner', 'react-router-dom']
        .map((m) => ({ find: new RegExp(`^${m}(/.*)?$`), replacement: path.join(nm, m) + '$1' })),
    ],
  },
  server: { port: 5199, strictPort: true, fs: { allow: [repo] } },
  css: { postcss: { plugins: [] } },
});

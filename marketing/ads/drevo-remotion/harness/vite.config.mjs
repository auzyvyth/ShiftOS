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
      { find: /^onnxruntime-web\/wasm$/, replacement: path.join(nm, 'onnxruntime-web/dist/ort.wasm.bundle.min.mjs') },
      { find: /^onnxruntime-web\/webgpu$/, replacement: path.join(nm, 'onnxruntime-web/dist/ort.webgpu.bundle.min.mjs') },
      { find: /^.*\/supabaseClient(\.js)?$/, replacement: path.join(here, 'stubSupabase.js') },
      ...['react', 'react-dom', 'lucide-react', 'react-i18next', 'i18next', 'i18next-browser-languagedetector', 'sonner', 'react-router-dom']
        .map((m) => ({ find: new RegExp(`^${m}(/.*)?$`), replacement: path.join(nm, m) + '$1' })),
    ],
  },
  publicDir: path.join(repo, 'public'),
  build: { rollupOptions: { input: ['index.html', 'tools.html'].map((f) => path.join(here, f)) } },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: { port: 5199, strictPort: true, fs: { allow: [repo] } },
  css: { postcss: { plugins: [] } },
});

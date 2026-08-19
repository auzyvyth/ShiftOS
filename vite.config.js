import path from 'node:path';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Single source of truth for the app version: package.json "version".
// Bumped with `npm version <patch|minor|major>` on each prod release, which
// also creates the matching git tag. Exposed to the client as __APP_VERSION__.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	plugins: [
		react(),
		sentryVitePlugin({
			org: process.env.SENTRY_ORG,
			project: process.env.SENTRY_PROJECT,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			silent: true,
		}),
		VitePWA({
			// 'prompt' (not 'autoUpdate') so the plugin's own client bundle never
			// fires its internal window.location.reload() on activation — that call
			// is a *plain* reload with no cache-busting, which in aggressively
			// caching mobile webviews (Facebook/Instagram in-app browsers) can be
			// served the same stale document from HTTP cache, silently no-opping
			// and forcing repeat manual reloads after every deploy. main.jsx drives
			// the reload itself via controllerchange + hardReload() instead.
			registerType: 'prompt',
				injectRegister: false,
			manifest: {
				name: 'ShiftOS by XDrive',
				short_name: 'ShiftOS',
				description: 'Car dealership management platform',
				lang: 'en',
				theme_color: '#080C14',
				background_color: '#080C14',
				display: 'standalone',
				start_url: '/',
				// `id` pins the install identity. With no id the browser derives it
				// from start_url, so ever changing start_url (e.g. routing installed
				// users straight to /dashboard) would read as a DIFFERENT app —
				// existing installs orphan instead of updating. Setting it now, while
				// the install base is small, makes start_url safe to change later.
				id: '/',
				// Explicit scope. The default is start_url's directory, which happens
				// to be the same thing here; stating it keeps it from silently moving
				// if start_url ever gains a path.
				scope: '/',
				// NOTE: orientation is deliberately unset. The dealer dashboard has
				// wide stock/P&L tables that are genuinely better in landscape on a
				// tablet, so locking to portrait would be hostile.
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
				],
			},
			workbox: {
				// Pulls the push/notificationclick handlers into the generated SW.
				// generateSW writes sw.js from scratch every build, so this is the only
				// place custom handlers can live without switching to injectManifest —
				// which would mean rebuilding the precache config below, the exact thing
				// that caused the two outages its comments describe. See public/push-sw.js.
				importScripts: ['/push-sw.js'],
				// MUST be explicitly `null` (workbox only accepts null|string here), not
				// just omitted — vite-plugin-pwa's own resolver hardcodes a
				// `navigateFallback: 'index.html'` default that silently backfills any
				// unset key, so leaving this key out entirely (as an earlier version of
				// this config did) does NOT disable it.
				navigateFallback: null,
				// index.html / the main entry bundle are deliberately EXCLUDED below
				// (globIgnores) rather than precached.
				// These two files change on every single deploy — precaching them (as
				// this config used to, via navigateFallback + '**/index-*.js') meant a
				// still-installed OLD service worker kept serving its OLD index.html on
				// the very next navigation after a push, which then requested the OLD
				// entry chunk hash. Vercel deletes old hashed assets on each deploy, so
				// that request 404s -> the SPA catch-all rewrite returns index.html
				// content for a .js request -> MIME-type mismatch -> the module fails
				// to load BEFORE React ever mounts (a dark blank page, not even the
				// error fallback renders) -> the recovery reload can hit the SAME
				// still-stale worker again, needing several reloads before the new
				// worker finally wins the race.
				// vercel.json already sets Cache-Control: max-age=0, must-revalidate on
				// index.html and the JS entry, so the browser fetches them fresh from
				// network on every navigation as long as nothing intercepts that
				// request. Letting the service worker touch neither file removes the
				// entire staleness race for the two things that change every push.
				// cleanupOutdatedCaches purges old precache buckets from prior SW
				// versions; skipWaiting + clientsClaim still make a fresh worker take
				// over the instant it's ready, for the vendor assets it still precaches.
				cleanupOutdatedCaches: true,
				skipWaiting: true,
				clientsClaim: true,
				// Only precache genuinely immutable, content-hashed vendor chunks — if
				// their content changes, Vite gives them a NEW filename, so there is no
				// staleness risk in caching them aggressively. Dealer-only JS chunks
				// (Dashboard, Salesman, Import, PDF/XLSX/charts) are excluded so a
				// public visitor's first load doesn't pull 5.6 MB of admin code, and are
				// fetched live from the network same as index.html / the entry bundle.
				globPatterns: ['**/*.{css,ico,png,svg}', '**/vendor-react*', '**/vendor-supabase*', '**/vendor-ui*'],
				globIgnores: [
					'**/index.html', '**/index-*.js',
					'**/DashboardPage*', '**/Salesmanpanel*', '**/SalesmanLite*',
					'**/SalesmanPremium*', '**/SalesmanOnboarding*', '**/ImportStockPage*',
					'**/AccountantPanel*', '**/AdminPanel*', '**/AdminPage*',
					'**/ManagerPanel*', '**/FIPanel*', '**/AccountsPanel*',
					'**/LeadsPage*', '**/vendor-charts*', '**/vendor-pdf*',
					'**/vendor-xlsx*', '**/html2canvas*', '**/pdf.worker*',
				],
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
				// PWA-2: offline fallback. Deliberately NOT navigateFallback (see the
				// comment on that key above) — this only substitutes offline.html when
				// a navigation genuinely fails, and never touches index.html's
				// network-fresh behaviour otherwise.
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkOnly',
						options: {
							plugins: [{
								handlerDidError: async () => caches.match('/offline.html'),
							}],
						},
					},
				],
				// offline.html has to be in the precache from the very first SW
				// install, not fetched on demand — by definition it's only ever
				// needed once the network has already failed. Revision is tied to
				// the app version (bumped by `npm version`, same as __APP_VERSION__
				// above) so editing the page invalidates the cached copy on the next
				// release instead of needing a manual revision bump.
				additionalManifestEntries: [
					{ url: '/offline.html', revision: pkg.version },
				],
			},
		}),
	],
	server: {
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					'vendor-motion': ['framer-motion'],
					'vendor-supabase': ['@supabase/supabase-js'],
					'vendor-ui': ['lucide-react', 'react-helmet', 'react-i18next'],
					'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
					'vendor-charts': ['recharts'],
					'vendor-pdf': ['jspdf'],
					'vendor-xlsx': ['xlsx'],
				},
			},
		},
		chunkSizeWarningLimit: 600,
	},
});

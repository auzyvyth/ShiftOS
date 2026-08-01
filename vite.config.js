import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
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
				theme_color: '#080C14',
				background_color: '#080C14',
				display: 'standalone',
				start_url: '/',
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
				],
			},
			workbox: {
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
				// Durable revisit caching for the content-hashed app chunks that are
				// deliberately NOT precached (the entry index-*.js, dealer-only chunks,
				// vendor-charts/pdf/xlsx). The browser HTTP cache gives these a 1-year
				// immutable header (vercel.json), but mobile browsers evict it
				// aggressively after a day — the "reopened after a day is slow" report:
				// the 155 KB entry re-downloads from the network. Cache Storage is far
				// more durable, so on revisit these serve instantly from the SW instead.
				//
				// CacheFirst is safe here precisely because every /assets/ filename is
				// content-hashed: a URL's bytes never change, so a cached hit is never
				// stale. A new deploy ships a NEW hash -> cache miss -> fetched fresh
				// once -> cached. index.html itself is untouched (still network-first
				// via must-revalidate), so the blank-after-deploy staleness race the
				// precache config guards against cannot occur. This is on-demand (not
				// precache), so a public visitor never pulls dealer chunks — only the
				// chunks a session actually requests get cached for its own revisit.
				runtimeCaching: [
					{
						urlPattern: /\/assets\/[^/]+\.(?:js|css)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'app-assets-v1',
							expiration: {
								maxEntries: 120,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
								purgeOnQuotaError: true,
							},
							cacheableResponse: { statuses: [0, 200] },
						},
					},
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

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
			registerType: 'autoUpdate',
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
				navigateFallback: '/index.html',
				// Only precache critical public assets. Dealer-only JS chunks
				// (Dashboard, Salesman, Import, PDF/XLSX/charts) are excluded so
				// a public visitor's first load doesn't pull 5.6 MB of admin code.
				globPatterns: ['**/*.{css,html,ico,png,svg}', '**/vendor-react*', '**/vendor-supabase*', '**/vendor-ui*', '**/index-*.js'],
				globIgnores: [
					'**/DashboardPage*', '**/Salesmanpanel*', '**/SalesmanLite*',
					'**/SalesmanPremium*', '**/SalesmanOnboarding*', '**/ImportStockPage*',
					'**/AccountantPanel*', '**/AdminPanel*', '**/AdminPage*',
					'**/ManagerPanel*', '**/FIPanel*', '**/AccountsPanel*',
					'**/LeadsPage*', '**/vendor-charts*', '**/vendor-pdf*',
					'**/vendor-xlsx*', '**/html2canvas*', '**/pdf.worker*',
				],
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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

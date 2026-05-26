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
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.js',
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
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
				maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
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
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					'vendor-motion': ['framer-motion'],
					'vendor-supabase': ['@supabase/supabase-js'],
					'vendor-ui': ['lucide-react', 'react-helmet', 'react-i18next'],
					'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
					'vendor-pdf': ['jspdf'],
				},
			},
		},
		chunkSizeWarningLimit: 600,
	},
});

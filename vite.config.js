import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		react(),
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
		rollupOptions: {
			output: {
				manualChunks: {
					// Core React runtime
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					// Animation library
					'vendor-motion': ['framer-motion'],
					// Supabase client
					'vendor-supabase': ['@supabase/supabase-js'],
					// UI utilities
					'vendor-ui': ['lucide-react', 'react-helmet', 'react-i18next'],
					// DnD
					'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
					// PDF generation
					'vendor-pdf': ['jspdf'],
				},
			},
		},
		// Raise warning threshold slightly — we're now splitting properly
		chunkSizeWarningLimit: 600,
	},
});
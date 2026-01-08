import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sdk': path.resolve(__dirname, '../sdk'),
      '@lunar-dollar': path.resolve(__dirname, '../../lunar-dollar/sdk'),
    },
  },
  server: {
    port: 3000,
    // Allow importing the sibling ../sdk and ../../lunar-dollar/sdk folders in dev
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../lunar-dollar/sdk')],
    },
    proxy: {
      '/v1': {
        target: process.env.VITE_LEDGER_URL || 'http://localhost:7575',
        changeOrigin: true,
        secure: false,
      },
      '/navigator-api': {
        target: process.env.VITE_NAVIGATOR_URL || 'http://localhost:7500',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/navigator-api/, '/api'),
      },
    },
  },
  define: {
    // Fallback for proxy target when env var not set
    'import.meta.env.VITE_LEDGER_URL': JSON.stringify(process.env.VITE_LEDGER_URL || ''),
  },
});

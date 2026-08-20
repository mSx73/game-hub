import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          realtime: ['socket.io-client', 'livekit-client'],
          motion: ['framer-motion'],
          ui: ['lucide-react', 'clsx', 'tailwind-merge'],
          effects: ['canvas-confetti'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/livekit-token': { target: 'http://localhost:3002', changeOrigin: true },
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3002', ws: true },
    },
  },
});

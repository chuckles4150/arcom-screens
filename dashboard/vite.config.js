import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During local dev, proxy API calls to the Express server.
    proxy: {
      '/api': 'http://localhost:8080',
      '/screenshots': 'http://localhost:8080',
    },
  },
});

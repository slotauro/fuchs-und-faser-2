import { defineConfig } from 'vite';

export default defineConfig({
  // Three.js allein ist rund 600 kB; ein Aufteilen bringt für dieses kleine Spiel wenig.
  build: { chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
});

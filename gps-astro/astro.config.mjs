import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// Vercel adapter for production deploys (serverless functions for SSR routes).
// Node standalone adapter stays available for local dev / self-hosting.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

export default defineConfig({
  output: 'server',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  devToolbar: { enabled: false },
});

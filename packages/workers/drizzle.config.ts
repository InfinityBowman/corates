import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.js',
  out: './migrations',
  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4ecd5402c7f7163e3273bf055876334a8c73c1a3f79e9dc457c7730d98ff5be4.sqlite',
  },
});

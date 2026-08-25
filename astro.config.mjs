import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// BASE_PATH is set by .github/workflows/pages.yml to "/<repo-name>" for GitHub Pages
// project-page deploys. Locally (dev/preview) it's unset, so base defaults to "/" and
// every route works from http://localhost too — all internal links use
// import.meta.env.BASE_URL rather than hardcoded absolute paths, so both resolve.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  integrations: [react(), mdx()],
  outDir: './dist',
  base,
  build: { format: 'directory' },
});

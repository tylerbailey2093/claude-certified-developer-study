import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// BASE_PATH is set by .github/workflows/pages.yml to "/<repo-name>" for GitHub Pages
// project-page deploys. Locally it's unset, so base defaults to "/" — every internal
// link uses import.meta.env.BASE_URL rather than a hardcoded path, so both resolve.
// Normalise to a trailing slash. Every template builds links as `${base}foo/`,
// so a base without the trailing slash silently concatenates into
// "/repo-namefoo/" — which 404s on Pages while working fine locally where
// base is just "/". That exact bug shipped once; keep the normalisation.
const rawBase = process.env.BASE_PATH || '/';
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export default defineConfig({
  integrations: [react(), mdx()],
  outDir: './dist',
  base,
  build: { format: 'directory' },
  markdown: {
    shikiConfig: {
      // Dual themes emitted as CSS variables (--shiki-light / --shiki-dark) so the
      // site's own theme toggle drives code colours too, with no flash and no JS.
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
      wrap: false,
    },
  },
});

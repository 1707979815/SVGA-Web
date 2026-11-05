# custom-svga online demo

Source of the online demo: **https://1707979815.github.io/SVGA-Web/**

- Vue 3 + Vite + TypeScript + SCSS, using the published [`custom-svga`](https://www.npmjs.com/package/custom-svga) package from npm.
- Single-instance regression page & multi-instance stress playground: dynamic sprite/text replacement, poster, frame range, frame throttling, DPR cap, etc.
- Deployed to GitHub Pages automatically by `.github/workflows/demo.yml` on every push to `main` that touches this directory.

## Run locally

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # vue-tsc --noEmit && vite build
```

The default `.svga` asset is served from `public/`; in dev, `/svga` requests are proxied (see `vite.config.ts`).

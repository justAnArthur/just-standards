Ship a favicon (SVG preferred, plus a 32×32 PNG or ICO fallback) and a 180×180 `apple-touch-icon` PNG, made from the logo the repo already has.

- **Next.js:** `app/icon.svg` (or `icon.png`) and `app/apple-icon.png`; Next writes the `<link>` tags itself.
- **Astro / static:** files in `public/` and `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` in `<head>`.

If there is no logo in the repo, stop and say so in the PR.

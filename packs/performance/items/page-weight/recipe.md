## Done when
The check passes on the PR's preview: on a phone (390×844), the home page transfers under 1.5 MB in all (compressed, until the network is quiet) and under 400 KB of JavaScript. The evidence names the heaviest files: start there.

## Make what is missing
- **JavaScript:** find what is in the bundles (`next build` output, `@next/bundle-analyzer`, `npx vite-bundle-visualizer`). Move client components that don't need state back to server components; lazy-load what is below the fold or behind a click (`next/dynamic`, `import()`): maps, galleries, date pickers, chat widgets. Replace heavy libraries used for little (moment → `Intl`/date-fns, lodash → native).
- **Several Google tags:** each gtag.js is about 200 KB; load one GTM container (or one gtag with several IDs) instead of separate gtag scripts per GA4 and Ads ID.
- **Images:** `performance/modern-images`; and nothing below the fold loads eagerly (`loading="lazy"`, `priority` only on the LCP image).
- **Fonts:** subset, WOFF2, at most two families and the weights in use.
- **Video:** no autoplaying video on mobile; poster image first.

## Stacks
- **Next.js:** `'use client'` only on leaves; `next/dynamic` with `ssr: false` for browser-only widgets; `@next/third-parties` for Google tags.
- **Payload + Next:** the Payload client (`@payloadcms/ui`) must not reach the public bundle.
- **Astro:** islands with `client:visible` / `client:idle` rather than `client:load`.

## Hand off only when
The weight is a third party's that the business requires (a booking engine's script): name it and its size in the PR, and cut everything else.

## Don't
- Don't defer loading until after the check's quiet period (a timer that loads everything later) to game it.
- Don't remove analytics or the consent manager.

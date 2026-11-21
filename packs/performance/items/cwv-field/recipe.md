## Done when
The check passes on production: PageSpeed Insights reports, for real mobile visitors (CrUX p75), LCP under 2.5 s, INP under 200 ms and CLS under 0.1. Field data trails by up to 28 days, so the PR is done when the lab run on its preview shows the same three in the green and the change targets what the evidence names.

## Make what is missing
Fix what the failing metric points at, measured first: run Lighthouse on the preview (mobile) or open PageSpeed Insights for the page and read its LCP element, its layout shifts and its long tasks.
- **LCP:** the hero image or heading is the LCP element. Serve the hero as AVIF/WebP at the size shown (`next/image` with `sizes`), preload it (`priority` / `preload`), don't lazy-load or fade it in, and don't render it only after JS. Cut render-blocking CSS and fonts (`next/font`), and fix a slow server (`performance/ttfb`).
- **CLS:** every image, video, embed and ad slot has `width`/`height` or an `aspect-ratio`; fonts use `size-adjust` fallbacks (`next/font` does this); banners (cookies, notices) overlay instead of pushing content down.
- **INP:** break long tasks (heavy click handlers, hydration of big client components): move work off the main thread, make components server components, defer third-party scripts (`next/script` `lazyOnload`), debounce input handlers.

## Stacks
- **Next.js:** `next/image` with `priority` on the hero; server components by default; `next/script` for third parties; `@next/bundle-analyzer` to find heavy client bundles.
- **Payload + Next:** the hero's media comes through the repo's `Media` component: give it `priority` and real `sizes` there.

## Hand off only when
The cost is a third-party script the business requires (booking widget, chat) and no lighter way to load it works: name it with its measured cost.

## Don't
- Don't hide content until load or skip rendering for Lighthouse's user agent: that fakes the lab and leaves real visitors where they were.
- Don't remove analytics or consent banners to win milliseconds.

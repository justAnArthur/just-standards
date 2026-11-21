## Done when
The check passes on the PR's preview: no script or stylesheet from another host is render-blocking on the home page (Chromium's own `renderBlockingStatus` for each resource). The page paints even when a third party is slow.

## Make what is missing
- **Google Fonts or another font CDN stylesheet:** self-host the fonts (`next/font/google` downloads them at build time; Astro's `@fontsource/*`), or at least load the stylesheet with `media="print" onload="this.media='all'"`.
- **Third-party scripts in `<head>` without `async`/`defer`:** add `defer` (or `async` for independent tags), or load them after interactive (`next/script` `strategy="afterInteractive"` or `"lazyOnload"`). A consent manager's script may stay early, but `async`.
- **CSS from a CDN (icon fonts, a widget's stylesheet):** bundle it with the site's CSS, or load it when the widget opens.

## Stacks
- **Next.js:** `next/script` instead of raw `<script>` in `layout.tsx`; `next/font` for fonts.
- **Payload + Next:** scripts configured in a site-settings global still render through the layout: use `next/script` there.
- **Astro / static:** `<script is:inline async src>` or move it to the end of the body.

## Hand off only when
Never: deferring or self-hosting is in the repo's hands.

## Don't
- Don't defer the consent manager in a way that lets tags fire before it.
- Don't inline a third party's whole CSS by hand: it goes stale.

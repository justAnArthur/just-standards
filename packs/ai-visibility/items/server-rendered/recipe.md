## Done when
The check passes on the PR's preview: the home page's HTML as served, before any JavaScript runs, has an `h1` with text and the main content (at least 120 words in `<main>`, or in the body outside header, nav and footer). `curl <url>` shows what a visitor reads.

## Make what is missing
- Find what renders on the client only: a page or layout marked `'use client'` that fetches in `useEffect`, a component loaded with `dynamic(..., { ssr: false })`, a `useSearchParams()` without a `<Suspense>` boundary (Next then bails out to client rendering and the HTML carries an empty boundary), or a SPA that mounts into `<div id="root">`.
- Move the data fetching to the server (a server component, `getStaticProps`, a loader) and keep only the interactive parts as client components.
- Render the `h1` and the copy the page already has into the HTML; don't write new copy.

## Stacks
- **Next.js (app router):** pages are server components by default; push `'use client'` down to the leaf that needs state. Wrap `useSearchParams()` users in `<Suspense>` with a fallback that still shows the content.
- **Next 16 with cacheComponents:** use `'use cache'` on the fetcher rather than route segment config.
- **Vite / React SPA:** prerender the public routes (`vite-plugin-ssr`/Vike, `react-snap`, or moving to Astro or Next for the marketing pages).
- **Astro:** components are server-rendered unless a `client:only` directive says otherwise; use `client:load` instead.

## Hand off only when
Never: the content is in the repo, it only renders in the wrong place.

## Don't
- Don't hide a copy of the text for crawlers only (cloaking): what the HTML says must be what visitors see.
- Don't pad the page with filler to reach the word count.

## Done when
The check passes on the PR's preview: PageSpeed Insights' mobile Lighthouse run scores performance 90 or more on the home page, and the page looks and works the same.

## Make what is missing
Read the report's opportunities and diagnostics (PageSpeed Insights for the preview URL, or `npx lighthouse <url> --preset=perf --form-factor=mobile`), and fix the largest first:
- **Largest Contentful Paint / Speed Index:** see `performance/cwv-field`: hero image size, format and preload; render-blocking CSS and fonts.
- **Total Blocking Time:** less JavaScript on first load: server components, `dynamic()` imports for below-the-fold widgets, third parties through `next/script` with `afterInteractive` or `lazyOnload`, no full libraries for one function.
- **Unused JS/CSS:** drop dead dependencies and global CSS nobody uses.
- **Images:** modern formats, sizes matching the display, lazy loading below the fold.
- Re-run until the score holds across two runs: it moves a few points between runs.

## Stacks
- **Next.js:** `next build` prints each route's first-load JS; keep the home route's small.
- **Astro / static:** islands only where interaction is needed; `astro:assets` for images.

## Hand off only when
The cost is a third-party script the business requires, and it can't be deferred: name it with its measured cost.

## Don't
- Don't detect Lighthouse and serve it a different page.
- Don't drop content or features to raise the score.

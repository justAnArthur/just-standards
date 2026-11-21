What fix runs have learned about Next.js 15–16 repos. The repo's own AGENTS.md wins where it says otherwise.

- With `cacheComponents: true`, route segment config is a build error: no `export const dynamic`, `revalidate`, `fetchCache` or `runtime`. Cache with `'use cache'`, `cacheLife()` and `cacheTag()` in the data function instead.
- With an `app/[locale]` or `app/[lang]` segment, a root file such as `/robots.txt`, `/sitemap.xml` or `/llms.txt` is a route handler at `app/<name>/route.ts`, outside the locale segment; the `app/robots.ts` metadata files would be claimed by the segment.
- Metadata comes from the Metadata API (`metadata` or `generateMetadata`). A page's `openGraph` replaces the layout's whole object, so a field the layout sets (images, videos) must be set again on the page.
- Headers for every route go in `next.config` `headers()` with `source: '/(.*)'`.
- Files in `public/` are served from the site root, so `public/og/loop.mp4` is `/og/loop.mp4`.
- `next build` catches what `tsc` doesn't (segment config, server/client boundaries). When the build needs secrets the worktree doesn't have, rely on the PR's CI build.

Payload CMS on Next.js. Everything in the Next.js notes applies:

- With `cacheComponents: true`, no route segment config (`export const dynamic`, `revalidate`, `fetchCache`, `runtime`); cache with `'use cache'`, `cacheLife()` and `cacheTag()`.
- Root files under a `[locale]` segment are route handlers at `app/<name>/route.ts`.
- A page's `openGraph` replaces the layout's whole object.

And for Payload:

- Content lives in the CMS: read it through the repo's own query helpers (often `queryDocs` or a `payload.find` wrapper), with `depth: 0` when relations aren't needed.
- A site-wide setting (an OG video, a default image) belongs on a global (SEO or site settings) as an upload field, read in `generateMetadata`, with a static file in `public/` as the fallback.
- Changing a collection or global schema needs a migration (`payload migrate:create`); say so in the PR when you add a field.

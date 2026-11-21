## Done when
The check passes on the PR's preview, and crawlers, AI crawlers included, may crawl every public page and find them all from a sitemap: `/robots.txt` answers 200, has no site-wide `Disallow: /` for `User-agent: *`, and names the sitemap by absolute URL; that sitemap lists every public page.

## Make what is missing
Generate the sitemap from the real routes and the CMS's published documents, never a hand-kept list. Robots rules: allow `/`, disallow only what is private (`/admin`, `/api`, account pages).

## Stacks
- **Next.js:** `app/robots.ts` returning `{ rules: { userAgent: '*', allow: '/' }, sitemap: '<origin>/sitemap.xml' }` and `app/sitemap.ts` listing the routes, with `lastModified`. Under an `app/[locale]` segment, both are route handlers (`app/robots.txt/route.ts`, `app/sitemap.xml/route.ts`).
- **Payload + Next:** `app/sitemap.ts` reads the published documents of each routed collection (`_status: published`), with `updatedAt` as `lastModified`.
- **Astro:** `@astrojs/sitemap` (needs `site` in the config) and `public/robots.txt` with `Sitemap: <origin>/sitemap-index.xml`.
- **Static:** write both files by hand.

## Hand off only when
Never.

## Don't
- Don't block AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended): a site is built for search and for AI alike.
- Don't serve a staging robots.txt (`Disallow: /`) in production: if the repo switches on an env variable, make production the default.
- Don't build the sitemap's origin from the request host: a preview would list preview URLs.

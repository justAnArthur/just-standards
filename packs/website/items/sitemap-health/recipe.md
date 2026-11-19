Make the sitemap list only canonical, live pages on the production host:

- Generate it from the real routes and CMS documents (published only), not a hand-kept list.
- Every URL absolute, on the production origin (no `localhost`, preview or staging hosts, no `http://` when the site is HTTPS), and exactly the canonical form (trailing slash and `www` as the site serves them, so no URL redirects).
- Drop pages that 404, redirect, or are `noindex`.

- **Next.js / Payload:** `app/sitemap.ts` built from the routes and the CMS, with the origin from one env variable (`NEXT_PUBLIC_SERVER_URL` or `metadataBase`) that is set to production in the production environment.
- **Astro:** `@astrojs/sitemap` with `site` set to the production origin, and `filter` for drafts.
- **WordPress:** the core sitemap or the SEO plugin's, after fixing the Site Address and removing noindex or redirected pages from it.

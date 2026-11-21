## Done when
The check passes on the PR's preview, and the sitemap lists only canonical, live pages on the production host: a sample of its URLs all answer 200 directly (no redirect), on the site's own host.

## Make what is missing
Generate the sitemap from the real routes and the CMS's published documents, not a hand-kept list:
- every URL absolute, on the production origin: no `localhost`, preview or staging hosts, no `http://` when the site is HTTPS;
- exactly the canonical form: the trailing slash and `www` as the site serves them, so no URL redirects;
- no page that 404s, redirects or is `noindex`.

## Stacks
- **Next.js / Payload + Next:** `app/sitemap.ts` (a route handler under a `[locale]` segment) built from the routes and the CMS, with the origin from one env variable (`NEXT_PUBLIC_SERVER_URL` or `metadataBase`) that is set to production in production.
- **Astro:** `@astrojs/sitemap` with `site` set to the production origin, and `filter` for drafts.
- **WordPress:** the core sitemap or the SEO plugin's, after fixing the Site Address and removing noindex or redirected pages.

## Hand off only when
The production origin is set in a hosting env variable the worker can't change: say which variable and its value.

## Don't
- Don't fix it by deleting pages from the sitemap that should be live: fix the page or its URL instead.
- In a repo that serves several sites, each site's sitemap lists only its own host.

Serve `/robots.txt` that allows crawling of public pages (never `Disallow: /` for `User-agent: *` on a live site) and names the sitemap by absolute URL, and serve that sitemap listing every public page.

- **Next.js:** `app/robots.ts` returning `{ rules: { userAgent: '*', allow: '/' }, sitemap: '<origin>/sitemap.xml' }` and `app/sitemap.ts` listing the routes (and CMS documents for Payload, with `lastModified`).
- **Astro:** `@astrojs/sitemap` (needs `site` in the config) and `public/robots.txt` with `Sitemap: <origin>/sitemap-index.xml`.
- **Static:** write both files by hand.

Don't block AI crawlers (GPTBot, ClaudeBot, PerplexityBot) unless the repo already says to.

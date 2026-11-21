## Done when
The check passes on production, and no page in the sitemap carries `noindex` (or `none`) in `<meta name="robots">`, `<meta name="googlebot">` or the `X-Robots-Tag` header.

## Make what is missing
- **Find where the noindex comes from:** page or layout metadata (`robots: { index: false }`), a CMS "hide from search" toggle on the document, a header set in the framework config, the CDN or the host, or an environment flag that is wrong on production.
- **A page that should be indexed:** remove the noindex at its source.
- **A page that shouldn't be** (account, booking management, thank-you, internal search): keep the noindex and take the page out of the sitemap instead. The sitemap lists only pages meant to rank.
- **Staging protection:** keep noindex on non-production environments, keyed to the production environment variable (`VERCEL_ENV === 'production'`, the deployment's own env), never to a hostname list that forgets a domain.

## Stacks
- **Next.js:** `robots` in `metadata`/`generateMetadata`; `headers()` in `next.config` for `X-Robots-Tag`; the sitemap from `app/sitemap.ts` filtered the same way. Vercel adds `X-Robots-Tag: noindex` to preview deployments by itself; that's expected there, and is why this item is judged on production.
- **Payload + Next:** a per-document "noindex" field read in both `generateMetadata` and the sitemap, so a hidden page is never listed.
- **Astro / static:** the layout's robots meta from a page prop; the sitemap integration's `filter` excludes the same pages.

## Hand off only when
Nothing on this item needs a person: whether a page should rank follows from what it is.

## Don't
- Remove noindex from staging or preview environments.
- Remove a page from the sitemap that should rank, just to hide its noindex.
- Change `robots.txt` to "fix" this: blocking crawling doesn't remove a page, and a blocked noindex is never seen.

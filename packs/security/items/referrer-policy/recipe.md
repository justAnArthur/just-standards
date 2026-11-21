## Done when
The check passes on the PR's preview, and every response carries `Referrer-Policy: strict-origin-when-cross-origin` (or the stricter `same-origin`, `strict-origin` or `no-referrer`), so third parties see at most the site's origin, never a page's path or query.

## Stacks
- **Next.js:** `headers()` in `next.config.*` for `source: '/(.*)'`, next to the other security headers.
- **Vercel, any framework:** `headers` in `vercel.json`.
- **Astro / static:** the host's headers file; `<meta name="referrer" content="strict-origin-when-cross-origin">` in the layout when the host can't set headers.
- **Behind a proxy:** the proxy's config.

## Hand off only when
The headers can only be set in a proxy or CDN whose config is not in this repo.

## Don't
- Don't use `unsafe-url` or `no-referrer-when-downgrade`: both send the full URL to other sites.
- Don't pick `no-referrer` if the analytics or the booking partner needs the origin to attribute visits: `strict-origin-when-cross-origin` sends the origin only.

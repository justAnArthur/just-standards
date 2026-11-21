## Done when
The check passes on the PR's preview, and every page is sent with `Content-Security-Policy: frame-ancestors 'self'` (or `'none'`, or a list of the business's own origins that embed it), and `X-Frame-Options: SAMEORIGIN` for older browsers, so no other site can load the pages in a frame.

## Make what is missing
- Check whether anything frames the site on purpose: a partner portal, a booking widget embedded elsewhere, the CMS's live preview. Name those origins in `frame-ancestors`; `X-Frame-Options` can't list origins, so leave it off when there are any.
- When the site already sends a CSP, add `frame-ancestors` to that header rather than sending a second policy.

## Stacks
- **Next.js:** `headers()` in `next.config.*` for `source: '/(.*)'`: `{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }` and `{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }`; or in `middleware.ts` alongside a nonce CSP.
- **Payload + Next:** Payload's live preview frames the site from the admin's origin: list that origin (often the same one, so `'self'` holds).
- **Astro / static:** the host's headers file (`vercel.json`, `_headers`); `<meta>` can't set `frame-ancestors`.

## Hand off only when
The headers can only be set in a proxy or CDN whose config is not in this repo, on an account the worker doesn't have.

## Don't
- Don't use `X-Frame-Options: ALLOW-FROM`: browsers ignore it.
- Don't put `frame-ancestors` in a `<meta>` CSP: browsers ignore it there.

## Done when
After the merge, the check passes on production: Observatory grades the host B+ or better (or the grade set in `STANDARDS_OBSERVATORY_GRADE`), and the failing tests the evidence named now pass. Observatory scans only public hosts, so the PR's preview can't show it; check the headers on the preview with `curl -sI <preview-url>` instead.

## Make what is missing
The evidence lists each failed test with its result code and what it costs (`X-Frame-Options: x-frame-options-not-implemented (-20)`). Fix the most expensive first; the meaning of each result code is in [tests and scoring](https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring).
- **`csp-not-implemented` (-25), `csp-implemented-with-unsafe-inline` (-20):** add a `Content-Security-Policy`. Start from what the pages load: read the HTML for scripts, styles, fonts, images, frames and `connect-src` targets (analytics, the CMS, the booking engine). Next.js renders inline scripts: use a nonce from the proxy/middleware (Next's CSP guide), not `'unsafe-inline'` on `script-src`. Ship `Content-Security-Policy-Report-Only` first only if the repo already reports somewhere; otherwise test every page type on the preview with the console open.
- **`x-frame-options-not-implemented` (-20):** `frame-ancestors 'self'` in the CSP, or `X-Frame-Options: SAMEORIGIN`.
- **`hsts-*`:** `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- **`x-content-type-options-*`:** `X-Content-Type-Options: nosniff`.
- **`referrer-policy-*`:** `Referrer-Policy: strict-origin-when-cross-origin`.
- **`cookies-*`:** every cookie the app sets gets `Secure`, `SameSite=Lax` (or `Strict`), and `HttpOnly` when no script reads it (session cookies always). Cookies set by the framework (Next's `NEXT_LOCALE`) take the options where they are set (middleware `response.cookies.set(name, value, { secure: true, sameSite: 'lax' })`).
- **`redirection-*`:** `http://` goes to `https://` on the same host in its first hop.
- **`sri-*`, `corp-*`:** bonus points; needed only for A+.

## Stacks
- **Next.js:** `headers()` in `next.config.*` for static headers on `source: '/(.*)'`; a nonce-based CSP in `proxy.ts` / `middleware.ts`.
- **Vercel, any framework:** `headers` in `vercel.json` / `vercel.ts`.
- **Behind a proxy (Dokploy, Traefik, nginx):** in the proxy's config, when the app can't set them.

## Hand off only when
The headers can only be set in a proxy or CDN whose config is not in this repo and needs an account the worker doesn't have.

## Don't
- Don't add `'unsafe-inline'` or `'unsafe-eval'` to `script-src` to make the CSP pass quickly: the test fails on it anyway, and it guards nothing.
- Don't add `preload` to HSTS: that is a commitment to submit the domain, and a person's call.
- Don't break the pages to win points: a CSP that blocks the booking engine, analytics after consent, or the CMS's preview is worse than a C.

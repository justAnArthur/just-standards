## Done when
The check passes on the PR's preview, and every response carries `Strict-Transport-Security: max-age=63072000; includeSubDomains` (keeping visitors on HTTPS) and `X-Content-Type-Options: nosniff`.

## Stacks
- **Next.js on Vercel or self-hosted:** `headers()` in `next.config.*`, for `source: '/(.*)'`.
- **Vercel, any framework:** `headers` in `vercel.json` or `vercel.ts`.
- **Behind a proxy (Dokploy, Traefik, nginx):** in the proxy's config, when the app can't set them.
- **GitHub Pages:** headers can't be set; HSTS comes from github.io itself. Say so in the PR and suggest a waiver for `x-content-type-options` instead of changing hosting.

## Hand off only when
The headers can only be set in a proxy or CDN whose config is not in this repo and needs an account the worker doesn't have.

## Don't
- Don't add a Content-Security-Policy in this change: it needs its own testing.
- Don't add `preload` to HSTS: that is a commitment to submit the domain, and a person's call.

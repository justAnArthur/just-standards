Send `Strict-Transport-Security: max-age=63072000; includeSubDomains` and `X-Content-Type-Options: nosniff` on every response.

- **Next.js on Vercel or self-hosted:** `headers()` in `next.config.*` for `source: '/(.*)'`.
- **Vercel (any framework):** `headers` in `vercel.json` / `vercel.ts`.
- **GitHub Pages:** headers can't be set; HSTS comes from github.io itself. Say so in the PR and suggest a waiver for `x-content-type-options` instead of changing hosting.
- **Behind a proxy (Dokploy, Traefik, nginx):** set them in the proxy config if the app can't.

Don't add a Content-Security-Policy in this change: it needs its own testing.

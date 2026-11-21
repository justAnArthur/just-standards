## Done when
The check passes on production: the home page's HTML comes compressed (br or gzip), and every hashed script, stylesheet, font and image it references (`/_next/static/`, `/_astro/`, `*-<hash>.js`) is served with `Cache-Control: public, max-age=31536000, immutable`.

## Make what is missing
- **Hosts that do it by default:** Vercel and Netlify already send `immutable` for `/_next/static` and compress HTML. If they don't here, something overrides them: a `headers()` rule in `next.config` with `source: '/(.*)'` that sets `Cache-Control` on everything, or a proxy (Cloudflare, nginx) in front. Scope the rule to HTML routes, or add an explicit rule for the hashed path.
- **Self-hosted Next (`next start`, Docker):** it sends `immutable` for `/_next/static`; compression is on unless `compress: false`. Behind nginx, turn on `gzip`/`brotli` for `text/html` and pass `Cache-Control` through.
- **Static hosts:** set the header for the build's asset folder (`_headers` file, S3/CloudFront metadata, nginx `location`).
- Files in `public/` aren't hashed: don't mark them immutable unless their names carry a hash.

## Stacks
- **Next.js:** `headers()` in `next.config`, never `Cache-Control` on `/(.*)`.
- **Astro:** `/_astro/*` with `immutable` in the host's headers file.

## Hand off only when
The CDN or proxy in front isn't configured from this repo (a dashboard only a person can reach): say which setting to change.

## Don't
- Don't mark HTML or un-hashed files immutable: visitors would never see a new version.

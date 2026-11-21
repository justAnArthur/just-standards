## Done when
The check passes on the PR's preview, and every page is sent with an enforced `Content-Security-Policy` whose `script-src` (or `default-src`) allows only the site's own and listed origins, or nonce- or hash-marked scripts, with no `'unsafe-inline'` unless a nonce or hash is there too, and no `*`, `https:` or `data:` script source. Every page still works: the booking flow, analytics after consent, embedded maps and the CMS preview load without CSP errors in the console.

## Make what is missing
- **List what the pages load.** Open the home, booking, fleet and contact pages with Playwright and collect the script, style, image, font, frame and connect origins (or ship the policy as `Content-Security-Policy-Report-Only` first, with the same value, and read the console). The policy is built from that list, nothing guessed.
- **Inline scripts:** move them into files, or mark them with a per-request nonce. Framework runtimes (Next.js) add the nonce to their own scripts when the policy is set in middleware.
- **Start from this shape** and add the origins found: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' <APIs>; frame-src <embeds>; frame-ancestors 'self'; base-uri 'self'; form-action 'self' <booking host>; object-src 'none'`. `'unsafe-inline'` in `style-src` is acceptable; in `script-src` it is not.
- **Report-Only alone fails.** If the site already sends one, switch it to the enforcing header once its reports are clean.

## Stacks
- **Next.js (App Router):** a nonce per request in `middleware.ts`: generate it, set `Content-Security-Policy` on the response and `x-nonce` on the request; Next applies it to its own scripts, and `next/script` and inline JSON-LD read it from `headers()`. Pages with a nonce render dynamically; under `cacheComponents`, read `headers()` only inside the `<Suspense>` parts that need it. Without inline scripts, a static header in `next.config` `headers()` is enough.
- **Payload + Next:** the admin (`/admin`) needs its own, looser policy (`'unsafe-eval'` in dev only); scope the strict one with the middleware `matcher` to the public routes.
- **Astro:** `experimental.csp` (Astro 5.9+) hashes inline scripts at build time; otherwise the header in the host's config (`vercel.json`, `_headers` on Netlify/Cloudflare) or the server adapter's middleware.

## Hand off only when
A third-party script the business requires (a booking widget, a payment page) can't work under any policy without `'unsafe-inline'` or `'unsafe-eval'` in `script-src`: name it, and ask for a waiver on this item rather than weakening the policy for everything.

## Don't
- Don't add `'unsafe-inline'` or `https:` to `script-src` to make errors go away: that is no policy.
- Don't ship an enforcing policy without loading the main flows once: a blocked booking script loses money. Test them on the preview.
- Don't set a nonce from a constant or the build ID: it must be new on every response.

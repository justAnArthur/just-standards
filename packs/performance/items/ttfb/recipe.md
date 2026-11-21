## Done when
The check passes on production: the home page's first byte arrives in under 800 ms (the median of three requests, redirects included), and the page is as fresh as the business needs.

## Make what is missing
Find where the time goes: compare the time with `curl -w '%{time_starttransfer}\n' -o /dev/null -s <url>` against a static file on the same host. Static fast and HTML slow means the server renders on every request.
- **Render less per request:** prerender the home page, or cache its data (Next 16: `'use cache'` with `cacheLife` and `cacheTag`, revalidated by the CMS webhook; Next 13–15: `revalidate` or `unstable_cache`). With Partial Prerendering only the dynamic holes wait.
- **Slow data:** cache CMS and API reads; run the database in the same region as the functions; add the indexes the query needs.
- **Redirects:** link and register the final host so visitors don't pay for a `www` or `http` hop (`website/canonical-host`).
- **Middleware:** keep it short and free of network calls.

## Stacks
- **Next 16 with cacheComponents:** no `export const revalidate` (see `nextjs/no-segment-config`); cache in the data function.
- **Payload + Next:** cache the query helper the page calls; Payload's own reads aren't cached.
- **Vercel:** functions' region next to the database (`regions` in `vercel.json`).

## Hand off only when
The time is spent in a backend this repo doesn't own (a booking API, a hosted CMS on a slow plan): show the timing in the PR.

## Don't
- Don't cache pages that show per-visitor data (session, cart) for everyone.
- Don't measure from a laptop on a slow connection alone: the check runs from the engine's machine.

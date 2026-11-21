## Done when
The check passes on the PR's branch and `next build` succeeds: no file under `app/` exports `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` or `runtime`, every `generateStaticParams` returns at least one param, and each page caches or stays dynamic the way it did before.

## Make what is missing
For each export the check names, keep what it meant and say it the cacheComponents way:
- **`revalidate = N`:** put `'use cache'` at the top of the data function the page awaits (or of the page itself), with `cacheLife({ revalidate: N })` or the nearest profile (`'hours'`, `'days'`), and `cacheTag()` for the tag the CMS webhook revalidates.
- **`dynamic = 'force-dynamic'`:** delete it. Under cacheComponents a page is dynamic wherever it reads `cookies()`, `headers()`, `searchParams` or uncached data; wrap that part in `<Suspense>` so the rest prerenders. If the page must not be cached at all, call `await connection()` from `next/server` before the read.
- **`dynamic = 'force-static'` / `'error'`:** delete it; cache the data function with `'use cache'`.
- **`fetchCache`:** delete it; cache the function around the `fetch` instead.
- **`runtime`:** delete it, even `runtime = 'nodejs'`. Cache Components needs the Node.js runtime, which is the default; edge behaviour moves to `proxy.ts`.
- **`dynamicParams`:** delete it. Paths `generateStaticParams` doesn't return render at request time; call `notFound()` in the page when the resource doesn't exist.
- **`generateStaticParams` returning `[]`:** return at least one real param (the most visited slug, the default locale), so the route has a static shell to prerender.

## Stacks
- **Next 16 with cacheComponents:** `cacheLife` and `cacheTag` come from `next/cache`. A cached function can't read `cookies()` or `headers()`: pass the values in as arguments.
- **Payload + Next:** cache the repo's query helper (the function wrapping `payload.find`), not the page; tag it with the collection's slug so the existing `afterChange` revalidation hooks still reach it.

## Hand off only when
The build needs a secret the worktree doesn't have to prove it works: rely on the PR's CI build and say so in the PR.

## Don't
- Don't turn `cacheComponents` off to make the check pass.
- Don't move the export to a file outside `app/`: it is still read from the segment.
- Don't cache a function that reads per-visitor data (session, locale cookie): the first visitor's answer would be served to all.

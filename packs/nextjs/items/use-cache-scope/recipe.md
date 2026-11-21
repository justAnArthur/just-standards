## Done when
The check passes on the PR's branch, `next build` succeeds and the cached pages render on the preview, with the per-visitor parts still per visitor: every function, component or file marked `'use cache'` is async, and none calls `cookies()` or `headers()` inside its scope.

## Make what is missing
- **`cookies()` / `headers()` inside a cached function:** read the value outside, in the (uncached) caller, and pass it in as an argument, which becomes part of the cache key: `const locale = (await cookies()).get('locale')?.value; return <Prices locale={locale} />` with `'use cache'` in `Prices`.
- **A file-level `'use cache'` with a request read:** move that one function to a file without the directive.
- **A sync cached function:** add `async`. In a file-level `'use cache'` file every exported function, `generateMetadata` and `generateStaticParams` included, must be async; constants go to another file.
- **Data that really is per user and can't be passed in** (compliance): `'use cache: private'`, which may read cookies; say why in a comment.

## Stacks
- **next-intl:** pass `locale` into the cached function; `getTranslations({ locale, namespace })` inside it, not the request-bound `getTranslations()`.
- **Payload + Next:** the cached query helper takes `draft` as an argument; `draftMode()` is read outside it.

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't remove `'use cache'` to make the error go away: the page becomes dynamic and slow.
- Don't pass a cookie store or headers object in: pass the plain values.

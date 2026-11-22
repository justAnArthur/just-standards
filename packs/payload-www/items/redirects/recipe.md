## Done when
`@payloadcms/plugin-redirects` provides a `redirects` collection, and the frontend answers a path listed there with its
redirect (301 by default): adding one in the preview's admin redirects on the preview.

## Make what is missing
- `redirectsPlugin({ collections: ['pages', 'posts'], redirectTypes: ['301', '302'] })`, on the same version as `payload`.
- Read it where requests arrive: in `proxy.ts`/middleware from a cached table, or in the catch-all page before `notFound()`
  (Payload's website template has `PayloadRedirects`). Cache it with a tag the collection's afterChange revalidates.
- A site replacing an old one (WordPress) seeds the collection with every old URL → new URL.

## Hand off only when
The old site's URL list can't be read from its sitemap, its export or the search console data in the repo.

## Don't
- Don't hard-code redirects in `next.config` for content URLs: editors can't change them there.

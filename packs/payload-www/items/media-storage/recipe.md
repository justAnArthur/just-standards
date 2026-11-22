## Done when
Every upload collection stores its files through a storage adapter (for org sites: the org's self-hosted Openinary through
`@justanarthur/payload-storage-openinary`; otherwise a `@payloadcms/storage-*` adapter), and an image
uploaded in the preview's admin shows on the preview's page.

## Make what is missing
- Org sites: `@justanarthur/payload-storage-openinary` from github.com/justAnArthur/payload-www, with `OPENINARY_URL` and
  `OPENINARY_API_KEY` named in `.env.example` (one API key per site).
- Elsewhere: `@payloadcms/storage-s3` on the same version as `payload`, `s3Storage({ collections: { media: true }, bucket,
  config })`, with its variables in `.env.example`.
- Images served from the storage host need it in `next.config` `images.remotePatterns`.

## Hand off only when
The bucket and its keys don't exist yet: the code and `.env.example` still land; say which variables the deployment needs.

## Don't
- Don't commit keys or a `media/` folder of uploads.
- Don't keep `staticDir` as a fallback in production.

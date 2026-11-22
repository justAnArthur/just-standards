## Done when
Every upload collection stores its files through a `@payloadcms/storage-*` adapter (S3 for org sites), and an image
uploaded in the preview's admin shows on the preview's page.

## Make what is missing
- `@payloadcms/storage-s3` on the same version as `payload`, set up with `s3Storage({ collections: { media: true }, bucket:
  process.env.S3_BUCKET, config: { region, endpoint, credentials, forcePathStyle } })` in the app's plugins.
- Name `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in `.env.example`.
- Images served from the bucket's host need it in `next.config` `images.remotePatterns`.

## Hand off only when
The bucket and its keys don't exist yet: the code and `.env.example` still land; say which variables the deployment needs.

## Don't
- Don't commit keys or a `media/` folder of uploads.
- Don't keep `staticDir` as a fallback in production.

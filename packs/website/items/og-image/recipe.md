Add `og:image` (1200×630 PNG or JPG, under 5 MB, absolute URL), `og:title`, `og:description` and `twitter:card` = `summary_large_image`.

- **Image:** reuse the brand's existing social image if the repo has one. Otherwise generate it from the code: Next.js `app/opengraph-image.tsx` with `ImageResponse` (logo, title, one line, brand colours from the site's CSS), or a static file in `public/`. Never use a placeholder or stock picture; if no brand assets exist, say so in the PR.
- **Next.js / Payload + Next:** `metadata.openGraph` and `metadata.twitter` in the root layout; `metadataBase` makes the image URL absolute.
- **Astro / static:** the four `<meta>` tags in `<head>`, with the image under `public/` and the URL built from the site origin.

Check the result with `curl -s <url> | grep og:` and that the image URL answers 200 with an `image/*` type.

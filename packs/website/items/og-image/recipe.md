## Done when
The check passes on the PR's preview, and a link to the home page shared on LinkedIn, X, Slack or iMessage shows a large picture with the site's title and description: `og:image` (absolute URL, answers 200 as `image/*`, under 5 MB), `og:title`, `og:description` and `twitter:card` = `summary_large_image`.

## Make what is missing
- **The image:** use the brand's existing social image (1200×630) if the repo has one. Otherwise make one: a 1200×630 card with the logo, the site's headline and a photo from the site, in the brand's colors and fonts.
  - **Next.js:** `app/opengraph-image.tsx` with `ImageResponse` (from `next/og`), reading the logo and fonts from the repo.
  - **Any stack:** render an HTML card at 1200×630 and screenshot it with Playwright (`page.setViewportSize({ width: 1200, height: 630 })`, `page.screenshot({ path: 'public/og/home.png' })`), then commit the PNG.
- **Title and description:** the page's own, or the site's from the business context.

## Stacks
- **Next.js:** `metadata.openGraph` and `metadata.twitter` in the root layout; `metadataBase` makes the image URL absolute. A page's `openGraph` replaces the layout's, so a page that sets one sets `images` again.
- **Payload + Next:** a default image as an upload field on the SEO global, read in `generateMetadata`, with the static file in `public/` as the fallback.
- **Astro / static:** the four `<meta>` tags in `<head>`, with the image under `public/` and its URL built from the site origin.

## Hand off only when
Never: the image is made from the repo's brand assets. If the repo has none, that is `ai-ready/brand-assets` failing, not this item.

## Don't
- Don't use a placeholder, a stock photo or the logo alone on white: a logo is not a 1200×630 card (see `sharing/og-image-size`).
- Don't point the tags at a file you didn't commit: the check follows the URL.
- Don't build the URL from the request host: previews would then point at themselves.

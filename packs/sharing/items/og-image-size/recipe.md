## Done when
The check passes on the PR's preview, and a link shared anywhere shows a full-width picture rather than a cropped logo: the home page's `og:image` is a PNG, JPEG or WebP of 1200×630 (within 5%), under 5 MB, answering 200. Key pages (fleet, locations, posts) get their own image where the stack makes it cheap.

## Make what is missing
Make a 1200×630 card from the repo's brand assets and the page's own content: the logo, the headline, a photo from the site, in the design system's colors and fonts, with the text inside the central 1000×500 so no platform crops it.
- **Next.js:** `app/opengraph-image.tsx` (and per route segment) with `ImageResponse` from `next/og`, reading the logo and font files from the repo; Next sets `og:image`, its width and its height.
- **Any stack:** render an HTML card at 1200×630 and screenshot it with Playwright (`page.setViewportSize({ width: 1200, height: 630 })`, `page.screenshot({ path: 'public/og/home.png' })`); commit the PNG (or a JPEG at quality 85 when the photo makes the PNG large).

## Stacks
- **Next.js:** `metadata.openGraph.images = [{ url: '/og/home.png', width: 1200, height: 630, alt }]`, or the `opengraph-image` file convention.
- **Payload + Next:** a default image as an upload field on the SEO global, and an image size `og` (1200×630, `crop: 'center'`) in the media collection's `imageSizes`, so `generateMetadata` uses `image.sizes.og.url` rather than the original upload.
- **Astro / static:** the file in `public/og/` and the `<meta>` tags in the layout.

## Hand off only when
Never: the card is made from the repo's brand assets. If the repo has none, that is `ai-ready/brand-assets` failing, not this item.

## Don't
- Don't use the logo alone as the share image: platforms show it as a small, cropped square.
- Don't upscale a small image to 1200×630: make the card instead.
- Don't use SVG or AVIF: most platforms don't show them.

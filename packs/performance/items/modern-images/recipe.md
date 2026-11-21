## Done when
The check passes on the PR's preview: on a phone, scrolling the home page, every content image (100×100 CSS px or larger) is served as AVIF or WebP (or SVG), and none is delivered at more than twice the device pixels it is shown at in both dimensions.

## Make what is missing
- **JPEG/PNG served as is:** send images through the framework's optimizer, which negotiates AVIF/WebP from the `Accept` header: `next/image` (with `images.formats: ['image/avif', 'image/webp']` in `next.config`), Astro's `<Image>`/`<Picture>`. For images from the CMS, allow its host in `images.remotePatterns`.
- **Oversized:** give the image the `sizes` it really takes (`sizes="(max-width: 768px) 100vw, 50vw"`), so the browser picks a smaller candidate; a fixed-size thumbnail gets `width`/`height` that match.
- **CSS backgrounds** aren't checked, but the same holds: use `image-set()` with AVIF/WebP.
- **Source files:** keep originals in the CMS or `public/`; the optimizer makes the variants. Don't hand-export a WebP for every size.

## Stacks
- **Next.js:** `next/image` everywhere (`nextjs/next-image`); on a static export, a loader that points at an image CDN.
- **Payload + Next:** Payload's `imageSizes` on the media collection with `formatOptions: { format: 'webp' }`, and `next/image` on the front end.
- **Astro:** `astro:assets`, `<Picture formats={['avif', 'webp']}>`.

## Hand off only when
The images come from a third party (the booking engine's car photos) whose URLs the repo can't change and can't proxy: name the host in the PR.

## Don't
- Don't convert PNG logos and icons that are small: they aren't content images; SVG is better.
- Don't drop image quality below what the brand's photos need (`quality` 75–80 is the usual).

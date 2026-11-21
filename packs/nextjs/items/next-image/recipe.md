## Done when
The check passes on the PR's branch: every image in the app's components renders through `next/image` (or the repo's own wrapper around it), with a size or `fill`, and the page looks the same.

## Make what is missing
- **Static files in `public/`:** `import Image from 'next/image'`, then `<Image src="/logo.png" alt="…" width={28} height={28} />` with the size the `<img>` had; a statically imported file (`import logo from './logo.png'`) gets its size for free.
- **The LCP image** (the hero): add `priority` (Next 15) or `preload` (Next 16), and `sizes` when it is responsive.
- **Remote or CMS images:** add the host to `images.remotePatterns` (or the path to `images.localPatterns`) in `next.config`, then use `next/image`. If the repo has an image component (a `Media` or `ImageMedia` wrapper), use it.
- **SVG logos and icons:** render the SVG inline or as a component; `next/image` with an `.svg` `src` needs `unoptimized`.
- **An `<img>` that has to stay** (a third-party pixel, a data URL, an image the optimizer can't fetch): keep it, with `{/* eslint-disable-next-line @next/next/no-img-element -- why */}` (or `biome-ignore lint/performance/noImgElement: why`) on the line above. The check accepts that marker.

## Stacks
- **Payload + Next:** media fields go through the template's `Media` / `ImageMedia` component, which already wraps `next/image`; the upload path is `/api/media/file/**` in `images.localPatterns`.
- **`next/og` images, emails:** the check skips `opengraph-image.tsx`, `icon.tsx`, `next/og` and React Email files, where `<img>` is the only option.

## Hand off only when
Never: everything needed is in the repo.

## Don't
- Don't set `images.unoptimized: true` for the whole app to make warnings go away.
- Don't drop `width` and `height` without `fill`: the build fails.
- Don't add the marker to images that could use `next/image`.

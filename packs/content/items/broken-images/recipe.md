## Done when
The check passes on the PR's preview, and every image on the sampled pages (`img` and `picture` sources) loads: it answers 200 with an image content type, on the preview and in production.

## Make what is missing
- For each broken URL in the evidence, find where the page gets it: a CMS media field, a hard-coded path, a `srcset` built from a list of widths.
- **A missing file:** restore it from the repo's history or the CMS's media library. When it is gone everywhere, use another image the repo or the CMS already has for the same thing (the same car, the same location); never a stock photo from outside.
- **A CMS URL that points at the wrong host** (an old CMS domain, `localhost`, `http://`): fix the CMS's public URL setting or the loader, not each URL.
- **An image answered as HTML:** the path falls through to the site's 404 or a login page; fix the path or the route.
- **`next/image` answers 400 or 404:** the source's host is missing from `images.remotePatterns`, or the file is above the size limit.

## Stacks
- **Next.js:** `images.remotePatterns` in `next.config.*` for every CMS host, including the one previews use.
- **Payload:** the media collection's `staticURL`/`serverURL`, and the storage adapter's public URL.
- **Strapi:** the `url` in `config/server` and the upload provider's base URL.
- **Astro / static:** files under `public/` or imported from `src/assets`.

## Hand off only when
The original image exists only in a store the worker can't reach (a CMS media library behind credentials it doesn't have): name the files.

## Don't
- Don't hide broken images with CSS or by removing the `img` from the page: fix the source.
- Don't swap in images from elsewhere on the web.

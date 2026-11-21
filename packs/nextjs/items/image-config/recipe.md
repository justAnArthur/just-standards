## Done when
The check passes on the PR's branch, and every remote image the site shows still loads on the preview: next.config's `images` has no `domains`, no `remotePatterns` entry allows any host, and `dangerouslyAllowSVG` (if kept) comes with `contentSecurityPolicy`.

## Make what is missing
- **`domains: ['cdn.example.com']`:** one `remotePatterns` entry per host, as strict as the images allow: `{ protocol: 'https', hostname: 'cdn.example.com', pathname: '/uploads/**' }`, or `new URL('https://cdn.example.com/uploads/**')`.
- **`hostname: '**'`:** list the hosts the site's images actually come from: grep the components, the CMS's media URLs in the content, and the env vars that name the CMS (`CMS_BASE_URL`). Build the pattern from that variable if the host differs per deploy.
- **`dangerouslyAllowSVG: true`:** prefer `unoptimized` on the `<Image>` that shows the SVG and drop the option; if it stays, add `contentDispositionType: 'attachment'` and `contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"`.

## Stacks
- **Payload + Next:** uploads are local: `images.localPatterns` with `pathname: '/api/media/file/**'`; the site's own origin in `remotePatterns` only if images are requested by absolute URL.
- **Strapi / headless CMS:** the CMS's media host (or its S3/CDN bucket) with `pathname` of the uploads folder.

## Hand off only when
Never: the hosts are in the code, the content and the env templates.

## Don't
- Don't set `unoptimized: true` globally to get rid of the patterns.
- Don't leave `protocol` out: it allows `http` too.

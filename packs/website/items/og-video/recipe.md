Add `og:video` with its type and size next to the existing `og:image` (keep the image: platforms that don't play video fall back to it).

```html
<meta property="og:video" content="https://example.com/og/loop.mp4">
<meta property="og:video:secure_url" content="https://example.com/og/loop.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
```

- **The video:** an MP4 (H.264, no audio needed), 1280×720, a 3–8 s loop, under 8 MB, served from the site's own origin (`public/og/loop.mp4`). Use a video the repo already has (a hero or demo clip). If there is none, don't fake one: wire the tags behind a single constant, leave the file out, and say in the PR that a person must add `public/og/loop.mp4`.
- **Next.js / Payload + Next:** `metadata.openGraph.videos = [{ url, secureUrl, type: 'video/mp4', width: 1280, height: 720 }]`. With Payload, prefer an upload field on the SEO global (`ogVideo`, relation to media) read in `generateMetadata`, with the static file as the fallback.
- **Astro / static:** the tags in `<head>`, URL built from the site origin.

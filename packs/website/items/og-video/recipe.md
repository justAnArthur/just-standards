## Done when
The check passes on the PR's preview, and a link to the home page shared on LinkedIn or X can play a short loop: `og:video` points to an MP4 that answers 200 as `video/mp4`, under 8 MB, with `og:video:type`, `og:video:width` and `og:video:height` beside it. The `og:image` stays, for platforms that don't play video.

```html
<meta property="og:video" content="https://example.com/og/loop.mp4">
<meta property="og:video:secure_url" content="https://example.com/og/loop.mp4">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="1280">
<meta property="og:video:height" content="720">
```

## Make what is missing
Make the video from what the repo has, in this order:

1. **A brand clip** in the repo's brand folder (`brand/`, `public/brand/`, or wherever `AGENTS.md` says): cut 4–8 s from it.
2. **Otherwise, an HTML scene** built from the design system and the brand assets: the logo, the brand colors and fonts, a photo from the site, the site's headline, with a simple CSS animation (a slow pan or zoom on the photo, the headline fading in). Put it in a scratch file, not in the app.
3. **Or a recording of the live hero:** the home page's first screen, if it moves.

Record it with Playwright at 1280×720 for about 6 s:

```ts
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'tmp/og', size: { width: 1280, height: 720 } } })
const page = await context.newPage()
await page.goto('file:///…/scene.html') // or the site's URL for the hero
await page.waitForTimeout(6500)
await context.close() // writes the .webm
```

Then cut the loop and encode it:

```sh
ffmpeg -ss 0.5 -t 6 -i tmp/og/<recording>.webm -vf scale=1280:720 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an -crf 26 public/og/loop.mp4
```

Check it is under 8 MB (`ls -l`; raise `-crf` if not), and commit it under `public/og/` (or the stack's static folder), so the site serves it from its own origin.

## Stacks
- **Next.js:** `metadata.openGraph.videos = [{ url: '/og/loop.mp4', secureUrl: '/og/loop.mp4', type: 'video/mp4', width: 1280, height: 720 }]` beside `images`; `metadataBase` makes the URLs absolute. A page that sets its own `openGraph` must set `videos` again.
- **Payload + Next:** an upload field (`ogVideo`, a relation to media) on the SEO global, read in `generateMetadata`, with the committed file as the fallback; say in the PR that the field needs a migration.
- **Astro / static:** the tags in `<head>`, with the URL built from the site origin.

## Hand off only when
Never: the video is made from the repo's brand assets and design system. If the repo has neither, that is `ai-ready/brand-assets` failing, not this item.

## Don't
- Don't ship the tags without the file: the check follows `og:video` and fails on anything but a 200 `video/mp4`.
- Don't commit the raw recording, the scratch scene or anything over 8 MB.
- Don't add audio, and don't use a codec other than H.264 in `yuv420p`: some platforms then show nothing.
- Don't use stock footage or people who aren't in the repo's own assets.

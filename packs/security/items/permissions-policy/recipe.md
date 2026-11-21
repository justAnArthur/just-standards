## Done when
The check passes on the PR's preview, and every response carries a `Permissions-Policy` that turns off the powerful features the site doesn't use and limits the ones it does to its own origin, for example `camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()`.

## Make what is missing
Read the code for what it uses: `navigator.geolocation` (a "nearest branch" button), a payment request, an embedded map or video that needs `fullscreen`. Allow those for `self` (and the embed's origin); turn the rest off with `()`.

## Stacks
- **Next.js:** `headers()` in `next.config.*` for `source: '/(.*)'`.
- **Vercel, any framework:** `headers` in `vercel.json`.
- **Astro / static:** the host's headers file.

## Hand off only when
The headers can only be set in a proxy or CDN whose config is not in this repo.

## Don't
- Don't turn off a feature the site uses (geolocation for the branch finder, fullscreen for a video): load those pages on the preview.
- Don't send the old `Feature-Policy` syntax instead.

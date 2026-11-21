## Done when
The check passes on the PR's preview: the home page links a web app manifest (`<link rel="manifest">`) that answers JSON with `name`, `short_name`, `start_url`, `display`, `theme_color`, `background_color`, and icons of 192×192 and 512×512 (plus a maskable 512) that load as images; adding the site to a phone's home screen shows the brand's icon and name.

## Make what is missing
- **Icons:** render them from the logo's SVG in the brand folder with `rsvg-convert` or `sharp`: 192 and 512 px on the brand background, and a maskable 512 with the mark inside the central 80 % safe zone. Use the mark rather than the wordmark when the brand has one.
- **Colours:** `theme_color` and `background_color` from the design system's tokens (the brand's primary and the page background), not picked by eye.
- **Name:** the site's name as the site states it (its title or Organization name); `short_name` up to 12 characters.
- In a repo serving several sites, each site gets its own manifest with its own name, icons and colours.

## Stacks
- **Next.js:** `app/manifest.ts` returning `MetadataRoute.Manifest`; Next serves `/manifest.webmanifest` and adds the link. Icons in `public/` (or `app/icon-*.png`). For several sites in one app, build it from the site's config by host.
- **Payload + Next:** the same, with the name from the site's settings global.
- **Astro / static:** `public/site.webmanifest` and `<link rel="manifest" href="/site.webmanifest">` in the layout.

## Hand off only when
Never: the manifest is made from the logo and the design tokens. If the repo has no logo, that is `ai-ready/brand-assets` failing.

## Don't
- Don't point icons at another host (the CMS) that previews can't reach.
- Don't set `display: standalone` on a site that isn't built to run without the browser's back button; `browser` or `minimal-ui` is fine.

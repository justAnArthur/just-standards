## Done when
The check passes on the PR's preview, and browser tabs, bookmarks and home-screen shortcuts show the brand mark: a favicon (SVG, plus a 32×32 PNG or ICO fallback) and a 180×180 `apple-touch-icon` PNG, each answering 200.

## Make what is missing
Make every size from the logo SVG in the repo's brand folder, with `rsvg-convert` or `sharp`: 32×32, 180×180 (on the brand background, no transparency: iOS fills it black), and for a web app also 192×192, 512×512 and a maskable 512×512 with a `site.webmanifest`. Use the logo's mark (the symbol) rather than the full wordmark when the brand has one: a wordmark is unreadable at 32 px.

## Stacks
- **Next.js:** `app/icon.svg` (or `icon.png`) and `app/apple-icon.png`; Next writes the `<link>` tags. Under an `app/[locale]` segment they still go at the `app/` root.
- **Astro / static:** files in `public/` and, in `<head>`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` and `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.

## Hand off only when
Never: the icons come from the logo. If the repo has no logo, that is `ai-ready/brand-assets` failing, not this item.

## Don't
- Don't leave the framework's default icon (`favicon.ico` from the starter) in place beside the new one.
- Don't link icons from another host (a CMS) that a preview can't reach.

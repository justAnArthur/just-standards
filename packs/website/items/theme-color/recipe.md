## Done when
The check passes on the PR's preview: the pages carry `<meta name="theme-color">` with the brand's colour, the same one as the manifest's `theme_color`, so mobile browsers tint their toolbar with it.

## Make what is missing
Take the colour from the design system's tokens (the header's or the brand's primary colour). Where the site has a dark theme, add a second tag with `media="(prefers-color-scheme: dark)"`.

## Stacks
- **Next.js:** `export const viewport: Viewport = { themeColor: '#…' }` in the root layout (or an array with `media` for light and dark); not in `metadata`, which Next 14+ ignores for it.
- **Astro / static:** the tag in the layout's `<head>`.

## Hand off only when
Never.

## Don't
- Don't hard-code a colour that isn't in the design system.

## Done when
The check passes on the PR's branch: no component or stylesheet loads a font from a font CDN, the same families and weights load through `next/font`, and the text looks the same.

## Make what is missing
- **Google Fonts:** for each family in the `<link>` or `@import`, `import { Inter } from 'next/font/google'` in the root layout, with the weights and styles the URL listed and `subsets` for the site's languages (`latin-ext` for Slovak and Czech). Expose it as a CSS variable (`variable: '--font-sans'`) on `<html>`, and point the existing CSS or Tailwind theme at the variable, so no class has to change.
- **Fonts the repo has as files** (in `public/` or the brand folder): `next/font/local` with `src` pointing at them.
- **Typekit, Fontshare, Bunny:** download the font files the license allows self-hosting, and load them with `next/font/local`; if it doesn't, use the closest Google family.
- `display: 'swap'` is the default; keep it.

## Stacks
- **Next 13–16:** fonts are declared in a module scope (`app/fonts.ts` or the layout), never inside a component.
- **Tailwind v4:** set `--font-sans: var(--font-inter)` in `@theme`. Tailwind v3: `fontFamily.sans: ['var(--font-inter)', …]`.

## Hand off only when
The font is licensed only through its CDN (Adobe Fonts) and no free family is close enough: say which in the PR.

## Don't
- Don't leave the `<link rel="preconnect">` to fonts.gstatic.com behind.
- Don't load every weight "to be safe": only those the CSS uses.

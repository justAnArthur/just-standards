## Done when
The check passes on the PR's branch: a brand folder (`brand/`, `public/brand/`, `assets/brand/` or `.github/brand/`) holds the logo as SVG (for light and dark backgrounds), and its `README.md` says what each file is for and gives the brand colours and fonts.

## Make what is missing
- **Logo SVG:** from what the repo or the live site has, in this order: an SVG already in the repo (`public/`, a logo component's inline `<svg>`: save it as a file), the SVG the live site serves (header logo, favicon), the brand's official press kit. Make a white or light version for dark backgrounds by changing the fills. Don't trace a PNG by hand.
- **Colours:** from the site's tokens (CSS custom properties, Tailwind theme) and the logo's fills, as a table: name, hex, where it is used.
- **Fonts:** the families the site loads (`next/font`, `@font-face`), with weights and where each is used; font files only when the license allows them in the repo.
- **README.md:** a table, one row per file (or subfolder), "use it for…". Point at photos or video the site uses (hero images in `public/`) when they are brand material.
- Move or copy files the site serves only if nothing references the old path; otherwise keep them and list them.

## Stacks
- **Next.js:** `public/brand/` is served at `/brand/`, handy for og images and email.
- **Franchise brands** (Avis, Budget, Payless): the franchisor's rules in the business context win; take colours and logos from what the live site already uses.

## Hand off only when
The brand has no logo anywhere: not in the repo, not on the live site, not in an official press kit.

## Don't
- Don't redraw, recolour or "improve" a logo; don't make up colours.
- Don't commit fonts whose license forbids redistribution.

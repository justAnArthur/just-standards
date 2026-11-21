# Brand assets

Príklad Rent ("Example Rentals") is a fictional company. The brand is a plain wordmark and a mark made for this example;
it imitates no real rental brand. `scripts/brand-media.ts` (`bun run brand`) renders everything the site serves from
these files.

| file | what it is for |
|---|---|
| `logo.svg` | the wordmark with the mark, for light backgrounds (header, documents). Text is outlined from Inter 600. |
| `logo-dark.svg` | the same for dark backgrounds (share images, the video, a dark footer): white "Príklad", amber "Rent" |
| `mark.svg` | the mark alone: a P over a road line on a rounded brand-blue square. Source of the favicon, app icons and maskable icon |
| `tokens.json` | colours, font, radii and spacing; the source of the `@theme` block in `app/globals.css` and of DESIGN.md |
| `fonts/` | Inter 400, 500 and 600 (TTF) under the SIL Open Font License (`fonts/OFL-Inter.txt`); the site serves WOFF2 subsets made from them |
| `illustrations/` | the six car classes as flat side-view SVGs (city, compact, estate, suv, minibus, cargo); no make or badge |

## Colours

- Brand blue `#0E5A8A`: links, primary buttons, the mark
- Deep navy `#0A3550`: hero, share images, theme colour
- Amber `#F5B400`: the one call to action, the road line in the mark
- Ink `#14202B`, muted `#4B5966`, line `#D6DEE6`, surface `#F3F6F9`

## Type

Inter, weights 400 and 600 on the site (500 kept for print). Headlines 600 with slight negative tracking.

## Rules

- Keep the clear space around the logo at least the height of the mark's road line ×4.
- The logo on photos or busy backgrounds only on a solid brand-deep or white plate.
- Never recolour the mark beyond the light and dark versions here.

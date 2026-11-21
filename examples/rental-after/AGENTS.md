<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Príklad Rent: the example rental site

A fictional car and van rental in Bratislava, built to meet every standard of [just-standards](../../README.md). Next.js 16
(App Router), TypeScript, Tailwind CSS 4, Bun. Slovak (default, no URL prefix) and English (`/en`). Nothing on the site is
real: the company, its IDs, addresses, phone numbers and prices are examples.

## Commands

```bash
bun install          # install dependencies (bun.lock)
bun run dev          # dev server on http://localhost:3102
bun run build        # production build
bun run start        # production server on http://localhost:3102
bun run test         # unit tests (bun test): page copy lengths, routes, booking prices
bun run lint         # ESLint
bun run typecheck    # next typegen && tsc --noEmit
bun run brand        # re-render logo, icons, fleet pictures, share images and og:video (needs ffmpeg)
```

Before a commit: `bun run lint && bun run typecheck && bun run test && bun run build`.

## Where things live

| path | what |
|---|---|
| `proxy.ts` | every page request: the language rewrite (`/vozovy-park` → `app/[lang]` as `sk`), `/sk/...` → 308, the 404 for unknown paths, the per-request CSP nonce |
| `app/[lang]/layout.tsx` | `<html lang>`, font, icons, manifest, consent defaults, the consent banner and the held-back statistics tag |
| `app/[lang]/[[...slug]]/page.tsx` | every page: resolves the slug through `lib/i18n.ts`, sets metadata, renders a view from `views/` |
| `app/robots.txt`, `app/sitemap.xml`, `app/llms.txt`, `app/.well-known/security.txt` | route handlers outside the language segment |
| `app/api/stats` | receives the page views of `public/stats/script.js` (a self-hosted Umami stand-in) after consent |
| `views/` | page bodies; `components/` the shared parts (header, footer, booking form, cards, consent banner) |
| `content/` | all copy and facts (see Content below) |
| `lib/` | `i18n.ts` routes and slugs, `metadata.ts` the Metadata API object of a page, `jsonld.ts` schema.org, `booking.ts` prices, `csp.ts`, `consent.ts`, `not-found-page.ts` |
| `brand/`, `DESIGN.md` | brand assets and the design system |
| `scripts/brand-media.ts` | renders everything in `public/og`, `public/fleet`, `public/icons`, `app/fonts` and `components/logo-art.ts` from `brand/` |
| `tests/` | `bun test` suites |

## Content

There is no CMS. Everything a visitor reads comes from TypeScript files in `content/`, so it is typed and tested:

- `content/business.ts`: the company, its IDs, the two branches (address, coordinates, hours, phone), the fleet (seats, gearbox, price, deposit, excess) and the rental terms (age, fees, cancellation). JSON-LD, the footer, the FAQ and `llms.txt` all read these, so a fact changes in one place.
- `content/pages.ts`: each page's title, description and h1 in both languages. `bun run test` holds titles to 10–70 characters and descriptions to 70–160, all unique.
- `content/faq.ts`, `content/legal.ts`: the FAQ and the legal pages (rental terms, VOP, complaints, privacy, cookies, accessibility).
- `content/dictionary.ts`: interface words (navigation, form labels, footer, consent banner).

To change content locally: edit the file, run `bun run dev`, check the page in both languages, then `bun run test`. A new page needs a slug per language in `lib/i18n.ts`, copy in `content/pages.ts` and a view in `views/`; the sitemap, hreflang, breadcrumbs and the language switch follow from the slug table.

## Rules of the house

- **Every page renders per request.** The Content-Security-Policy carries a fresh nonce (`proxy.ts`), and a prerendered page can't carry one. That is why `cacheComponents` is off; don't turn it on or add `'unsafe-inline'` to `script-src`.
- **Metadata through the Metadata API only** (`lib/metadata.ts`): no `<head>`, `<meta>` or `<title>` in JSX. A page's `openGraph` replaces the layout's, so `pageMetadata` sets the image and the video on every page.
- **Images through `next/image`**, fonts through `next/font/local` (`app/fonts.ts`). No font CDN, no third-party script.
- **Statistics only after consent.** The tag in `components/Analytics.tsx` stays `type="text/plain"` until `ConsentBanner` starts it; Consent Mode defaults are denied.
- **Phone numbers and e-mail addresses are links** (`tel:`, `mailto:`); in copy, `components/RichText.tsx` links them.
- **Facts come from `content/business.ts`.** Never invent a price, an address or an ID elsewhere; the IDs are examples and say so.
- **Accessibility:** one h1 per page, labels on every field, visible focus (`:focus-visible` in `app/globals.css`), alt text on every image, `prefers-reduced-motion` respected.
- **Sites:** this repo folder is one site. Production would set `SITE_URL` (see `.env.example`); locally it is `http://localhost:3102`.

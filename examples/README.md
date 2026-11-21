# Example: one rental site, before and after

Proof that the standards work end to end. The same Next.js scaffold twice, checked by the engine:

- [`rental-before/`](rental-before): `create-next-app` with its defaults (App Router, TypeScript, Tailwind, ESLint), changed only to run on port 3101. The honest starting point.
- [`rental-after/`](rental-after): that scaffold grown into the site of **Príklad Rent** ("Example Rentals"), a car and van rental in Bratislava, on port 3102. Slovak and English, two pick-up points (city centre and airport), six car classes, booking search, FAQ, rental terms, VOP, complaints procedure, privacy and cookie policies, accessibility statement, contact, 404.
- [`workspace/`](workspace): a just-standards workspace with the two businesses (`rental-before`, `rental-after`), each a website asset and a repo asset, the same waivers, and the worker presets.
- [`run.ts`](run.ts): builds both, serves them, checks both businesses and writes [`results/`](results).

**Príklad Rent is fictional.** Its name, the IČO 12 345 678, the addresses (Ukážková 12, Letisková 1), the `+421 2 000 000 0x` phone numbers, the `@example.com` addresses and the prices are examples and belong to no one; the site says so in its footer, on every legal page and in `llms.txt`. The logo, illustrations and share images were drawn for it and imitate no real brand.

## Run it

From the root of the just-standards checkout (Bun, git and the `claude` CLI on PATH; ffmpeg only to re-render the brand media):

```bash
bun install
bun examples/run.ts              # install + next build both apps, next start on :3101 and :3102, check, stop
bun examples/run.ts --no-build   # reuse the last builds
```

`run.ts` adopts every pack in `packs/` except `repo` (it reads a GitHub repo, which the examples don't have) by rewriting the `packs:` line of both business files, so packs merged later are picked up without editing anything. It refuses to start when 3101 or 3102 is taken, and stops both servers on success, failure or Ctrl-C. Results: `results/before.ndjson`, `results/after.ndjson` (one check result per line, as `standards check --json` prints them) and `results/summary.md`. A full run takes about 45 seconds; most of it is the seven AI checks per business (haiku) and the two builds.

The repo checks (`nextjs`, `ai-ready`) read the files git tracks: commit or `git add` a change to `rental-*` before a run. The CLI works on the workspace directly too, from the repo root:

```bash
bun cli/standards.ts check rental-after --workspace examples/workspace
bun cli/standards.ts spec rental-after site --workspace examples/workspace   # every adopted standard as one brief
```

## Results

With the packs on this branch (2026-11-21, `results/summary.md`):

| pack | before | after |
|---|---|---|
| ai-ready | 3/6 | 6/6 |
| ai-visibility | 1/4 | 4/4 |
| analytics | 0/1 | 1/1 |
| eu-consumer | 0/5 | 5/5 |
| nextjs | 5/5 | 5/5 |
| performance | 2/2 | 2/2 |
| seo | 7/10 | 10/10 |
| sharing | 0/3 | 3/3 |
| website | 1/12 | 12/12 |
| **total** | **19/48** | **48/48** |

With the packs still in flight merged in a throwaway branch (`m9/packs`: security, content, i18n, website v4; `m9/local`: local-business, rental; the uncommitted `browser` kind: accessibility, cookie-consent, consent-mode, page-weight, no-console-errors, third-party, modern-images), same day:

| pack | before | after |
|---|---|---|
| accessibility | 3/5 | 5/5 |
| ai-ready | 3/6 | 6/6 |
| ai-visibility | 1/4 | 4/4 |
| analytics | 0/1 | 1/1 |
| content | 4/5 | 5/5 |
| eu-consumer | 2/7 | 7/7 |
| i18n | 4/4 | 4/4 |
| local-business | 2/6 | 6/6 |
| nextjs | 5/5 | 5/5 |
| performance | 6/6 | 6/6 |
| rental | 0/5 | 5/5 |
| security | 2/7 | 7/7 |
| seo | 7/10 | 10/10 |
| sharing | 0/3 | 3/3 |
| website | 3/16 | 16/16 |
| **total** | **42/90** | **90/90** |

What "before" passes is what the scaffold gets for free: a current Next with `next/font` and `next/image`, `<html lang>`, compressed HTML and immutable build files, a fast localhost, and the checks that have nothing to judge on a one-page, one-language site with no robots.txt (breadcrumbs, hreflang, AI crawlers).

### Waived on localhost, for both

Only what the production domain can show (`workspace/businesses/*.yml`):

| item | why |
|---|---|
| `website/tls` | localhost serves plain HTTP; the certificate is the production host's |
| `website/canonical-host` | localhost has no www twin and no https listener |
| `eu-consumer/email-auth` | no DNS: SPF and DMARC live on the production domain |
| `performance/cwv-field` | PageSpeed Insights can't reach localhost; field data needs real traffic |
| `performance/lighthouse` | PageSpeed Insights can't reach localhost |
| `website/domain-expiry` | localhost has no registration (website v4) |

`ai-visibility/ai-crawlers` and `performance/ttfb` are production-only on previews, but they can be judged on localhost, so they are checked.

## How the after site meets them

Read [`rental-after/AGENTS.md`](rental-after/AGENTS.md) for the layout and rules; the parts that matter for the standards:

- **Routing and language:** Slovak without a prefix, English under `/en`, localized slugs from one table (`lib/i18n.ts`). `proxy.ts` rewrites unprefixed paths into `app/[lang]`, redirects `/sk/...`, and answers unknown paths with a complete 404 page. The sitemap, hreflang (with `x-default`), canonicals, breadcrumbs and the language switch (to the same page) all come from that table.
- **Security:** a nonce-based Content-Security-Policy per request (`'strict-dynamic'`, no `'unsafe-inline'` for scripts), `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP in `next.config.ts`, `poweredByHeader: false`. Because of the nonce every page renders per request and Cache Components is off.
- **Metadata:** the Metadata API only (`lib/metadata.ts`): unique titles and descriptions (tested), canonical, hreflang, the full Open Graph set with a 1200×630 image per page group and a 6 s og:video, the X large card, icons, manifest, theme colour.
- **Structured data** from the same facts as the visible text (`content/business.ts`): Organization with IČO, DIČ and VAT ID, AutoRental per branch with address, geo, hours, phone and map, Car with an Offer in EUR (VAT included) per class, FAQPage, BreadcrumbList.
- **Consent:** the statistics tag (a self-hosted Umami stand-in that posts to the site's own `/api/stats`) stays `type="text/plain"` until the visitor allows it; decline and allow are equal buttons; Consent Mode v2 defaults are denied; the only cookie stores the choice.
- **Accessibility:** skip link, landmarks, one h1, labelled selects for the whole booking form (no native date picker), visible focus, alt text, reduced motion, contrast from the tokens, an accessibility statement.
- **ai-ready:** `AGENTS.md` with every command, `DESIGN.md`, `brand/` (logo light and dark, mark, tokens, fonts, illustrations, README), `.env.example`, content source documented; `scripts/brand-media.ts` renders the icons, fleet pictures, share images, web fonts and the video from `brand/`.

## Found along the way

- **`notFound()` in Next 16.4.6 answers 404 with an empty body** (`<html id="__next_error__">`, the page only exists once JavaScript runs), even in the unchanged scaffold; `website/not-found` rightly fails it. The after site answers unknown paths from `proxy.ts` instead.
- **The in-flight `accessibility/keyboard-nav` reads a native `<input type="date">` as a focus trap without visible focus:** Tab moves through its day, month and year segments, three stops on one element. The after site uses selects for dates, which is also simpler for screen readers; the check may want to treat date and time inputs' segments as one stop.

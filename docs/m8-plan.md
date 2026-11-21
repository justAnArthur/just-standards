# M8 plan: a catalog of standards for the camasys-web-link rental sites

**Goal:** every rental site (avis.sk, avisvan.sk, paylesscar.sk, avis.fo, rentcarnow.sk, and the rest) is measurably "perfect", and a worker can bring a site there without a person filling the gaps.

**Status:** M8a ([docs/m8a.md](m8a.md)), M8b ([docs/m8b.md](m8b.md)) and M8c ([docs/m8c.md](m8c.md)) are built; M8d and M8e are next. The decisions are at the end.

**The principle:** standards catch what gets forgotten, breaks, or never got done. They don't judge whether a design or a feature is good. An AI check asks whether something is there and true (a line under the heading, the company ID in the footer), never whether it is good. A worker builds from what the repo gives it: its design system, brand assets and docs. When the repo lacks them, that is the failing standard (`repo/brand-assets`), not a task handed to a person.

## 1. Where the sites stand today (2026-11-21, `website` pack v2)

| item | avis.sk | avisvan.sk | paylesscar.sk | avis.fo | rentcarnow.sk |
|---|---|---|---|---|---|
| meta-basics | ✓ | ✓ | ✓ | ✕ no canonical | ! |
| og-image | ✓ | ✓ | ✓ | ✕ | ! |
| og-video | ✕ | ✕ | ✕ | ✕ | ! |
| icons | ✓ | ✓ | ✕ | ✕ | ! |
| robots-sitemap | ✓ | ✓ | ✓ | ✕ | ! |
| structured-data | ✓ | ✕ | ✕ | ✕ | ! |
| llms-txt | ✓ | ✓ | ✓ | ✕ | ! |
| security-headers | ✕ | ✕ | ✕ | ✕ | ! |
| sitemap-health | ✓ | ✓ | ✓ | ✕ | ! |
| hero (AI) | ✕ | ✕ | ✕ | ✕ | ! |

`!`: `www.rentcarnow.sk` doesn't resolve. Only `rentcarnow.sk` answers, which is itself a standard (canonical host).

Other findings:
- **avis.fo** answers 200 for an unknown path, a soft 404.
- **The hero check fails on all four that answer.** The heading is a slogan. Under it comes an opening-hours notice or a promo carousel, not a line saying what the site offers and to whom.
- **Next.js versions differ.** `payless-fo`, `avis-fo` and `budget-fo` are on Next 13.4; the other five are on 16.3.

**Repo shape:** the rebuild moves every site into one new repo, with no per-site branches. In the app each site is its own asset (or business) pointing at that same repo. A fix in shared code can then turn several sites' cells green at once. The live sites today still come from the per-site branches of `utegsk/camasys-web-link`; the rebuild replaces them.

## 2. How standards get organized

Today a pack is a flat list of items. With about 80 items, two more axes are needed.

- **Category, on the item:** `category: seo | sharing | ai | performance | accessibility | privacy | legal | content | conversion | i18n | analytics | ops | brand | code`. The grid groups columns by category and folds each group into one coverage cell. A new scorecard view has sites as rows and categories as columns, with a % in each cell.
- **Severity, on the item:**
  - `must`: broken, illegal, or losing money;
  - `should`: expected of a good site;
  - `nice`: polish.
  - "Perfect" means every `must` and `should` is green. Severity shows in the cell, and you can filter by it.
- **Packs stay the unit of adoption, split by who needs them:**

| pack | for | items (≈) |
|---|---|---|
| `website` (v3) | every public site | 14: the current 10, plus canonical host, 404, TLS, `lang` |
| `seo` | sites that live on search | 12 |
| `sharing` | every site linked on social | 5 |
| `ai-visibility` | every site | 6 |
| `performance` | every site | 8 |
| `accessibility` | consumer services in the EU (EAA, from 2025-06-28) | 7 |
| `eu-consumer` | sites selling to EU consumers | 10 |
| `local-business` | businesses with branches, such as rental pick-up points | 5 |
| `rental` | car and van rental, the vertical pack | 8 |
| `analytics` | every site | 4 |
| `nextjs` | Next.js repos; code checks that encode `AGENTS.md` | 7 |
| `repo` | every repo | 8 (exists) |
| `ai-ready` | every repo agents work in | 7 |

A business adopts `website, seo, sharing, ai-visibility, performance, accessibility, eu-consumer, local-business, rental, analytics`. Its repo assets adopt `nextjs`, `repo` and `ai-ready`.

**Dependencies between items:** an item can say `requires: [repo/brand-assets]`. While that one is red, its cell reads "blocked by brand assets" rather than plain red, and no worker is sent to it.

## 3. The catalog

Check kinds: `http` and `script` exist, as do `ai`, `repo` and `github`. **New** kinds are marked: `crawl`, `browser`, `psi`, `dns`.

### `website` v3: the floor (all `must` unless marked)
1. **meta-basics, og-image, icons, robots-sitemap, structured-data, llms-txt, security-headers, sitemap-health:** as today.
2. **og-video** `should`, `requires: [ai-ready/brand-assets]`: the worker makes the video from the repo's brand assets and design system (§4).
3. **first-screen** `must` (`browser` + `ai` on a mobile screenshot; replaces `hero`): an `h1`, a line under it saying what the site offers, and the main action are all in the first screen. It checks that each is there, not how well it's worded.
4. **canonical-host** (`http`): exactly one host answers 200. The other host (www or bare domain) and `http://` 301 to it in a single hop.
5. **not-found** (`http`): an unknown path answers 404, with a branded page that links home. A 200 (soft 404) or a 500 fails.
6. **tls** (`script`): the certificate is valid for 21 more days or longer, TLS 1.2+, no mixed content on the home page.
7. **html-lang** (`http`): `<html lang>` is set and matches the page's locale.

### `seo` (crawl: N pages sampled from the sitemap, one crawl shared by every item)
1. **titles** `must`: every page has a unique title, 30–60 characters.
2. **descriptions** `should`: unique, 70–160 characters.
3. **canonical-self** `must`: each page's canonical is absolute and points to itself, and that URL answers 200.
4. **one-h1** `should`: exactly one `h1` per page.
5. **hreflang** `must` for multilingual sites: reciprocal alternates, `x-default`, codes that match `lang`.
6. **internal-links** `must`: no internal link answers 4xx/5xx; no redirect chains.
7. **image-alt** `should`: content images have alt text.
8. **indexable** `must`: no `noindex` on pages in the sitemap; the sitemap lists only canonical 200 URLs, with `lastmod`.
9. **url-hygiene** `should`: lowercase URLs, one trailing-slash style, no duplicates through query strings.
10. **legacy-redirects** `must` (`http`): the URLs listed in the business context (old `.html`, `index.php`) 301 to their new pages.
11. **search-console** `should` (`mcp`, through just-agents' `mcp-gsc`): the property is verified, the sitemap is submitted, no coverage errors.
12. **breadcrumbs** `should`: inner pages carry a `BreadcrumbList`.

### `sharing`
1. **og-complete** `must`: `og:title`, description, url, type, site_name, locale (with alternates).
2. **og-image-size** `should`: 1200×630, under 5 MB; key pages (fleet, locations) have their own image.
3. **twitter-card** `should`: `summary_large_image`.
4. **og-video** (`website`).
5. **social-profiles** `nice`: footer links match the Organization's `sameAs`.

### `ai-visibility`
1. **llms-txt** (`website`), plus **llms-full** `nice`.
2. **ai-crawlers** `must`: `robots.txt` and the CDN (Vercel's bot protection, Cloudflare's "block AI bots") let GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot and Google-Extended through. A site is built for search engines and AI alike.
3. **server-rendered** `must`: prices, fleet, locations and contacts are in the HTML as served, not only after JS.
4. **entity-facts** `should` (`ai`): name, legal entity, addresses, phone and hours are stated in plain text, the same on every page and in JSON-LD.
5. **answers** `should` (`ai` + `crawl`): the site answers what a renter asks:
   - deposit, minimum age, insurance and excess;
   - cross-border travel, fuel policy, mileage;
   - payment cards, cancellation, young driver, one-way.

### `performance`
1. **cwv-field** `must` (`psi`, CrUX field data): mobile LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
2. **lighthouse** `should` (`psi`, lab): mobile performance ≥ 90, on the home page and one fleet or booking page.
3. **ttfb** `should` (`http` timing): < 800 ms on the home page.
4. **page-weight** `should` (`browser`): home page under 1.5 MB transferred, JS under 300 KB.
5. **images** `should`: AVIF/WebP, sized; the hero is the LCP element, with `priority`.
6. **static-cache** `should` (`http`): hashed assets are `immutable`; responses are br/gzip.
7. **third-party** `should` (`browser`): no render-blocking third-party script in `<head>`.
8. **no-console-errors** `should` (`browser`): no JS errors on home, fleet and booking.

### `accessibility` (EU Accessibility Act: online booking of transport and rental services for consumers is in scope)
1. **axe** `must` (`browser`, axe-core): no serious or critical violations on home, fleet, booking and contact.
2. **contrast** `must`: part of axe; called out because brand reds and greys often fail it.
3. **keyboard-booking** `must` (`browser`): the booking search form can be filled and sent with the keyboard alone, with visible focus.
4. **form-labels** `must`: every input has a label.
5. **skip-link and landmarks** `should`.
6. **reduced-motion** `nice`: carousels respect `prefers-reduced-motion`.
7. **accessibility-statement** `should`: a page saying how the service meets the requirements, linked in the footer.

### `eu-consumer` (every site, the Faroes included; see decision 5)
1. **cookie-consent** `must` (`browser`): with no choice made, no non-essential cookie is set and no tracker request leaves (GA, Meta, Hotjar…). Reject is as easy as accept.
2. **consent-mode** `must` (`browser`): Google Consent Mode v2, defaults denied.
3. **privacy-policy** `must`: linked in the footer of every page, in every site language.
4. **terms** `must`: rental terms (VOP) and a complaints procedure, linked and reachable before booking.
5. **company-identity** `must` (`ai` + `http`): name, registered seat, IČO, DIČ/IČ DPH and the business register entry, plus contact, on the site, as Slovak law on electronic commerce asks.
6. **adr-info** `should`: who handles disputes out of court (the SOI and ADR bodies). No stale link to the EU ODR platform, which closed in 2025.
7. **prices-with-vat** `must` (`ai` + `browser`): consumer prices include VAT, and the total (fees, insurance, deposit) shows before the customer commits.
8. **security-txt** `should` (`http`): `/.well-known/security.txt` with an expiry.
9. **email-auth** `must` (`dns`): SPF, DKIM and DMARC (`p=quarantine` or stricter) on the domain that sends booking confirmations.
10. **forms-protected** `should`: contact and booking forms carry a honeypot or captcha and are rate limited.

### `local-business`
1. **locations-schema** `must`: each pick-up point is an `AutoRental` with address, geo, `openingHoursSpecification` and telephone.
2. **location-pages** `should`: one indexable page per pick-up point (city, airport) with a map, hours and directions.
3. **nap-consistent** `should`: name, address and phone are the same on the site, in JSON-LD and in the Google Business Profile, linked through `hasMap` and `sameAs`.
4. **click-to-call** `must`: phone numbers are `tel:` links; email addresses are `mailto:`.
5. **hours-current** `should` (`ai`): holiday hours and notices are current, with no expired banners.

### `rental` (the vertical)
1. **booking-works** `must` (`browser`, a synthetic run): search a pick-up tomorrow at the main location; results load within 5 s and show at least one car with a price. This is the check that catches a broken Camasys link.
2. **fleet-data** `should`: every car or van class shown carries its seats, transmission, luggage and a "from" price in the HTML, and `Car` with an `Offer` in EUR in JSON-LD.
3. **location-coverage** `should` (`crawl`): every pick-up point in the business context has a page.
4. **faq** `should`: an FAQ page with `FAQPage` JSON-LD covering the answers listed in `ai-visibility/answers`.
5. **promo-freshness** `must` (`ai`): no expired promotion, wrong season or past date on any page.
6. **footer-year** `should` (`http`): the copyright year is the current one.
7. **primary-cta-mobile** `must` (`browser` + `ai` on a 390×844 screenshot): the search form or "find cars" is in the first screen.
8. **copy-language** `should` (`ai` on a sample of pages): correct Slovak with diacritics on `sk` pages; no English or Lorem left on localized pages.

### `analytics`
1. **analytics-present** `must` (`browser`): Umami or GA4 loads, after consent.
2. **conversions** `must` (`ai` + `repo`, later `mcp` through `mcp-ga4`): booking started, booking completed and contact form sent are tracked events.
3. **utm-kept** `should` (`browser`): UTM parameters survive the hop into the Camasys booking flow.
4. **search-console** (`seo`).

### `nextjs` (`repo` checks; the rules Next 16 projects keep breaking)
1. **no-segment-config** `must`: no `export const dynamic|revalidate|fetchCache|runtime` with `cacheComponents`. This is what broke acadsys PR #29.
2. **next-image** `should`: no raw `<img>` in `app/` or `sections/`.
3. **next-font** `should`: fonts through `next/font`, with `display: 'swap'`.
4. **use-cache** `should` (`ai` on the code): Strapi fetchers in `app/[lang]` are wrapped in `'use cache'`, with `cacheLife` and `cacheTag`.
5. **metadata-api** `should`: metadata comes from `generateMetadata`, not hand-written `<head>`.
6. **lint-clean** `must` (`script` in a temporary worktree): `biome check` and `tsc --noEmit` pass.
7. **framework-current** `should`: Next is within one major of the latest release; the three FO sites on 13.4 fail this until they are rebuilt.

### `ai-ready` (`repo` + `ai`: what an agent needs in a repo to work without asking)
1. **agents-md** `must`: `AGENTS.md` (or `CLAUDE.md`) says how to run, build, test and lint, where things live, and the rules of the house.
2. **design-system** `must`: tokens (colors, type, spacing, radii) and the components are documented in one place the agent can read (`docs/design.md`, a tokens file, a Storybook or Ladle index).
3. **brand-assets** `must`: the logo as SVG (light and dark), brand colors and fonts, and source photos or video sit in a known folder (`brand/` or `public/brand/`), with what each is for.
4. **commands-work** `must` (`script` in a temporary worktree): the documented install, typecheck and lint commands succeed on a fresh clone.
5. **env-example** `must`: `.env.example` lists every variable the code reads, with no values.
6. **content-source** `should`: where content comes from (CMS, files) and how to change it locally is written down.
7. **sites-map** `should` for a repo serving several sites: which folder or config is which site, and its domain.

That's about 100 items. Release 1 is the `must` items, about 45.

## 4. Instructions for the LLM: recipes that finish the job

**What went wrong with acadsys og:video:** the worker did what the recipe said. The recipe told it not to fake a video and to leave the file to a person, so it shipped tags pointing at a 404. The fix is in the recipes and in the engine, not in the prompt alone.

### 4.1 One recipe template (`packs/RECIPE.md`), checked by `standards validate`
```markdown
## Done when
The check passes on the preview, and <the human-visible outcome>.

## Make what is missing
How to produce each input yourself, with the tools listed.

## Stacks
Next 16 (cacheComponents), Payload, Astro: only what the repo's own AGENTS.md is unlikely to say.

## Hand off only when
A closed list: secrets, legal facts that are neither on the site nor in the business context, paid accounts. A missing design system or brand asset is not on it: that is a failing `ai-ready` item.

## Don't
<the traps>
```
`validate` fails a recipe that lacks "Done when" or "Hand off only when".

### 4.2 Make, don't defer
Recipes say how to produce what is missing:

Everything here is made from what the repo has (`ai-ready/design-system`, `ai-ready/brand-assets`). The worker never asks whether a person likes the result.

| item | how the worker makes it |
|---|---|
| og:video | Use a brand clip from the repo's brand folder. Otherwise build a short HTML scene from the design system and brand assets (logo, colors, a photo), or record the live hero. Record with Playwright (`recordVideo` at 1280×720, 6 s), cut a loop and encode it with ffmpeg (`libx264`, `-pix_fmt yuv420p`, `-movflags +faststart`, no audio, under 8 MB), and commit it under `public/og/`. |
| og:image | Render a 1200×630 HTML card (logo, headline, photo from the site) and screenshot it with Playwright. |
| icons | From the logo SVG with sharp or rsvg: 32, 180, 192, 512, maskable, plus `site.webmanifest`. |
| llms.txt | From the sitemap and the pages' content, in the site's language. |
| the line under the h1, FAQ answers, location pages | Written from facts on the site and in the business context only. |
| JSON-LD | From the business context (legal entity, locations, hours). |

### 4.3 Tools the worker has
- **A pack declares the tools it needs:** `tools: [ffmpeg, playwright, rsvg-convert]`.
- **Before the run, the engine checks they are installed.** A missing tool fails fast with an install hint; it does not end in a PR that pushes the work onto a person.
- **The prompt lists the tools that are there,** and the worker gets them in its allowed tools: `Bash(ffmpeg *)`, `Bash(npx playwright *)`.

### 4.4 Context the worker reads
- **`businesses/<id>.context.md`:**
  - brand and voice: the Avis franchise rules, what is never changed;
  - audience, languages per site, legal entity and IDs;
  - locations and hours, legacy URLs.
- **The repo's own `AGENTS.md`** is the stack context (see `ai-ready/agents-md`).
- **`stacks/<stack>.md`** adds only what the engine has learned across repos: for `next16`, no `export const dynamic` with cacheComponents, and use `'use cache'`.
- **Both go into the prompt, before the recipes.**

### 4.5 The engine verifies, and sends the worker back
- **After `finish`, the engine checks the run's items on the PR preview** (built in M7).
- **If a check still fails** and the worker reported nothing missing, or what it reported isn't on the hand-off list, the engine resumes the same session (`--resume <session>`): "`website/og-video` still fails on the preview: `/og/loop.mp4` answered 404. Make it pass, or explain why only a person can." There are at most two rounds.
- **A run is `done` only when its checks pass on the preview.** Otherwise it ends `incomplete`, with the evidence, and the PR stays a draft.

## 5. Engine and app work this needs

| # | what | why |
|---|---|---|
| E1 | **PR labels name the standards a PR touches**: `std:website/og-video`. A worker's PR gets one label per item it fixes, and a person can label their own PRs. Once a labeled PR is merged and its production deployment succeeds, `runs sync` re-checks only those items, on every asset of that repo. Nothing else is re-checked. | Several sites in one repo; PRs from people and other agents count too |
| E2 | Worktrees named `std-<asset>-<item>` | Two runs on different sites of one repo must not collide in `.worktrees/` |
| E3 | `category`, `severity`, `tools` on items and packs; `pages` / `per_page` for crawl | §2, §4.3 |
| E4 | Check kinds `crawl` (one shared, cached crawl per check run), `browser` (Playwright: axe, cookies before consent, console, weight, synthetic flows, screenshots for `ai`), `psi` (PageSpeed Insights API: CrUX + Lighthouse; the key is in `secrets.yml`), `dns` (DoH TXT/MX) | §3 |
| E5 | Business and stack context files in the prompt | §4.4 |
| E6 | Verify loop and the `incomplete` state | §4.5 |
| E7 | **Rollout**: one item on many assets. Assets in one repo get one run and one PR, with every site's URL and check in the prompt, so the fix lands in shared code once. Assets in different repos get a pilot run first; once you approve its PR, it becomes the reference for the rest, run two at a time. | The og:video-everywhere case from the start |
| E8 | **`standards spec <business> <asset>`**: every adopted item with its recipe, grouped by category, as one Markdown brief | For the rebuild: give the agent rebuilding a site the standards as its definition of done up front |
| E9 | Check cadence per item (`http` hourly, `crawl` daily, `psi` weekly) and the scheduled background run | Later; the grid stays fresh without clicks |
| A1 | Grid grouped by category, with a severity filter; a scorecard (sites × categories); the "perfect" badge | 95 columns don't fit in a flat grid |
| A2 | Rollout view: one item across assets, pilot first | E7 |
| A3 | Context editor: business context, in the business form | E5 |
| A4 | "Blocked by" cells for `requires` | §2 |

## 6. Order

1. **M8a, the model and the brief** (E1, E2, E3, E5, E8, `requires`): PR labels with targeted re-checks, categories, severity, dependencies, the business context, and `standards spec`. With this you can hand the agent rebuilding the sites `standards spec <business> <asset>` as its acceptance list before the first commit.
2. **M8b, catalog release 1** (E4 `crawl`, `dns` and `psi`; the `must` items of `website` v3, `seo`, `sharing`, `ai-visibility`, `eu-consumer`, `analytics`, `nextjs` and `ai-ready`). Recipes go on the new template, and og-video is rewritten per §4.2.
3. **M8c, verify loop and tools** (E6, §4.3), proved by redoing acadsys og:video until the file exists. acadsys first gets `ai-ready/brand-assets`.
4. **M8d, browser checks** (E4 `browser`): `accessibility`, `rental/booking-works`, consent and performance weight; plus A1, the grouped grid and scorecard, and A4.
5. **M8e, rollout** (E7, A2): `security-headers`, og:video and `not-found` on every site.
6. **Then:** the `should` and `nice` items, cadence and the scheduled run (E9), the context editor (A3).

## 7. Decisions (2026-11-21)
1. **Repo:** the rebuild is one new repo with no per-site branches. Each site is an asset on that repo, added in the app by hand.
2. **Sites:** added in the app by hand; the plan doesn't fix the list.
3. **AI crawlers:** allowed. A site is built for search and for AI.
4. **Media:** no approval step. The worker makes og:video and og:image from what the repo has. A repo without a design system or brand assets fails `ai-ready`. Standards find what's forgotten or broken; they don't judge taste.
5. **Faroe Islands:** `eu-consumer` applies to every site, the Faroes included. Faroese law isn't EU law, but the same rules (consent before trackers, company identity, accessibility) are good practice and cost nothing extra on a shared codebase. A cell that doesn't fit a site gets a waiver.
6. **Keys:**
   - PageSpeed Insights works without a key at our volume. An optional key in `secrets.yml` lifts the rate limit.
   - Search Console and GA4 come later, and release 1 doesn't need them. They will use a check kind `mcp`: call a tool on an MCP server and assert on its answer, with the server URL and bearer in `secrets.yml`. just-agents' `mcp-gsc` and `mcp-ga4` are such servers: containers that read Google through a service account, which must be added as a user of each Search Console property and GA4 property. Today just-agents and just-standards share no code and don't call each other.

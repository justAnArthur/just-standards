# M8b: catalog release 1

The second step of the [M8 plan](m8-plan.md): new check kinds, ten packs with 61 items, and every recipe on [the template](../packs/RECIPE.md).

## Check kinds
- **`crawl`:** the home page and `pages` (default 20) URLs sampled across the sitemap, on the asset's host. Each page is held to `http` expectations. `unique` on a `select` fails a value shared by two pages.
  - One process crawls a site once, and every crawl item reads the same pages.
  - The sitemap comes from robots.txt, then `/sitemap.xml`, then `/sitemap-index.xml`. Duplicate URLs and other spellings of the home page are dropped.
- **`dns`:** records of the asset's domain (its host without `www.`) over DNS-over-HTTPS. One record of a name that holds is enough.
- **`psi`:** PageSpeed Insights.
  - `field` is CrUX p75 for the page, else for the origin, else the lab run.
  - `lab` is the Lighthouse score.
  - One call per page and strategy per process. A `psi-key` in `secrets.yml` is needed in practice, since the keyless quota is shared and usually spent.
- **`repo`, new expectations:**
  - `glob` with `min`, `max` (`max: 0` forbids) and `except`;
  - `grep` over tracked files, with `in` and `none`.
- **`http`, new options:**
  - request `headers` (a crawler's user agent);
  - on `select`: `min_count` and `max_count`;
  - on any value: `optional` (missing passes) and `self` (resolves to the page itself).
- **`ai`:** keeps JSON-LD in the stripped HTML. A long page loses its middle, not its footer.
- **Text and attributes are decoded** (`&amp;` → `&`), so lengths and uniqueness are right.

## Packs

| pack | items (kind, severity) |
|---|---|
| `website` v3 | meta-basics, og-image, robots-sitemap, security-headers, sitemap-health, **canonical-host**, **not-found**, **tls**, **html-lang** (must); og-video (`requires: ai-ready/brand-assets`, `tools: ffmpeg`), icons, structured-data, llms-txt, hero (should) |
| `sharing` | og-complete (must); og-image-size, twitter-card (should) |
| `seo` | titles, canonical-self, hreflang, internal-links, indexable (must); descriptions, one-h1, image-alt, breadcrumbs (should); url-hygiene (nice) |
| `ai-visibility` | ai-crawlers, server-rendered (must); entity-facts, answers (should, ai) |
| `eu-consumer` | privacy-policy, terms, company-identity (ai), email-auth (dns) (must); adr-info (ai), security-txt (should) |
| `analytics` | analytics-present (must) |
| `performance` | cwv-field (psi, must); lighthouse (psi), ttfb, static-cache (should) |
| `nextjs` | no-segment-config (must); next-image, next-font, metadata-api, framework-current (should) |
| `ai-ready` | agents-md, design-system, brand-assets, env-example (must); content-source, sites-map (should, ai) |
| `repo` v2 | readme, no-env (must; no-env now fails any tracked `.env` file, not only the root one); the rest as before |

The AI checks ask whether something is there and true, never whether it is good:
- **`hero`:** a line saying what the site offers.
- **`company-identity`:** IČO, DIČ and the register entry.
- **`adr-info`:** a listed ADR body, not an arbitration clause.

`nextjs` and `ai-ready` apply to `repo` assets. Add a site's repo as its own asset with its local `path`, and the website's `og-video` waits on that repo's `brand-assets`.

## The rental sites today

`website`, `sharing`, `seo`, `ai-visibility`, `eu-consumer` and `analytics` on five sites, 2026-11-21: 102 pass, 88 fail, 0 errors, in 56 s.

| item | avis.sk | avisvan.sk | paylesscar.sk | avis.fo | acadsys.com |
|---|---|---|---|---|---|
| security-headers | ✕ | ✕ | ✕ | ✕ | ✓ |
| not-found | ✕ | ✕ | ✕ | ✕ | ✓ |
| og-complete | ✕ | ✕ | ✕ | ✕ | ✓ |
| og-image-size | ✕ | ✕ | ✕ | ✕ | ✓ |
| internal-links | ✕ | ✕ | ✕ | ✓ | ✓ |
| image-alt | ✕ | ✕ | ✕ | ✓ | ✓ |
| breadcrumbs | ✕ | ✕ | ✕ | ✓ | ✕ |
| entity-facts | ✕ | ✕ | ✕ | ✓ | ✕ |
| company-identity | ✕ | ✕ | ✕ | ✕ | ✓ |
| adr-info | ✕ | ✕ | ✕ | ✕ | ✕ |
| email-auth | ✕ | ✕ | ✕ | ✕ | ✕ |
| security-txt | ✕ | ✕ | ✕ | ✕ | ✕ |

What these failures are:
- **not-found:** a 404 page with an empty body until JavaScript runs; avis.fo answers 200 for any path.
- **og-image-size:** the share image is a logo (590×180), not a 1200×630 card.
- **internal-links:** old `.html` links that 404 or redirect twice.
- **image-alt:** alt text that is a file name.
- **company-identity:** no operator with an IČO on the site.
- **adr-info:** a private arbitrator instead of the SOI.
- **email-auth:** DMARC missing or `p=none`.

## Known gaps
- **Preview checks swap the asset's URL for the preview's,** so items that compare against the production host fail there:
  - sitemap URLs, canonicals and hreflang;
  - Vercel's own `x-robots-tag: noindex` on previews.
  - Passing the production URL to checks is for M8c.
- **Still missing:** browser-based items (cookie consent, consent mode, prices with VAT, booking flow, axe) come in M8d. `legacy-redirects` and `search-console` need the business context and the `mcp` kind.
- **DKIM isn't checked:** it needs the selector.

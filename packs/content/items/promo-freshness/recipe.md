## Done when
The check passes on the PR's preview, and no page presents an offer, a season, an event or an announcement whose date has passed as if it were current: what ended is gone from the banners, carousels and headlines (or reads as past news), and what runs states until when.

## Make what is missing
- Take every stale message from the evidence and find its source: a CMS entry (a banner, a slide, a promo collection), a hard-coded component, a translation file.
- Unpublish or archive the expired entries in the CMS, for every language. For hard-coded ones, remove them.
- **Stop it from happening again:** give promotions a `validUntil` (and `validFrom`) field and filter on it where they render, server-side, so an offer leaves the site on its own when it ends. Render the dates on the page ("platí do 30. 11. 2026").
- Don't replace an expired offer with a new one you made up: only take offers from the CMS or the business context. If nothing current exists, the slot shows the site's standing message or nothing.

## Stacks
- **Next.js:** filter in the server component that fetches the banners (`where: { validUntil: { greater_than: now } }`); with `'use cache'`, set `cacheLife` short enough (hours) that an offer disappears on the day it ends, or tag it and revalidate.
- **Payload:** add `validFrom`/`validUntil` date fields to the promo collection and a `where` on them in the query; optionally a scheduled job that unpublishes.
- **Strapi:** the same fields on the content type, filtered in the API query (`filters[validUntil][$gt]`).
- **Astro / static:** filter at build time and schedule a daily rebuild.

## Hand off only when
- The CMS that holds the offer isn't reachable with the credentials the worker has: name the entries to unpublish.
- Whether an offer still runs is a business fact found neither on the site nor in the business context (an undated "-30 %"): ask with the exact text.

## Don't
- Don't change the dates of an expired offer to make it current: that is a new offer, and a business decision.
- Don't fix it in one language only.

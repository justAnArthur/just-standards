## Done when
The check passes on the PR's preview, and the footer's copyright notice states the current year (or a range ending in it, `© 2015–2026`) in the HTML as served, and keeps doing so next year without anyone editing it.

## Make what is missing
- Compute the year where the footer renders, at render or build time, never as a hard-coded number in the CMS or the template.
- When the evidence says the slot is empty, the year is rendered only in the browser (a client component, a `useEffect`): render it on the server instead.

## Stacks
- **Next.js:** a server component in the footer, `{new Date().getFullYear()}`. Under `cacheComponents` (Next 16) `new Date()` in a server component must sit in a cached scope: put the year in a small `'use cache'` function with `cacheLife('days')`, or the footer's static shell rebuilds it at most daily. Don't move it into a client component to dodge the error: that is what leaves the slot empty as served.
- **Payload + Next:** when the notice text comes from a global (`"© {year} Acme"`), replace the token on the server where the footer renders; keep the year out of the stored text.
- **Astro / static:** `{new Date().getFullYear()}` in the layout runs at build time: the site needs a rebuild each January (a scheduled deploy) or the year goes stale; say so in the PR if there is none.

## Hand off only when
Never.

## Don't
- Don't type this year in: it is wrong again on 1 January.
- Don't remove the notice to pass the check.

## Done when
The check passes on the PR's preview: on an inner page, the language switcher's link to another language goes to the same page in that language (the page's hreflang alternate), not to that language's home. Pages that exist in one language only may link home.

## Make what is missing
Build the switcher's links from the same source as the page's hreflang alternates: the current route and its translated slugs (from the CMS or the routing config), so the two can't disagree.

## Stacks
- **Next.js:** next-intl's `Link` with `href={pathname}` and `locale={other}` keeps the path when slugs are shared; with translated slugs, use `pathnames` in `defineRouting`, or pass the alternates that `generateMetadata` computes down to the switcher. Render the switcher's links on the server, as real `<a href>`, so crawlers follow them.
- **Payload + Next:** read the document's slug in each locale (`locale: 'all'`) and link each one.
- **Astro:** `getRelativeLocaleUrl(locale, Astro.url.pathname)` or the content collection's translations.

## Hand off only when
Never.

## Don't
- Don't link to the other language's home "for now" when the page has a counterpart.
- Don't make the switcher a `<button>` that only JavaScript understands.

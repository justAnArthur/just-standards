## Done when
The check passes on the PR's preview, and every page that exists in several languages links each version, itself included, with `<link rel="alternate" hreflang>`: valid codes, an `x-default`, every target answering 200 and linking back. A single-language site passes without any.
Google only recommends `x-default` (a fallback for unmatched languages); this standard requires it, so add it.

## Make what is missing
- **One map per page, used in both directions:** for each document, its URL in every locale where a translation exists. Every version renders the whole map plus `x-default` (the default locale's version, or a language picker page), so A→B always comes with B→A.
- **Translated slugs:** the English URL of `/vozovy-park` is whatever the CMS calls it in English, not `/en/vozovy-park`. Read the slugs of all locales from the CMS or the route table.
- **No translation:** leave that language out of the map. Don't point it at the other language's home page.
- **Codes:** ISO 639-1 language, optionally an ISO 3166 region, with a hyphen: `sk`, `en`, `en-GB`, `de-AT`. Each page's own code matches its `<html lang>`.

## Stacks
- **Next.js:** `alternates.languages` in `generateMetadata`, from the map: `{ sk: '/vozovy-park', en: '/en/fleet', 'x-default': '/vozovy-park' }`, with `metadataBase` set so they come out absolute. Next renders `hrefLang`, which is the same attribute.
- **Payload + Next:** with localization on, fetch the document with `locale: 'all'` (or the slug field per locale) to build the map; skip locales where the document isn't published.
- **Astro:** a helper in the layout from `getRelativeLocaleUrl` per locale, or `i18n` in `@astrojs/sitemap` for the sitemap's alternates.

## Hand off only when
Nothing on this item needs a person: which translations exist is in the CMS or the routes.

## Don't
- Hard-code the alternates in the layout (every page then points at the other language's home page, and nothing is reciprocal).
- Use `en_GB`, `en-UK`, or a country code as a language (`cz` for Czech is `cs`).
- Link alternates that redirect, 404 or are `noindex`.

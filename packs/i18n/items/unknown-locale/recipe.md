## Done when
The check passes on the PR's preview: a path with a made-up language prefix (`/xx/`, `/zz-ZZ/`) answers 404 with the site's not-found page, not 200 (a page rendered for a language the site doesn't have) and not 500.

## Make what is missing
Validate the locale segment against the configured list before rendering, and call the framework's not-found for anything else.

## Stacks
- **Next.js (`app/[locale]`):** in `app/[locale]/layout.tsx`, `if (!routing.locales.includes(locale)) notFound()` (next-intl: `hasLocale(routing.locales, locale)`), and `export const dynamicParams = false` with `generateStaticParams` returning the locales, where the project allows segment config (not with `cacheComponents`: there, the `notFound()` check is the way). The middleware's `matcher` must not rewrite unknown prefixes onto the default locale.
- **Payload + Next:** the same, with the list from `localization.locales`.
- **Astro:** only configured locales get pages; check that a catch-all `[...slug].astro` doesn't render under any prefix.

## Hand off only when
Never.

## Don't
- Don't redirect unknown locales to the home page: that is a soft 404.
- Don't catch the error and render the default language under the made-up prefix.

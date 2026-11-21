## Done when
The check passes on the PR's preview: every language the home page declares (its `<html lang>`, its hreflang alternates, its switcher's links) has a home page that answers 200, in that language (`<html lang>` matches), without redirecting into another language.

## Make what is missing
- **A declared language that has no pages:** stop declaring it (remove it from the locales config, the switcher and the alternates) when the business context doesn't list it for this site; when it does, the locale must render, from the translations the repo has.
- **A locale home that errors:** usually a missing translation file or CMS locale; the evidence names the URL. Make missing keys fall back to the default language rather than throw.
- **A locale home that redirects to another language** (`/en` → `/`): the middleware doesn't know the locale, or a cookie overrides the URL. The URL's locale wins.

## Stacks
- **Next.js:** the locales list in the i18n config (`next-intl`'s `defineRouting`, or `i18n.locales`) is the single source the switcher, `generateStaticParams` and `alternates.languages` read.
- **Payload:** `localization.locales` in the Payload config; a locale with no content falls back with `fallback: true`.
- **Astro:** `i18n.locales` in `astro.config`, with a page under each.

## Hand off only when
Which languages a site should offer is neither in the business context nor evident from the repo's config.

## Don't
- Don't add a locale by machine-translating the whole site without the business context saying the site offers it.
- Don't fix a 500 by redirecting the locale to the default language: that is a language that isn't there.

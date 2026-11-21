## Done when
The check passes on the PR's preview, and every page's `<html lang>` is a BCP 47 tag (`sk`, `en`, `en-GB`, `fo`) naming the language the page is written in, so screen readers read it with the right voice and browsers and search engines know whom it is for.

## Make what is missing
Take the language from the page's own content and the site's locale config; on a multilingual site, from the locale of the route.

## Stacks
- **Next.js:** `<html lang={locale}>` in the root layout; under `app/[locale]`, the root layout lives in that segment (or reads the locale from `params`) so each language gets its own `lang`.
- **Payload + Next:** the locale codes come from the Payload localization config; map them to BCP 47 if they differ (`sk_SK` → `sk-SK`).
- **Astro:** `<html lang={Astro.currentLocale ?? 'sk'}>` in the layout.
- **Static:** the attribute in each page's `<html>`.

## Hand off only when
Never.

## Don't
- Don't hard-code one language in a layout shared by several sites or locales.
- Don't use `og:locale`'s underscore form (`sk_SK`) in `lang`.

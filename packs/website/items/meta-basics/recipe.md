## Done when
The check passes on the PR's preview, and the home page (and every page the framework makes cheap) carries its language on `<html lang>`, a title of 10–70 characters, a description of 50–170 characters (Google sets no length limit for either and cuts both to fit the device; these are this standard's budgets) and an absolute canonical URL on the production domain.

- **Title:** what the page is, then the brand: `Car rental software for independent fleets · Camasys`.
- **Description:** one plain sentence about what a visitor gets.
- **Canonical:** the page's own absolute URL on the production origin, without tracking parameters, in the trailing-slash and `www` form the site serves.

## Make what is missing
Write the title and description from what the site already says: its heading, its first paragraph, the business context. Keep every language version in step (Payload locales, i18n files, WPML).

## Stacks
- **Next.js:** `metadata` or `generateMetadata` in `app/layout.tsx` and the pages, with `metadataBase` set to the production origin and `alternates: { canonical: '/' }` (relative paths resolve against `metadataBase`). `lang` goes on `<html>` in the root layout, from the locale segment when there is one.
- **Payload + Next:** read title and description from the SEO fields (or the SEO global) in `generateMetadata`, falling back to the defaults.
- **Astro:** a shared `<Seo>` component or the layout's `<head>`; set `site` in `astro.config` so `new URL(Astro.url.pathname, Astro.site)` gives an absolute canonical.
- **Static HTML:** the tags in `<head>` of each page.

## Hand off only when
Never: everything here is made from the site's own content.

## Don't
- Don't point the canonical at a preview or staging host: build it from the production origin, not from the request's host.
- Don't invent claims, prices or numbers for the description.
- Don't set one site's title or canonical in shared code that serves several sites: read it from that site's config.

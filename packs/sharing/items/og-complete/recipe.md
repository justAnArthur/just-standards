## Done when
The check passes on the PR's preview, and a share card for the home page takes everything from the site rather than guessing: `og:title`, `og:description`, `og:url` (absolute, the page's own URL), `og:type` (`website` for the home page, `article` for posts), `og:site_name` and `og:locale` in Open Graph's `language_TERRITORY` form (`sk_SK`, `en_GB`), with `og:locale:alternate` for each other language the site has.

## Make what is missing
Everything comes from what the site already has: the title and description from the page's metadata, the site name from the brand, the locale from the page's `lang` and the business context's country. Set them once in the shared layout so every page inherits them, and per page only what differs (title, description, URL, type).

## Stacks
- **Next.js:** `metadata.openGraph = { title, description, url: '/', siteName, locale: 'sk_SK', alternateLocale: ['en_GB'], type: 'website' }` in the root layout, with `metadataBase` so `url` comes out absolute. A page's `openGraph` replaces the layout's whole object: a page that sets one repeats `siteName`, `locale` and `type` (spread a shared base object).
- **Payload + Next:** the site name and locales from the site-settings global and the Payload localization config, in `generateMetadata`; the page's own SEO fields for title and description.
- **Astro:** the tags in the shared `<Seo>` component, with `og:url` from `new URL(Astro.url.pathname, Astro.site)`.

## Hand off only when
Never: every value is on the site already.

## Don't
- Don't set `og:url` to the request's host or a preview URL: build it from the production origin.
- Don't write `og:locale` as `sk` or `sk-SK`: Open Graph expects `sk_SK`.
- Don't give every page the home page's `og:url`.

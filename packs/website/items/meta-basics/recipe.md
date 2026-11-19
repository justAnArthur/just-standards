Set these on the home page, and per page where the framework makes it cheap:

- `<html lang="…">` with the page language.
- `<title>`: 10–70 characters, what the page is, then the brand: `Car rental software for independent fleets · Camasys`.
- `<meta name="description">`: 50–170 characters, one plain sentence about what a visitor gets.
- `<link rel="canonical">`: the absolute URL of the page, on the production domain, without tracking parameters.

By stack:

- **Next.js (App Router), Payload + Next:** `export const metadata` (or `generateMetadata`) in `app/layout.tsx` and pages, with `metadataBase` set to the production origin and `alternates: { canonical: '/' }`. `lang` goes on `<html>` in the root layout. With Payload, read title and description from the SEO fields or global, falling back to the defaults.
- **Astro:** a shared `<Seo>` component or the layout's `<head>`; `Astro.site` must be set in `astro.config` so the canonical is absolute.
- **Static HTML:** write the tags into `<head>` of `index.html`.

Write copy from what the site actually says; don't invent claims.

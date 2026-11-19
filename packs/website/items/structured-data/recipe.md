Add one `<script type="application/ld+json">` to the home page with a schema.org `Organization` (or `Person` for a personal site) and a `WebSite`, in an `@graph`:

- Organization: `name`, `url`, `logo` (absolute), `sameAs` (the real social profiles linked from the site).
- WebSite: `name`, `url`.
- A product site may add `SoftwareApplication` or `Product`, with only facts the site states.

- **Next.js:** render it in the root layout or home page: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`.
- **Astro / static:** the same tag in `<head>`.

Validate the JSON parses. Never invent ratings, prices or reviews.

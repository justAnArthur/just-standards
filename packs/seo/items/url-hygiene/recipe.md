## Done when
The check passes on the PR's preview, and the sitemap lists each page once, on one origin, with a lowercase path, no query string, and one trailing-slash style throughout.

## Make what is missing
- **Uppercase paths** (`/Kariera`, `/sluzby/Deposity`): change the slug to lowercase at its source (the CMS document's slug, the route folder), and add a permanent redirect from the old URL so outside links keep working. Update internal links to the new URL (see `seo/internal-links`).
- **Query strings** in the sitemap (`?page=2`, `?lang=en`): list the clean URL of the page instead; a language belongs in the path, a filter isn't a page.
- **Two trailing-slash styles:** pick the one most URLs already use and the server serves without redirecting, set it once in the framework, and generate the sitemap from the same rule.
- **Duplicates:** a page listed twice or under two spellings is usually two sources (a static list plus the CMS) feeding one sitemap: dedupe by the canonical URL.

## Stacks
- **Next.js:** `trailingSlash` in `next.config`; `app/sitemap.ts` (or the route handler) builds every URL with the same helper as the canonical, and dedupes.
- **Payload + Next:** a slug field hook that lowercases and transliterates (`požičovňa` → `pozicovna` if the site's other slugs are ASCII); a migration for existing slugs, with redirects (the redirects plugin, if installed).
- **Astro / static:** `trailingSlash` in `astro.config`; `@astrojs/sitemap` follows it.

## Hand off only when
Nothing on this item needs a person.

## Don't
- Change a slug without a redirect from the old URL.
- Lowercase only in the sitemap: the page must answer at the URL the sitemap lists, without a redirect.
- Rename slugs that other sites in the same repo share without checking their pages.

## Done when
The check passes on the PR's preview, and every inner page (anything but the home page of a language) carries a schema.org `BreadcrumbList` in JSON-LD, from the home page to the page itself, each step with its name and URL. Search results then show the page's place in the site instead of a raw URL.

## Make what is missing
- **One function builds the trail from the route:** the home page, each parent section, the page itself. Names are the sections' own titles in the page's language (`Domov › Vozový park › Škoda Octavia`); URLs are absolute.
- **Where the site shows a visible breadcrumb**, render the JSON-LD from the same data. Where it doesn't, the JSON-LD alone is fine; add a visible one only if the design system has a breadcrumb component.
- `itemListElement`: `ListItem`s with `position` (from 1), `name` and `item` (the URL; optional on the last one).
- Put it in its own `<script type="application/ld+json">`, or in the page's existing `@graph`.

## Stacks
- **Next.js:** a server `<Breadcrumbs>` component (or a helper in the page) that renders `<script type="application/ld+json">` with `JSON.stringify`; the trail comes from the route segments and the documents' titles.
- **Payload + Next:** the parent chain from the nested-docs plugin's `breadcrumbs` field when the collection has it; otherwise the collection's listing page as the parent.
- **Astro / static:** the same script in the layout, from `Astro.url.pathname` and the page's title.

## Hand off only when
Nothing on this item needs a person: the trail is the site's own structure.

## Don't
- Put the same breadcrumb on every page, or one that skips straight from the home page when the URL has sections.
- List URLs that redirect or 404, or names that differ from the pages' own titles.
- Add `BreadcrumbList` to the home page.

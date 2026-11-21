## Done when
The check passes on the PR's preview: each location (from the JSON-LD and from the business context's "Locations" list) has its own indexable page (`/pobocky/kosice-letisko`, `/locations/vagar-airport`) that answers 200 and shows, in the HTML as served, the location's street address and its opening hours.

## Make what is missing
- One page per location, from one template: the name as `h1`, the address, the phone (a `tel:` link), the opening hours as a table of days, how to get there, a map link (see `local-business/map-link`), and the booking search with that location preselected if the booking widget allows it.
- Facts only from the business context, the site's branch data and its current contact page. Write the short "how to get there" text from what the site already says (airport terminal, parking); leave it out rather than invent.
- Link every location page from the contact page and the footer, and add them to the sitemap.
- Point each location's JSON-LD `url` at its page.

## Stacks
- **Next.js:** a dynamic route (`app/[locale]/pobocky/[slug]/page.tsx`) with `generateStaticParams` from the branch data, rendered on the server so the address and hours are in the HTML.
- **Payload + Next:** a `branches` collection with a `slug`; the page reads it by slug.
- **Astro / static:** `src/pages/pobocky/[slug].astro` with `getStaticPaths` over the branches data file.

## Hand off only when
A location's address or opening hours are neither on the site nor in the business context nor in the repo's data.

## Don't
- Don't render the address or hours only on the client (a map widget, a listbox): the check reads the HTML as served.
- Don't make one page list every branch and call it each branch's page; a business with several places needs a page each.
- Don't `noindex` the pages, and don't make thin copies that differ only in the city name: each shows its own facts.

## Done when
The check passes on the PR's preview: every location (branch, pick-up point, airport desk) is one JSON-LD node of a LocalBusiness subtype (`AutoRental` for car and van rental) with `name`, `address` as a `PostalAddress` (`streetAddress`, `postalCode`, `addressLocality`, `addressCountry`), `telephone`, `geo` (`latitude`, `longitude`), `openingHoursSpecification` and a `url` that answers 200. Every location the business context lists has its node.

## Make what is missing
- **Where the facts come from:** the business context's "Locations" list, the contact page and the site's own branch data (CMS or config). Never from memory or a map search.
- **Coordinates:** when no source in the repo or the context has them, take them from the map links the site already shows (`google.com/maps/place/62.0676,-7.2803`) or the CMS's branch record. Otherwise hand off (below).
- **Hours:** one `OpeningHoursSpecification` per run of days with the same hours (`dayOfWeek: ["Monday", …], opens: "08:00", closes: "21:00"`); a closed day is left out.
- **Address text:** a one-line address ("Ivanská cesta 5285/91, 821 04 Bratislava") splits into its parts; `addressCountry` is the ISO code (`SK`, `FO`).
- **The `url`:** the location's own page (see `local-business/location-pages`), never an internal ID path that 404s.
- **Where it goes:** each node on its location's page, and all of them on the contact page (an `@graph`, or `department` of the Organization). Give each an `@id` (`https://www.example.sk/pobocky/kosice-letisko#branch`) so pages can point at one another.
- A `Place` in a `contactPoint` doesn't count: turn it into an `AutoRental` node.

## Stacks
- **Next.js:** a `<script type="application/ld+json">` rendered by the server component of the page, built from the same branch data the page shows (`JSON.stringify` of a typed object), not a client component.
- **Payload + Next:** a `branches` collection (name, address fields, phone, lat/lng, hours array, slug) that both the page and the JSON-LD read.
- **Astro / static:** a branches data file; the layout of each location page renders its node.

## Hand off only when
A location's address, phone, opening hours or coordinates are neither on the site, nor in the business context, nor in the repo's data or CMS.

## Don't
- Don't invent or round coordinates, or guess hours; copy them.
- Don't use `LocalBusiness` with an address the business doesn't serve from (a registered office that isn't a branch).
- In a repo serving several sites, build the nodes from each site's own branch data; never copy one site's branches to another.

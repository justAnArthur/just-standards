## Done when
The check passes on the PR's preview: each location page (or, where there are none, the contact page, once per location) has a link to the location on Google Maps, Apple Maps or OpenStreetMap, or an embedded map.

## Make what is missing
- A "Show on map" / "Navigovať" link next to the address, built from the location's coordinates (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`) or its address, or its Google Business Profile's map URL from the business context.
- An embed is optional: a link is lighter and works on every phone; if the site embeds a map, load it after consent and keep the plain link as well.

## Stacks
- **Next.js:** a `MapLink` component in the location page's server component, from the branch data.
- **Payload + Next:** the `branches` collection's lat/lng (or a `mapUrl` field).
- **Astro / static:** the same link in the location page template.

## Hand off only when
A location's coordinates and address are neither on the site nor in the business context nor in the repo's data.

## Don't
- Don't link a search for the brand name only: it lands on another branch.
- Don't load a third-party map iframe before consent where the site needs consent for it.

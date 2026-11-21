## Done when
The check passes on the PR's preview: no page shows a holiday, seasonal or closure notice whose dates have all passed, and a location's regular hours are the same on every page that states them.

## Make what is missing
- Give every notice about hours an end date (`visibleUntil` in the CMS or the config) and hide it after that date on the server, so it can't outlive itself again.
- Remove or end-date the expired notices the check quoted. A news post about past hours may stay in the archive, but not as a banner or a "current" notice.
- When two pages state different hours for one location, the business context decides; otherwise the location's own branch data does. Render every place that shows hours from that one source.

## Stacks
- **Next.js:** filter notices by date in the server component (with `'use cache'`, give it a `cacheLife` short enough that the notice drops off on time, or revalidate on a schedule).
- **Payload + Next:** `visibleFrom` / `visibleUntil` fields on the notice or banner collection, filtered in the query.
- **Astro / static:** filter at build time and rebuild daily, or filter on the client as a fallback.

## Hand off only when
The current hours of a location are neither on the site (in its branch data) nor in the business context, and the only statement of them is the expired notice.

## Don't
- Don't change the hours themselves unless two sources on the site disagree; the check is about expired notices, not about what the hours should be.
- Don't delete news archive posts that are dated history.

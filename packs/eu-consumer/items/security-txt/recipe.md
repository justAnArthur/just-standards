## Done when
The check passes on the PR's preview: `/.well-known/security.txt` answers 200 as `text/plain`, with a `Contact:` (a `mailto:` or an https URL) and an `Expires:` date less than a year ahead (RFC 9116).

## Make what is missing
- Write the file:
  ```
  Contact: mailto:security@<domain>
  Expires: <ISO 8601 date, 11 months from today>T00:00:00.000Z
  Preferred-Languages: sk, en
  Canonical: https://<host>/.well-known/security.txt
  ```
- Use the contact the business context gives for security or IT; otherwise the site's general e-mail.
- Generate `Expires` at build time (a route that adds 11 months to the build date) so it never goes stale; a static file needs renewing before it expires.

## Stacks
- **Next.js:** `app/.well-known/security.txt/route.ts` returning `text/plain` with the computed date, or `public/.well-known/security.txt`. In a repo with `[locale]` routing, make sure the middleware does not rewrite `/.well-known`.
- **Astro / static:** `public/.well-known/security.txt`, or an endpoint `src/pages/.well-known/security.txt.ts`.

## Hand off only when
Never: the site's own e-mail is a valid contact.

## Don't
- Don't serve the site's HTML 404 page or a soft 200 there.
- Don't set `Expires` years ahead: the RFC recommends under a year.

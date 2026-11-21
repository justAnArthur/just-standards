## Done when
The check passes on the PR's preview, and every cookie the site sets (on the home page and the sampled pages) has `Secure` and a `SameSite` (`Lax` unless it must travel on cross-site requests, then `None; Secure`), and every session or login cookie also has `HttpOnly`.

## Make what is missing
Find where each cookie the evidence names is set: the i18n middleware (`NEXT_LOCALE`), the auth library, the CMS, an A/B test. Set the flags there, through the library's own cookie options.

## Stacks
- **Next.js:** `response.cookies.set(name, value, { secure: true, sameSite: 'lax', httpOnly: true, path: '/' })` in middleware or route handlers; `cookies().set(...)` in server actions. `next-intl`'s locale cookie takes `localeCookie: { secure: true, sameSite: 'lax' }` in `defineRouting`.
- **Payload:** `auth.cookies` on the users collection (`secure: true`, `sameSite: 'Lax'`); Payload's token cookie is HttpOnly by default.
- **Astro:** `Astro.cookies.set(name, value, { secure: true, sameSite: 'lax', httpOnly: true })`.

## Hand off only when
The cookie is set by a third party the site embeds (a chat widget, a booking iframe on another domain): name it; it is the vendor's to fix.

## Don't
- Don't set `Secure` only in production builds behind an env check that previews miss: previews are HTTPS too.
- Don't make a cookie HttpOnly that client code reads on purpose (a theme or consent cookie read by script): Secure and SameSite are enough there.

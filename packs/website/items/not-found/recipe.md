## Done when
The check passes on the PR's preview, and a visitor or crawler asking for a page that doesn't exist gets status 404 (not 200, not a redirect to the home page, not a 500) with a page in the site's own look, served as HTML, that says the page isn't there and links home (`/`, or the locale's home such as `/sk`), ideally also to search, the main sections and contact.

## Make what is missing
Build the page from the site's own layout and design system: the header and footer, a short heading in the site's language ("Stránka sa nenašla"), one sentence, and the links. Every language version gets its own copy.

## Stacks
- **Next.js:** `app/not-found.tsx` (and `app/[locale]/not-found.tsx` under a locale segment), rendered on the server, so the link is in the HTML as served; a catch-all route (`[...slug]`) must call `notFound()` for an unknown slug rather than render an empty page. When the 404's `<body>` is empty as served, the not-found page is rendered only on the client: render it as a server component inside the root layout, and make sure nothing above it suspends without a fallback.
- **Payload + Next:** the page route calls `notFound()` when the CMS finds no document for the slug.
- **Astro:** `src/pages/404.astro`; static hosts serve it with status 404.
- **GitHub Pages:** a `404.html` at the root of the published folder (for a project site, the project's root).

## Hand off only when
Never.

## Don't
- Don't redirect unknown paths to the home page: that is a soft 404.
- Don't render the 404 through a page that answers 200 (a CMS "not found" document served as a normal page).
- Don't make the 404 page depend on JavaScript to show its content.

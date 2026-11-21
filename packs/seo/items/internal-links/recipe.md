## Done when
The check passes on the PR's preview, and every link from one page of the site to another answers 200, directly or through a single redirect: no 404s, no 5xx, no chains of redirects.

## Make what is missing
- **Find each link's source:** a hard-coded `href` in a component, a menu or footer entry in the CMS, or a link inside rich text (blog posts and news often carry old URLs: `.html` pages, `/sk/` prefixes, the bare domain or `http://`).
- **Links in content:** rewrite them to the final URL, in the content itself (a one-off script or migration over the CMS documents), not only in the rendering. Run it for every locale.
- **A page that moved:** link its new URL. Keep a redirect for outside links, straight to the final URL in one hop (old → new, not old → `/sk/old` → new).
- **A document that's gone** (a PDF, an old offer): link the current version if the repo, the CMS media or the site has one; otherwise remove the link and the sentence that offers it.
- **A link that isn't a URL** (a phone number in an `href` without `tel:`, an email without `mailto:`): give it its scheme.

## Stacks
- **Next.js:** redirects in `next.config` `redirects()` with `permanent: true` and the final destination; links with `next/link` to paths from the route table rather than strings.
- **Payload + Next:** a migration (`payload migrate:create`) that rewrites URLs in rich-text fields; the link field type for menus so editors pick documents, not URLs.
- **Astro / static:** `redirects` in `astro.config` or the host's redirect file (`vercel.json`, `_redirects`), one hop each.

## Hand off only when
A linked document is legally required (terms, a complaints form) and exists neither in the repo, the CMS, the site nor the business context: say which document and where it's linked.

## Don't
- Redirect unknown URLs to the home page (a soft 404), or hide broken links with `rel="nofollow"` or CSS.
- Delete content to get rid of a link that has a working replacement.
- Change redirects other sites in the same repo rely on without checking them.

## Done when
The check passes on the PR's preview, and every page in the sitemap (and the home page) has exactly one `<link rel="canonical">` with its own absolute URL, on the production host, in the spelling the site serves (www or not, trailing slash or not).

## Make what is missing
- One function builds the canonical from the route's path and the production origin; every page uses it.
- With locales in the path, the canonical keeps the page's own locale prefix: `/en/fleet` names `/en/fleet`, not `/fleet`.
- **A page that is a copy of another** (a filter or sort URL, a print view, an old URL kept alive) canonicalizes to the original, and so it isn't in the sitemap: take it out of the sitemap rather than give it a self-canonical. The check reads only sitemap pages, which are all meant to rank on their own.
- **Two canonicals on one page** (layout and page both render one, or a CMS block adds another): keep the one from the metadata, remove the other. Search engines ignore both when they disagree.

## Stacks
- **Next.js:** `metadataBase` set to the production origin in the root layout, and `alternates: { canonical: <the page's own path> }` in each page's `generateMetadata`. A `canonical: '/'` in the root layout is inherited by every page that doesn't set its own, and points them all at the home page.
- **Payload + Next:** the path comes from the document's slug (and locale); documents with a "canonical URL" override use it only when it is set, and those documents are left out of the sitemap.
- **Astro / static:** `new URL(Astro.url.pathname, Astro.site)` in the layout's `<head>`, with `site` set in `astro.config`.

## Hand off only when
Nothing on this item needs a person. Which host is canonical is the one that answers 200 (see `website/canonical-host`), not a choice to ask about.

## Don't
- Canonicalize every page to the home page, or to the default language's version of a translated page.
- Use a relative URL, a preview or staging host, `http://`, or tracking parameters.
- Hide the failure by dropping pages from the sitemap that should rank.

## Done when
The check passes on the PR's preview, and an AI tool reading `/llms.txt` gets a short, true map of the site in the llmstxt.org format: an `# H1` with the site name, a `> ` one-paragraph summary, then `## ` sections of Markdown links to the most useful pages, each with a short note.

## Make what is missing
Build it from the sitemap and the pages' own content, in the site's main language: what the business is, who it serves, where it operates, and links to the pages a customer needs (offer, prices, locations, contact, terms, FAQ). Keep it under a few hundred lines. For a CMS-driven site, generate it so new pages appear without a hand edit.

## Stacks
- **Next.js:** `public/llms.txt`, or a route handler `app/llms.txt/route.ts` (outside any `[locale]` segment) that builds it from the routes.
- **Payload + Next:** the route handler reads the published pages and the site-settings global.
- **Astro / static:** `public/llms.txt`.

## Hand off only when
Never.

## Don't
- Don't write facts from memory: every claim comes from the site or the business context.
- Don't link to pages that 404 or redirect, or to another site's host.

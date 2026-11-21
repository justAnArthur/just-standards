## Done when
The check passes on the PR's preview, and every page in the sitemap has its own `<title>` in `<head>`, 10–70 characters: what the page is first, then the brand (`Škoda Octavia Combi rental · Avis`), never the same text as another page.

## Make what is missing
- **Static pages** (contact, about, fleet): write the title from the page's own `h1` and first paragraph.
- **Collections** (cars, branches, posts): one template per collection from the document's own fields (`<model> rental`, `<branch city> branch`, the post's headline), plus the brand suffix. A CMS SEO title, when set, wins over the template.
- **Too long:** rewrite to the subject, don't cut. A 160-character blog headline becomes its topic in a few words; keep the headline in the `h1`.
- **Duplicates:** two pages with one title are usually a template that ignores the document (every post titled after the blog) or two URLs of one page. Fix the template; for two URLs of one page, see `seo/canonical-self` and `website/sitemap-health`.

## Stacks
- **Next.js:** `title: { template: '%s · Brand', default: 'Brand · what it is' }` in the root layout's `metadata`, and `title` from `generateMetadata` on every dynamic route. The title must be in the HTML as served, in `<head>`: if it shows up in `<body>` instead (metadata streamed after the shell), resolve it without suspending, or set `htmlLimitedBots` in `next.config` so crawlers get it up front.
- **Payload + Next:** read `meta.title` (the SEO plugin's field) in `generateMetadata`, falling back to the collection template; the brand suffix comes from the site's settings global, not a literal.
- **Astro / static:** a `title` prop on the layout, required, rendered in `<head>`.

## Hand off only when
Nothing on this item needs a person: every title is written from the page's own content and the brand name the site already uses.

## Don't
- Make titles unique with numbers, paths or "page 2"; that passes the check and tells a searcher nothing.
- Cut a title mid-word with `…`, or stuff it with keywords and city lists.
- Change the brand suffix in shared code for every site at once: in a repo that serves several sites, each site's brand comes from its own config.

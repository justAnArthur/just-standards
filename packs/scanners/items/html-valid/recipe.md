## Done when
The check passes on the PR's preview: the Nu Html Checker reports no error on the home page and the two sampled pages, and the pages look and behave as before.

## Make what is missing
- The evidence names each error as `path:line: message`. The line is in the HTML as served, not in the source: fetch the page (`curl -s <preview-url><path> | sed -n '<line>p'`) to see the markup, then find the component that renders it.
- Validate any page yourself while you work: `curl -s <url> | curl -s -H 'Content-Type: text/html; charset=utf-8' --data-binary @- 'https://validator.w3.org/nu/?out=gnu'`, at most one request a second.
- Fix the cause in the shared component (layout, header, footer, card), so every page gets it, rather than page by page.
- The usual ones: an element where its parent doesn't allow it (`div` in `p` or `ul`, a link inside a link, a `button` inside an `a`); a duplicate `id`; an attribute the element doesn't take (`width="auto"`, `align`); a `meta` or `link` outside `head`; an empty `src`/`href`; an `img` without `alt`; a stray end tag.

## Stacks
- **Next.js / React:** errors in markup that comes from a CMS's rich text belong in the rich-text renderer, not in the content. Attributes React writes (`fetchpriority`, `precedence`) are valid; an error naming one is usually a typo or a wrong element.
- **Payload + Next:** the Lexical / Slate serializer in the repo renders the CMS's HTML.

## Hand off only when
The error is in markup a third party injects (a booking widget, a consent banner, a chat) that the repo can't change: name the vendor and the error.

## Don't
- Don't change the content to hide an error the code makes.
- Don't remove an element or attribute that something depends on (analytics, tests, structured data) just to silence the checker: move or rename it to a valid one.
- Don't send the checker a request per page in a loop: it is a public service.

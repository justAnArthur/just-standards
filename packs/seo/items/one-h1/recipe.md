## Done when
The check passes on the PR's preview, and every page has exactly one `h1`: the page's subject, as the visitor sees it at the top of the content.

## Make what is missing
- **No `h1`:** promote the page's main visible heading (often an `h2` or a styled `div`) to `h1`. A page whose design has no heading gets one from its title, visually hidden only when the design truly has no place for it.
- **Two or more:**
  - a logo or site name in the header marked `h1`: make it a link or a `p`;
  - a heading rendered twice for mobile and desktop: render it once and change its layout with CSS;
  - a hero carousel with one `h1` per slide: the first slide's heading or the page subject is the `h1`, the slides use `h2` or `p`;
  - CMS rich text containing `h1`: map rich-text `h1` to `h2` in the serializer.
- Keep the visual style: change the element, keep the classes.

## Stacks
- **Next.js / React:** a shared `<PageHeading>` component that renders the `h1`, used once per page; section components take a heading level prop instead of hard-coding `h1`.
- **Payload + Next:** the rich-text converter maps `h1` nodes to `h2`; a hero block's title is the `h1` only when it is the page's first block.
- **Astro / static:** the layout or page template owns the `h1`; components below it start at `h2`.

## Hand off only when
Nothing on this item needs a person: the heading text is already on the page.

## Don't
- Pass the check with an empty or hidden `h1` while the visible heading stays a `div`.
- Change the heading's look; only its element.
- Fix one page's template by changing a component that other sites in the same repo render, without checking their pages too.

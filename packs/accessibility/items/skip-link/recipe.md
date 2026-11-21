## Done when
The check passes on the PR's preview: on the home page, the first or second Tab focuses a link such as "Skip to content" (in the page's language) that becomes visible when focused and points at an element that exists, the main content.

## Make what is missing
- Add, as the first element of `<body>` in the shared layout: `<a href="#main" class="skip-link">{t('skipToContent')}</a>`, and `id="main"` (with `tabindex="-1"` so focus moves there) on the `<main>` element of every layout.
- Hide it until focused, not with `display: none`: `.skip-link { position: absolute; left: 1rem; top: -100px } .skip-link:focus { top: 1rem; z-index: 1000 }`, styled with the design system's button tokens.
- Translate the label for every locale: "Preskočiť na obsah" (sk), "Skip to content" (en), "Zum Inhalt springen" (de), and Faroese from the site's translations.

## Stacks
- **Next.js (App Router):** in `app/[lang]/layout.tsx`, before the header; the label from the dictionary the layout already loads.
- **Payload + Next:** the same layout; the label can live in the site's translations, not in a Payload global.
- **Astro / static:** the base layout.

## Hand off only when
Never: the link and its label come from the repo.

## Don't
- Don't use `display: none` or `visibility: hidden` on the focused state: it must appear.
- Don't point it at `#` or an id no layout renders.
- Don't put the cookie banner before it in the DOM order of the layout.

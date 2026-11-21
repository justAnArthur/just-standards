## Done when
The check passes on the PR's preview: axe-core (WCAG 2.2 A and AA rules, axe's best practices left out) finds no serious or critical violation on the home page and two pages from the sitemap, at 1366×900. A screen reader names every control, link and image, and text meets contrast.

## Make what is missing
Reproduce on the dev server: run axe in Chrome's console (`await import('https://cdn.jsdelivr.net/npm/axe-core/axe.min.js'); (await axe.run({ runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] })).violations`) or with Playwright, which the repo may already have. The evidence names each rule and how many nodes fail; fix by rule:
- **color-contrast:** change the token, not the one element: darken the brand grey or red in the design system until text reaches 4.5:1 (3:1 for 24 px+ or 19 px+ bold). Check every component that uses it. Brand colours that can't change get a darker text variant.
- **link-name / button-name:** icon-only links and buttons (social icons, the hamburger, carousel arrows, the logo link) get an `aria-label` in the page's language, from the locale's translations.
- **image-alt:** content images get alt text from the CMS (the image's own alt field, else the car's or location's name); decorative ones `alt=""`.
- **label / select-name:** every input and select has a `<label for>` or `aria-label`; a placeholder is not a label.
- **aria-*:** remove ARIA that doesn't fit the element rather than adding more.
- **frame-title, html-has-lang, document-title:** one attribute each.

## Stacks
- **Next.js:** `next/image` requires `alt`; pass the CMS field through. Shared components (`Button`, `IconButton`) take a required `label` prop so the type system stops the next unnamed button.
- **Payload + Next:** make the media collection's `alt` field required, with a migration filling existing rows from the file's title.
- **Astro / static:** fix the layout and components; `astro check` doesn't catch these.

## Hand off only when
A violation is inside a third party's embedded widget (a booking engine iframe, a map, a chat) that the repo can't change: name the vendor and the rule in the PR, and fix everything else.

## Don't
- Don't hide failing elements with `aria-hidden` or `role="presentation"` when they carry content or are focusable.
- Don't fix contrast by overriding one element's colour inline: the next page reuses the token.
- Don't exclude rules or pages from the check.
